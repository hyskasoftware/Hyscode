/**
 * Extension Loader
 *
 * Manages lifecycle of enabled extensions: activates them on startup,
 * deactivates them on disable/uninstall, and provides a minimal HyscodeAPI
 * implementation backed by existing Zustand stores.
 *
 * NOTE: Do NOT import from extension-store here — extension-store imports
 * from this module (activation helpers), which would create a circular dep.
 */

import { invoke } from '@tauri-apps/api/core';
import { ExtensionSandbox } from '@hyscode/extension-host';
import type {
  HyscodeAPI,
  Disposable,
  ThemeDefinition,
  LanguageRegistration,
  LspContribution,
  ExtensionContextMenuItem,
  DocumentFormatter,
  ExtensionStatusBarItem,
  ExtensionPanel,
  ExtensionToolbarAction,
  QuickPickItem,
  QuickPickOptions,
  InputBoxOptions,
} from '@hyscode/extension-api';
import { registerExtensionTheme } from './monaco-themes';
import { useProjectStore } from '../stores/project-store';
import { useSettingsStore } from '../stores/settings-store';
import { useEditorStore } from '../stores/editor-store';
import { useExtensionUiStore } from '../stores/extension-ui-store';
import { useCommandStore } from '../stores/command-store';
import { useKeybindingStore } from '../stores/keybinding-store';
import type { InstalledExtension } from '../stores/extension-store';

// ── Singleton sandbox ────────────────────────────────────────────────────────

const _sandbox = new ExtensionSandbox();

// ── Minimal HyscodeAPI implementation ────────────────────────────────────────

function noop(): Disposable {
  return { dispose() {} };
}

