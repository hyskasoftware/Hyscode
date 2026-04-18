import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { invoke } from '@tauri-apps/api/core';
import type {
  ExtensionManifest,
  StatusBarItemContribution,
  ViewContribution,
  ThemeContribution,
  LanguageContribution,
  LspContribution,
  CommandContribution,
  KeybindingContribution,
  ConfigurationContribution,
  SnippetContribution,
  IconThemeContribution,
  MenuItem,
  ThemeDefinition,
} from '@hyscode/extension-api';
import { registerExtensionTheme, unregisterExtensionTheme } from '../lib/monaco-themes';
import {
  activateAllExtensions,
  activateExtension,
  deactivateExtension,
  reloadExtension,
  checkAndReloadChangedExtensions,
} from '../lib/extension-loader';

// ── Types ────────────────────────────────────────────────────────────────────

export interface InstalledExtension {
  name: string;
  displayName: string;
  version: string;
  description: string;
  publisher: string;
  path: string;
  enabled: boolean;
  installedAt: string;
  manifest: ExtensionManifest | null;
  icon: string | null;
  categories: string[];
  activationEvents: string[];
  hasMain: boolean;
}

export type ExtensionFilter = 'all' | 'enabled' | 'disabled' | 'themes' | 'languages';

export interface GitUpdateInfo {
  extensionName: string;
  repoUrl: string;
  currentSha: string;
  remoteSha: string;
  hasUpdate: boolean;
}

export interface ExtensionGitSource {
  extensionName: string;
  repoUrl: string;
  branch: string;
  localClonePath: string;
  localCommitSha: string;
}

export interface MergedContributions {
  themes: Array<ThemeContribution & { extensionName: string }>;
  languages: Array<LanguageContribution & { extensionName: string }>;
  languageServers: Array<LspContribution & { extensionName: string }>;
  commands: Array<CommandContribution & { extensionName: string }>;
  keybindings: Array<KeybindingContribution & { extensionName: string }>;
  views: Array<ViewContribution & { extensionName: string }>;
  statusBarItems: Array<StatusBarItemContribution & { extensionName: string }>;
  configurations: Array<{ extensionName: string; config: ConfigurationContribution }>;
  snippets: Array<SnippetContribution & { extensionName: string }>;
  iconThemes: Array<IconThemeContribution & { extensionName: string }>;
  menus: {
    'editor/context': Array<MenuItem & { extensionName: string }>;
    'editor/title': Array<MenuItem & { extensionName: string }>;
    'explorer/context': Array<MenuItem & { extensionName: string }>;
    commandPalette: Array<MenuItem & { extensionName: string }>;
  };
}

function emptyContributions(): MergedContributions {
  return {
    themes: [],
    languages: [],
    languageServers: [],
    commands: [],
    keybindings: [],
    views: [],
    statusBarItems: [],
    configurations: [],
    snippets: [],
    iconThemes: [],
    menus: {
      'editor/context': [],
      'editor/title': [],
      'explorer/context': [],
      commandPalette: [],
    },
  };
}

// ── State ────────────────────────────────────────────────────────────────────

interface ExtensionState {
  extensions: InstalledExtension[];
  loading: boolean;
  installing: boolean;
  error: string | null;
  searchQuery: string;
  filter: ExtensionFilter;
  selectedExtension: string | null;
  contributions: MergedContributions;
  extensionThemesVersion: number;
  // Git install/update
  gitUpdates: Record<string, GitUpdateInfo>;
  gitSources: Record<string, ExtensionGitSource>;
  checkingUpdates: boolean;
  installingFromGit: boolean;

