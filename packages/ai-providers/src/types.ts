// ─── Message Types ──────────────────────────────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  base64: string;
  mediaType: string;
}

export interface ToolCallContent {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolCallId: string;
  output: string;
  isError?: boolean;
}

export type MessageContent = TextContent | ImageContent | ToolCallContent | ToolResultContent;

export interface Message {
  role: MessageRole;
  content: MessageContent[];
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ─── Token Usage ────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

// ─── Stream Chunks ──────────────────────────────────────────────────────────

export type StreamChunk =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; input: string }
  | { type: 'tool_call_end'; id: string }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; stopReason: StopReason }
  | { type: 'error'; error: string; retryable?: boolean };

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'error';

// ─── Chat Parameters ────────────────────────────────────────────────────────

export interface ChatParams {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
}

// ─── Chat Response (non-streaming) ──────────────────────────────────────────

export interface ChatResponse {
  content: MessageContent[];
  stopReason: StopReason;
  usage: TokenUsage;
  model: string;
}

// ─── Provider & Model ───────────────────────────────────────────────────────

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  inputPricePerMToken?: number;
  outputPricePerMToken?: number;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  models: AIModel[];
  chat(params: ChatParams): AsyncIterable<StreamChunk>;
  listModels(): Promise<AIModel[]>;
  isConfigured(): boolean;
}

// ─── Retry Config ───────────────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

// ─── Provider Error ─────────────────────────────────────────────────────────

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// ─── HTTP Proxy types (for Rust IPC) ────────────────────────────────────────

export interface StreamRequest {
  provider: string;
  url: string;
  method: 'POST' | 'GET';
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface StreamEvent {
  id: string;
  data: string;
  done: boolean;
  error?: string;
}
