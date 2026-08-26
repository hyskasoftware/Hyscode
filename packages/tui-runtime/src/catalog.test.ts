import { describe, expect, it } from 'vitest';
import { buildCatalogProviders } from './catalog';

describe('buildCatalogProviders', () => {
  const configuredIds = ['anthropic', 'ollama'];

  it('lists every canonical provider with a configured flag', () => {
    const providers = buildCatalogProviders({ configuredIds });
    expect(providers.map((provider) => provider.id)).toEqual([
      'anthropic',
      'openai',
      'gemini',
      'ollama',
      'openrouter',
      'codex',
      'github-copilot',
      'opencode-zen',
      'opencode-go',
    ]);
    expect(providers.find((provider) => provider.id === 'anthropic')?.configured).toBe(true);
    expect(providers.find((provider) => provider.id === 'openai')?.configured).toBe(false);
  });

  it('hides models of unconfigured providers', () => {
    const openai = buildCatalogProviders({ configuredIds }).find((provider) => provider.id === 'openai');
    expect(openai?.models).toEqual([]);
  });

  it('applies enabledModels as an allowlist per provider', () => {
    const anthropic = buildCatalogProviders({
      configuredIds,
      enabledModels: { anthropic: ['claude-opus-5', 'model-not-in-catalog'] },
    }).find((provider) => provider.id === 'anthropic');
    expect(anthropic?.models.map((model) => model.id)).toEqual(['claude-opus-5']);
  });

  it('appends user custom models without duplicating catalog ids', () => {
    const anthropic = buildCatalogProviders({
      configuredIds,
      customModels: [
        { providerId: 'anthropic', modelId: 'claude-opus-5', name: 'Duplicated' },
        { providerId: 'anthropic', modelId: 'vendor/custom-model', name: 'Custom Model' },
        { providerId: 'openai', modelId: 'ignored-unconfigured', name: 'Ignored' },
      ],
    }).find((provider) => provider.id === 'anthropic');
    const ids = anthropic?.models.map((model) => model.id) ?? [];
    expect(ids.filter((id) => id === 'claude-opus-5')).toHaveLength(1);
    expect(anthropic?.models.at(-1)).toMatchObject({ id: 'vendor/custom-model', name: 'Custom Model', supportsTools: true });
  });

  it('prefers live-discovered models over the static list', () => {
    const discovered = [{ id: 'llama4:latest', name: 'llama4:latest', provider: 'ollama', contextWindow: 128000, maxOutputTokens: 8192, supportsTools: true, supportsStreaming: true, supportsVision: false }];
    const ollama = buildCatalogProviders({
      configuredIds,
      dynamicModels: { ollama: discovered },
    }).find((provider) => provider.id === 'ollama');
    expect(ollama?.models.map((model) => model.id)).toEqual(['llama4:latest']);
  });
});
