import type { LspContribution } from '@hyscode/extension-api';
import { LspConnection } from './lsp-connection';
import type { LspConnectionStatus } from './lsp-connection';
import { TauriLspTransport } from './tauri-transport';
import { MonacoLspAdapter } from './monaco-adapter';
import { enableNativeTypeScriptValidation, disableNativeTypeScriptValidation } from './language-registry';

type MonacoEditor = typeof import('monaco-editor');
type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type TauriListen = (event: string, handler: (payload: { payload: string }) => void) => Promise<() => void>;

interface ActiveServer {
  connection: LspConnection;
  transport: TauriLspTransport;
  adapter: MonacoLspAdapter;
  config: LspContribution;
  openDocCount: number;
  /** Normalized server key (e.g. typescriptreact → typescript) */
  serverKey: string;
}

type StatusChangeHandler = (languageId: string, status: LspConnectionStatus) => void;

/** Languages that share the same underlying server process */
const SERVER_KEY_NORMALIZATION: Record<string, string> = {
  typescriptreact: 'typescript',
  javascriptreact: 'javascript',
};

const TSJS_IDS = new Set(['typescript', 'javascript']);

function normalizeServerKey(languageId: string): string {
  return SERVER_KEY_NORMALIZATION[languageId] ?? languageId;
}

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

  async onLanguageOpened(languageId: string, filePath?: string): Promise<void> {
    const serverKey = normalizeServerKey(languageId);
    const existing = this.servers.get(serverKey);
    if (existing) {
      existing.openDocCount++;
      return;
    }

    const config = this.configs.get(languageId);
    if (!config || !this.monaco || !this.rootUri) return;

    const serverId = `lsp-${serverKey}-${Date.now()}`;
    const rootPath = this.rootUri.replace(/^file:\/\/\/?/, '');
    console.log('[LspManager] lsp_start serverKey=', serverKey, 'rootUri=', this.rootUri, 'rootPath=', rootPath, 'filePath=', filePath);

    try {
      const startResult = await this.invoke('lsp_start', {
        id: serverId,
        command: config.command,
        args: config.args ?? [],
        rootPath,
        filePath: filePath ?? null,
      }) as { server_id: string; root_path: string };

      const resolvedRootPath = startResult.root_path ?? rootPath;
      const resolvedRootUri = resolvedRootPath.startsWith('/')
        ? `file://${resolvedRootPath}`
        : `file:///${resolvedRootPath.replace(/\\/g, '/')}`;

      const transport = new TauriLspTransport(startResult.server_id, this.invoke, this.listen);
      await transport.start();

    const connection = new LspConnection(startResult.server_id, serverKey, transport);
    connection.onStatusChange((status) => {
      for (const listener of this.statusListeners) {
        listener(serverKey, status);
      }
      // Toggle Monaco native TS validation based on LSP health
      if (TSJS_IDS.has(serverKey)) {
        if (status === 'ready') {
          disableNativeTypeScriptValidation(this.monaco!);
        } else if (status === 'error' || status === 'stopped') {
          enableNativeTypeScriptValidation(this.monaco!);
        }
      }
    });

    await connection.initialize(resolvedRootUri);

    const adapter = new MonacoLspAdapter(connection, this.monaco);
    // Register adapter for both the normalized key and the original languageId
    // so Monaco providers cover all variants (typescript + typescriptreact, etc.)
    adapter.register(serverKey);
    if (serverKey !== languageId) {
      adapter.register(languageId);
    }

    this.servers.set(serverKey, {
      connection,
      transport,
      adapter,
      config,
      openDocCount: 1,
      serverKey,
    });
    } catch (err) {
      console.error(`[LspManager] Failed to start server for "${languageId}":`, err);
      for (const listener of this.statusListeners) {
        listener(languageId, 'error');
      }
    }
  }

  async onLanguageClosed(languageId: string): Promise<void> {
    const serverKey = normalizeServerKey(languageId);
    const server = this.servers.get(serverKey);
    if (!server) return;

    server.openDocCount--;
    if (server.openDocCount <= 0) {
      await this.stopServer(serverKey);
    }
  }

  async stopServer(serverKey: string): Promise<void> {
    const server = this.servers.get(serverKey);
    if (!server) return;

    server.adapter.dispose();
    await server.connection.shutdown();

    try {
      await this.invoke('lsp_stop', { id: server.connection.serverId });
    } catch {
      // Process may have already died
    }

    this.servers.delete(serverKey);
  }

  async stopAll(): Promise<void> {
    const keys = Array.from(this.servers.keys());
    for (const key of keys) {
      await this.stopServer(key);
    }
  }

  getConnection(languageId: string): LspConnection | undefined {
    const serverKey = normalizeServerKey(languageId);
    return this.servers.get(serverKey)?.connection;
  }

  getStatus(languageId: string): LspConnectionStatus | undefined {
    const serverKey = normalizeServerKey(languageId);
    return this.servers.get(serverKey)?.connection.status;
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
