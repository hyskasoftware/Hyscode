// ─── MCP Bridge ─────────────────────────────────────────────────────────────
// Singleton that owns the McpClientManager and syncs it with settings.

import { McpClientManager } from '@hyscode/mcp-client';
import type { McpToolDefinition, McpServerConfig as McpCoreConfig } from '@hyscode/mcp-client';
import { tauriInvokeRaw } from './tauri-invoke';
import { useSettingsStore } from '@/stores/settings-store';
import type { McpServerConfig } from '@/stores/settings-store';

let _instance: McpBridge | null = null;

export class McpBridge {
  private manager: McpClientManager;

  private constructor() {
    this.manager = new McpClientManager(tauriInvokeRaw);
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
      void _instance.disconnectAllServers();
      _instance = null;
    }
  }

  // ─── Adapter ────────────────────────────────────────────────────────

  /** Convert the simple settings-store config to the full MCP core config */
  private toCoreConfig(server: McpServerConfig): McpCoreConfig {
    return {
      id: server.id,
      name: server.name,
      transport: server.transport,
      command: server.command,
      args: server.args,
      url: server.url,
      wsUrl: server.wsUrl,
      capabilities: {
        allowedTools: '*',
        allowedResources: '*',
        maxConcurrentCalls: 5,
        timeoutMs: 30_000,
      },
    };
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
    await this.manager.connect(this.toCoreConfig(server));
  }

  async disconnect(serverId: string): Promise<void> {
    await this.manager.disconnect(serverId);
  }

  async disconnectAllServers(): Promise<void> {
    const servers = this.manager.listServers();
    for (const server of servers) {
      await this.manager.disconnect(server.config.id);
    }
  }

  // ─── Tool / Resource access ─────────────────────────────────────────

  getTools(): Array<McpToolDefinition & { serverId: string }> {
    return this.manager.getAllTools();
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.manager.callTool(serverId, toolName, args);
  }

  getConnectedServerIds(): string[] {
    return this.manager.listServers()
      .filter((s) => s.status === 'connected')
      .map((s) => s.config.id);
  }
}
