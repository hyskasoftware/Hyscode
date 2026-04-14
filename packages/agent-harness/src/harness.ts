// ─── Harness ────────────────────────────────────────────────────────────────
// The main orchestration engine that powers agentic behavior.
// Implements the observe → think → plan → act → update loop.

import type { Message } from '@hyscode/ai-providers';
import { getProviderRegistry } from '@hyscode/ai-providers';
import type {
  HarnessConfig,
  HarnessEvent,
  HarnessEventHandler,
  AgentType,
  ToolCallRecord,
  ConversationMode,
  ToolExecutionContext,
  ToolHandler,
  Skill,
} from './types';
import { DEFAULT_HARNESS_CONFIG } from './types';
import { ContextManager } from './context-manager';
import { ToolRouter } from './tool-router';
import { getAllBuiltinTools } from './tools';
import { getAgentDefinition } from './agents';
import { SkillLoader } from './skill-loader';
import type { SddDatabase } from './sdd-engine';
import { SddEngine } from './sdd-engine';

export interface HarnessOptions {
  config?: Partial<HarnessConfig>;
  workspacePath: string;
  projectId: string;
  /** Tauri invoke function */
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  /** Tauri event listener function */
  listen?: (event: string, handler: (payload: unknown) => void) => Promise<() => void>;
  /** Event handler for UI updates */
  onEvent?: HarnessEventHandler;
  /** Approval callback */
  onApprovalRequest?: (pending: { id: string; toolName: string; input: Record<string, unknown>; description: string }) => Promise<boolean>;
  /** SDD database interface */
  sddDb?: SddDatabase;
  /** Skill loader config */
  skillLoader?: SkillLoader;
}

export class Harness {
  private config: HarnessConfig;
  private contextManager: ContextManager;
  private toolRouter: ToolRouter;
  private skillLoader: SkillLoader | null;
  private sddEngine: SddEngine | null = null;
  private eventHandler: HarnessEventHandler | null;
  private invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  private listen: ((event: string, handler: (payload: unknown) => void) => Promise<() => void>) | undefined;
  private workspacePath: string;
  private projectId: string;
  private conversationId = '';
  private _mode: ConversationMode = 'agent';
  private agentType: AgentType = 'build';
  private cancelled = false;
  private abortController: AbortController | null = null;
  private toolCallHistory: ToolCallRecord[] = [];
  private activeSkills: Skill[] = [];

  constructor(options: HarnessOptions) {
    this.config = { ...DEFAULT_HARNESS_CONFIG, ...options.config };
    this.workspacePath = options.workspacePath;
    this.projectId = options.projectId;
    this.invoke = options.invoke;
    this.listen = options.listen;
    this.eventHandler = options.onEvent ?? null;
    this.skillLoader = options.skillLoader ?? null;

    // Initialize context manager
    this.contextManager = new ContextManager();

    // Initialize tool router
    this.toolRouter = new ToolRouter();
    this.toolRouter.setApprovalConfig(this.config.approval);
    if (this.eventHandler) {
      this.toolRouter.setEventHandler(this.eventHandler);
    }
    if (options.onApprovalRequest) {
      this.toolRouter.setApprovalCallback(async (pending) => {
        return options.onApprovalRequest!({
          id: pending.id,
          toolName: pending.toolName,
          input: pending.input,
          description: pending.description,
        });
      });
    }

    // Register built-in tools
    for (const tool of getAllBuiltinTools()) {
      this.toolRouter.register(tool);
    }

    // Initialize SDD engine if database provided
    if (options.sddDb) {
      this.sddEngine = new SddEngine({
        db: options.sddDb,
        eventHandler: this.eventHandler ?? undefined,
        runAgentTurn: (addon, msg) => this.runSingleTurn(addon, msg),
      });
    }
  }

  // ─── Configuration ──────────────────────────────────────────────────

  setMode(mode: ConversationMode): void {
    this._mode = mode;
  }

  setAgentType(type: AgentType): void {
    this.agentType = type;
    const agentDef = getAgentDefinition(type);
    this.contextManager.setAgent(agentDef);
  }

  setConversationId(id: string): void {
    this.conversationId = id;
  }

  cancel(): void {
    this.cancelled = true;
    this.abortController?.abort();
  }

