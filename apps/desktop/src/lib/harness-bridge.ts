// ─── Harness Bridge ─────────────────────────────────────────────────────────
// Singleton that owns the Harness instance and wires its events → Zustand stores.
// Lives outside React to avoid re-renders during streaming.

import { Harness, SkillLoader } from '@hyscode/agent-harness';
import type {
  HarnessEvent,
  AgentType,
  ConversationMode,
  SddTask,
  ToolHandler,
  ToolResult,
  ToolExecutionContext,
  ToolCategory,
} from '@hyscode/agent-harness';
import type { Message, ToolDefinition } from '@hyscode/ai-providers';
import { tauriInvokeRaw } from './tauri-invoke';
import { listen as tauriListen } from '@tauri-apps/api/event';
import { McpBridge } from './mcp-bridge';
import { useAgentStore } from '@/stores/agent-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { ToolCallDisplay, PendingApproval } from '@/stores/agent-store';

// ─── Singleton ──────────────────────────────────────────────────────────────

let _instance: HarnessBridge | null = null;

export class HarnessBridge {
  private harness: Harness;
  private approvalResolvers = new Map<string, (approved: boolean) => void>();

  private constructor(workspacePath: string, projectId: string) {
    const settings = useSettingsStore.getState();

    // Create SkillLoader with Tauri-backed file system callbacks
    const skillLoader = new SkillLoader({
      builtInPath: `${workspacePath}/node_modules/@hyscode/skills/dist`,
      globalPath: `${HarnessBridge.getHomePath()}/.hyscode/skills`,
      workspacePath,
      readDir: async (path: string) => {
        try {
          return await tauriInvokeRaw<Array<{ name: string; is_dir: boolean }>>('list_dir', { path });
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

  /** Get users home directory path (best-effort; the actual path is resolved by pathExists fallback) */
  private static getHomePath(): string {
    // In the Tauri webview we don't have Node's os.homedir().
    // Use environment-based heuristic. The SkillLoader's pathExists will
    // gracefully return false if the path doesn't exist.
    const isWin = navigator.userAgent?.includes('Windows');
    const username = (globalThis as Record<string, unknown>).__TAURI_USERNAME__ as string | undefined;
    if (isWin) {
      return 'C:/Users/' + (username || 'user');
    }
    return '/home/' + (username || 'user');
  }

  // ─── Singleton access ───────────────────────────────────────────────

  static init(workspacePath: string, projectId: string): HarnessBridge {
    if (_instance) return _instance;
    _instance = new HarnessBridge(workspacePath, projectId);
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
      this.persistConversation(userMessage, response);
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

  /** Sync conversation ID when restoring a previous session */
  restoreSession(conversationId: string): void {
    this.harness.setConversationId(conversationId);
    useAgentStore.getState().setConversationId(conversationId);
    this.debug(`Session restored: ${conversationId}`);
  }

  async loadSkills(): Promise<void> {
    try {
      await this.harness.loadSkills();
      this.debug('Skills loaded successfully');
    } catch (err) {
      this.debug(`Failed to load skills: ${err instanceof Error ? err.message : String(err)}`);
    }
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
          store.updateLastAssistantContent(store.streamingText + chunk.text);
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
    return messages.slice(0, -1).map((msg) => ({
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

      // Try to update first; if the conversation doesn't exist yet, create it
      try {
        await tauriInvokeRaw('db_update_conversation', {
          conversationId,
          title,
        });
      } catch {
        // Conversation doesn't exist yet — create it
        await tauriInvokeRaw('db_create_conversation', {
          id: conversationId,
          projectId: this.harness['projectId'],
          title,
          mode: store.mode,
          modelId: settings.activeModelId ?? null,
          providerId: settings.activeProviderId ?? null,
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