  // Actions
  loadExtensions: () => Promise<void>;
  installFromFolder: (sourcePath: string) => Promise<void>;
  installFromZip: (zipPath: string) => Promise<void>;
  installFromGit: (repoUrl: string, branch?: string) => Promise<void>;
  uninstallExtension: (name: string) => Promise<void>;
  toggleExtension: (name: string) => Promise<void>;
  checkGitUpdates: () => Promise<void>;
  updateFromGit: (extensionName: string) => Promise<void>;
  loadGitSources: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: ExtensionFilter) => void;
  selectExtension: (name: string | null) => void;
  rebuildContributions: () => void;
  loadExtensionThemes: (themes: Array<ThemeContribution & { extensionName: string }>) => Promise<void>;
  // Computed-like helpers
  getFiltered: () => InstalledExtension[];
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useExtensionStore = create<ExtensionState>()(
  immer((set, get) => ({
    extensions: [],
    loading: false,
    installing: false,
    error: null,
    searchQuery: '',
    filter: 'all' as ExtensionFilter,
    selectedExtension: null,
    contributions: emptyContributions(),
    extensionThemesVersion: 0,
    gitUpdates: {},
    gitSources: {},
    checkingUpdates: false,
    installingFromGit: false,

    loadExtensions: async () => {
      const previousExtensions = get().extensions;

      set((s) => {
        s.loading = true;
        s.error = null;
      });

      try {
        const result = await invoke<InstalledExtension[]>('extension_list');
        set((s) => {
          s.extensions = result;
          s.loading = false;
        });
        get().rebuildContributions();

        if (previousExtensions.length === 0) {
          // First load (startup): activate all extensions then check for git updates
          void activateAllExtensions(get().extensions);
          void get().loadGitSources();
          void get().checkGitUpdates();
        } else {
          // Subsequent load (refresh): check for code changes and reload
          const current = get().extensions;
          void checkAndReloadChangedExtensions(current).then(() => {
            // Activate any newly added extensions that aren't active yet
            void activateAllExtensions(current);
          });
        }
      } catch (err) {
        set((s) => {
          s.error = String(err);
          s.loading = false;
        });
      }
    },

    installFromFolder: async (sourcePath: string) => {
      set((s) => {
        s.installing = true;
        s.error = null;
      });

      try {
        const ext = await invoke<InstalledExtension>('extension_install', {
          sourcePath,
        });
        set((s) => {
          s.extensions = s.extensions.filter((e) => e.name !== ext.name);
          s.extensions.push(ext);
          s.installing = false;
        });
        get().rebuildContributions();
        // Reload (deactivate + reactivate) so fresh code runs immediately
        void reloadExtension(ext);
      } catch (err) {
        set((s) => {
          s.error = String(err);
          s.installing = false;
        });
      }
    },

    installFromZip: async (zipPath: string) => {
      set((s) => {
        s.installing = true;
        s.error = null;
      });

      try {
        const ext = await invoke<InstalledExtension>('extension_install_zip', {
          zipPath,
        });
        set((s) => {
          s.extensions = s.extensions.filter((e) => e.name !== ext.name);
          s.extensions.push(ext);
          s.installing = false;
        });
        get().rebuildContributions();
        // Reload (deactivate + reactivate) so fresh code runs immediately
        void reloadExtension(ext);
      } catch (err) {
        set((s) => {
          s.error = String(err);
          s.installing = false;
        });
      }
    },

    installFromGit: async (repoUrl: string, branch?: string) => {
      set((s) => {
        s.installingFromGit = true;
        s.error = null;
      });

      try {
        const ext = await invoke<InstalledExtension>('extension_install_git', {
          repoUrl,
          branch: branch ?? null,
        });
        set((s) => {
          s.extensions = s.extensions.filter((e) => e.name !== ext.name);
          s.extensions.push(ext);
          s.installingFromGit = false;
        });
        get().rebuildContributions();
        void reloadExtension(ext);
        // Reload git sources to reflect the new entry
        void get().loadGitSources();
      } catch (err) {
        set((s) => {
          s.error = String(err);
          s.installingFromGit = false;
        });
      }
    },

    checkGitUpdates: async () => {
      set((s) => {
        s.checkingUpdates = true;
      });
      try {
        const updates = await invoke<GitUpdateInfo[]>('extension_check_git_updates');
        set((s) => {
          s.checkingUpdates = false;
          s.gitUpdates = {};
          for (const u of updates) {
            s.gitUpdates[u.extensionName] = u;
          }
        });
      } catch {
        set((s) => {
          s.checkingUpdates = false;
        });
      }
    },

    updateFromGit: async (extensionName: string) => {
      set((s) => {
        s.error = null;
      });
      try {
        const ext = await invoke<InstalledExtension>('extension_update_git', { extensionName });
        set((s) => {
          s.extensions = s.extensions.filter((e) => e.name !== ext.name);
          s.extensions.push(ext);
          // Clear the update badge
          if (s.gitUpdates[extensionName]) {
            s.gitUpdates[extensionName].hasUpdate = false;
          }
        });
        get().rebuildContributions();
        void reloadExtension(ext);
        void get().loadGitSources();
      } catch (err) {
        set((s) => {
          s.error = String(err);
        });
      }
    },

    loadGitSources: async () => {
      try {
        const sources = await invoke<ExtensionGitSource[]>('extension_get_git_sources');
        set((s) => {
          s.gitSources = {};
          for (const src of sources) {
            s.gitSources[src.extensionName] = src;
          }
        });
      } catch {
        // silently ignore — not critical
      }
    },

    uninstallExtension: async (name: string) => {
      try {
        await invoke('extension_uninstall', { name });
        // Also clean up git source record if this was a git-sourced extension
        const isGit = !!get().gitSources[name];
        if (isGit) {
          await invoke('extension_remove_git_source', { extensionName: name }).catch(() => {});
        }
        await deactivateExtension(name);
        set((s) => {
          s.extensions = s.extensions.filter((e) => e.name !== name);
          if (s.selectedExtension === name) s.selectedExtension = null;
          delete s.gitSources[name];
          delete s.gitUpdates[name];
        });
        get().rebuildContributions();
      } catch (err) {
        set((s) => {
          s.error = String(err);
        });
      }
    },

    toggleExtension: async (name: string) => {
      const ext = get().extensions.find((e) => e.name === name);
      if (!ext) return;

      const newEnabled = !ext.enabled;

      try {
        await invoke('extension_toggle', { name, enabled: newEnabled });
        set((s) => {
          const target = s.extensions.find((e) => e.name === name);
          if (target) target.enabled = newEnabled;
        });
        get().rebuildContributions();
        // Activate or deactivate the extension's main.js
        if (newEnabled) {
          const ext = get().extensions.find((e) => e.name === name);
          if (ext) void activateExtension(ext);
        } else {
          void deactivateExtension(name);
        }
      } catch (err) {
        set((s) => {
          s.error = String(err);
        });
      }
    },

    setSearchQuery: (query: string) => {
      set((s) => {
        s.searchQuery = query;
      });
    },

    setFilter: (filter: ExtensionFilter) => {
      set((s) => {
        s.filter = filter;
      });
    },

    selectExtension: (name: string | null) => {
      set((s) => {
        s.selectedExtension = name;
      });
    },

    getFiltered: () => {
      const { extensions, searchQuery, filter } = get();
      let filtered = [...extensions];

      // Apply search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.displayName.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.publisher.toLowerCase().includes(q) ||
            e.categories?.some((c) => c.toLowerCase().includes(q)),
        );
      }

      // Apply filter
      switch (filter) {
        case 'enabled':
          filtered = filtered.filter((e) => e.enabled);
          break;
        case 'disabled':
          filtered = filtered.filter((e) => !e.enabled);
          break;
        case 'themes':
          filtered = filtered.filter(
            (e) =>
              e.categories?.some((c) => c.toLowerCase().includes('theme')) ||
              e.manifest?.contributes?.themes?.length,
          );
          break;
        case 'languages':
          filtered = filtered.filter(
            (e) =>
              e.categories?.some((c) => c.toLowerCase().includes('language')) ||
              e.manifest?.contributes?.languages?.length ||
              e.manifest?.contributes?.languageServers?.length,
          );
          break;
      }

      return filtered;
    },

    rebuildContributions: () => {
      const enabled = get().extensions.filter((e) => e.enabled && e.manifest);
      const prev = get().contributions;
      const next = emptyContributions();

      for (const ext of enabled) {
        const c = ext.manifest?.contributes;
        if (!c) continue;
        const extName = ext.name;

        if (c.themes) {
          for (const t of c.themes) next.themes.push({ ...t, extensionName: extName });
        }
        if (c.languages) {
          for (const l of c.languages) next.languages.push({ ...l, extensionName: extName });
        }
        if (c.languageServers) {
          for (const ls of c.languageServers) next.languageServers.push({ ...ls, extensionName: extName });
        }
        if (c.commands) {
          for (const cmd of c.commands) next.commands.push({ ...cmd, extensionName: extName });
        }
        if (c.keybindings) {
          for (const kb of c.keybindings) next.keybindings.push({ ...kb, extensionName: extName });
        }
        if (c.views) {
          for (const v of c.views) next.views.push({ ...v, extensionName: extName });
        }
        if (c.statusBarItems) {
          for (const si of c.statusBarItems) next.statusBarItems.push({ ...si, extensionName: extName });
        }
        if (c.configuration) {
          next.configurations.push({ extensionName: extName, config: c.configuration });
        }
        if (c.snippets) {
          for (const s of c.snippets) next.snippets.push({ ...s, extensionName: extName });
        }
        if (c.iconThemes) {
          for (const it of c.iconThemes) next.iconThemes.push({ ...it, extensionName: extName });
        }
        if (c.menus) {
          const menuKeys = ['editor/context', 'editor/title', 'explorer/context', 'commandPalette'] as const;
          for (const key of menuKeys) {
            const items = c.menus[key];
            if (items) {
              for (const item of items) next.menus[key].push({ ...item, extensionName: extName });
            }
          }
        }
      }

      // Unregister themes that are no longer active
      for (const old of prev.themes) {
        if (!next.themes.find((t) => t.id === old.id)) {
          unregisterExtensionTheme(old.id);
        }
      }

      set((s) => {
        s.contributions = next;
      });

      // Async: read theme JSON files and register them with Monaco + theme picker
      void get().loadExtensionThemes(next.themes);
    },

    loadExtensionThemes: async (themes: Array<ThemeContribution & { extensionName: string }>) => {
      for (const theme of themes) {
        if (!theme.path) continue;
        try {
          const content = await invoke<string>('extension_read_asset', {
            name: theme.extensionName,
            assetPath: theme.path,
          });
          const def = JSON.parse(content) as ThemeDefinition;
          // Ensure label and extensionName are populated
          if (!def.label) def.label = theme.label ?? def.id;
          if (!def.extensionName) def.extensionName = theme.extensionName;
          registerExtensionTheme(def);
        } catch (e) {
          console.warn(`[ExtensionStore] Failed to load theme "${theme.id}" from ${theme.path}:`, e);
        }
      }
      // Bump version so theme-tab re-renders and picks up getCustomThemeMetas()
      set((s) => { s.extensionThemesVersion++; });
    },
  })),
);
