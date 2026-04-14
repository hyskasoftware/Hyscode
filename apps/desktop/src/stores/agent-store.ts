import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AgentType, SddStatus, SddTask } from '@hyscode/agent-harness';

// ─── Types ──────────────────────────────────────────────────────────────────

/** AgentMode mirrors AgentType — single source of truth for active agent. */
export type AgentMode = 'chat' | 'build' | 'review' | 'debug' | 'plan';
export type MessageRole = 'user' | 'assistant';

export interface ToolCallDisplay {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCallDisplay[];
  timestamp: number;
}

export interface PendingApproval {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  description: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type FileChangeStatus = 'pending' | 'accepted' | 'rejected';

export interface PendingFileChange {
  id: string;
  filePath: string;
  toolName: string;
  toolCallId: string;
  /** null when the file was newly created */
  originalContent: string | null;
  newContent: string;
  status: FileChangeStatus;
}

export interface SessionSummary {
  id: string;
  title: string;
  mode: AgentMode;
  modelId: string | null;
  providerId: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── State ──────────────────────────────────────────────────────────────────

interface AgentState {
  // Core — mode IS the agent type (single source of truth)
  mode: AgentMode;
  conversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  contextFiles: string[];

  // Tool calls & approval
  pendingToolCalls: ToolCallDisplay[];
  pendingApprovals: PendingApproval[];

  // Agent file changes (write-through with visual tracking)
  pendingFileChanges: PendingFileChange[];

  // SDD (Spec-Driven Development)
  sddPhase: SddStatus | null;
  sddSpec: string | null;
  sddTasks: SddTask[];
  sddProgress: number; // 0-100

  // Token usage
  tokenUsage: TokenUsage | null;

  // Agent task tracking
  agentTasks: Array<{ id: number; title: string; status: string }>;

  // Session history
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  historyOpen: boolean;

  // ─── Debug ────────────────────────────────────────────────────────────
  debugLines: string[];
  debugExpanded: boolean;
  addDebugLine: (line: string) => void;
  clearDebugLines: () => void;
  setDebugExpanded: (v: boolean) => void;

  // ─── Actions ──────────────────────────────────────────────────────────

  setMode: (mode: AgentMode) => void;
  /** @deprecated Use setMode() instead. Kept as alias for compatibility. */
  setAgentType: (type: AgentType) => void;
  setConversationId: (id: string) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastAssistantContent: (content: string) => void;
  appendStreamingText: (text: string) => void;
  flushStreamingText: () => void;
  setStreaming: (streaming: boolean) => void;
  addContextFile: (path: string) => void;
  removeContextFile: (path: string) => void;
  clearConversation: () => void;

  // Tool calls
  addToolCall: (tc: ToolCallDisplay) => void;
  updateToolCall: (id: string, patch: Partial<ToolCallDisplay>) => void;

  // Approvals
  addPendingApproval: (approval: PendingApproval) => void;
  removePendingApproval: (id: string) => void;

  // File changes
  addPendingFileChange: (change: PendingFileChange) => void;
  resolvePendingFileChange: (id: string, accepted: boolean) => void;
  resolveAllPendingFileChanges: (accepted: boolean) => void;

  // SDD
  setSddPhase: (phase: SddStatus | null) => void;
  setSddSpec: (spec: string | null) => void;
  setSddTasks: (tasks: SddTask[]) => void;
  updateSddTask: (id: string, patch: Partial<SddTask>) => void;
  setSddProgress: (progress: number) => void;

  // Token usage
  setTokenUsage: (usage: TokenUsage | null) => void;

  // Agent task tracking
  setAgentTasks: (tasks: Array<{ id: number; title: string; status: string }>) => void;

