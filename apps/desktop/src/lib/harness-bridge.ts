// ─── Harness Bridge ─────────────────────────────────────────────────────────
// Singleton that owns the Harness instance and wires its events → Zustand stores.
// Lives outside React to avoid re-renders during streaming.

import { Harness, SkillLoader } from '@hyscode/agent-harness';
import type {
  HarnessEvent,
  AgentType,
  ConversationMode,
  Skill,
  SddTask,
  ToolHandler,
  ToolResult,
  ToolExecutionContext,
  ToolCategory,
} from '@hyscode/agent-harness';
import type { Message, ToolDefinition } from '@hyscode/ai-providers';
import { tauriInvokeRaw } from './tauri-invoke';
import { tauriFs } from './tauri-fs';
import { listen as tauriListen } from '@tauri-apps/api/event';
import { McpBridge } from './mcp-bridge';
import { useAgentStore } from '@/stores/agent-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useSkillsStore } from '@/stores/skills-store';
import { useFileStore } from '@/stores/file-store';
import type { ToolCallDisplay, PendingApproval, AgentEditSession } from '@/stores/agent-store';
import { computeDiffHunks } from './compute-diff';

// ─── Singleton ──────────────────────────────────────────────────────────────

let _instance: HarnessBridge | null = null;

export class HarnessBridge {
  private harness: Harness;
  private approvalResolvers = new Map<string, (approved: boolean) => void>();

  private constructor(workspacePath: string, projectId: string, homePath: string) {
    const settings = useSettingsStore.getState();

    // Create SkillLoader with Tauri-backed file system callbacks
    const skillLoader = new SkillLoader({
      builtInPath: `${workspacePath}/node_modules/@hyscode/skills/dist`,
      globalPath: `${homePath}/.agents/skills`,
      workspacePath,
      readDir: async (path: string) => {
        try {
          // Use list_dir_all to include hidden entries and skill folders
          return await tauriInvokeRaw<Array<{ name: string; is_dir: boolean }>>('list_dir_all', { path });
        } catch {
          return [];
        }
      },
      readFile: async (path: string) => {
        return await tauriInvokeRaw<string>('read_file', { path });
      },
      pathExists: async (path: string) => {
        try {
          await tauriInvokeRaw('stat_path', { path });
          return true;
        } catch {
          return false;
        }
      },
    });

    this.harness = new Harness({
      workspacePath,
      projectId,
      invoke: tauriInvokeRaw,
      listen: async (event: string, handler: (payload: unknown) => void) => {
        const unlisten = await tauriListen(event, (e) => handler(e.payload));
        return unlisten;
      },
      config: {
        providerId: settings.activeProviderId ?? '',
        modelId: settings.activeModelId ?? '',
        maxIterations: settings.maxIterations,
        maxOutputTokens: settings.maxTokens,
        maxInputTokens: 200_000,
        turnTimeoutMs: 300_000,
        approval: { mode: settings.approvalMode },
      },
      onEvent: (event) => this.handleEvent(event),
      onApprovalRequest: (pending) => this.handleApprovalRequest(pending),
      skillLoader,
    });
  }

  private static _homePathCache: string | null = null;

  /** Fallback home path when Tauri command is not available */
  private static getHomePathFallback(): string {
    const isWin = navigator.userAgent?.includes('Windows');
    const username = (globalThis as Record<string, unknown>).__TAURI_USERNAME__ as string | undefined;
    if (isWin) {
      return 'C:/Users/' + (username || 'user');
    }
    return '/home/' + (username || 'user');
  }

  /** Get the resolved home path (available after init) */
  static getHomePath(): string {
    return HarnessBridge._homePathCache ?? HarnessBridge.getHomePathFallback();
  }

  // ─── Singleton access ───────────────────────────────────────────────

