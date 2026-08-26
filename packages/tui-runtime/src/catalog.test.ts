import { describe, expect, it } from 'vitest';
import { buildCatalogProviders } from './catalog';
import type { AIModel } from '@hyscode/ai-providers';

/** Mirrors resolver output shape proven in packages/ai-providers
 *  (model-metadata/resolver.test.ts): curated rows keep pricing/thinking,
 *  unknown live ids bootstrap conservatively. */
const zenResolvedFixture: AIModel[] = [
  { id: 'claude-fable-5', name: 'Claude Fable 5 (Zen)', provider: 'opencode-zen', contextWindow: 1_000_000, maxOutputTokens: 128_000, supportsTools: true, supportsStreaming: true, supportsVision: true, inputPricePerMToken: 10, outputPricePerMToken: 50 },
  { id: 'brand-new-upstream', name: 'brand-new-upstream (Zen)', provider: 'opencode-zen', contextWindow: 1_000_000, maxOutputTokens: 16_384, supportsTools: true, supportsStreaming: true, supportsVision: false },
];
const goResolvedFixture: AIModel[] = [
  { id: 'glm-5.3-flash', name: 'GLM 5.3 Flash (Go)', provider: 'opencode-go', contextWindow: 200_000, maxOutputTokens: 128_000, supportsTools: true, supportsStreaming: true, supportsVision: false, inputPricePerMToken: 0.15, outputPricePerMToken: 0.5 },
];

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

  it('reflects gateway-refreshed zen/go lists via dynamicModels (issue #51)', () => {
    const configuredWithZenGo = [...configuredIds, 'opencode-zen', 'opencode-go'];

    const providers = buildCatalogProviders({
      configuredIds: configuredWithZenGo,
      dynamicModels: { 'opencode-zen': zenResolvedFixture, 'opencode-go': goResolvedFixture },
    });
    const zen = providers.find((provider) => provider.id === 'opencode-zen');
    const go = providers.find((provider) => provider.id === 'opencode-go');
    expect(zen?.configured).toBe(true);
    expect(zen?.models.map((m) => m.id)).toEqual(['claude-fable-5', 'brand-new-upstream']);
    const brandNew = zen?.models.find((m) => m.id === 'brand-new-upstream');
    expect(brandNew).toMatchObject({ supportsTools: true, contextWindow: 1_000_000 });
    expect(go?.models.map((m) => m.id)).toEqual(['glm-5.3-flash']);
    expect(go?.models[0].inputPricePerMToken).toBe(0.15);
  });
});
