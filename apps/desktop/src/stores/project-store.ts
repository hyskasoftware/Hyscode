import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ProjectState {
  name: string | null;
  rootPath: string | null;
  isLoading: boolean;
  openProject: (path: string) => void;
  closeProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    name: null,
    rootPath: null,
    isLoading: false,

    openProject: (path) =>
      set((state) => {
        const parts = path.replace(/\\/g, '/').split('/');
        state.name = parts[parts.length - 1] || 'project';
        state.rootPath = path;
      }),

    closeProject: () =>
      set((state) => {
        state.name = null;
        state.rootPath = null;
      }),
  })),
);
