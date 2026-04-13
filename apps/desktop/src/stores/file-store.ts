import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { tauriFs } from '../lib/tauri-fs';

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
  loadDirectory: (path: string) => Promise<FileNode[]>;
  openFolder: (path: string) => Promise<void>;
  expandDirectory: (path: string) => Promise<void>;
}

function entriesToNodes(entries: { name: string; path: string; is_dir: boolean; size: number }[]): FileNode[] {
  return entries.map((e) => ({
    name: e.name,
    path: e.path,
    isDir: e.is_dir,
    size: e.size,
    children: e.is_dir ? [] : undefined,
    isExpanded: false,
    isLoading: false,
  }));
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

    loadDirectory: async (path) => {
      const entries = await tauriFs.listDir(path);
      return entriesToNodes(entries);
    },

    openFolder: async (path) => {
      set((state) => {
        state.rootPath = path;
        state.tree = [];
        state.fileCache.clear();
      });
      const nodes = await get().loadDirectory(path);
      set((state) => {
        state.tree = nodes;
      });
    },

    expandDirectory: async (path) => {
      // Mark loading
      set((state) => {
        const find = (nodes: FileNode[]): boolean => {
          for (const n of nodes) {
            if (n.path === path) {
              n.isLoading = true;
              n.isExpanded = true;
              return true;
            }
            if (n.children && find(n.children)) return true;
          }
          return false;
        };
        find(state.tree);
      });

      const children = await get().loadDirectory(path);

      set((state) => {
        const find = (nodes: FileNode[]): boolean => {
          for (const n of nodes) {
            if (n.path === path) {
              n.children = children;
              n.isLoading = false;
              return true;
            }
            if (n.children && find(n.children)) return true;
          }
          return false;
        };
        find(state.tree);
      });
    },
  })),
);
