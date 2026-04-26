import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommandHistoryEntry {
  command: string;
  output: string;
  exitCode: number | null;
  timestamp: number;
  /** Who executed this command */
  source: 'user' | 'agent';
}

export interface TerminalSession {
  id: string;
  name: string;
  ptyId: string | null;
  /** Whether this session is owned by the AI agent */
  isAgentSession: boolean;
  /** Initial working directory for this session */
  cwd: string | null;
  /** Last executed command (for environment context injection) */
  lastCommand: CommandHistoryEntry | null;
  /** Rolling command history (capped at MAX_HISTORY) */
  commandHistory: CommandHistoryEntry[];
}

const MAX_HISTORY = 50;

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  nextIndex: number;
  createSession: (name?: string, isAgentSession?: boolean, cwd?: string) => string;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setPtyId: (sessionId: string, ptyId: string | null) => void;
  /** Record a finished command on a session */
  setLastCommand: (sessionId: string, command: string, output: string, exitCode: number | null) => void;
  /** Append a command to the rolling history */
  appendCommandHistory: (sessionId: string, entry: CommandHistoryEntry) => void;
  /** Find or create the dedicated agent terminal session. Returns its id. */
  ensureAgentSession: () => string;
  /** Get the agent session (if it exists) */
  getAgentSession: () => TerminalSession | undefined;
}

let _counter = 0;
function genId() {
  return `term-${Date.now()}-${++_counter}`;
}

export const useTerminalStore = create<TerminalState>()(
  immer((set, get) => ({
    sessions: [],
    activeSessionId: null,
    nextIndex: 1,

    createSession: (name?: string, isAgentSession = false, cwd?: string) => {
      const id = genId();
      const idx = get().nextIndex;
      const sessionName = name ?? `Terminal ${idx}`;
      set((state) => {
        state.sessions.push({
          id,
          name: sessionName,
          ptyId: null,
          isAgentSession,
          cwd: cwd ?? null,
          lastCommand: null,
          commandHistory: [],
        });
        state.activeSessionId = id;
        state.nextIndex = idx + 1;
      });
      return id;
    },

    closeSession: (id: string) =>
      set((state) => {
        const idx = state.sessions.findIndex((s) => s.id === id);
        if (idx === -1) return;
        state.sessions.splice(idx, 1);
        if (state.activeSessionId === id) {
          // Activate adjacent tab or null
          if (state.sessions.length > 0) {
            const newIdx = Math.min(idx, state.sessions.length - 1);
            state.activeSessionId = state.sessions[newIdx].id;
          } else {
            state.activeSessionId = null;
          }
        }
      }),

    setActiveSession: (id: string) =>
      set((state) => {
        state.activeSessionId = id;
      }),

    renameSession: (id: string, name: string) =>
      set((state) => {
        const session = state.sessions.find((s) => s.id === id);
        if (session) session.name = name;
      }),

    setPtyId: (sessionId: string, ptyId: string | null) =>
      set((state) => {
        const session = state.sessions.find((s) => s.id === sessionId);
        if (session) session.ptyId = ptyId;
      }),

    setLastCommand: (sessionId: string, command: string, output: string, exitCode: number | null) =>
      set((state) => {
        const session = state.sessions.find((s) => s.id === sessionId);
        if (session) {
          session.lastCommand = { command, output, exitCode, timestamp: Date.now(), source: 'user' };
        }
      }),

    appendCommandHistory: (sessionId: string, entry: CommandHistoryEntry) =>
      set((state) => {
        const session = state.sessions.find((s) => s.id === sessionId);
        if (session) {
          session.commandHistory.push(entry);
          // Cap at MAX_HISTORY
          if (session.commandHistory.length > MAX_HISTORY) {
            session.commandHistory = session.commandHistory.slice(-MAX_HISTORY);
          }
        }
      }),

    ensureAgentSession: () => {
      const existing = get().sessions.find((s) => s.isAgentSession);
      if (existing) return existing.id;
      // Create a new agent session (does not auto-focus it)
      const id = genId();
      const idx = get().nextIndex;
      set((state) => {
        state.sessions.push({
          id,
          name: 'Agent Terminal',
          ptyId: null,
          isAgentSession: true,
          cwd: null,
          lastCommand: null,
          commandHistory: [],
        });
        state.nextIndex = idx + 1;
      });
      return id;
    },

    getAgentSession: () => {
      return get().sessions.find((s) => s.isAgentSession);
    },
  })),
);
