import type { LspContribution } from '@hyscode/extension-api';
import { LspConnection } from './lsp-connection';
import type { LspConnectionStatus } from './lsp-connection';
import { TauriLspTransport } from './tauri-transport';
import { MonacoLspAdapter } from './monaco-adapter';

type MonacoEditor = typeof import('monaco-editor');
type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type TauriListen = (event: string, handler: (payload: { payload: string }) => void) => Promise<() => void>;

interface ActiveServer {
  connection: LspConnection;
  transport: TauriLspTransport;
  adapter: MonacoLspAdapter;
  config: LspContribution;
  openDocCount: number;
}

type StatusChangeHandler = (languageId: string, status: LspConnectionStatus) => void;

export class LspManager {
  private servers = new Map<string, ActiveServer>();
  private configs = new Map<string, LspContribution>();
  private invoke: TauriInvoke;
  private listen: TauriListen;
  private monaco: MonacoEditor | null = null;
  private rootUri: string | null = null;
  private statusListeners = new Set<StatusChangeHandler>();

  constructor(invoke: TauriInvoke, listen: TauriListen) {
    this.invoke = invoke;
    this.listen = listen;
  }

  setMonaco(monaco: MonacoEditor) {
    this.monaco = monaco;
  }

  setRootUri(uri: string) {
    this.rootUri = uri;
  }

  registerServerConfig(config: LspContribution) {
    for (const langId of config.languageIds) {
      this.configs.set(langId, config);
    }
  }

  unregisterServerConfig(configId: string) {
    for (const [langId, config] of this.configs.entries()) {
      if (config.id === configId) {
        this.configs.delete(langId);
      }
    }
  }

  clearAllConfigs() {
    this.configs.clear();
  }

  async onLanguageOpened(languageId: string): Promise<void> {
    const existing = this.servers.get(languageId);
    if (existing) {
      existing.openDocCount++;
      return;
    }

    const config = this.configs.get(languageId);
    if (!config || !this.monaco || !this.rootUri) return;

    const serverId = `lsp-${languageId}-${Date.now()}`;

    try {
      await this.invoke('lsp_start', {
        id: serverId,
        command: config.command,
        args: config.args ?? [],
        rootPath: this.rootUri.replace('file://', ''),
      });

      const transport = new TauriLspTransport(serverId, this.invoke, this.listen);
      await transport.start();

      const connection = new LspConnection(serverId, languageId, transport);
      connection.onStatusChange((status) => {
        for (const listener of this.statusListeners) {
          listener(languageId, status);
        }
      });

      await connection.initialize(this.rootUri);

      const adapter = new MonacoLspAdapter(connection, this.monaco);
      adapter.register(languageId);

      this.servers.set(languageId, {
        connection,
        transport,
        adapter,
        config,
        openDocCount: 1,
      });
    } catch (err) {
      console.error(`[LspManager] Failed to start server for "${languageId}":`, err);
      for (const listener of this.statusListeners) {
        listener(languageId, 'error');
      }
    }
  }

  async onLanguageClosed(languageId: string): Promise<void> {
    const server = this.servers.get(languageId);
    if (!server) return;

    server.openDocCount--;
    if (server.openDocCount <= 0) {
      await this.stopServer(languageId);
    }
  }

  async stopServer(languageId: string): Promise<void> {
    const server = this.servers.get(languageId);
    if (!server) return;

    server.adapter.dispose();
    await server.connection.shutdown();

    try {
      await this.invoke('lsp_stop', { id: server.connection.serverId });
    } catch {
      // Process may have already died
    }

    this.servers.delete(languageId);
  }

  async stopAll(): Promise<void> {
    const languages = Array.from(this.servers.keys());
    for (const lang of languages) {
      await this.stopServer(lang);
    }
  }

  getConnection(languageId: string): LspConnection | undefined {
    return this.servers.get(languageId)?.connection;
  }

  getStatus(languageId: string): LspConnectionStatus | undefined {
    return this.servers.get(languageId)?.connection.status;
  }

  getActiveLanguages(): string[] {
    return Array.from(this.servers.keys());
  }

  hasServer(languageId: string): boolean {
    return this.configs.has(languageId);
  }

  onStatusChange(handler: StatusChangeHandler) {
    this.statusListeners.add(handler);
    return () => { this.statusListeners.delete(handler); };
  }
}
