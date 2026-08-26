// ─── models.dev → CatalogEnrichmentEntry Normalizer ─────────────────────────
// Layer C3 (issue #51). Converts a models.dev api.json provider entry
// (https://models.dev/api.json, providers "opencode" / "opencode-go") into
// resolver enrichment entries for ids missing from the curated catalog.
//
// Upstream fields consumed (verified Aug 2026):
//   cost.{input,output,cache_read}      $/M tokens — same unit we publish
//   limit.{context,output}              token counts
//   modalities.input includes 'image'   → supportsVision
//   tool_call                           → supportsTools
//   attachment                          ignored (no consumer)
//   reasoning_options                   IGNORED deliberately: missing/empty
//     for always-on and toggle models; misses GPT-5.6 pro modes; Claude data
//     maps to budget_tokens. thinkingVariants stay curated-only.
//
// Consumption happens ONLY in scripts/sync-model-catalog.mjs (build-time) and
// through resolver enrichment — never from the app runtime.

import type { CatalogEnrichmentEntry } from './resolver';

export const MODELSDV_API_URL = 'https://models.dev/api.json';

export interface ModelsDevPricing {
  input?: number;
  output?: number;
  cache_read?: number;
  /** Context-tiered pricing list; we only surface tier[0] as base when present. */
  tiers?: Array<{ input?: number; output?: number; cache_read?: number }>;
}

export interface ModelsDevModel {
  id?: string;
  name?: string;
  tool_call?: boolean;
  reasoning?: boolean;
  modalities?: { input?: string[] };
  limit?: { context?: number; output?: number };
  cost?: ModelsDevPricing;
  status?: string | null;
}

/** The subset of one models.dev provider entry this module reads. */
export interface ModelsDevProvider {
  id?: string;
  name?: string;
  models?: Record<string, ModelsDevModel>;
}

const DEFAULT_CONTEXT = 1_000_000;
const DEFAULT_OUTPUT = 16_384;

/** Normalize every model of a provider entry. Skips rows without usable ids;
 *  free models keep 0 prices exactly as upstream reports them. */
export function normalizeModelsDevProvider(
  entry: ModelsDevProvider,
): CatalogEnrichmentEntry[] {
  const out: CatalogEnrichmentEntry[] = [];
  for (const [modelId, m] of Object.entries(entry.models ?? {})) {
    if (!modelId) continue;
    if (m.status === 'deprecated' || m.status === 'alpha') continue;
    const vision = m.modalities?.input?.includes('image') === true;
    const contextWindow =
      typeof m.limit?.context === 'number' && m.limit.context > 0 ? m.limit.context : DEFAULT_CONTEXT;
    const maxOutputTokens =
      typeof m.limit?.output === 'number' && m.limit.output > 0 ? m.limit.output : DEFAULT_OUTPUT;

    out.push({
      id: modelId,
      name: m.name ?? modelId,
      contextWindow,
      maxOutputTokens,
      supportsTools: m.tool_call !== false,
      supportsStreaming: true,
      supportsVision: vision,
      ...(typeof m.cost?.input === 'number' && typeof m.cost?.output === 'number'
        ? {
            inputPricePerMToken: m.cost.input,
            outputPricePerMToken: m.cost.output,
            ...(typeof m.cost.cache_read === 'number' ? { cachedInputPricePerMToken: m.cost.cache_read } : {}),
          }
        : {}),
      source: 'models.dev',
    });
  }
  return out;
}

/** Fetch + normalize both OpenCode providers from live models.dev. */
export async function fetchModelsDevEnrichment(fetchImpl: typeof fetch): Promise<{
  zen: CatalogEnrichmentEntry[];
  go: CatalogEnrichmentEntry[];
}> {
  const response = await fetchImpl(MODELSDV_API_URL);
  if (!response.ok) throw new Error(`models.dev fetch failed: HTTP ${response.status}`);
  const api = (await response.json()) as Record<string, ModelsDevProvider>;
  const zen = normalizeModelsDevProvider(api.opencode ?? {});
  const go = normalizeModelsDevProvider(api['opencode-go'] ?? {});
  return { zen, go };
}
