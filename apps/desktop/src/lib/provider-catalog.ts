// ─── Provider & Model Catalog ─────────────────────────────────────────────────
// Single source of truth for provider/model metadata used by both the AI
// settings tab and the agent-input model selector.

import type { CustomModel } from '@/stores/settings-store';

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
  needsKey: boolean;
  supportsCustomModels?: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    needsKey: true,
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    needsKey: true,
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    needsKey: true,
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    needsKey: true,
    supportsCustomModels: true,
    models: [
      { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'openai/gpt-5.4', name: 'GPT-5.4' },
      { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    needsKey: false,
    supportsCustomModels: true,
    models: [
      { id: 'llama4', name: 'Llama 4' },
      { id: 'qwen3', name: 'Qwen 3' },
      { id: 'deepseek-r1', name: 'DeepSeek R1' },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2' },
    ],
  },
];

/** Get all models for a provider (catalog + user custom) */
export function getProviderModels(
  provider: ProviderInfo,
  customModels: CustomModel[],
): ModelInfo[] {
  const customs = customModels
    .filter((c) => c.providerId === provider.id)
    .map((c) => ({ id: c.modelId, name: c.name }));
  return [...provider.models, ...customs];
}

/** Check if a model is enabled for a provider.
 *  Absent key = all catalog models enabled by default. */
export function isModelEnabled(
  enabledModels: Record<string, string[]>,
  providerId: string,
  modelId: string,
): boolean {
  const explicit = enabledModels[providerId];
  if (!explicit) return true;
  return explicit.includes(modelId);
}

/** Get flat list of enabled models for a single provider */
export function getEnabledModelsForProvider(
  providerId: string,
  enabledModels: Record<string, string[]>,
  customModels: CustomModel[],
): ModelInfo[] {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return [];
  const all = getProviderModels(provider, customModels);
  return all.filter((m) => isModelEnabled(enabledModels, providerId, m.id));
}

/** Get all enabled models grouped by provider */
export function getAllEnabledModelsGrouped(
  enabledModels: Record<string, string[]>,
  customModels: CustomModel[],
): Array<{ provider: ProviderInfo; models: ModelInfo[] }> {
  return PROVIDERS.map((p) => ({
    provider: p,
    models: getEnabledModelsForProvider(p.id, enabledModels, customModels),
  })).filter((g) => g.models.length > 0);
}
