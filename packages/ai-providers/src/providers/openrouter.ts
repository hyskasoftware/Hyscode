import type { AIModel, ChatParams, StreamChunk, FetchImpl } from '../types';
import { OpenAIProvider } from './openai';

// ─── OpenRouter Provider ────────────────────────────────────────────────────
// Reuses OpenAI adapter since OpenRouter is OpenAI-compatible.
// Only overrides: base URL, extra headers, and dynamic model listing.

const OPENROUTER_MODELS: AIModel[] = [
  {
    id: 'anthropic/claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4 (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 200_000,
    maxOutputTokens: 16_384,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3 (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
  },
];

export class OpenRouterProvider extends OpenAIProvider {
  override readonly id = 'openrouter' as const;
  override readonly name = 'OpenRouter';
  override models: AIModel[] = [...OPENROUTER_MODELS];

  constructor(apiKey: string, fetchImpl?: FetchImpl) {
    super(apiKey, 'https://openrouter.ai/api/v1', {
      'HTTP-Referer': 'https://hyscode.dev',
      'X-Title': 'HysCode IDE',
    }, fetchImpl);
  }

  override async listModels(): Promise<AIModel[]> {
    try {
      const response = await this.fetchImpl('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) return this.models;

      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          name: string;
          context_length?: number;
          top_provider?: { max_completion_tokens?: number };
          pricing?: { prompt?: string; completion?: string };
        }>;
      };

      if (data.data?.length) {
        this.models = data.data
          .filter((m) => m.id && m.name)
          .slice(0, 100) // Limit to top 100
          .map((m) => ({
            id: m.id,
            name: m.name,
            provider: 'openrouter',
            contextWindow: m.context_length ?? 128_000,
            maxOutputTokens: m.top_provider?.max_completion_tokens ?? 8_192,
            supportsTools: true, // Most OpenRouter models support tools
            supportsStreaming: true,
            supportsVision: m.name.toLowerCase().includes('vision') || m.id.includes('gpt-4o') || m.id.includes('claude'),
            inputPricePerMToken: m.pricing?.prompt ? parseFloat(m.pricing.prompt) * 1_000_000 : undefined,
            outputPricePerMToken: m.pricing?.completion ? parseFloat(m.pricing.completion) * 1_000_000 : undefined,
          }));
      }

      return this.models;
    } catch {
      return this.models;
    }
  }

  override async *chat(params: ChatParams): AsyncIterable<StreamChunk> {
    yield* super.chat(params);
  }
}
