import type {
  LspRequest,
  LspResponse,
  LspNotification,
  MessageTransport,
  ServerCapabilities,
  InitializeResult,
} from './types';

type NotificationHandler = (params: unknown) => void;
type ResponseResolver = { resolve: (result: unknown) => void; reject: (error: Error) => void };

export type LspConnectionStatus = 'starting' | 'ready' | 'error' | 'stopped';

export class LspConnection {
  private transport: MessageTransport;
  private nextId = 1;
  private pendingRequests = new Map<number | string, ResponseResolver>();
  private notificationHandlers = new Map<string, NotificationHandler>();
  private _capabilities: ServerCapabilities | null = null;
  private _status: LspConnectionStatus = 'starting';
  private statusListeners = new Set<(status: LspConnectionStatus) => void>();

  readonly languageId: string;
  readonly serverId: string;

  constructor(serverId: string, languageId: string, transport: MessageTransport) {
    this.serverId = serverId;
    this.languageId = languageId;
    this.transport = transport;

    this.transport.onMessage((msg) => this.handleMessage(msg));
  }

  get capabilities(): ServerCapabilities | null {
    return this._capabilities;
  }

  get status(): LspConnectionStatus {
    return this._status;
  }

  async initialize(rootUri: string, workspaceFolders?: Array<{ uri: string; name: string }>): Promise<InitializeResult> {
    const result = await this.sendRequest<InitializeResult>('initialize', {
      processId: null,
      rootUri,
      workspaceFolders: workspaceFolders ?? [{ uri: rootUri, name: 'workspace' }],
      capabilities: {
        textDocument: {
          synchronization: { dynamicRegistration: false, willSave: false, didSave: true, willSaveWaitUntil: false },
          completion: {
            dynamicRegistration: false,
            completionItem: { snippetSupport: true, commitCharactersSupport: true, documentationFormat: ['markdown', 'plaintext'] },
          },
          hover: { dynamicRegistration: false, contentFormat: ['markdown', 'plaintext'] },
          signatureHelp: { dynamicRegistration: false },
          definition: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
          documentSymbol: { dynamicRegistration: false },
          codeAction: { dynamicRegistration: false },
          formatting: { dynamicRegistration: false },
          rangeFormatting: { dynamicRegistration: false },
          rename: { dynamicRegistration: false },
          publishDiagnostics: { relatedInformation: true },
        },
        workspace: {
          workspaceFolders: true,
        },
      },
    });

    this._capabilities = result.capabilities;
    this.sendNotification('initialized', {});
    this.setStatus('ready');

    return result;
  }

  async shutdown(): Promise<void> {
    try {
      await this.sendRequest('shutdown', null);
      this.sendNotification('exit', null);
    } catch {
      // Process may have already died
    }
    this.setStatus('stopped');
    this.transport.close();
  }

  // ── Document Sync ─────────────────────────────────────────────────────────

  didOpen(uri: string, languageId: string, version: number, text: string) {
    this.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId, version, text },
    });
  }

  didChange(uri: string, version: number, contentChanges: Array<{ text: string }>) {
    this.sendNotification('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges,
    });
  }

  didClose(uri: string) {
    this.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });
  }

  didSave(uri: string, text?: string) {
    this.sendNotification('textDocument/didSave', {
      textDocument: { uri },
      text,
    });
  }

  // ── Requests ──────────────────────────────────────────────────────────────

  completion(uri: string, line: number, character: number) {
    return this.sendRequest('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  hover(uri: string, line: number, character: number) {
    return this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  definition(uri: string, line: number, character: number) {
    return this.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  formatting(uri: string, tabSize: number, insertSpaces: boolean) {
    return this.sendRequest('textDocument/formatting', {
      textDocument: { uri },
      options: { tabSize, insertSpaces },
    });
  }

  codeAction(uri: string, range: { start: { line: number; character: number }; end: { line: number; character: number } }, diagnostics: unknown[]) {
    return this.sendRequest('textDocument/codeAction', {
      textDocument: { uri },
      range,
      context: { diagnostics },
    });
  }

  signatureHelp(uri: string, line: number, character: number) {
    return this.sendRequest('textDocument/signatureHelp', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  // ── Notification Handler ──────────────────────────────────────────────────

  onNotification(method: string, handler: NotificationHandler) {
    this.notificationHandlers.set(method, handler);
  }

  onStatusChange(listener: (status: LspConnectionStatus) => void) {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private sendRequest<T = unknown>(method: string, params: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pendingRequests.set(id, { resolve: resolve as (v: unknown) => void, reject });

      const msg: LspRequest = { jsonrpc: '2.0', id, method, params };
      this.transport.send(msg);

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`LSP request "${method}" timed out (30s).`));
        }
      }, 30_000);
    });
  }

  private sendNotification(method: string, params: unknown) {
    const msg: LspNotification = { jsonrpc: '2.0', method, params };
    this.transport.send(msg);
  }

  private handleMessage(msg: LspResponse | LspNotification) {
    if ('id' in msg && msg.id !== undefined && msg.id !== null) {
      // Response
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        const resp = msg as LspResponse;
        if (resp.error) {
          pending.reject(new Error(`LSP error ${resp.error.code}: ${resp.error.message}`));
        } else {
          pending.resolve(resp.result);
        }
      }
    } else if ('method' in msg) {
      // Notification
      const notification = msg as LspNotification;
      const handler = this.notificationHandlers.get(notification.method);
      if (handler) {
        handler(notification.params);
      }
    }
  }

  private setStatus(status: LspConnectionStatus) {
    this._status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
