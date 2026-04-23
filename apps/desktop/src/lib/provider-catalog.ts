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
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
      { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash-Lite Preview' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
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
  {
    id: 'claude-agent',
    name: 'Claude Agent',
    needsKey: false, // Reuses Anthropic API key
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Agent)' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (Agent)' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (Agent)' },
    ],
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    needsKey: false, // Uses OAuth, not API key
    models: [
      // 0× (free)
      { id: 'gpt-4.1', name: 'GPT-4.1 (Copilot)' },
      { id: 'gpt-4o', name: 'GPT-4o (Copilot)' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini (Copilot)' },
      { id: 'raptor-mini', name: 'Raptor Mini (Copilot)' },
      // 0.25×
      { id: 'grok-code-fast-1', name: 'Grok Code Fast 1 (Copilot)' },
      // 0.33×
      { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5 (Copilot)' },
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash (Copilot)' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini (Copilot)' },
      // 1×
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4 (Copilot)' },
      { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5 (Copilot)' },
      { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6 (Copilot)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Copilot)' },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro (Copilot)' },
      { id: 'gpt-5.2', name: 'GPT-5.2 (Copilot)' },
      { id: 'gpt-5.2-codex', name: 'GPT-5.2-Codex (Copilot)' },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3-Codex (Copilot)' },
      { id: 'gpt-5.4', name: 'GPT-5.4 (Copilot)' },
      // 3×
      { id: 'claude-opus-4.5', name: 'Claude Opus 4.5 (Copilot)' },
      { id: 'claude-opus-4.6', name: 'Claude Opus 4.6 (Copilot)' },
    ],
  },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    needsKey: true,
    models: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7 (Zen)' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (Zen)' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Zen)' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5 (Zen)' },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4 (Zen)' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (Zen)' },
      { id: 'claude-3-5-haiku', name: 'Claude Haiku 3.5 (Zen)' },
      { id: 'qwen3.6-plus', name: 'Qwen3.6 Plus (Zen)' },
      { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus (Zen)' },
      { id: 'minimax-m2.7', name: 'MiniMax M2.7 (Zen)' },
      { id: 'minimax-m2.5', name: 'MiniMax M2.5 (Zen)' },
      { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free (Zen)' },
      { id: 'glm-5.1', name: 'GLM 5.1 (Zen)' },
      { id: 'glm-5', name: 'GLM 5 (Zen)' },
      { id: 'kimi-k2.5', name: 'Kimi K2.5 (Zen)' },
      { id: 'kimi-k2.6', name: 'Kimi K2.6 (Zen)' },
      { id: 'big-pickle', name: 'Big Pickle (Zen)' },
      { id: 'ling-2.6-flash', name: 'Ling 2.6 Flash (Zen)' },
      { id: 'hy3-preview-free', name: 'Hy3 Preview Free (Zen)' },
      { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free (Zen)' },
    ],
  },
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    needsKey: true,
    models: [
      { id: 'glm-5.1', name: 'GLM 5.1 (Go)' },
      { id: 'glm-5', name: 'GLM 5 (Go)' },
      { id: 'kimi-k2.5', name: 'Kimi K2.5 (Go)' },
      { id: 'kimi-k2.6', name: 'Kimi K2.6 (Go)' },
      { id: 'mimo-v2-pro', name: 'MiMo V2 Pro (Go)' },
      { id: 'mimo-v2-omni', name: 'MiMo V2 Omni (Go)' },
      { id: 'mimo-v2.5-pro', name: 'MiMo V2.5 Pro (Go)' },
      { id: 'mimo-v2.5', name: 'MiMo V2.5 (Go)' },
      { id: 'minimax-m2.7', name: 'MiniMax M2.7 (Go)' },
      { id: 'minimax-m2.5', name: 'MiniMax M2.5 (Go)' },
      { id: 'qwen3.6-plus', name: 'Qwen3.6 Plus (Go)' },
      { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus (Go)' },
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
