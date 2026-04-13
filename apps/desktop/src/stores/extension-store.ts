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
} from '@hyscode/extension-api';

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
  };
}

// ── State ────────────────────────────────────────────────────────────────────

interface ExtensionState {
  extensions: InstalledExtension[];
  loading: boolean;
  error: string | null;
  contributions: MergedContributions;

  // Actions
  loadExtensions: () => Promise<void>;
  installExtension: (sourcePath: string) => Promise<void>;
  uninstallExtension: (name: string) => Promise<void>;
  enableExtension: (name: string) => void;
  disableExtension: (name: string) => void;
  rebuildContributions: () => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useExtensionStore = create<ExtensionState>()(
  immer((set, get) => ({
    extensions: [],
    loading: false,
    error: null,
    contributions: emptyContributions(),

    loadExtensions: async () => {
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
      } catch (err) {
        set((s) => {
          s.error = String(err);
          s.loading = false;
        });
      }
    },

    installExtension: async (sourcePath: string) => {
      set((s) => {
        s.loading = true;
        s.error = null;
      });

      try {
        const ext = await invoke<InstalledExtension>('extension_install', {
          sourcePath,
        });
        set((s) => {
          // Remove existing if reinstalling
          s.extensions = s.extensions.filter((e) => e.name !== ext.name);
          s.extensions.push(ext);
          s.loading = false;
        });
        get().rebuildContributions();
      } catch (err) {
        set((s) => {
          s.error = String(err);
          s.loading = false;
        });
      }
    },

    uninstallExtension: async (name: string) => {
      try {
        await invoke('extension_uninstall', { name });
        set((s) => {
          s.extensions = s.extensions.filter((e) => e.name !== name);
        });
        get().rebuildContributions();
      } catch (err) {
        set((s) => {
          s.error = String(err);
        });
      }
    },

    enableExtension: (name: string) => {
      set((s) => {
        const ext = s.extensions.find((e) => e.name === name);
        if (ext) ext.enabled = true;
      });
      get().rebuildContributions();
    },

    disableExtension: (name: string) => {
      set((s) => {
        const ext = s.extensions.find((e) => e.name === name);
        if (ext) ext.enabled = false;
      });
      get().rebuildContributions();
    },

    rebuildContributions: () => {
      const enabled = get().extensions.filter((e) => e.enabled && e.manifest);
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
      }

      set((s) => {
        s.contributions = next;
      });
    },
  })),
);
