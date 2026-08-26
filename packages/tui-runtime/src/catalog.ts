// ─── Catalog Join ─────────────────────────────────────────────────────────────
// Builds the provider/model summaries served to the TUI from the canonical
// ai-providers catalog plus the shared settings contract, so the TUI shows
// exactly the same providers, models, thinking variants, enabled/disabled
// toggles and user custom models as the desktop app.

import type { AIModel } from '@hyscode/ai-providers';
import { getProviderCatalog } from '@hyscode/ai-providers';
import type { SharedCustomModel } from './config';

export type CatalogProviderSummary = {
  id: string;
  name: string;
  configured: boolean;
  models: AIModel[];
};

export type CatalogJoinOptions = {
  /** Provider ids registered by the runtime registry (= configured). */
  configuredIds: Iterable<string>;
  /** Live-discovered models that replace a provider's static list (e.g. Ollama). */
  dynamicModels?: Record<string, AIModel[]>;
  /** Provider id → enabled model ids. Absent key = all catalog models enabled. */
  enabledModels?: Record<string, string[]>;
  /** User-added models (primarily OpenRouter/Ollama) from the shared settings. */
  customModels?: SharedCustomModel[];
};

function customModelToAiModel(providerId: string, custom: SharedCustomModel): AIModel {
  return {
    id: custom.modelId,
    name: custom.name || custom.modelId,
    provider: providerId,
    contextWindow: 0,
    maxOutputTokens: 0,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
  };
}

export function buildCatalogProviders(options: CatalogJoinOptions): CatalogProviderSummary[] {
  const configured = new Set(options.configuredIds);
  return getProviderCatalog().map((entry) => {
    const isConfigured = configured.has(entry.id);
    const source = options.dynamicModels?.[entry.id] ?? entry.models;
    const allowed = options.enabledModels?.[entry.id];
    const base = isConfigured
      ? source.filter((model) => !allowed || allowed.includes(model.id))
      : [];
    const existing = new Set(base.map((model) => model.id));
    const customs = (options.customModels ?? [])
      .filter((custom) => custom.providerId === entry.id && custom.modelId && !existing.has(custom.modelId))
      .map((custom) => customModelToAiModel(entry.id, custom));
    return { id: entry.id, name: entry.name, configured: isConfigured, models: [...base, ...customs] };
  });
}
