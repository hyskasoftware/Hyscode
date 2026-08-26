// ─── Canonical Provider Catalog ───────────────────────────────────────────────
// Single source of truth for provider/model metadata shown by every surface
// (desktop pickers, AI settings tab, and the TUI runtime bridge).
//
// The entries are read from the provider implementations themselves, so the
// lists shown in the UI always match the catalogs that actually serve chat
// requests. Constructors only store credentials — instantiating with a
// placeholder performs no I/O.
//
// `claude-agent` is intentionally absent: the provider is disabled while in
// development and the registry never registers it (see settings-store
// migration v4).

import type { AIModel } from './types';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { OllamaProvider } from './providers/ollama';
import { OpenRouterProvider } from './providers/openrouter';
import { CodexProvider } from './providers/codex';
import { GitHubCopilotProvider } from './providers/github-copilot';
import { OpenCodeZenProvider } from './providers/opencode-zen';
import { OpenCodeGoProvider } from './providers/opencode-go';

export interface CatalogEntry {
  id: string;
  name: string;
  models: AIModel[];
}

const CATALOG_PROVIDERS = [
  new AnthropicProvider('catalog-placeholder'),
  new OpenAIProvider('catalog-placeholder'),
  new GeminiProvider('catalog-placeholder'),
  new OllamaProvider(),
  new OpenRouterProvider('catalog-placeholder'),
  new CodexProvider(''),
  new GitHubCopilotProvider('catalog-placeholder'),
  new OpenCodeZenProvider('catalog-placeholder'),
  new OpenCodeGoProvider('catalog-placeholder'),
] as const;

/** Live snapshot of the canonical catalog, ordered as the registry initializes providers. */
export function getProviderCatalog(): CatalogEntry[] {
  return CATALOG_PROVIDERS.map((provider) => ({ id: provider.id, name: provider.name, models: provider.models }));
}
