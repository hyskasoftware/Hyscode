import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type AgentMode = 'chat' | 'build' | 'review';
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

interface AgentState {
  mode: AgentMode;
  conversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  pendingToolCalls: ToolCallDisplay[];
  contextFiles: string[];
  setMode: (mode: AgentMode) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastAssistantContent: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  addContextFile: (path: string) => void;
  removeContextFile: (path: string) => void;
  clearConversation: () => void;
}

export const useAgentStore = create<AgentState>()(
  immer((set) => ({
    mode: 'chat',
    conversationId: null,
    messages: [],
    isStreaming: false,
    pendingToolCalls: [],
    contextFiles: [],

    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
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

    setStreaming: (streaming) =>
      set((state) => {
        state.isStreaming = streaming;
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
        state.contextFiles = [];
      }),
  })),
);
