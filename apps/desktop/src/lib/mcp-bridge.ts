// ─── MCP Bridge ─────────────────────────────────────────────────────────────
// Singleton that owns the McpClientManager and syncs it with settings.

import { McpClientManager, StdioTransport, SseTransport, WebSocketTransport } from '@hyscode/mcp-client';
import type { McpToolDefinition, McpResource } from '@hyscode/mcp-client';
import { useSettingsStore } from '@/stores/settings-store';
import type { McpServerConfig } from '@/stores/settings-store';

let _instance: McpBridge | null = null;

export class McpBridge {
  private manager: McpClientManager;

  private constructor() {
    this.manager = new McpClientManager();
  }

  static init(): McpBridge {
    if (_instance) return _instance;
    _instance = new McpBridge();
    return _instance;
  }

  static get(): McpBridge {
    if (!_instance) throw new Error('McpBridge not initialized.');
    return _instance;
  }

  static destroy(): void {
    if (_instance) {
      _instance.disconnectAll();
      _instance = null;
    }
  }

  // ─── Connection Management ──────────────────────────────────────────

  /** Connect to all enabled MCP servers from settings */
  async connectAll(): Promise<void> {
    const servers = useSettingsStore.getState().mcpServers.filter((s) => s.enabled);
    for (const server of servers) {
      await this.connect(server);
    }
  }

  async connect(server: McpServerConfig): Promise<void> {
    let transport;
    switch (server.transport) {
      case 'stdio':
        transport = new StdioTransport(server.command ?? '', server.args ?? []);
        break;
      case 'sse':
        transport = new SseTransport(server.url ?? '');
        break;
      case 'websocket':
        transport = new WebSocketTransport(server.wsUrl ?? '');
        break;
    }

    await this.manager.connect(server.id, transport, {
      name: server.name,
      transport: server.transport,
    });
  }

  async disconnect(serverId: string): Promise<void> {
    await this.manager.disconnect(serverId);
  }

  async disconnectAll(): Promise<void> {
    await this.manager.disconnectAll();
  }

  // ─── Tool / Resource access ─────────────────────────────────────────

  getTools(): McpToolDefinition[] {
    return this.manager.getAllTools();
  }

  getResources(): McpResource[] {
    return this.manager.getAllResources();
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.manager.callTool(serverId, toolName, args);
  }

  getConnectedServerIds(): string[] {
    return this.manager.getConnectedIds();
  }
}
