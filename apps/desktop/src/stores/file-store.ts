import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  children?: FileNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface FileState {
  rootPath: string | null;
  tree: FileNode[];
  fileCache: Map<string, string>;
  setRootPath: (path: string) => void;
  setTree: (tree: FileNode[]) => void;
  toggleExpand: (path: string) => void;
  setFileContent: (path: string, content: string) => void;
  getFileContent: (path: string) => string | undefined;
}

export const useFileStore = create<FileState>()(
  immer((set, get) => ({
    rootPath: null,
    tree: [],
    fileCache: new Map(),

    setRootPath: (path) =>
      set((state) => {
        state.rootPath = path;
        state.tree = [];
        state.fileCache.clear();
      }),

    setTree: (tree) =>
      set((state) => {
        state.tree = tree;
      }),

    toggleExpand: (path) =>
      set((state) => {
        const findAndToggle = (nodes: FileNode[]): boolean => {
          for (const node of nodes) {
            if (node.path === path) {
              node.isExpanded = !node.isExpanded;
              return true;
            }
            if (node.children && findAndToggle(node.children)) return true;
          }
          return false;
        };
        findAndToggle(state.tree);
      }),

    setFileContent: (path, content) =>
      set((state) => {
        state.fileCache.set(path, content);
      }),

    getFileContent: (path) => get().fileCache.get(path),
  })),
);
