// ─── Harness Bridge ─────────────────────────────────────────────────────────
// Singleton that owns the Harness instance and wires its events → Zustand stores.
// Lives outside React to avoid re-renders during streaming.

import { Harness } from '@hyscode/agent-harness';
import type {
  HarnessEvent,
  AgentType,
  ConversationMode,
  SddTask,
} from '@hyscode/agent-harness';
import type { Message } from '@hyscode/ai-providers';
import { tauriInvokeRaw } from './tauri-invoke';
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

    this.harness = new Harness({
      workspacePath,
      projectId,
      invoke: tauriInvokeRaw,
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
    });
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
    this.harness.setAgentType(settings.agentType);

    const dbg = (msg: string) => {
      const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
      console.log('[HarnessBridge]', msg);
      useAgentStore.getState().addDebugLine(line);
    };

    dbg(`Iniciando com provider="${providerId || '(default)'}" model="${modelId || '(default)'}"`);

    let mode: ConversationMode = 'agent';
    if (store.mode === 'chat') mode = 'chat';
    if (store.mode === 'build' && store.sddPhase) mode = 'sdd';
    this.harness.setMode(mode);
    dbg(`Modo: ${mode}`);

    if (!store.conversationId) {
      const id = crypto.randomUUID();
      useAgentStore.getState().setConversationId(id);
      this.harness.setConversationId(id);
    }

    // Add user message to store
    useAgentStore.getState().addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });

    // Start streaming
    useAgentStore.getState().setStreaming(true);

    // Create placeholder assistant message
    useAgentStore.getState().addMessage({
      id: crypto.randomUUID(),
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

  setAgentType(type: AgentType): void {
    this.harness.setAgentType(type);
    useAgentStore.getState().setAgentType(type);
    useSettingsStore.getState().set('agentType', type);
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

  async loadSkills(): Promise<void> {
    await this.harness.loadSkills();
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
      case 'turn_start':
        this.debug(`Iteração ${event.iteration} — aguardando LLM...`);
        break;

      case 'stream_chunk': {
        const chunk = event.chunk;
        if (chunk.type === 'text_delta') {
          store.appendStreamingText(chunk.text);
          store.updateLastAssistantContent(store.streamingText + chunk.text);
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
}
