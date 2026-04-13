// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  McpTransportType,
  McpCapabilities,
  McpServerConfig,
  McpToolDefinition,
  McpResource,
  McpResourceContent,
  McpPrompt,
  McpPromptResult,
  McpConnection,
  McpToolResult,
} from './types';

// ─── Manager ────────────────────────────────────────────────────────────────
export { McpClientManager, StdioTransport, SseTransport } from './manager';
export type { McpTransport } from './manager';;
