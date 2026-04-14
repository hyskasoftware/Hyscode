import type {
  AIProvider,
  AIModel,
  ChatParams,
  StreamChunk,
  Message,
  ToolDefinition,
  FetchImpl,
} from '../types';
import { ProviderError } from '../types';
import { parseSSEStream } from '../retry';

// ─── Anthropic Message Formatting ───────────────────────────────────────────

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContent[];
}

type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

function toAnthropicMessages(messages: Message[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue; // system prompt handled separately

    const role = msg.role === 'tool' ? 'user' : msg.role === 'user' ? 'user' : 'assistant';
    const content: AnthropicContent[] = [];

    for (const c of msg.content) {
      switch (c.type) {
        case 'text':
          content.push({ type: 'text', text: c.text });
          break;
        case 'image':
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: c.mediaType, data: c.base64 },
          });
          break;
        case 'tool_call':
          content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input });
          break;
        case 'tool_result':
          content.push({
            type: 'tool_result',
            tool_use_id: c.toolCallId,
            content: c.output,
            is_error: c.isError,
          });
          break;
      }
    }

    // Anthropic requires alternating user/assistant. Merge consecutive same-role messages
    const last = result[result.length - 1];
    if (last && last.role === role) {
      last.content.push(...content);
    } else {
      result.push({ role, content });
    }
  }

  return result;
}

function toAnthropicTools(tools: ToolDefinition[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

// ─── SSE Event Parsing ──────────────────────────────────────────────────────

interface AnthropicSSEEvent {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function parseAnthropicEvent(data: string): StreamChunk | null {
  let event: AnthropicSSEEvent;
  try {
    event = JSON.parse(data);
  } catch {
    return null;
  }

  switch (event.type) {
    case 'message_start':
      if (event.message?.usage) {
        return {
          type: 'usage',
          usage: {
            inputTokens: event.message.usage.input_tokens ?? 0,
            outputTokens: event.message.usage.output_tokens ?? 0,
            totalTokens:
              (event.message.usage.input_tokens ?? 0) + (event.message.usage.output_tokens ?? 0),
            cacheReadTokens: event.message.usage.cache_read_input_tokens,
            cacheWriteTokens: event.message.usage.cache_creation_input_tokens,
          },
        };
      }
      return null;

    case 'content_block_start':
      if (event.content_block?.type === 'tool_use') {
        return {
          type: 'tool_call_start',
          id: event.content_block.id,
          name: event.content_block.name,
        };
      }
      return null;

    case 'content_block_delta':
      if (event.delta?.type === 'thinking_delta') {
        return { type: 'thinking_delta', text: event.delta.thinking };
      }
      if (event.delta?.type === 'text_delta') {
        return { type: 'text_delta', text: event.delta.text };
      }
      if (event.delta?.type === 'input_json_delta') {
        return {
          type: 'tool_call_delta',
          id: String(event.index),
          input: event.delta.partial_json,
        };
      }
      return null;

    case 'content_block_stop':
      if (event.index !== undefined) {
        return { type: 'tool_call_end', id: String(event.index) };
      }
      return null;

    case 'message_delta':
      if (event.delta?.stop_reason) {
        const stopReason = event.delta.stop_reason === 'tool_use' ? 'tool_use' :
          event.delta.stop_reason === 'max_tokens' ? 'max_tokens' : 'end_turn';
        return {
          type: 'done',
          stopReason,
        };
      }
      if (event.usage) {
        return {
          type: 'usage',
          usage: {
            inputTokens: event.usage.input_tokens ?? 0,
            outputTokens: event.usage.output_tokens ?? 0,
            totalTokens:
              (event.usage.input_tokens ?? 0) + (event.usage.output_tokens ?? 0),
          },
        };
      }
      return null;

    case 'message_stop':
      return null; // Already handled by message_delta

    case 'error':
      return {
        type: 'error',
        error: event.error?.message ?? 'Unknown Anthropic error',
        retryable: event.error?.type === 'overloaded_error',
      };

    default:
      return null;
  }
}

// ─── Provider Implementation ────────────────────────────────────────────────

const ANTHROPIC_MODELS: AIModel[] = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 16_384,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputPricePerMToken: 3,
    outputPricePerMToken: 15,
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 16_384,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputPricePerMToken: 15,
    outputPricePerMToken: 75,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputPricePerMToken: 0.8,
    outputPricePerMToken: 4,
  },
];

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const;
  readonly name = 'Anthropic';
  models: AIModel[] = [...ANTHROPIC_MODELS];

  private apiKey: string;
  private baseUrl: string;
  private fetchImpl: FetchImpl;

  constructor(apiKey: string, baseUrl = 'https://api.anthropic.com', fetchImpl?: FetchImpl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async listModels(): Promise<AIModel[]> {
    return this.models;
  }

  async *chat(params: ChatParams): AsyncIterable<StreamChunk> {
    const messages = toAnthropicMessages(params.messages);

    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      max_tokens: params.maxTokens ?? 8192,
      stream: true,
    };

    if (params.systemPrompt) {
      body.system = params.systemPrompt;
    }
    if (params.tools?.length) {
      body.tools = toAnthropicTools(params.tools);
    }
    if (params.temperature !== undefined) {
      body.temperature = params.temperature;
    }
    if (params.topP !== undefined) {
      body.top_p = params.topP;
    }
    if (params.stopSequences?.length) {
      body.stop_sequences = params.stopSequences;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
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
        `Anthropic API error: ${response.status} ${errorBody}`,
        'anthropic',
        response.status,
        [429, 500, 502, 503, 529].includes(response.status),
        retryAfterMs,
      );
    }

    // Track current tool block index -> tool call id mapping
    const toolBlockMap = new Map<number, string>();
    let currentToolIndex = -1;

    for await (const data of parseSSEStream(response, params.signal)) {
      const chunk = parseAnthropicEvent(data);
      if (!chunk) continue;

      // Fix tool_call_delta and tool_call_end to use correct IDs
      if (chunk.type === 'tool_call_start') {
        currentToolIndex++;
        toolBlockMap.set(currentToolIndex, chunk.id);
      } else if (chunk.type === 'tool_call_delta') {
        const id = toolBlockMap.get(Number(chunk.id)) ?? chunk.id;
        yield { ...chunk, id };
        continue;
      } else if (chunk.type === 'tool_call_end') {
        const id = toolBlockMap.get(Number(chunk.id)) ?? chunk.id;
        yield { ...chunk, id };
        continue;
      }

      yield chunk;
    }
  }
}
