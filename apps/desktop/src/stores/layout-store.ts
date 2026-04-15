import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TerminalLocation = 'bottom' | 'sidebar';

interface LayoutState {
  /** Where the terminal is rendered: 'bottom' (below editor) or 'sidebar' (next to agent chat) */
  terminalLocation: TerminalLocation;
  /** Whether the terminal panel is visible at all */
  terminalVisible: boolean;
  /** Which tab is active when terminal is in sidebar mode */
  sidebarActiveTab: 'chat' | 'terminal';

  setTerminalLocation: (location: TerminalLocation) => void;
  setTerminalVisible: (visible: boolean) => void;
  setSidebarActiveTab: (tab: 'chat' | 'terminal') => void;
  toggleTerminal: () => void;
  moveTerminalToSidebar: () => void;
  moveTerminalToBottom: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      terminalLocation: 'bottom',
      terminalVisible: true,
      sidebarActiveTab: 'chat',

      setTerminalLocation: (location) => set({ terminalLocation: location }),
      setTerminalVisible: (visible) => set({ terminalVisible: visible }),
      setSidebarActiveTab: (tab) => set({ sidebarActiveTab: tab }),

      toggleTerminal: () =>
        set((state) => ({ terminalVisible: !state.terminalVisible })),

      moveTerminalToSidebar: () =>
        set({ terminalLocation: 'sidebar', sidebarActiveTab: 'terminal', terminalVisible: true }),

      moveTerminalToBottom: () =>
        set({ terminalLocation: 'bottom', terminalVisible: true }),
    }),
    {
      name: 'hyscode-layout',
      partialize: (state) => ({
        terminalLocation: state.terminalLocation,
        terminalVisible: state.terminalVisible,
      }),
    },
  ),
);