  setConfig(patch: Partial<Pick<HarnessConfig, 'providerId' | 'modelId'>>): void {
    if (patch.providerId !== undefined) this.config.providerId = patch.providerId;
    if (patch.modelId !== undefined) this.config.modelId = patch.modelId;
  }

  getSddEngine(): SddEngine | null {
    return this.sddEngine;
  }

  // ─── External Tool Registration (MCP, extensions) ───────────────────

  /** Register an external tool (e.g. from MCP server) into the tool router */
  registerExternalTool(handler: ToolHandler): void {
    this.toolRouter.register(handler);
  }

  /** Unregister a tool by name */
  unregisterTool(name: string): void {
    this.toolRouter.unregister(name);
  }

  /** Add a context source (e.g. attached file, selection, etc.) */
  addContextSource(source: import('./types').ContextSource): void {
    this.contextManager.addSource(source);
  }

  /** Remove a context source by ID */
  removeContextSource(id: string): void {
    this.contextManager.removeSource(id);
  }

  /** Get the skill loader (for external callers to list skills) */
  getSkillLoader(): SkillLoader | null {
    return this.skillLoader;
  }

  // ─── Skills ─────────────────────────────────────────────────────────

  async loadSkills(): Promise<void> {
    if (!this.skillLoader) return;
    await this.skillLoader.loadAll();

    // NOTE: We do NOT auto-activate skills here.
    // The skills store (frontend) is the single source of truth for which
    // skills are enabled. HarnessBridge.syncActiveSkills() is called before
    // each run() to push the store state into the harness.
    this.activeSkills = this.skillLoader.getActive();
    this.contextManager.setActiveSkills(this.activeSkills);
    this.contextManager.setAllSkills(this.skillLoader.getAll());
  }

  // ─── Main Agent Loop ────────────────────────────────────────────────

