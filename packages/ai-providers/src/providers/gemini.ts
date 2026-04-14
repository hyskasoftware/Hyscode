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

// ─── Gemini Message Formatting ──────────────────────────────────────────────

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { content: string } } };

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

function toGeminiContents(messages: Message[]): GeminiContent[] {
  const result: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue; // handled via systemInstruction

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts: GeminiPart[] = [];

    for (const c of msg.content) {
      switch (c.type) {
        case 'text':
          parts.push({ text: c.text });
          break;
        case 'image':
          parts.push({ inlineData: { mimeType: c.mediaType, data: c.base64 } });
          break;
        case 'tool_call':
          parts.push({ functionCall: { name: c.name, args: c.input } });
          break;
        case 'tool_result':
          parts.push({
            functionResponse: { name: c.toolCallId, response: { content: c.output } },
          });
          break;
      }
    }

    // Merge consecutive same-role
    const last = result[result.length - 1];
    if (last && last.role === role) {
      last.parts.push(...parts);
    } else {
      result.push({ role, parts });
    }
  }

  return result;
}

function toGeminiTools(tools: ToolDefinition[]): { functionDeclarations: GeminiFunctionDeclaration[] } {
  return {
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    })),
  };
}

// ─── Streaming Response Parser ──────────────────────────────────────────────

function* parseGeminiResponse(data: string): Iterable<StreamChunk> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data);
  } catch {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = parsed.candidates as any[];
  if (!candidates?.length) {
    // Check for usageMetadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = parsed.usageMetadata as any;
    if (usage) {
      yield {
        type: 'usage',
        usage: {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
        },
      };
    }
    return;
  }

  const candidate = candidates[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = candidate.content?.parts as any[];

  if (parts) {
    for (const part of parts) {
      if (part.text) {
        yield { type: 'text_delta', text: part.text };
      }
      if (part.functionCall) {
        const callId = `gemini_${part.functionCall.name}_${Date.now()}`;
        yield { type: 'tool_call_start', id: callId, name: part.functionCall.name };
        yield { type: 'tool_call_delta', id: callId, input: JSON.stringify(part.functionCall.args ?? {}) };
        yield { type: 'tool_call_end', id: callId };
      }
    }
  }

  // Check finish reason
  if (candidate.finishReason) {
    const reasonMap: Record<string, StopReason> = {
      STOP: 'end_turn',
      MAX_TOKENS: 'max_tokens',
      SAFETY: 'end_turn',
      RECITATION: 'end_turn',
    };
    yield { type: 'done', stopReason: reasonMap[candidate.finishReason] ?? 'end_turn' };
  }

  // Usage metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usageMeta = parsed.usageMetadata as any;
  if (usageMeta) {
    yield {
      type: 'usage',
      usage: {
        inputTokens: usageMeta.promptTokenCount ?? 0,
        outputTokens: usageMeta.candidatesTokenCount ?? 0,
        totalTokens: usageMeta.totalTokenCount ?? 0,
      },
    };
  }
}

// ─── Provider Implementation ────────────────────────────────────────────────

const GEMINI_MODELS: AIModel[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputPricePerMToken: 0.075,
    outputPricePerMToken: 0.3,
  },
  {
    id: 'gemini-2.0-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'gemini',
    contextWindow: 2_097_152,
    maxOutputTokens: 8_192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputPricePerMToken: 1.25,
    outputPricePerMToken: 10,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    contextWindow: 2_097_152,
    maxOutputTokens: 8_192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputPricePerMToken: 1.25,
    outputPricePerMToken: 5,
  },
];

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly name = 'Google Gemini';
  models: AIModel[] = [...GEMINI_MODELS];

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://generativelanguage.googleapis.com/v1beta') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async listModels(): Promise<AIModel[]> {
    return this.models;
  }

  async *chat(params: ChatParams): AsyncIterable<StreamChunk> {
    const contents = toGeminiContents(params.messages);

    const body: Record<string, unknown> = { contents };

    if (params.systemPrompt) {
      body.systemInstruction = { parts: [{ text: params.systemPrompt }] };
    }
    if (params.tools?.length) {
      body.tools = [toGeminiTools(params.tools)];
    }

    const generationConfig: Record<string, unknown> = {};
    if (params.maxTokens) generationConfig.maxOutputTokens = params.maxTokens;
    if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
    if (params.topP !== undefined) generationConfig.topP = params.topP;
    if (params.stopSequences?.length) generationConfig.stopSequences = params.stopSequences;
    if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;

    const url = `${this.baseUrl}/models/${params.model}:streamGenerateContent?alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
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
        `Gemini API error: ${response.status} ${errorBody}`,
        'gemini',
        response.status,
        [429, 500, 502, 503].includes(response.status),
        retryAfterMs,
      );
    }

    // Gemini streams SSE with JSON chunks containing candidates
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError('No response body', 'gemini');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (params.signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') return;
            for (const chunk of parseGeminiResponse(data)) {
              yield chunk;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
