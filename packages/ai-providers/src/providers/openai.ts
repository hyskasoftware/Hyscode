import type {
  AIProvider,
  AIModel,
  ChatParams,
  StreamChunk,
  Message,
  ToolDefinition,
  StopReason,
} from '../types';
import { ProviderError } from '../types';
import { parseSSEStream } from '../retry';

// ─── OpenAI Message Formatting ──────────────────────────────────────────────

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | OpenAIContentPart[] | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAITool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

function toOpenAIMessages(messages: Message[], systemPrompt?: string): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === 'system') {
      result.push({ role: 'system', content: msg.content.map(c => c.type === 'text' ? c.text : '').join('') });
      continue;
    }

    if (msg.role === 'tool') {
      for (const c of msg.content) {
        if (c.type === 'tool_result') {
          result.push({ role: 'tool', content: c.output, tool_call_id: c.toolCallId });
        }
      }
      continue;
    }

    if (msg.role === 'assistant') {
      const textParts: string[] = [];
      const toolCalls: OpenAIToolCall[] = [];

      for (const c of msg.content) {
        if (c.type === 'text') textParts.push(c.text);
        if (c.type === 'tool_call') {
          toolCalls.push({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.input) },
          });
        }
      }

      const assistantMsg: OpenAIMessage = { role: 'assistant' };
      if (textParts.length) assistantMsg.content = textParts.join('');
      if (toolCalls.length) assistantMsg.tool_calls = toolCalls;
      if (!textParts.length && !toolCalls.length) assistantMsg.content = '';
      result.push(assistantMsg);
      continue;
    }

    // user message
    const contentParts: OpenAIContentPart[] = [];
    for (const c of msg.content) {
      if (c.type === 'text') contentParts.push({ type: 'text', text: c.text });
      if (c.type === 'image') {
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:${c.mediaType};base64,${c.base64}` },
        });
      }
    }
    result.push({
      role: 'user',
      content: contentParts.length === 1 && contentParts[0].type === 'text'
        ? contentParts[0].text
        : contentParts,
    });
  }

  return result;
}

function toOpenAITools(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

// ─── SSE Parsing ────────────────────────────────────────────────────────────

function parseOpenAIChunk(data: string): StreamChunk | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices = parsed.choices as any[];
  if (!choices?.length) {
    // Could be a usage-only chunk
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = parsed.usage as any;
    if (usage) {
      return {
        type: 'usage',
        usage: {
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
      };
    }
    return null;
  }

  const choice = choices[0];
  const delta = choice.delta;
  const finishReason = choice.finish_reason;

  if (finishReason) {
    const reasonMap: Record<string, StopReason> = {
      stop: 'end_turn',
      tool_calls: 'tool_use',
      length: 'max_tokens',
    };
    return { type: 'done', stopReason: reasonMap[finishReason] ?? 'end_turn' };
  }

  if (delta?.content) {
    return { type: 'text_delta', text: delta.content };
  }

  if (delta?.tool_calls) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tc = delta.tool_calls[0] as any;
    if (tc.function?.name) {
      return { type: 'tool_call_start', id: tc.id ?? '', name: tc.function.name };
    }
    if (tc.function?.arguments) {
      return { type: 'tool_call_delta', id: tc.id ?? '', input: tc.function.arguments };
    }
  }

  return null;
}

// ─── Provider Implementation ────────────────────────────────────────────────

const OPENAI_MODELS: AIModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputPricePerMToken: 2.5,
    outputPricePerMToken: 10,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputPricePerMToken: 0.15,
    outputPricePerMToken: 0.6,
  },
  {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputPricePerMToken: 10,
    outputPricePerMToken: 40,
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini',
    provider: 'openai',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
    inputPricePerMToken: 1.1,
    outputPricePerMToken: 4.4,
  },
];

export class OpenAIProvider implements AIProvider {
  readonly id: string = 'openai';
  readonly name: string = 'OpenAI';
  models: AIModel[] = [...OPENAI_MODELS];

  protected apiKey: string;
  protected baseUrl: string;
  protected defaultHeaders: Record<string, string>;

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1', extraHeaders: Record<string, string> = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultHeaders = extraHeaders;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async listModels(): Promise<AIModel[]> {
    return this.models;
  }

  async *chat(params: ChatParams): AsyncIterable<StreamChunk> {
    const messages = toOpenAIMessages(params.messages, params.systemPrompt);

    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (params.maxTokens) body.max_tokens = params.maxTokens;
    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.topP !== undefined) body.top_p = params.topP;
    if (params.stopSequences?.length) body.stop = params.stopSequences;
    if (params.tools?.length) body.tools = toOpenAITools(params.tools);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.defaultHeaders,
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader
        ? parseFloat(retryAfterHeader) * 1_000
        : undefined;
      throw new ProviderError(
        `${this.name} API error: ${response.status} ${errorBody}`,
        this.id,
        response.status,
        [429, 500, 502, 503].includes(response.status),
        retryAfterMs,
      );
    }

    // Track tool call IDs across delta chunks
    let currentToolCallId = '';

    for await (const data of parseSSEStream(response, params.signal)) {
      const chunk = parseOpenAIChunk(data);
      if (!chunk) continue;

      // OpenAI sends tool_call_start with the id, then deltas without id
      if (chunk.type === 'tool_call_start' && chunk.id) {
        currentToolCallId = chunk.id;
      } else if (chunk.type === 'tool_call_delta' && !chunk.id) {
        yield { ...chunk, id: currentToolCallId };
        continue;
      }

      yield chunk;
    }

    // If we didn't get an explicit done, emit one
    // (OpenAI sometimes ends without finish_reason in stream)
  }
}