  /**
   * Run a full agent turn: user sends a message, agent responds (possibly with tool calls).
   * Returns the final assistant text response.
   */
  async run(userMessage: string, history: Message[]): Promise<{ response: string; toolCalls: ToolCallRecord[] }> {
    this.cancelled = false;
    this.toolCallHistory = [];

    // In SDD mode, delegate to runSdd
    if (this._mode === 'sdd') {
      const review = await this.runSdd(userMessage);
      return { response: review, toolCalls: this.toolCallHistory };
    }

    // In chat mode, override to chat agent
    if (this._mode === 'chat' && this.agentType !== 'chat') {
      this.setAgentType('chat');
    }

    // NOTE: Skill triggers are intentionally skipped here.
    // The skills store controls which skills are active. Trigger-based
    // auto-activation would bypass user preferences. The agent can still
    // use the activate_skill tool to request skill activation.

    // Set conversation history
    this.contextManager.setHistory(history);

    // Add user message to history
    const userMsg: Message = {
      role: 'user',
      content: [{ type: 'text', text: userMessage }],
    };
    this.contextManager.addMessage(userMsg);

    // Agent loop
    const agentDef = getAgentDefinition(this.agentType);
    let iteration = 0;
    let finalResponse = '';
    let consecutiveIdenticalCalls = 0;
    let lastToolCallSignature = '';

    while (iteration < this.config.maxIterations && !this.cancelled) {
      iteration++;
      this.emit({ type: 'turn_start', conversationId: this.conversationId, iteration });

      // Build context snapshot
      const tools = this.toolRouter.getToolDefinitionsFiltered(
        agentDef.allowedToolCategories,
        agentDef.toolOverrides,
      );
      const snapshot = this.contextManager.buildSnapshot(
        tools,
        this.config.maxInputTokens,
        agentDef.maxOutputTokens,
      );

      // Call LLM
      const registry = getProviderRegistry();

      // Turn timeout enforcement
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const abortController = new AbortController();
      this.abortController = abortController;

      const chatParams = {
        model: this.config.modelId,
        messages: snapshot.messages,
        systemPrompt: snapshot.systemPrompt,
        tools: snapshot.tools,
        maxTokens: agentDef.maxOutputTokens,
        signal: abortController.signal,
      };

      let assistantText = '';
      let toolCalls: Array<{ id: string; name: string; input: Record<string, unknown>; _rawInput?: string }> = [];

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(new Error(`Turn timeout after ${Math.round(this.config.turnTimeoutMs / 1000)}s`));
        }, this.config.turnTimeoutMs);
      });

      try {
        await Promise.race([
          (async () => {
            for await (const chunk of registry.chat({
              ...chatParams,
              providerId: this.config.providerId || undefined,
            })) {
          this.emit({ type: 'stream_chunk', chunk });

          switch (chunk.type) {
            case 'text_delta':
              assistantText += chunk.text;
              break;
            case 'thinking_delta':
              // Thinking text is emitted for UI display only — not added to assistantText
              break;
            case 'tool_call_start':
              toolCalls.push({
                id: chunk.id,
                name: chunk.name,
                input: {},
              });
              break;
            case 'tool_call_delta': {
              const tc = toolCalls.find(t => t.id === chunk.id);
              if (tc) {
                // Accumulate incremental JSON input
                tc._rawInput = (tc._rawInput || '') + chunk.input;
              }
              break;
            }
            case 'tool_call_end': {
              const tc = toolCalls.find(t => t.id === chunk.id);
              if (tc && tc._rawInput) {
                try { tc.input = JSON.parse(tc._rawInput); } catch { /* keep empty */ }
              }
              break;
            }
            case 'done':
              // stopReason is tracked by the provider but the loop
              // relies solely on toolCalls.length to decide continuation.
              break;
            case 'error':
              throw new Error(chunk.error);
          }
        }
          })(),
          timeoutPromise,
        ]);
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        this.emit({
          type: 'turn_end',
          reason: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      // Add assistant response to history
      const assistantMsg: Message = {
        role: 'assistant',
        content: [
          ...(assistantText ? [{ type: 'text' as const, text: assistantText }] : []),
          ...toolCalls.map((tc) => ({
            type: 'tool_call' as const,
            id: tc.id,
            name: tc.name,
            input: tc.input,
          })),
        ],
      };
      this.contextManager.addMessage(assistantMsg);

      // If no tool calls, we're done — the LLM gave a final text response.
      // IMPORTANT: Do NOT check stopReason here. Some providers (Ollama, Gemini)
      // return 'end_turn' even when tool calls are present. The presence of
      // tool calls is the only reliable signal that the agent wants to continue.
      if (toolCalls.length === 0) {
        finalResponse = assistantText;
        break;
      }

      // Stuck detection: same tool call 3 times in a row
      const callSignature = toolCalls.map((tc) => `${tc.name}:${JSON.stringify(tc.input)}`).join('|');
      if (callSignature === lastToolCallSignature) {
        consecutiveIdenticalCalls++;
        if (consecutiveIdenticalCalls >= 3) {
          finalResponse = assistantText + '\n\n[Agent loop detected repeated identical tool calls. Stopping.]';
          this.emit({ type: 'turn_end', reason: 'error', error: 'Stuck in loop: repeated identical tool calls' });
          break;
        }
      } else {
        consecutiveIdenticalCalls = 0;
        lastToolCallSignature = callSignature;
      }

      // Execute tool calls
      const toolResults: Message = {
        role: 'user',
        content: [],
      };

      const executionContext: ToolExecutionContext = {
        workspacePath: this.workspacePath,
        conversationId: this.conversationId,
        toolCallId: '', // set per-call below
        invoke: this.invoke,
        listen: this.listen,
        onFileChange: (change) => {
          this.emit({ type: 'file_change_pending', change });
        },
      };

      for (const tc of toolCalls) {
        // Set the per-call toolCallId before execution
        executionContext.toolCallId = tc.id;

        const record = await this.toolRouter.execute(
          tc.name,
          tc.id,
          tc.input,
          executionContext,
        );
        this.toolCallHistory.push(record);

        // Handle special meta-tool actions
        if (record.output.metadata?.action === 'activate_skill' && this.skillLoader) {
          const skillName = record.output.metadata.skillName as string;
          const skill = this.skillLoader.getByName(skillName);
          if (skill) {
            // Only activate if the skill is enabled in the store.
            // The bridge event handler will sync store → harness on the
            // 'activate_skill' metadata so the store stays authoritative.
            const activated = this.skillLoader.activate(skillName);
            if (activated) {
              this.activeSkills = this.skillLoader.getActive();
              this.contextManager.setActiveSkills(this.activeSkills);
              this.contextManager.setAllSkills(this.skillLoader.getAll());
            }
            record.output.output = `Skill "${skillName}" activation requested. The skill store will be updated.`;
            record.output.metadata = { ...record.output.metadata, action: 'activate_skill', skillName };
          } else {
            record.output.output = `Skill "${skillName}" not found. Use list_skills to see available skills.`;
            record.output.success = false;
          }
        }

        if (record.output.metadata?.action === 'list_skills' && this.skillLoader) {
          const allSkills = this.skillLoader.getAll();
          const skillList = allSkills.map(s => ({
            name: s.frontmatter.name,
            description: s.frontmatter.description,
            active: s.active,
            activation: s.frontmatter.activation,
            scope: s.frontmatter.scope,
          }));
          record.output.output = skillList.length > 0
            ? `Available skills (only ENABLED skills are injected into context):\n${skillList.map(s => `- **${s.name}** [${s.active ? 'ENABLED' : 'DISABLED'}] (${s.scope}): ${s.description}`).join('\n')}\n\nTo use a disabled skill, call activate_skill first.`
            : 'No skills are currently loaded.';
        }

        if (record.output.metadata?.action === 'create_skill') {
          const { skillName, skillContent, skillScope } = record.output.metadata as Record<string, string>;
          try {
            const basePath = skillScope === 'global'
              ? `${this.skillLoader?.['config']?.globalPath ?? ''}`
              : `${this.workspacePath}/.agents/skills`;
            const filePath = `${basePath}/${skillName}.md`;
            // Write skill file via Tauri invoke
            await executionContext.invoke('create_directory', { path: basePath });
            await executionContext.invoke('write_file', { path: filePath, content: skillContent });
            record.output.output = `Skill "${skillName}" created at ${filePath}. It will be available after refreshing skills.`;
            record.output.metadata = { ...record.output.metadata, filePath };
          } catch (err) {
            record.output.output = `Failed to create skill "${skillName}": ${err instanceof Error ? err.message : String(err)}`;
            record.output.success = false;
          }
        }

        toolResults.content.push({
          type: 'tool_result',
          toolCallId: tc.id,
          output: record.output.success
            ? record.output.output
            : `Error: ${record.output.error}`,
          isError: !record.output.success,
        });
      }

      // Add tool results to history
      this.contextManager.addMessage(toolResults);
    }

    if (this.cancelled) {
      this.emit({ type: 'turn_end', reason: 'cancelled' });
    } else if (iteration >= this.config.maxIterations) {
      this.emit({ type: 'turn_end', reason: 'max_iterations' });
    } else {
      this.emit({ type: 'turn_end', reason: 'complete' });
    }

    return {
      response: finalResponse,
      toolCalls: this.toolCallHistory,
    };
  }

  // ─── SDD Mode ───────────────────────────────────────────────────────

  async runSdd(description: string): Promise<string> {
    if (!this.sddEngine) {
      throw new Error('SDD Engine not initialized (no database provided)');
    }

    // Phase 1: Create session
    const session = await this.sddEngine.startSession(this.projectId, description);

    // Phase 2: Generate and review spec
    await this.sddEngine.generateSpec(session.id);

    // Spec is returned to UI for user review/approval
    // In automated mode, we auto-approve
    await this.sddEngine.approveSpec(session.id);

    // Phase 3: Generate plan
    await this.sddEngine.generatePlan(session.id);

    // Plan is returned to UI for user review/approval
    // In automated mode, we auto-approve
    await this.sddEngine.approvePlan(session.id);

    // Phase 4: Execute
    await this.sddEngine.execute(session.id);

    // Phase 5: Review
    const review = await this.sddEngine.review(session.id);

    return review;
  }

  // ─── Internals ──────────────────────────────────────────────────────

  /** Run a single agent turn (used by SDD engine) */
  private async runSingleTurn(systemPromptAddon: string, userMessage: string): Promise<string> {
    const agentDef = getAgentDefinition(this.agentType);
    const originalPrompt = agentDef.basePrompt;

    // Temporarily modify system prompt
    this.contextManager.setSystemPrompt(originalPrompt + '\n\n' + systemPromptAddon);

    const result = await this.run(userMessage, this.contextManager.getHistory());

    // Restore original prompt
    this.contextManager.setSystemPrompt(originalPrompt);

    return result.response;
  }

  private emit(event: HarnessEvent): void {
    this.eventHandler?.(event);
  }
}
