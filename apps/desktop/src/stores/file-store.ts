import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { tauriFs } from '../lib/tauri-fs';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  children?: FileNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface FsChangePayload {
  kind: string;   // "create" | "modify" | "remove" | "rename"
  paths: string[];
}

interface FileState {
  rootPath: string | null;
  tree: FileNode[];
  fileCache: Map<string, string>;
  showHidden: boolean;
  _watchUnlisten: UnlistenFn | null;
  _refreshTimer: ReturnType<typeof setTimeout> | null;
  setRootPath: (path: string) => void;
  setTree: (tree: FileNode[]) => void;
  toggleExpand: (path: string) => void;
  setFileContent: (path: string, content: string) => void;
  getFileContent: (path: string) => string | undefined;
  loadDirectory: (path: string) => Promise<FileNode[]>;
  openFolder: (path: string) => Promise<void>;
  expandDirectory: (path: string) => Promise<void>;
  refreshExpandedDirs: () => Promise<void>;
  closeFolder: () => void;
  toggleShowHidden: () => Promise<void>;
  startWatching: () => Promise<void>;
  stopWatching: () => Promise<void>;
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
    showHidden: (() => {
      try { return localStorage.getItem('hscode-show-hidden') === 'true'; } catch { return false; }
    })(),
    _watchUnlisten: null,
    _refreshTimer: null,

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
      const entries = await tauriFs.listDir(path, get().showHidden);
      return entriesToNodes(entries);
    },

    openFolder: async (path) => {
      // Stop any existing watcher
      await get().stopWatching();

      set((state) => {
        state.rootPath = path;
        state.tree = [];
        state.fileCache.clear();
      });
      const nodes = await get().loadDirectory(path);
      set((state) => {
        state.tree = nodes;
      });

      // Start watching after loading
      await get().startWatching();
    },

    closeFolder: () => {
      get().stopWatching();
      set((state) => {
        state.rootPath = null;
        state.tree = [];
        state.fileCache.clear();
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

    refreshExpandedDirs: async () => {
      const { rootPath, tree, loadDirectory } = get();
      if (!rootPath) return;

      // Collect all expanded directory paths
      const expandedPaths: string[] = [];
      const collectExpanded = (nodes: FileNode[]) => {
        for (const n of nodes) {
          if (n.isDir && n.isExpanded) {
            expandedPaths.push(n.path);
            if (n.children) collectExpanded(n.children);
          }
        }
      };
      collectExpanded(tree);

      // Refresh root
      const rootNodes = await loadDirectory(rootPath);
      set((state) => {
        state.tree = rootNodes;
      });

      // Re-expand previously expanded directories
      for (const dirPath of expandedPaths) {
        try {
          const children = await loadDirectory(dirPath);
          set((state) => {
            const find = (nodes: FileNode[]): boolean => {
              for (const n of nodes) {
                if (n.path === dirPath) {
                  n.children = children;
                  n.isExpanded = true;
                  n.isLoading = false;
                  return true;
                }
                if (n.children && find(n.children)) return true;
              }
              return false;
            };
            find(state.tree);
          });
        } catch {
          // Directory may have been deleted
        }
      }
    },

    toggleShowHidden: async () => {
      const newVal = !get().showHidden;
      set((state) => { state.showHidden = newVal; });
      try { localStorage.setItem('hscode-show-hidden', String(newVal)); } catch {}
      const { rootPath, openFolder } = get();
      if (rootPath) await openFolder(rootPath);
    },

    startWatching: async () => {
      const { rootPath } = get();
      if (!rootPath) return;

      try {
        await tauriFs.watch(rootPath);
      } catch (err) {
        console.warn('[FileStore] Failed to start watcher:', err);
        return;
      }

      const unlisten = await listen<FsChangePayload>('fs:changed', (_event) => {
        // Debounce: batch rapid changes into a single refresh
        const current = get();
        if (current._refreshTimer) {
          clearTimeout(current._refreshTimer);
        }
        const timer = setTimeout(() => {
          get().refreshExpandedDirs().catch(console.error);
        }, 300);
        // Store timer reference (can't use set() for non-immer fields, use object mutation)
        (get() as any)._refreshTimer = timer;
      });

      set((state) => {
        state._watchUnlisten = unlisten as any;
      });
    },

    stopWatching: async () => {
      const state = get();
      if (state._watchUnlisten) {
        (state._watchUnlisten as UnlistenFn)();
        set((s) => { s._watchUnlisten = null; });
      }
      if (state._refreshTimer) {
        clearTimeout(state._refreshTimer);
        set((s) => { s._refreshTimer = null; });
      }
      if (state.rootPath) {
        try {
          await tauriFs.unwatch(state.rootPath);
        } catch {
          // Ignore
        }
      }
    },
  })),
);
