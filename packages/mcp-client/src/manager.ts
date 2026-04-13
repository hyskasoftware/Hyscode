// ─── MCP Client Manager ─────────────────────────────────────────────────────
// Manages connections to MCP servers and provides unified tool access.
// Uses JSON-RPC 2.0 protocol over different transports.

import type {
  McpServerConfig,
  McpConnection,
  McpToolDefinition,
  McpToolResult,
  McpResource,
  McpResourceContent,
  McpPrompt,
  McpPromptResult,
} from './types';

// ─── JSON-RPC Types ─────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ─── Transport Interface ────────────────────────────────────────────────────

export interface McpTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: JsonRpcRequest): Promise<JsonRpcResponse>;
  onNotification(handler: (notification: JsonRpcNotification) => void): void;
}

// ─── Stdio Transport ────────────────────────────────────────────────────────
// Spawns a local process and communicates via JSON-RPC over stdin/stdout.

export class StdioTransport implements McpTransport {
  private config: McpServerConfig;
  private invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  private ptyId: string | null = null;
  private pendingRequests = new Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (reason: Error) => void;
  }>();
  private notificationHandler: ((n: JsonRpcNotification) => void) | null = null;
  private buffer = '';

  constructor(
    config: McpServerConfig,
    invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>,
  ) {
    this.config = config;
    this.invoke = invoke;
  }

  async connect(): Promise<void> {
    if (!this.config.command) throw new Error('stdio transport requires command');

    this.ptyId = `mcp-${this.config.id}-${Date.now()}`;
    await this.invoke('pty_spawn', {
      id: this.ptyId,
      shell: this.config.command,
      args: this.config.args || [],
      cwd: undefined,
      cols: 80,
      rows: 24,
      env: this.config.env,
    });
  }

  async disconnect(): Promise<void> {
    if (this.ptyId) {
      try {
        await this.invoke('pty_kill', { id: this.ptyId });
      } catch {
        // Ignore kill errors
      }
      this.ptyId = null;
    }
    // Reject pending requests
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();
  }

  async send(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.ptyId) throw new Error('Transport not connected');

    const data = JSON.stringify(message) + '\n';
    await this.invoke('pty_write', { id: this.ptyId, data });

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request ${message.id} timed out`));
      }, this.config.capabilities.timeoutMs || 30000);

      this.pendingRequests.set(message.id, {
        resolve: (resp) => {
          clearTimeout(timeout);
          resolve(resp);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });
    });
  }

  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandler = handler;
  }

  /** Called when data is received from the process stdout */
  handleData(data: string): void {
    this.buffer += data;

    // Process complete JSON lines
    while (true) {
      const newlineIdx = this.buffer.indexOf('\n');
      if (newlineIdx === -1) break;

      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line);
        if ('id' in msg && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg as JsonRpcResponse);
        } else if ('method' in msg && !('id' in msg)) {
          this.notificationHandler?.(msg as JsonRpcNotification);
        }
      } catch {
        // Invalid JSON — skip
      }
    }
  }
}

// ─── SSE Transport ──────────────────────────────────────────────────────────
// HTTP-based transport using POST for requests, SSE for server messages.

export class SseTransport implements McpTransport {
  private config: McpServerConfig;
  private messagesUrl: string | null = null;
  private eventSource: EventSource | null = null;
  private pendingRequests = new Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (reason: Error) => void;
  }>();
  private notificationHandler: ((n: JsonRpcNotification) => void) | null = null;

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.url) throw new Error('SSE transport requires url');

    const baseUrl = this.config.url;

    // Establish SSE connection
    this.eventSource = new EventSource(baseUrl);

    this.eventSource.addEventListener('endpoint', (event: MessageEvent) => {
      // Server sends the messages endpoint URL
      this.messagesUrl = new URL(event.data, baseUrl).toString();
    });

    this.eventSource.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if ('id' in msg && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg as JsonRpcResponse);
        } else if ('method' in msg && !('id' in msg)) {
          this.notificationHandler?.(msg as JsonRpcNotification);
        }
      } catch {
        // Invalid message
      }
    });

    // Wait for connection to establish
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('SSE connection timeout')), 10000);
      this.eventSource!.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      this.eventSource!.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('SSE connection failed'));
      });
    });
  }

  async disconnect(): Promise<void> {
    this.eventSource?.close();
    this.eventSource = null;
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();
  }

  async send(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    const url = this.messagesUrl || this.config.url;
    if (!url) throw new Error('No messages endpoint');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    // Response comes via SSE stream, wait for it
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request ${message.id} timed out`));
      }, this.config.capabilities.timeoutMs || 30000);

      this.pendingRequests.set(message.id, {
        resolve: (resp) => {
          clearTimeout(timeout);
          resolve(resp);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });
    });
  }

  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandler = handler;
  }
}

// ─── WebSocket Transport ────────────────────────────────────────────────────
// Bidirectional JSON-RPC over a single WebSocket connection.

