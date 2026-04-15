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
} from '@hyscode/extension-api';
import { registerExtensionTheme } from './monaco-themes';
import { useProjectStore } from '../stores/project-store';
import { useSettingsStore } from '../stores/settings-store';
import { useEditorStore } from '../stores/editor-store';
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
      const _h = handler; // keep reference
      console.debug(`[HyscodeAPI] registerCommand("${id}")`, _h);
      return { dispose() {} };
    },
    async executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T> {
      console.warn(`[HyscodeAPI] executeCommand("${id}") not fully implemented`, args);
      return undefined as T;
    },
    getCommands(): string[] {
      return [];
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
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Activate a single enabled extension that has a main entry point.
 * Reads main.js from the Rust backend and executes it in the sandbox.
 */
export async function activateExtension(ext: InstalledExtension): Promise<void> {
  if (!ext.enabled || !ext.hasMain || !ext.manifest) return;
  if (_sandbox.isActive(ext.name)) return;

  try {
    const mainPath = ext.manifest.main ?? 'main.js';
    const source = await invoke<string>('extension_read_asset', {
      name: ext.name,
      assetPath: mainPath,
    });
    await _sandbox.activate(ext.manifest, ext.path, source, _api);
  } catch (err) {
    console.warn(`[ExtensionLoader] Could not activate "${ext.name}":`, err);
  }
}

/**
 * Deactivate a single extension.
 */
export async function deactivateExtension(name: string): Promise<void> {
  await _sandbox.deactivate(name);
}

/**
 * Activate all enabled extensions that have a main entry point.
 * Runs activations in parallel.
 */
export async function activateAllExtensions(extensions: InstalledExtension[]): Promise<void> {
  const eligible = extensions.filter((e) => e.enabled && e.hasMain && e.manifest);
  await Promise.allSettled(eligible.map(activateExtension));
}

/**
 * Deactivate all currently active extensions.
 */
export async function deactivateAllExtensions(): Promise<void> {
  await _sandbox.deactivateAll();
}
