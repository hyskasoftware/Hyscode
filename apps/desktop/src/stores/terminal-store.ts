import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface TerminalSession {
  id: string;
  name: string;
  ptyId: string | null;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  nextIndex: number;
  createSession: (name?: string) => string;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setPtyId: (sessionId: string, ptyId: string) => void;
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

    createSession: (name?: string) => {
      const id = genId();
      const idx = get().nextIndex;
      const sessionName = name ?? `Terminal ${idx}`;
      set((state) => {
        state.sessions.push({
          id,
          name: sessionName,
          ptyId: null,
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

    setPtyId: (sessionId: string, ptyId: string) =>
      set((state) => {
        const session = state.sessions.find((s) => s.id === sessionId);
        if (session) session.ptyId = ptyId;
      }),
  })),
);
