// ─── Provider & Model Catalog ─────────────────────────────────────────────────
// Desktop view of the canonical catalog exported by `@hyscode/ai-providers`
// (`getProviderCatalog`). The canonical catalog is derived from the provider
// implementations themselves, so this module adds only UI metadata
// (`needsKey`, `supportsCustomModels`) — never model lists. The TUI runtime
// bridge serves the same canonical entries, keeping both surfaces in lockstep.

import type { AIModel } from '@hyscode/ai-providers';
import { getProviderCatalog } from '@hyscode/ai-providers';
import type { CustomModel } from '@/stores/settings-store';

export interface ModelInfo {
  id: string;
  name: string;
  /** Whether this model supports thinking/reasoning modes */
  supportsThinking?: boolean;
  /** Type of thinking control supported by this model */
  thinkingType?: 'anthropic' | 'openai' | 'gemini' | 'kimi' | 'deepseek' | 'mistral' | 'none';
  /** Available thinking levels for this model (if applicable) */
  thinkingLevels?: string[];
  /** Available reasoning modes (e.g. GPT-5.6 standard|pro) */
  thinkingModes?: string[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
  needsKey: boolean;
  supportsCustomModels?: boolean;
}

const PROVIDER_UI_METADATA: Record<string, { needsKey: boolean; supportsCustomModels?: boolean }> = {
  anthropic: { needsKey: true },
  openai: { needsKey: true },
  gemini: { needsKey: true },
  openrouter: { needsKey: true, supportsCustomModels: true },
  ollama: { needsKey: false, supportsCustomModels: true },
  'github-copilot': { needsKey: false }, // Uses OAuth, not API key
  'opencode-zen': { needsKey: true },
  'opencode-go': { needsKey: true },
  codex: { needsKey: true },
};

/** Maps a canonical runtime model to the UI-facing metadata shape. */
export function modelInfoFromAiModel(model: AIModel): ModelInfo {
  const variants = model.thinkingVariants;
  const thinking = Boolean(variants && variants.kind !== 'none');
  return {
    id: model.id,
    name: model.name,
    supportsThinking: thinking,
    ...(thinking && variants
      ? {
          thinkingType: variants.kind,
          ...(variants.levels?.length ? { thinkingLevels: [...variants.levels] } : {}),
          ...(variants.modes?.length ? { thinkingModes: [...variants.modes] } : {}),
        }
      : { thinkingType: 'none' as const }),
  };
}

export const PROVIDERS: ProviderInfo[] = getProviderCatalog().map((entry) => ({
  id: entry.id,
  name: entry.name,
  needsKey: PROVIDER_UI_METADATA[entry.id]?.needsKey ?? true,
  ...PROVIDER_UI_METADATA[entry.id]?.supportsCustomModels ? { supportsCustomModels: true } : {},
  models: entry.models.map(modelInfoFromAiModel),
}));

/** Replaces a provider's model list with locally discovered ones (e.g. Ollama daemon). */
export function applyDiscoveredModels(providerId: string, models: AIModel[]): void {
  const entry = PROVIDERS.find((provider) => provider.id === providerId);
  if (entry) entry.models = models.map(modelInfoFromAiModel);
}

/** Get all models for a provider (catalog + user custom) */
export function getProviderModels(provider: ProviderInfo, customModels: CustomModel[]): ModelInfo[] {
  const customs = customModels.filter((c) => c.providerId === provider.id).map((c) => ({ id: c.modelId, name: c.name }));
  return [...provider.models, ...customs];
}

/** Check if a model is enabled for a provider.
 *  Absent key = all catalog models enabled by default. */
export function isModelEnabled(enabledModels: Record<string, string[]>, providerId: string, modelId: string): boolean {
  const explicit = enabledModels[providerId];
  if (!explicit) return true;
  return explicit.includes(modelId);
}

/** Get flat list of enabled models for a single provider */
export function getEnabledModelsForProvider(providerId: string, enabledModels: Record<string, string[]>, customModels: CustomModel[]): ModelInfo[] {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return [];
  const all = getProviderModels(provider, customModels);
  return all.filter((m) => isModelEnabled(enabledModels, providerId, m.id));
}

/** Get all enabled models grouped by provider */
export function getAllEnabledModelsGrouped(enabledModels: Record<string, string[]>, customModels: CustomModel[]): Array<{ provider: ProviderInfo; models: ModelInfo[] }> {
  return PROVIDERS.map((p) => ({
    provider: p,
    models: getEnabledModelsForProvider(p.id, enabledModels, customModels),
  })).filter((g) => g.models.length > 0);
}