const _api: HyscodeAPI = {
  workspace: {
    get rootPath() {
      return useProjectStore.getState().rootPath;
    },
    async readFile(path: string): Promise<string> {
      return invoke<string>('fs_read_text', { path });
    },
    async writeFile(path: string, content: string): Promise<void> {
      await invoke('fs_write_text', { path, content });
    },
    async listDir(path: string) {
      return invoke('fs_list_dir', { path });
    },
    onDidOpenFile: noop,
    onDidSaveFile: noop,
    onDidCloseFile: noop,
  },

  commands: {
    registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
      const dispose = useCommandStore.getState().registerCommand(id, handler);
      return { dispose };
    },
    async executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T> {
      return (await useCommandStore.getState().executeCommand(id, ...args)) as T;
    },
    getCommands(): string[] {
      return useCommandStore.getState().getAllCommands().map((c) => c.id);
    },
  },

  window: {
    async showInformationMessage(message: string): Promise<string | undefined> {
      console.info(`[Extension] ℹ️ ${message}`);
      return undefined;
    },
    async showWarningMessage(message: string): Promise<string | undefined> {
      console.warn(`[Extension] ⚠️ ${message}`);
      return undefined;
    },
    async showErrorMessage(message: string): Promise<string | undefined> {
      console.error(`[Extension] ❌ ${message}`);
      return undefined;
    },
    createStatusBarItem(options) {
      return {
        id: options.id,
        text: options.text,
        tooltip: options.tooltip,
        command: options.command,
        show() {},
        hide() {},
        update() {},
        dispose() {},
      };
    },
    registerViewProvider: noop,
  },

  editor: {
    get activeFilePath(): string | null {
      return useEditorStore.getState().activeTabId ?? null;
    },
    async openFile(path: string): Promise<void> {
      const { openTab } = useEditorStore.getState();
      const sep = path.includes('/') ? '/' : '\\';
      const fileName = path.split(sep).pop() ?? 'file';
      const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
      openTab({ id: path, filePath: path, fileName, language: ext || 'plaintext', viewerType: 'code' });
    },
    getSelectedText(): string | null {
      return null;
    },
    insertText(_text: string): void {
      console.warn('[HyscodeAPI] insertText not implemented');
    },
    addDecorations(): Disposable {
      return noop();
    },
  },

  settings: {
    async get<T>(_key: string, defaultValue?: T): Promise<T | undefined> {
      return defaultValue;
    },
    async set(_key: string, _value: unknown): Promise<void> {},
    onDidChange(_key: string): Disposable {
      return noop();
    },
  },

  git: {
    async currentBranch(): Promise<string | null> {
      return null;
    },
    async status() {
      return [];
    },
    async diff(): Promise<string> {
      return '';
    },
    onDidChangeBranch: noop,
  },

  themes: {
    registerTheme(theme: ThemeDefinition): Disposable {
      registerExtensionTheme(theme);
      return {
        dispose() {
          // Note: unregisterExtensionTheme is available but we keep it simple
        },
      };
    },
    getActiveThemeId(): string {
      return useSettingsStore.getState().themeId;
    },
  },

  languages: {
    registerLanguage(_language: LanguageRegistration): Disposable {
      return noop();
    },
    registerLanguageServer(_config: LspContribution): Disposable {
      return noop();
    },
    setLanguageDiagnostics(_uri: string, _diagnostics: unknown[]): void {},
  },

  notifications: {
    showInfo(message: string): void { console.info(`[Extension] ${message}`); },
    showWarning(message: string): void { console.warn(`[Extension] ${message}`); },
    showError(message: string): void { console.error(`[Extension] ${message}`); },
    showProgress(_title: string, task): void {
      task({ report() {} }).catch(console.error);
    },
  },

  extensions: {
    getExtension(_name: string) {
      return undefined;
    },
    getAllExtensions() {
      return [];
    },
    onDidChange: noop,
  },

  ui: {
    registerContextMenuItem(item: ExtensionContextMenuItem): Disposable {
      return useExtensionUiStore.getState().addContextMenuItem('__runtime__', item);
    },
    registerDocumentFormatter(formatter: DocumentFormatter): Disposable {
      return useExtensionUiStore.getState().addFormatter('__runtime__', formatter);
    },
    registerStatusBarItem(item: ExtensionStatusBarItem): Disposable {
      return useExtensionUiStore.getState().addStatusBarItem('__runtime__', item);
    },
    registerPanel(panel: ExtensionPanel): Disposable {
      return useExtensionUiStore.getState().addPanel('__runtime__', panel);
    },
    registerToolbarAction(action: ExtensionToolbarAction): Disposable {
      return useExtensionUiStore.getState().addToolbarAction('__runtime__', action);
    },
    async showQuickPick(
      items: QuickPickItem[],
      options?: QuickPickOptions,
    ): Promise<QuickPickItem | undefined> {
      const result = await useExtensionUiStore.getState().showQuickPick(items, options);
      return result ? items.find((i) => i.label === result.label) : undefined;
    },
    async showInputBox(options?: InputBoxOptions): Promise<string | undefined> {
      return useExtensionUiStore.getState().showInputBox(options);
    },
  },
};

// ── Per-extension API factory ────────────────────────────────────────────────

