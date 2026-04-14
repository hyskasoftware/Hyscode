// ─── Agent Harness Types ────────────────────────────────────────────────────
// Core types for the agent harness orchestration engine.

import type { Message, StreamChunk, ToolDefinition } from '@hyscode/ai-providers';

// ─── Tool System ────────────────────────────────────────────────────────────

export type ToolCategory = 'filesystem' | 'terminal' | 'git' | 'code' | 'browser' | 'mcp' | 'meta';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolHandler {
  definition: ToolDefinition;
  category: ToolCategory;
  requiresApproval: boolean;
  execute: (input: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}

export interface ToolExecutionContext {
  workspacePath: string;
  conversationId: string;
  /** The ID of the current tool call (set per-call by the harness) */
  toolCallId: string;
  /** Invoke a Tauri command */
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  /** Listen to a Tauri event. Returns an unlisten function. */
  listen?: (event: string, handler: (payload: unknown) => void) => Promise<() => void>;
  /** Callback fired when a file-writing tool mutates a file on disk */
  onFileChange?: (change: FileChangePending) => void;
}

/** Emitted when a tool writes/edits/creates a file so the UI can track it */
export interface FileChangePending {
  toolCallId: string;
  toolName: string;
  filePath: string;
  /** null when the file is newly created */
  originalContent: string | null;
  newContent: string;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output: ToolResult;
  durationMs: number;
  approved: boolean;
  timestamp: string;
}

// ─── Approval System ────────────────────────────────────────────────────────

export type ApprovalMode = 'manual' | 'yolo' | 'custom';

export interface ApprovalConfig {
  mode: ApprovalMode;
  /** Per-category overrides (only used in 'custom' mode) */
  categoryOverrides?: Partial<Record<ToolCategory, boolean>>;
  /** Per-tool overrides (highest priority) */
  toolOverrides?: Record<string, boolean>;
}

export interface PendingToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  description: string;
  resolve: (approved: boolean, reason?: string) => void;
}

// ─── Context Manager ────────────────────────────────────────────────────────

export type ContextPriority = 'always' | 'high' | 'medium' | 'low';

export interface ContextSource {
  id: string;
  type: 'active_file' | 'selection' | 'context_chip' | 'git_diff' | 'file_tree' | 'terminal' | 'search_results';
  priority: ContextPriority;
  content: string;
  tokenEstimate: number;
  metadata?: Record<string, unknown>;
}

export interface TokenBudget {
  maxInput: number;
  maxOutput: number;
  reserved: {
    systemPrompt: number;
    toolDefinitions: number;
    responseBuffer: number;
  };
  available: number;
}

export interface ContextSnapshot {
  systemPrompt: string;
  messages: Message[];
  tools: ToolDefinition[];
  totalTokens: number;
  budget: TokenBudget;
}

// ─── Agent Definitions ──────────────────────────────────────────────────────

export type AgentType = 'chat' | 'build' | 'review' | 'debug' | 'plan';

export interface AgentDefinition {
  type: AgentType;
  name: string;
  description: string;
  /** Base system prompt for this agent */
  basePrompt: string;
  /** Which tool categories this agent can use */
  allowedToolCategories: ToolCategory[];
  /** Additional tool names that are explicitly allowed/denied */
  toolOverrides?: { allow?: string[]; deny?: string[] };
  /** Skills that are always active for this agent */
  defaultSkills?: string[];
  /** Max iterations per turn */
  maxIterations: number;
  /** Output token limit */
  maxOutputTokens: number;
}

// ─── Conversation ───────────────────────────────────────────────────────────

export type ConversationMode = 'chat' | 'agent' | 'sdd';

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  mode: ConversationMode;
  agentType: AgentType;
  messages: Message[];
  contextFiles: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── SDD (Spec-Driven Development) ─────────────────────────────────────────

export type SddStatus =
  | 'describing'
  | 'specifying'
  | 'planning'
  | 'executing'
  | 'reviewing'
  | 'completed'
  | 'cancelled';

export type SddTaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

export interface SddSession {
  id: string;
  projectId: string;
  description: string;
  spec: string | null;
  specApproved: boolean;
  tasks: SddTask[];
  status: SddStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SddTask {
  id: string;
  sessionId: string;
  ordinal: number;
  title: string;
  description: string;
  files: string[];
  dependencies: string[];
  status: SddTaskStatus;
  agentOutput: string | null;
  toolCalls: ToolCallRecord[];
  createdAt: string;
  updatedAt: string;
}

// ─── Harness Configuration ──────────────────────────────────────────────────

export interface HarnessConfig {
  /** Default provider ID */
  providerId: string;
  /** Default model ID */
  modelId: string;
  /** Max iterations per agent turn */
  maxIterations: number;
  /** Max total input tokens per turn */
  maxInputTokens: number;
  /** Max output tokens per turn */
  maxOutputTokens: number;
  /** Turn timeout in ms */
  turnTimeoutMs: number;
  /** Approval configuration */
  approval: ApprovalConfig;
}

export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  providerId: '',
  modelId: '',
  maxIterations: 25,
  maxInputTokens: 200_000,
  maxOutputTokens: 16_000,
  turnTimeoutMs: 300_000, // 5 minutes
  approval: {
    mode: 'manual',
  },
};

// ─── Harness Events ─────────────────────────────────────────────────────────
// Events emitted by the harness for UI updates.

export type HarnessEvent =
  | { type: 'turn_start'; conversationId: string; iteration: number }
  | { type: 'stream_chunk'; chunk: StreamChunk }
  | { type: 'tool_call_start'; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_call_pending'; pending: PendingToolCall }
  | { type: 'tool_call_result'; toolCallId: string; toolName: string; result: ToolResult; durationMs: number }
  | { type: 'turn_end'; reason: 'complete' | 'max_iterations' | 'cancelled' | 'error'; error?: string }
  | { type: 'context_overflow'; droppedMessages: number }
  | { type: 'sdd_phase_change'; phase: SddStatus }
  | { type: 'sdd_task_start'; task: SddTask }
  | { type: 'sdd_task_complete'; task: SddTask }
  | { type: 'file_change_pending'; change: FileChangePending };

export type HarnessEventHandler = (event: HarnessEvent) => void;

// ─── Skill Types ────────────────────────────────────────────────────────────

export type SkillScope = 'built-in' | 'global' | 'workspace';
export type SkillActivation = 'always' | 'manual' | 'trigger';

export interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
  scope: SkillScope;
  activation: SkillActivation;
  trigger?: string;
  agents?: AgentType[];
  globs?: string[];
}

export interface Skill {
  id: string;
  frontmatter: SkillFrontmatter;
  content: string;
  filePath: string;
  active: boolean;
}

// ─── Agent Task System ──────────────────────────────────────────────────────
// Lightweight in-conversation task tracking (similar to how Copilot tracks todos).

export type AgentTaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export interface AgentTask {
  id: number;
  title: string;
  status: AgentTaskStatus;
  detail?: string;
  createdAt: string;
  updatedAt: string;
}
