// ─── Tool Router ────────────────────────────────────────────────────────────
// Routes LLM tool calls to concrete implementations and manages approval flow.

import type { ToolDefinition } from '@hyscode/ai-providers';
import type {
  ToolHandler,
  ToolResult,
  ToolCallRecord,
  ToolExecutionContext,
  ToolCategory,
  ApprovalConfig,
  PendingToolCall,
  HarnessEventHandler,
} from './types';

export class ToolRouter {
  private handlers = new Map<string, ToolHandler>();
  private approvalConfig: ApprovalConfig = { mode: 'manual' };
  private eventHandler: HarnessEventHandler | null = null;
  private approvalCallback: ((pending: PendingToolCall) => Promise<boolean>) | null = null;

  // ─── Registration ───────────────────────────────────────────────────

  register(handler: ToolHandler): void {
    this.handlers.set(handler.definition.name, handler);
  }

  unregister(name: string): void {
    this.handlers.delete(name);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }

  // ─── Configuration ──────────────────────────────────────────────────

  setApprovalConfig(config: ApprovalConfig): void {
    this.approvalConfig = config;
  }

  setEventHandler(handler: HarnessEventHandler): void {
    this.eventHandler = handler;
  }

  /** Set callback for requesting user approval */
  setApprovalCallback(
    callback: (pending: PendingToolCall) => Promise<boolean>,
  ): void {
    this.approvalCallback = callback;
  }

  // ─── Tool Definitions ───────────────────────────────────────────────

  /** Get tool definitions for all registered tools (for sending to LLM) */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.handlers.values()).map((h) => h.definition);
  }

  /** Get tool definitions filtered by allowed categories */
  getToolDefinitionsForCategories(categories: ToolCategory[]): ToolDefinition[] {
    return Array.from(this.handlers.values())
      .filter((h) => categories.includes(h.category))
      .map((h) => h.definition);
  }

  /** Get tool definitions with specific allow/deny overrides */
  getToolDefinitionsFiltered(
    categories: ToolCategory[],
    overrides?: { allow?: string[]; deny?: string[] },
  ): ToolDefinition[] {
    const defs = this.getToolDefinitionsForCategories(categories);

    if (!overrides) return defs;

    let filtered = defs;
    if (overrides.deny?.length) {
      filtered = filtered.filter((d) => !overrides.deny!.includes(d.name));
    }
    if (overrides.allow?.length) {
      // Add tools that are explicitly allowed even if not in categories
      const alreadyIncluded = new Set(filtered.map((d) => d.name));
      for (const name of overrides.allow) {
        if (!alreadyIncluded.has(name)) {
          const handler = this.handlers.get(name);
          if (handler) {
            filtered.push(handler.definition);
          }
        }
      }
    }

    return filtered;
  }

  // ─── Tool Execution ─────────────────────────────────────────────────

  async execute(
    toolName: string,
    toolCallId: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolCallRecord> {
    const startTime = Date.now();
    const handler = this.handlers.get(toolName);

    if (!handler) {
      return {
        id: toolCallId,
        toolName,
        input,
        output: {
          success: false,
          output: '',
          error: `Unknown tool: ${toolName}`,
        },
        durationMs: Date.now() - startTime,
        approved: false,
        timestamp: new Date().toISOString(),
      };
    }

    // Check approval
    const needsApproval = this.needsApproval(toolName, handler);

    if (needsApproval) {
      this.eventHandler?.({
        type: 'tool_call_pending',
        pending: {
          id: toolCallId,
          toolName,
          input,
          description: this.describeToolCall(toolName, input),
          resolve: () => {},
        },
      });

      const approved = await this.requestApproval(toolCallId, toolName, input);

      if (!approved) {
        const result: ToolResult = {
          success: false,
          output: '',
          error: 'Tool call was rejected by the user.',
        };
        return {
          id: toolCallId,
          toolName,
          input,
          output: result,
          durationMs: Date.now() - startTime,
          approved: false,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Emit start event
    this.eventHandler?.({
      type: 'tool_call_start',
      toolCallId,
      toolName,
      input,
    });

    // Execute the tool
    let result: ToolResult;
    try {
      result = await handler.execute(input, context);
    } catch (err) {
      result = {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const durationMs = Date.now() - startTime;

    // Emit result event
    this.eventHandler?.({
      type: 'tool_call_result',
      toolCallId,
      toolName,
      result,
      durationMs,
    });

    return {
      id: toolCallId,
      toolName,
      input,
      output: result,
      durationMs,
      approved: true,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Approval Logic ─────────────────────────────────────────────────

  private needsApproval(toolName: string, handler: ToolHandler): boolean {
    const { mode, categoryOverrides, toolOverrides } = this.approvalConfig;

    // Tool-level override (highest priority)
    if (toolOverrides?.[toolName] !== undefined) {
      return toolOverrides[toolName];
    }

    // Mode-level check
    if (mode === 'yolo') return false;
    if (mode === 'manual') return handler.requiresApproval;

    // Custom mode: check category overrides
    if (mode === 'custom' && categoryOverrides) {
      const catOverride = categoryOverrides[handler.category];
      if (catOverride !== undefined) return catOverride;
    }

    return handler.requiresApproval;
  }

  private async requestApproval(
    id: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this.approvalCallback) {
      // No callback set — auto-approve
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const pending: PendingToolCall = {
        id,
        toolName,
        input,
        description: this.describeToolCall(toolName, input),
        resolve: (approved: boolean) => resolve(approved),
      };
      this.approvalCallback!(pending).then(resolve);
    });
  }

  private describeToolCall(toolName: string, input: Record<string, unknown>): string {
    // Generate a human-readable description of the tool call
    switch (toolName) {
      case 'write_file':
      case 'create_file':
        return `${toolName}: ${input.path}`;
      case 'edit_file':
        return `edit_file: ${input.path}`;
      case 'run_terminal_command':
        return `run: ${input.command}`;
      case 'git_commit':
        return `git commit: "${input.message}"`;
      case 'git_add':
        return `git add: ${Array.isArray(input.paths) ? (input.paths as string[]).join(', ') : 'all'}`;
      case 'mcp_call':
        return `MCP: ${input.server_id}/${input.tool_name}`;
      default:
        return `${toolName}(${Object.keys(input).join(', ')})`;
    }
  }
}