/** Creates an API clone whose `ui` and `commands` calls are tagged with the extension's name */
function createExtensionApi(extensionName: string): HyscodeAPI {
  const uiStore = useExtensionUiStore.getState;
  const cmdStore = useCommandStore.getState;
  return {
    ..._api,
    commands: {
      registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
        const dispose = cmdStore().registerCommand(id, handler, { extensionName });
        return { dispose };
      },
      async executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T> {
        return (await cmdStore().executeCommand(id, ...args)) as T;
      },
      getCommands(): string[] {
        return cmdStore().getAllCommands().map((c) => c.id);
      },
    },
    ui: {
      registerContextMenuItem(item: ExtensionContextMenuItem): Disposable {
        return uiStore().addContextMenuItem(extensionName, item);
      },
      registerDocumentFormatter(formatter: DocumentFormatter): Disposable {
        return uiStore().addFormatter(extensionName, formatter);
      },
      registerStatusBarItem(item: ExtensionStatusBarItem): Disposable {
        return uiStore().addStatusBarItem(extensionName, item);
      },
      registerPanel(panel: ExtensionPanel): Disposable {
        return uiStore().addPanel(extensionName, panel);
      },
      registerToolbarAction(action: ExtensionToolbarAction): Disposable {
        return uiStore().addToolbarAction(extensionName, action);
      },
      async showQuickPick(
        items: QuickPickItem[],
        options?: QuickPickOptions,
      ): Promise<QuickPickItem | undefined> {
        const result = await uiStore().showQuickPick(items, options);
        return result ? items.find((i) => i.label === result.label) : undefined;
      },
      async showInputBox(options?: InputBoxOptions): Promise<string | undefined> {
        return uiStore().showInputBox(options);
      },
    },
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Register command metadata and keybindings from extension manifests into
 * the command store and keybinding store. This ensures commands declared in
 * extension.json (but whose handlers are registered at runtime by main.js)
 * appear in the Command Palette with titles, categories and keybindings.
 */
export function registerExtensionContributions(ext: InstalledExtension): void {
  if (!ext.manifest?.contributes) return;
  const { commands: cmds, keybindings: kbs } = ext.manifest.contributes;
  const cmdStore = useCommandStore.getState();
  const kbStore = useKeybindingStore.getState();

  // Register command metadata (title/category) if not yet registered by main.js
  if (cmds) {
    for (const cmd of cmds) {
      if (!cmdStore.hasCommand(cmd.id)) {
        cmdStore.registerCommand(cmd.id, () => {
          console.warn(`[ExtensionLoader] Command "${cmd.id}" invoked but no handler registered yet.`);
        }, {
          title: cmd.title,
          category: cmd.category,
          extensionName: ext.name,
        });
      }
    }
  }

  // Register keybindings
  if (kbs) {
    for (const kb of kbs) {
      kbStore.register({
        command: kb.command,
        key: kb.key,
        when: kb.when,
        extensionName: ext.name,
      });
    }
  }
}

/**
 * Unregister all commands and keybindings from a specific extension.
 */
export function unregisterExtensionContributions(name: string): void {
  useCommandStore.getState().removeExtensionCommands(name);
  useKeybindingStore.getState().removeExtensionBindings(name);
}

/**
 * Activate a single enabled extension that has a main entry point.
 * Reads main.js from the Rust backend and executes it in the sandbox.
 */
export async function activateExtension(ext: InstalledExtension): Promise<void> {
  if (!ext.enabled || !ext.hasMain || !ext.manifest) return;
  if (_sandbox.isActive(ext.name)) return;

  // Pre-register command metadata & keybindings from manifest
  registerExtensionContributions(ext);

  try {
    const mainPath = ext.manifest.main ?? 'main.js';
    const source = await invoke<string>('extension_read_asset', {
      name: ext.name,
      assetPath: mainPath,
    });
    const api = createExtensionApi(ext.name);
    await _sandbox.activate(ext.manifest, ext.path, source, api);
  } catch (err) {
    console.warn(`[ExtensionLoader] Could not activate "${ext.name}":`, err);
  }
}

/**
 * Deactivate a single extension.
 */
export async function deactivateExtension(name: string): Promise<void> {
  await _sandbox.deactivate(name);
  useExtensionUiStore.getState().removeAllForExtension(name);
  unregisterExtensionContributions(name);
}

/**
 * Activate all enabled extensions that have a main entry point.
 * Runs activations in parallel.
 */
export async function activateAllExtensions(extensions: InstalledExtension[]): Promise<void> {
  const eligible = extensions.filter((e) => e.enabled && e.hasMain && e.manifest);
  // Also register contributions for extensions without main.js (theme-only, etc.)
  for (const ext of extensions.filter((e) => e.enabled && !e.hasMain && e.manifest)) {
    registerExtensionContributions(ext);
  }
  await Promise.allSettled(eligible.map(activateExtension));
}

/**
 * Deactivate all currently active extensions.
 */
export async function deactivateAllExtensions(): Promise<void> {
  await _sandbox.deactivateAll();
}