  static async init(workspacePath: string, projectId: string): Promise<HarnessBridge> {
    if (_instance) return _instance;

    // Resolve home directory via Rust (reliable cross-platform)
    let homePath: string;
    try {
      homePath = await tauriInvokeRaw<string>('get_home_dir', {});
    } catch {
      homePath = HarnessBridge.getHomePathFallback();
    }
    HarnessBridge._homePathCache = homePath;

    _instance = new HarnessBridge(workspacePath, projectId, homePath);
    return _instance;
  }

  static get(): HarnessBridge {
    if (!_instance) throw new Error('HarnessBridge not initialized. Call HarnessBridge.init() first.');
    return _instance;
  }

  static destroy(): void {
    if (_instance) {
      _instance.cancel();
      _instance = null;
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────

  async sendMessage(userMessage: string): Promise<void> {
    const store = useAgentStore.getState();
    const settings = useSettingsStore.getState();

    const providerId = settings.activeProviderId ?? '';
    const modelId = settings.activeModelId ?? '';

    // Sync settings → harness config
    this.harness.setConfig({ providerId, modelId });
    // mode IS the agent type — single source of truth
    this.harness.setAgentType(store.mode as AgentType);

    const dbg = (msg: string) => {
      const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
      console.log('[HarnessBridge]', msg);
      useAgentStore.getState().addDebugLine(line);
    };

    dbg(`Iniciando com provider="${providerId || '(default)'}" model="${modelId || '(default)'}"`);

    // Map store.mode → ConversationMode for the harness
    let harnessMode: ConversationMode = 'agent';
    if (store.mode === 'chat') harnessMode = 'chat';
    if (store.mode === 'build' && store.sddPhase) harnessMode = 'sdd';
    this.harness.setMode(harnessMode);
    dbg(`Modo: ${harnessMode} (agent: ${store.mode})`);

    // Sync active skills from skills store → harness (respects per-mode assignments)
    const activeForMode = useSkillsStore.getState().getActiveForMode(store.mode as AgentType);
    this.syncActiveSkills(activeForMode.map((s) => s.name));
    dbg(`Skills ativas: ${activeForMode.length}`);

    if (!store.conversationId) {
      const id = crypto.randomUUID();
      useAgentStore.getState().setConversationId(id);
      this.harness.setConversationId(id);
    }

    // Inject context files into the harness context manager
    const contextFiles = store.contextFiles;
    if (contextFiles.length > 0) {
      dbg(`Injetando ${contextFiles.length} arquivo(s) de contexto`);
      for (const filePath of contextFiles) {
        try {
          const content = await tauriInvokeRaw<string>('read_file', { path: filePath });
          const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
          const tokenEstimate = Math.ceil(content.length / 4);
          this.harness.addContextSource({
            id: `ctx-file-${filePath}`,
            type: 'context_chip',
            priority: 'high',
            content: `<file path="${filePath}">\n${content}\n</file>`,
            tokenEstimate,
            metadata: { filePath, fileName },
          });
        } catch (err) {
          dbg(`Erro ao ler contexto ${filePath}: ${err}`);
        }
      }
    }

    // Add user message to store
    const userMsgId = crypto.randomUUID();
    useAgentStore.getState().addMessage({
      id: userMsgId,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });

    // Start streaming
    useAgentStore.getState().setStreaming(true);

    // Create placeholder assistant message
    const assistantMsgId = crypto.randomUUID();
    useAgentStore.getState().addMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    });

    try {
      // Build history from store messages (use fresh state after addMessage calls)
      const history = this.buildHistory(useAgentStore.getState().messages.slice(0, -2));

      dbg(`Enviando para LLM (${history.length} msgs no histórico)...`);

      const { response } = await this.harness.run(userMessage, history);

      dbg(`Resposta recebida (${response.length} chars)`);

      // Flush any remaining streaming text
      useAgentStore.getState().flushStreamingText();

      // Update the last assistant message with the final response
      useAgentStore.getState().updateLastAssistantContent(response);

      // Persist conversation to DB
      await this.persistConversation(userMessage, response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      dbg(`ERRO: ${errorMsg}`);
      useAgentStore.getState().updateLastAssistantContent(`❌ ${errorMsg}`);
    } finally {
      useAgentStore.getState().setStreaming(false);
    }
  }

  cancel(): void {
    this.harness.cancel();
    useAgentStore.getState().setStreaming(false);
  }

  /** Pause SDD execution after the current task finishes */
  pauseSdd(): void {
    this.harness.getSddEngine()?.pause();
    this.debug('SDD paused');
  }

  /** Resume SDD execution */
  resumeSdd(): void {
    this.harness.getSddEngine()?.resume();
    this.debug('SDD resumed');
  }

  /** Skip a specific SDD task */
  skipSddTask(taskId: string): void {
    this.harness.getSddEngine()?.skipTask(taskId);
    this.debug(`SDD task skipped: ${taskId}`);
  }

  setAgentType(type: AgentType): void {
    this.harness.setAgentType(type);
    useAgentStore.getState().setMode(type as import('@/stores/agent-store').AgentMode);
  }

  /** Resolve a pending approval from the UI */
  resolveApproval(id: string, approved: boolean): void {
    const resolver = this.approvalResolvers.get(id);
    if (resolver) {
      resolver(approved);
      this.approvalResolvers.delete(id);
      useAgentStore.getState().removePendingApproval(id);
    }
  }

  /** Accept or revert a single pending file change */
  async resolveFileChange(id: string, accepted: boolean): Promise<void> {
    const store = useAgentStore.getState();
    const change = store.pendingFileChanges.find((c) => c.id === id);
    if (!change || change.status !== 'pending') return;

    if (!accepted) {
      // Revert: restore original content or delete newly-created file
      try {
        if (change.originalContent === null) {
          await tauriFs.deletePath(change.filePath);
        } else {
          await tauriFs.writeFile(change.filePath, change.originalContent);
        }
      } catch (err) {
        console.warn('[HarnessBridge] Failed to revert file change:', err);
      }
    }

    store.resolvePendingFileChange(id, accepted);
  }

  /** Accept or revert ALL pending file changes in bulk */
  async resolveAllFileChanges(accepted: boolean): Promise<void> {
    const store = useAgentStore.getState();
    const pending = store.pendingFileChanges.filter((c) => c.status === 'pending');

    if (!accepted) {
      for (const change of pending) {
        try {
          if (change.originalContent === null) {
            await tauriFs.deletePath(change.filePath);
          } else {
            await tauriFs.writeFile(change.filePath, change.originalContent);
          }
        } catch (err) {
          console.warn('[HarnessBridge] Failed to revert file change:', err);
        }
      }
    }

    store.resolveAllPendingFileChanges(accepted);
  }

  /** Accept or revert a single agent edit session */
  async resolveEditSession(id: string, accepted: boolean): Promise<void> {
    const store = useAgentStore.getState();
    const session = store.agentEditSessions.find(
      (s) => s.id === id && (s.phase === 'streaming' || s.phase === 'pending_review'),
    );
    if (!session) return;

    if (!accepted) {
      try {
        if (session.originalContent === null) {
          await tauriFs.deletePath(session.filePath);
        } else {
          await tauriFs.writeFile(session.filePath, session.originalContent);
        }
      } catch (err) {
        console.warn('[HarnessBridge] Failed to revert edit session:', err);
      }
      // Sync file cache: revert to original or remove entry
      const fileStore = useFileStore.getState();
      if (session.originalContent !== null) {
        fileStore.setFileContent(session.filePath, session.originalContent);
      }
    }

    store.resolveEditSession(id, accepted);

    // Also resolve legacy pending file change for the same file
    const legacy = store.pendingFileChanges.find(
      (c) => c.filePath === session.filePath && c.status === 'pending',
    );
    if (legacy) {
      store.resolvePendingFileChange(legacy.id, accepted);
    }
  }

  /** Accept or revert ALL active agent edit sessions */
  async resolveAllEditSessions(accepted: boolean): Promise<void> {
    const store = useAgentStore.getState();
    const active = store.agentEditSessions.filter(
      (s) => s.phase === 'streaming' || s.phase === 'pending_review',
    );

    if (!accepted) {
      const fileStore = useFileStore.getState();
      for (const session of active) {
        try {
          if (session.originalContent === null) {
            await tauriFs.deletePath(session.filePath);
          } else {
            await tauriFs.writeFile(session.filePath, session.originalContent);
            fileStore.setFileContent(session.filePath, session.originalContent);
          }
        } catch (err) {
          console.warn('[HarnessBridge] Failed to revert edit session:', err);
        }
      }
    }

    store.resolveAllEditSessions(accepted);
    store.resolveAllPendingFileChanges(accepted);
  }

  /** Sync conversation ID when restoring a previous session */
  restoreSession(conversationId: string): void {
    this.harness.setConversationId(conversationId);
    useAgentStore.getState().setConversationId(conversationId);
    this.debug(`Session restored: ${conversationId}`);
  }

  async loadSkills(): Promise<Skill[]> {
    try {
      await this.harness.loadSkills();
      const loader = this.harness.getSkillLoader();
      const all = loader?.getAll() ?? [];
      this.debug(`Skills loaded: ${all.length} total`);
      return all;
    } catch (err) {
      this.debug(`Failed to load skills: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /** Sync the active skill set from the skills store to the harness before a run */
  syncActiveSkills(activeSkillNames: string[]): void {
    const loader = this.harness.getSkillLoader();
    if (!loader) return;
    // Deactivate all, then activate only the ones from the store
    for (const skill of loader.getAll()) {
      skill.active = false;
    }
    for (const name of activeSkillNames) {
      loader.activate(name);
    }
    // Update context manager
    const active = loader.getActive();
    this.harness['activeSkills'] = active;
    this.harness['contextManager'].setActiveSkills(active);
    this.harness['contextManager'].setAllSkills(loader.getAll());
  }

  /** Register all tools from connected MCP servers as native tool handlers */
  async registerMcpTools(): Promise<void> {
    try {
      const mcpBridge = McpBridge.get();
      const mcpTools = mcpBridge.getTools();

      let registered = 0;
      for (const tool of mcpTools) {
        const serverId = tool.serverId;
        const toolName = `mcp__${serverId}__${tool.name}`;

        const handler: ToolHandler = {
          definition: {
            name: toolName,
            description: `[MCP: ${serverId}] ${tool.description ?? tool.name}`,
            inputSchema: (tool.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {}, required: [] },
          } satisfies ToolDefinition,
          category: 'mcp' as ToolCategory,
          requiresApproval: true,
          execute: async (input: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> => {
            try {
              const result = await mcpBridge.callTool(serverId, tool.name, input);
              const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
              return { success: true, output };
            } catch (err) {
              return { success: false, output: '', error: err instanceof Error ? err.message : String(err) };
            }
          },
        };

        this.harness.registerExternalTool(handler);
        registered++;
      }

      if (registered > 0) {
        this.debug(`Registered ${registered} MCP tools`);
      }
    } catch {
      // McpBridge may not be initialized yet — that's fine, MCP tools are optional
    }
  }

  // ─── Event Handling ─────────────────────────────────────────────────

  private debug(msg: string): void {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log('[Harness]', msg);
    useAgentStore.getState().addDebugLine(line);
  }

  private handleEvent(event: HarnessEvent): void {
    const store = useAgentStore.getState();

    switch (event.type) {
      case 'turn_start': {
        this.debug(`Iteração ${event.iteration} — aguardando LLM...`);

        // On subsequent turns, flush current text and create a fresh assistant
        // message so each turn's text + tool calls form their own block in the UI
        if (event.iteration > 1) {
          store.flushStreamingText();
          store.addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'stream_chunk': {
        const chunk = event.chunk;
        if (chunk.type === 'text_delta') {
          store.appendStreamingText(chunk.text);
        }
        if (chunk.type === 'thinking_delta') {
          store.appendThinkingText(chunk.text);
        }
        if (chunk.type === 'usage') {
          store.setTokenUsage({
            inputTokens: chunk.usage.inputTokens,
            outputTokens: chunk.usage.outputTokens,
            totalTokens: chunk.usage.totalTokens,
          });
        }
        break;
      }

      case 'tool_call_start': {
        this.debug(`Ferramenta: ${event.toolName}`);
        const tc: ToolCallDisplay = {
          id: crypto.randomUUID(),
          name: event.toolName,
          input: event.input,
          status: 'running',
          startedAt: Date.now(),
        };
        store.addToolCall(tc);
        break;
      }

      case 'tool_call_pending': {
        const pending = event.pending;
        store.updateToolCall(pending.id, { status: 'pending' });
        break;
      }

      case 'tool_call_result': {
        const label = event.result.success ? '✓' : '✗';
        this.debug(`${label} ${event.toolName} (${event.durationMs}ms)`);
        // Find running tool call with matching name (most recent)
        const agentState = useAgentStore.getState();
        const running = [...agentState.pendingToolCalls]
          .reverse()
          .find((tc) => tc.name === event.toolName && (tc.status === 'running' || tc.status === 'approved'));
        if (running) {
          store.updateToolCall(running.id, {
            status: event.result.success ? 'success' : 'error',
            output: event.result.output,
            error: event.result.error,
            completedAt: Date.now(),
          });
        }

        // Handle metadata actions from tools
        const meta = event.result.metadata;
        if (meta?.action === 'manage_tasks' && Array.isArray(meta.tasks)) {
          store.setAgentTasks(meta.tasks as Array<{ id: number; title: string; status: string }>);
        }
        if (meta?.action === 'activate_skill' && meta.skillName) {
          // Enable the skill in the store (single source of truth)
          const skillsStore = useSkillsStore.getState();
          const skill = skillsStore.skills.find(
            (s) => s.name === meta.skillName || s.id === meta.skillName,
          );
          if (skill && !skill.enabled) {
            skillsStore.toggleSkill(skill.id);
          }
          // Re-sync store → harness so the skill is actually active
          const activeForMode = skillsStore.getActiveForMode(
            useAgentStore.getState().mode as AgentType,
          );
          this.syncActiveSkills(activeForMode.map((s) => s.name));
        }
        if (meta?.action === 'create_skill' && meta.filePath) {
          // Add the newly created skill to the skills store
          useSkillsStore.getState().addSkill({
            id: `workspace:${meta.skillName as string}`,
            name: meta.skillName as string,
            description: (meta.skillDescription as string) || '',
            scope: (meta.skillScope as string) === 'global' ? 'global' : 'workspace',
            enabled: true,
            filePath: meta.filePath as string,
            content: (meta.skillContent as string) || '',
            modes: [],
          });
        }
        break;
      }

      case 'turn_end': {
        if (event.reason === 'error' && event.error) {
          this.debug(`ERRO na iteração: ${event.error}`);
        } else {
          this.debug(`Turno encerrado: ${event.reason}`);
        }
        useAgentStore.getState().flushStreamingText();
        break;
      }

      case 'sdd_phase_change': {
        store.setSddPhase(event.phase);
        break;
      }

      case 'sdd_task_start': {
        store.updateSddTask(event.task.id, { status: 'in_progress' } as Partial<SddTask>);
        break;
      }

      case 'sdd_task_complete': {
        store.updateSddTask(event.task.id, {
          status: event.task.status,
          agentOutput: event.task.agentOutput,
        } as Partial<SddTask>);
        break;
      }

      case 'file_change_pending': {
        const c = event.change;
        const isNewFile = c.originalContent === null;
        const hunks = computeDiffHunks(c.originalContent, c.newContent);

        // Legacy pendingFileChanges (backward compat)
        store.addPendingFileChange({
          id: crypto.randomUUID(),
          filePath: c.filePath,
          toolName: c.toolName,
          toolCallId: c.toolCallId,
          originalContent: c.originalContent,
          newContent: c.newContent,
          status: 'pending',
        });

        // New session-based tracking
        const settings = useSettingsStore.getState();
        const initialPhase = settings.approvalMode === 'yolo' ? 'streaming' : 'streaming';
        const session: AgentEditSession = {
          id: crypto.randomUUID(),
          filePath: c.filePath,
          toolName: c.toolName,
          toolCallId: c.toolCallId,
          originalContent: c.originalContent,
          newContent: c.newContent,
          phase: initialPhase,
          isNewFile,
          hunks,
          createdAt: Date.now(),
        };
        store.upsertEditSession(session);

        // Transition to pending_review (in the first cut, the "streaming" phase
        // is instantaneous since we get the full payload at once)
        // Use a microtask so the UI renders the streaming state briefly
        queueMicrotask(() => {
          const s = useAgentStore.getState();
          const live = s.agentEditSessions.find(
            (es) => es.filePath === c.filePath && es.phase === 'streaming',
          );
          if (live) {
            if (settings.approvalMode === 'yolo') {
              // Auto-accept: go straight to accepted
              s.resolveEditSession(live.id, true);
            } else {
              // manual / custom → pending_review
              useAgentStore.setState((draft) => {
                const target = draft.agentEditSessions.find((es) => es.id === live.id);
                if (target) target.phase = 'pending_review';
              });
            }
          }
        });

        break;
      }
    }
  }

  private async handleApprovalRequest(pending: {
    id: string;
    toolName: string;
    input: Record<string, unknown>;
    description: string;
  }): Promise<boolean> {
    const settings = useSettingsStore.getState();

    // In yolo mode, auto-approve
    if (settings.approvalMode === 'yolo') return true;

    // Push to store for UI rendering
    const approval: PendingApproval = {
      id: pending.id,
      toolName: pending.toolName,
      input: pending.input,
      description: pending.description,
    };
    useAgentStore.getState().addPendingApproval(approval);

    // Wait for UI resolution
    return new Promise<boolean>((resolve) => {
      this.approvalResolvers.set(pending.id, resolve);
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private buildHistory(messages: Array<{ role: string; content: string }>): Message[] {
    return messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: [{ type: 'text' as const, text: msg.content }],
    }));
  }

  /** Persist the current conversation turn to the database */
  private async persistConversation(userMessage: string, _assistantResponse: string): Promise<void> {
    const store = useAgentStore.getState();
    const settings = useSettingsStore.getState();
    const conversationId = store.conversationId;
    if (!conversationId) return;

    try {
      const title = userMessage.slice(0, 80) + (userMessage.length > 80 ? '…' : '');

      const projectId = this.harness['projectId'] as string;

      // Ensure the project row exists before inserting the conversation (FK requirement)
      await tauriInvokeRaw('db_ensure_project', { id: projectId, path: projectId });

      // Try to create the conversation; if it already exists (duplicate PK), update it
      try {
        await tauriInvokeRaw('db_create_conversation', {
          id: conversationId,
          projectId,
          title,
          mode: store.mode,
          modelId: settings.activeModelId ?? null,
          providerId: settings.activeProviderId ?? null,
        });
      } catch {
        // Conversation already exists — update title and timestamp
        await tauriInvokeRaw('db_update_conversation', {
          conversationId,
          title,
        });
      }

      // Persist individual messages
      const lastTwo = store.messages.slice(-2);
      for (const msg of lastTwo) {
        try {
          await tauriInvokeRaw('db_create_message', {
            id: msg.id,
            conversationId,
            role: msg.role,
            content: msg.content,
            toolCalls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
            tokenInput: 0,
            tokenOutput: 0,
          });
        } catch {
          // Message may already exist (duplicate insert) — ignore
        }
      }
    } catch (err) {
      // DB persistence is best-effort; don't break the chat flow
      console.warn('[HarnessBridge] Failed to persist conversation:', err);
    }
  }
}