export class WebSocketTransport implements McpTransport {
  private config: McpServerConfig;
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (reason: Error) => void;
  }>();
  private notificationHandler: ((n: JsonRpcNotification) => void) | null = null;

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.wsUrl) throw new Error('WebSocket transport requires wsUrl');

    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data));
        if ('id' in msg && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg as JsonRpcResponse);
        } else if ('method' in msg && !('id' in msg)) {
          this.notificationHandler?.(msg as JsonRpcNotification);
        }
      } catch {
        // Invalid JSON message
      }
    });

    // Wait for open or error
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);

      this.ws!.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      this.ws!.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      }, { once: true });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();
  }

  async send(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify(message));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request ${message.id} timed out`));
      }, this.config.capabilities.timeoutMs || 30000);

      this.pendingRequests.set(message.id, {
        resolve: (resp) => {
          clearTimeout(timeout);
          resolve(resp);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });
    });
  }

  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandler = handler;
  }
}

// ─── MCP Client Manager ────────────────────────────────────────────────────

export class McpClientManager {
  private connections = new Map<string, McpConnection & { transport: McpTransport }>();
  private invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

  constructor(invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) {
    this.invoke = invoke;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────

  async connect(config: McpServerConfig): Promise<McpConnection> {
    // Create transport
    let transport: McpTransport;
    switch (config.transport) {
      case 'stdio':
        transport = new StdioTransport(config, this.invoke);
        break;
      case 'sse':
        transport = new SseTransport(config);
        break;
      case 'websocket':
        transport = new WebSocketTransport(config);
        break;
      default:
        throw new Error(`Unsupported transport: ${config.transport}`);
    }

    const connection: McpConnection & { transport: McpTransport } = {
      config,
      status: 'connecting',
      tools: [],
      resources: [],
      prompts: [],
      transport,
    };

    this.connections.set(config.id, connection);

    try {
      // Connect transport
      await transport.connect();

      // Initialize MCP protocol
      await this.rpcCall(config.id, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: {
          name: 'HysCode',
          version: '0.1.0',
        },
      });

      // Send initialized notification
      await transport.send({
        jsonrpc: '2.0',
        id: 0,
        method: 'notifications/initialized',
      });

      // List tools
      connection.tools = await this.fetchTools(config.id);

      // List resources (if supported)
      try {
        connection.resources = await this.fetchResources(config.id);
      } catch {
        // Resources not supported
      }

      // List prompts (if supported)
      try {
        connection.prompts = await this.fetchPrompts(config.id);
      } catch {
        // Prompts not supported
      }

      connection.status = 'connected';
      return connection;
    } catch (err) {
      connection.status = 'error';
      connection.error = err instanceof Error ? err.message : String(err);
      return connection;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;

    await conn.transport.disconnect();
    conn.status = 'disconnected';
    this.connections.delete(serverId);
  }

  async reconnect(serverId: string): Promise<McpConnection> {
    const conn = this.connections.get(serverId);
    if (!conn) throw new Error(`Server "${serverId}" not found`);

    await this.disconnect(serverId);
    return this.connect(conn.config);
  }

  // ─── Discovery ──────────────────────────────────────────────────────

  listServers(): McpConnection[] {
    return Array.from(this.connections.values()).map(({ transport, ...conn }) => conn);
  }

  getServerTools(serverId: string): McpToolDefinition[] {
    const conn = this.connections.get(serverId);
    if (!conn || conn.status !== 'connected') return [];

    // Apply capability gating
    const { allowedTools } = conn.config.capabilities;
    if (allowedTools === '*') return conn.tools;
    return conn.tools.filter((t) => allowedTools.includes(t.name));
  }

  getAllTools(): Array<McpToolDefinition & { serverId: string }> {
    const tools: Array<McpToolDefinition & { serverId: string }> = [];
    for (const [serverId, conn] of this.connections) {
      if (conn.status !== 'connected') continue;
      const serverTools = this.getServerTools(serverId);
      tools.push(...serverTools.map((t) => ({ ...t, serverId })));
    }
    return tools;
  }

  // ─── Execution ──────────────────────────────────────────────────────

  async callTool(
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const conn = this.connections.get(serverId);
    if (!conn || conn.status !== 'connected') {
      throw new Error(`Server "${serverId}" not connected`);
    }

    // Check capability gating
    const { allowedTools } = conn.config.capabilities;
    if (allowedTools !== '*' && !allowedTools.includes(toolName)) {
      throw new Error(`Tool "${toolName}" not allowed for server "${serverId}"`);
    }

    const result = await this.rpcCall(serverId, 'tools/call', {
      name: toolName,
      arguments: args || {},
    });

    return result as McpToolResult;
  }

  // ─── Resources ────────────────────────────────────────────────────

  async listResources(serverId: string): Promise<McpResource[]> {
    return this.fetchResources(serverId);
  }

  async readResource(serverId: string, uri: string): Promise<McpResourceContent> {
    const result = await this.rpcCall(serverId, 'resources/read', { uri });
    const contents = (result as { contents: McpResourceContent[] }).contents;
    return contents[0];
  }

  // ─── Prompts ──────────────────────────────────────────────────────

  async listPrompts(serverId: string): Promise<McpPrompt[]> {
    return this.fetchPrompts(serverId);
  }

  async getPrompt(
    serverId: string,
    name: string,
    args?: Record<string, string>,
  ): Promise<McpPromptResult> {
    const result = await this.rpcCall(serverId, 'prompts/get', { name, arguments: args });
    return result as McpPromptResult;
  }

  // ─── Internal ─────────────────────────────────────────────────────

  private async rpcCall(serverId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const conn = this.connections.get(serverId);
    if (!conn) throw new Error(`Server "${serverId}" not found`);

    const id = Date.now();
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    const response = await conn.transport.send(request);

    if (response.error) {
      throw new Error(`MCP error ${response.error.code}: ${response.error.message}`);
    }

    return response.result;
  }

  private async fetchTools(serverId: string): Promise<McpToolDefinition[]> {
    const result = await this.rpcCall(serverId, 'tools/list');
    return (result as { tools: McpToolDefinition[] }).tools || [];
  }

  private async fetchResources(serverId: string): Promise<McpResource[]> {
    const result = await this.rpcCall(serverId, 'resources/list');
    return (result as { resources: McpResource[] }).resources || [];
  }

  private async fetchPrompts(serverId: string): Promise<McpPrompt[]> {
    const result = await this.rpcCall(serverId, 'prompts/list');
    return (result as { prompts: McpPrompt[] }).prompts || [];
  }
}
