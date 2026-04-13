import type { AIProvider, AIModel, ChatParams, StreamChunk, RetryConfig } from './types';
import { ProviderError } from './types';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { OllamaProvider } from './providers/ollama';
import { OpenRouterProvider } from './providers/openrouter';
import { withRetry } from './retry';

// ─── Key Store Interface ────────────────────────────────────────────────────
// Abstraction over the actual key storage (Tauri stronghold, env vars, etc.)

export interface KeyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

// ─── Provider Registry ──────────────────────────────────────────────────────

export class ProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private _defaultProviderId: string | null = null;
  private _defaultModelId: string | null = null;
  private retryConfig: Partial<RetryConfig> = {};

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(id: string): void {
    this.providers.delete(id);
    if (this._defaultProviderId === id) {
      this._defaultProviderId = null;
    }
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  listConfigured(): AIProvider[] {
    return this.list().filter((p) => p.isConfigured());
  }

  setDefault(providerId: string, modelId?: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Provider "${providerId}" not registered`);
    }
    this._defaultProviderId = providerId;
    this._defaultModelId = modelId ?? null;
  }

  getDefault(): { provider: AIProvider; modelId: string } {
    const providerId = this._defaultProviderId;
    if (!providerId) {
      // Fallback: first configured provider
      const configured = this.listConfigured();
      if (!configured.length) {
        throw new ProviderError('No AI providers configured', 'registry');
      }
      const provider = configured[0];
      return { provider, modelId: provider.models[0]?.id ?? '' };
    }

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ProviderError(`Default provider "${providerId}" not found`, 'registry');
    }

    return {
      provider,
      modelId: this._defaultModelId ?? provider.models[0]?.id ?? '',
    };
  }

  get defaultProviderId(): string | null {
    return this._defaultProviderId;
  }

  get defaultModelId(): string | null {
    return this._defaultModelId;
  }

  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = config;
  }

  /** Get all available models across all configured providers */
  async listAllModels(): Promise<AIModel[]> {
    const allModels: AIModel[] = [];
    for (const provider of this.listConfigured()) {
      const models = await provider.listModels();
      allModels.push(...models);
    }
    return allModels;
  }

  /** Chat with retry, using the specified or default provider */
  async *chat(params: ChatParams & { providerId?: string }): AsyncIterable<StreamChunk> {
    const { providerId, ...chatParams } = params;

    let provider: AIProvider;
    let model = chatParams.model;

    if (providerId) {
      const p = this.providers.get(providerId);
      if (!p) throw new ProviderError(`Provider "${providerId}" not found`, 'registry');
      provider = p;
    } else {
      const def = this.getDefault();
      provider = def.provider;
      if (!model) model = def.modelId;
    }

    if (!provider.isConfigured()) {
      throw new ProviderError(`Provider "${provider.id}" is not configured (missing API key?)`, provider.id);
    }

    // For streaming, we wrap the initial connection in retry but stream without retry
    // (retrying mid-stream would break the protocol)
    const stream = await withRetry(
      async () => {
        const iter = provider.chat({ ...chatParams, model });
        // Get the iterator and try the first read to verify connection works
        const asyncIter = iter[Symbol.asyncIterator]();
        const first = await asyncIter.next();
        return { asyncIter, first };
      },
      this.retryConfig,
    );

    if (!stream.first.done) {
      yield stream.first.value;
    }

    while (true) {
      const result = await stream.asyncIter.next();
      if (result.done) break;
      yield result.value;
    }
  }

  // ─── Initialization ─────────────────────────────────────────────────────

  /**
   * Initialize all providers from a key store.
   * Called on app startup to register providers with their API keys.
   */
  async initialize(keyStore: KeyStore, ollamaBaseUrl?: string): Promise<void> {
    // Anthropic
    const anthropicKey = await keyStore.get('anthropic_api_key');
    if (anthropicKey) {
      this.register(new AnthropicProvider(anthropicKey));
    }

    // OpenAI
    const openaiKey = await keyStore.get('openai_api_key');
    if (openaiKey) {
      this.register(new OpenAIProvider(openaiKey));
    }

    // Gemini
    const geminiKey = await keyStore.get('gemini_api_key');
    if (geminiKey) {
      this.register(new GeminiProvider(geminiKey));
    }

    // Ollama (always registered, no key needed)
    this.register(new OllamaProvider(ollamaBaseUrl));

    // OpenRouter
    const openrouterKey = await keyStore.get('openrouter_api_key');
    if (openrouterKey) {
      this.register(new OpenRouterProvider(openrouterKey));
    }

    // Set default to first configured provider
    const configured = this.listConfigured();
    if (configured.length) {
      this._defaultProviderId = configured[0].id;
      this._defaultModelId = configured[0].models[0]?.id ?? null;
    }
  }

  /**
   * Re-initialize a single provider (e.g., after user changes API key).
   */
  async reinitializeProvider(
    providerId: string,
    keyStore: KeyStore,
    ollamaBaseUrl?: string,
  ): Promise<void> {
    this.unregister(providerId);

    switch (providerId) {
      case 'anthropic': {
        const key = await keyStore.get('anthropic_api_key');
        if (key) this.register(new AnthropicProvider(key));
        break;
      }
      case 'openai': {
        const key = await keyStore.get('openai_api_key');
        if (key) this.register(new OpenAIProvider(key));
        break;
      }
      case 'gemini': {
        const key = await keyStore.get('gemini_api_key');
        if (key) this.register(new GeminiProvider(key));
        break;
      }
      case 'ollama': {
        this.register(new OllamaProvider(ollamaBaseUrl));
        break;
      }
      case 'openrouter': {
        const key = await keyStore.get('openrouter_api_key');
        if (key) this.register(new OpenRouterProvider(key));
        break;
      }
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _registry: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!_registry) {
    _registry = new ProviderRegistry();
  }
  return _registry;
}