  // Session history
  setSessions: (sessions: SessionSummary[]) => void;
  setSessionsLoading: (loading: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  deleteSession: (id: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAgentStore = create<AgentState>()(
  immer((set) => ({
    // Defaults
    mode: 'chat',
    conversationId: null,
    messages: [],
    isStreaming: false,
    streamingText: '',
    pendingToolCalls: [],
    pendingApprovals: [],
    pendingFileChanges: [],
    contextFiles: [],
    sddPhase: null,
    sddSpec: null,
    sddTasks: [],
    sddProgress: 0,
    tokenUsage: null,
    agentTasks: [],
    sessions: [],
    sessionsLoading: false,
    historyOpen: false,

    // Debug
    debugLines: [],
    debugExpanded: false,

    // ─── Core Actions ─────────────────────────────────────────────────

    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
      }),

    setAgentType: (type) =>
      set((state) => {
        state.mode = type as AgentMode;
      }),

    setConversationId: (id) =>
      set((state) => {
        state.conversationId = id;
      }),

    addMessage: (message) =>
      set((state) => {
        state.messages.push(message);
      }),

    updateLastAssistantContent: (content) =>
      set((state) => {
        const last = state.messages[state.messages.length - 1];
        if (last?.role === 'assistant') {
          last.content = content;
        }
      }),

    appendStreamingText: (text) =>
      set((state) => {
        state.streamingText += text;
      }),

    flushStreamingText: () =>
      set((state) => {
        if (!state.streamingText) return;
        const last = state.messages[state.messages.length - 1];
        if (last?.role === 'assistant') {
          last.content = state.streamingText;
        } else {
          state.messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: state.streamingText,
            timestamp: Date.now(),
          });
        }
        state.streamingText = '';
      }),

    setStreaming: (streaming) =>
      set((state) => {
        state.isStreaming = streaming;
        if (!streaming) {
          state.streamingText = '';
        }
      }),

    addContextFile: (path) =>
      set((state) => {
        if (!state.contextFiles.includes(path)) {
          state.contextFiles.push(path);
        }
      }),

    removeContextFile: (path) =>
      set((state) => {
        state.contextFiles = state.contextFiles.filter((f) => f !== path);
      }),

    clearConversation: () =>
      set((state) => {
        state.messages = [];
        state.conversationId = null;
        state.pendingToolCalls = [];
        state.pendingApprovals = [];
        state.pendingFileChanges = [];
        state.contextFiles = [];
        state.streamingText = '';
        state.sddPhase = null;
        state.sddSpec = null;
        state.sddTasks = [];
        state.sddProgress = 0;
        state.tokenUsage = null;
      }),

    // ─── Tool Calls ──────────────────────────────────────────────────

    addToolCall: (tc) =>
      set((state) => {
        state.pendingToolCalls.push(tc);
        // Also attach to last assistant message
        const last = state.messages[state.messages.length - 1];
        if (last?.role === 'assistant') {
          if (!last.toolCalls) last.toolCalls = [];
          last.toolCalls.push(tc);
        }
      }),

    updateToolCall: (id, patch) =>
      set((state) => {
        const tc = state.pendingToolCalls.find((t) => t.id === id);
        if (tc) Object.assign(tc, patch);
        // Also update in message
        for (const msg of state.messages) {
          const msgTc = msg.toolCalls?.find((t) => t.id === id);
          if (msgTc) Object.assign(msgTc, patch);
        }
      }),

    // ─── Approvals ───────────────────────────────────────────────────

    addPendingApproval: (approval) =>
      set((state) => {
        state.pendingApprovals.push(approval);
      }),

    removePendingApproval: (id) =>
      set((state) => {
        state.pendingApprovals = state.pendingApprovals.filter((a) => a.id !== id);
      }),

    // ─── File Changes ────────────────────────────────────────────────

    addPendingFileChange: (change) =>
      set((state) => {
        // Collapse: if same filePath already pending, update newContent in place
        const existing = state.pendingFileChanges.find(
          (c) => c.filePath === change.filePath && c.status === 'pending',
        );
        if (existing) {
          existing.newContent = change.newContent;
          existing.toolCallId = change.toolCallId;
        } else {
          state.pendingFileChanges.push(change);
        }
      }),

    resolvePendingFileChange: (id, accepted) =>
      set((state) => {
        const change = state.pendingFileChanges.find((c) => c.id === id);
        if (change) {
          change.status = accepted ? 'accepted' : 'rejected';
        }
      }),

    resolveAllPendingFileChanges: (accepted) =>
      set((state) => {
        for (const change of state.pendingFileChanges) {
          if (change.status === 'pending') {
            change.status = accepted ? 'accepted' : 'rejected';
          }
        }
      }),

    // ─── SDD ─────────────────────────────────────────────────────────

    setSddPhase: (phase) =>
      set((state) => {
        state.sddPhase = phase;
      }),

    setSddSpec: (spec) =>
      set((state) => {
        state.sddSpec = spec;
      }),

    setSddTasks: (tasks) =>
      set((state) => {
        state.sddTasks = tasks as SddTask[];
      }),

    updateSddTask: (id, patch) =>
      set((state) => {
        const task = state.sddTasks.find((t) => t.id === id);
        if (task) Object.assign(task, patch);
        // Recalculate progress
        const total = state.sddTasks.length;
        if (total > 0) {
          const done = state.sddTasks.filter((t) => t.status === 'completed' || t.status === 'skipped').length;
          state.sddProgress = Math.round((done / total) * 100);
        }
      }),

    setSddProgress: (progress) =>
      set((state) => {
        state.sddProgress = progress;
      }),

    // ─── Token Usage ─────────────────────────────────────────────────

    setTokenUsage: (usage) =>
      set((state) => {
        state.tokenUsage = usage;
      }),

    // ─── Agent Task Tracking ─────────────────────────────────────────

    setAgentTasks: (tasks) =>
      set((state) => {
        state.agentTasks = tasks;
      }),

    // ─── Session History ─────────────────────────────────────────────

    setSessions: (sessions) =>
      set((state) => {
        state.sessions = sessions;
      }),

    setSessionsLoading: (loading) =>
      set((state) => {
        state.sessionsLoading = loading;
      }),

    setHistoryOpen: (open) =>
      set((state) => {
        state.historyOpen = open;
      }),

    deleteSession: (id) =>
      set((state) => {
        state.sessions = state.sessions.filter((s) => s.id !== id);
      }),

    // ─── Debug ───────────────────────────────────────────────────────

    addDebugLine: (line) =>
      set((state) => {
        state.debugLines.push(line);
        // Keep only last 100 lines
        if (state.debugLines.length > 100) {
          state.debugLines = state.debugLines.slice(-100);
        }
      }),

    clearDebugLines: () =>
      set((state) => {
        state.debugLines = [];
      }),

    setDebugExpanded: (v) =>
      set((state) => {
        state.debugExpanded = v;
      }),
  })),
);
