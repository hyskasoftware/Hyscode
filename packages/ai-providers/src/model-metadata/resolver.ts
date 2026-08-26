// ─── Dynamic Model Resolver (OpenCode Zen / Go) ─────────────────────────────
// Layer merge engine for issue #51. Produces the `AIModel[]` a provider
// publishes from three inputs:
//
//   C2  curatedCatalog    wire-format routing + limits + pricing + thinking
//                         (model-metadata/catalog-corrections.ts)
//   C3  enrichment        OPTIONAL metadata for ids missing from C2 — produced
//                         by scripts/sync-model-catalog.mjs from models.dev
//   C4  liveIds           ground truth of availability from GET /v1/models
//
// Availability rule: liveIds ∩ (C2 ∪ C3). A curated id absent from liveIds is
// dropped (retired upstream); a live id absent from both metadata sources gets
// conservative bootstrap defaults and routes as chat-completions.
//
// The public contract stays `AIModel[]` — harness cost math, Desktop UI and
// TUI are untouched.

import type { AIModel, FetchImpl } from '../types';
import { GO_CATALOG, ZEN_CATALOG, type CuratedCatalogEntry } from './catalog-corrections';

export const ZEN_MODELS_URL = 'https://opencode.ai/zen/v1/models';
export const GO_MODELS_URL = 'https://opencode.ai/zen/go/v1/models';

/** Conservative defaults for a live model with no known metadata. Matches the
 *  previous hardcoded-dummy behavior so unknown models degrade identically. */
const BOOTSTRAP = {
  contextWindow: 1_000_000,
  maxOutputTokens: 16_384,
  supportsTools: true,
  supportsStreaming: true,
  supportsVision: false,
} as const;

export interface CatalogEnrichmentEntry extends Omit<AIModel, 'provider'> {
  /** External provenance marker surfaced in drift reports only. */
  source?: string;
}

export interface ResolveInput {
  /** Live model ids from GET /v1/models (ownership of the fetch belongs to the provider). */
  liveIds?: readonly string[];
  /** Optional external metadata (models.dev-derived snapshot or live fetch). */
  enrichment?: readonly CatalogEnrichmentEntry[];
}

export type WireFormat = CuratedCatalogEntry['wireFormat'];

export interface ResolvedCatalog {
  models: AIModel[];
  /** id → endpoint routing hint (subset of models present). */
  wireFormats: ReadonlyMap<string, WireFormat>;
}

function curatedToAiModel(entry: CuratedCatalogEntry, providerId: string): AIModel {
  return {
    id: entry.id,
    name: entry.name,
    provider: providerId,
    contextWindow: entry.contextWindow,
    maxOutputTokens: entry.maxOutputTokens,
    supportsTools: entry.supportsTools,
    supportsStreaming: entry.supportsStreaming,
    supportsVision: entry.supportsVision,
    ...(entry.inputPricePerMToken !== undefined ? { inputPricePerMToken: entry.inputPricePerMToken } : {}),
    ...(entry.outputPricePerMToken !== undefined ? { outputPricePerMToken: entry.outputPricePerMToken } : {}),
    ...(entry.cachedInputPricePerMToken !== undefined
      ? { cachedInputPricePerMToken: entry.cachedInputPricePerMToken }
      : {}),
    ...(entry.thinkingVariants !== undefined ? { thinkingVariants: entry.thinkingVariants } : {}),
  };
}

function resolve(
  catalog: readonly CuratedCatalogEntry[],
  providerId: string,
  fallbackNames: { curatedSuffix: string; enrichmentSuffix: string },
  input: ResolveInput = {},
): ResolvedCatalog {
  void fallbackNames;
  const curatedById = new Map(catalog.map((e) => [e.id, e]));
  const enrichmentById = new Map((input.enrichment ?? []).map((e) => [e.id, e]));

  // C4 filter: when live ids exist they decide existence; otherwise assume all.
  const knownCurated =
    input.liveIds === undefined
      ? [...curatedById.keys()]
      : [...curatedById.keys()].filter((id) => input.liveIds!.includes(id));
  // Merge back live-only ids (upstream added a model we don't know yet).
  const mergedIds: string[] = [...knownCurated];
  if (input.liveIds) {
    const known = new Set(mergedIds);
    for (const id of input.liveIds) if (!known.has(id)) mergedIds.push(id);
  }

  const models: AIModel[] = [];
  const wireFormats = new Map<string, WireFormat>();

  for (const id of mergedIds) {
    const entry = curatedById.get(id);
    if (entry) {
      models.push(curatedToAiModel(entry, providerId));
      wireFormats.set(id, entry.wireFormat);
      continue;
    }
    const enriched = enrichmentById.get(id);
    if (enriched) {
      const { source: _source, ...rest } = enriched;
      models.push({ ...rest, id, provider: providerId });
      // models.dev does not expose gateway routing; chat-completions is the
      // OpenAI-compatible default that handles every non-Claude/GPT family.
      wireFormats.set(id, 'chat-completions');
      continue;
    }
    models.push({
      id,
      name: `${id} (${providerId === 'opencode-zen' ? 'Zen' : 'Go'})`,
      provider: providerId,
      ...BOOTSTRAP,
    });
    wireFormats.set(id, 'chat-completions');
  }

  return { models, wireFormats };
}

export function resolveZenCatalog(input: ResolveInput = {}): ResolvedCatalog {
  return resolve(ZEN_CATALOG, 'opencode-zen', { curatedSuffix: ' (Zen)', enrichmentSuffix: ' (Zen)' }, input);
}

export function resolveGoCatalog(input: ResolveInput = {}): ResolvedCatalog {
  return resolve(GO_CATALOG, 'opencode-go', { curatedSuffix: ' (Go)', enrichmentSuffix: ' (Go)' }, input);
}

// ─── Live ID fetch ──────────────────────────────────────────────────────────

interface LiveModelsResponse {
  data?: Array<{ id?: unknown }>;
}

/** GET /v1/models → bare ids. Returns undefined on any failure so callers keep
 *  their current list instead of dropping everything (offline-first). */
export async function fetchLiveModelIds(
  url: string,
  apiKey: string,
  fetchImpl: FetchImpl,
): Promise<string[] | undefined> {
  try {
    const response = await fetchImpl(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as LiveModelsResponse;
    const items: Array<{ id?: unknown }> = Array.isArray(data)
      ? (data as unknown as Array<{ id?: unknown }>)
      : (data.data ?? []);
    const ids = items
      .map((m) => m?.id)
      .filter((id): id is string => typeof id === 'string');
    return ids.length ? ids : undefined;
  } catch {
    return undefined;
  }
}
