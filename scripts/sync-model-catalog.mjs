#!/usr/bin/env node
// ─── Model Catalog Sync / Drift Report (issue #51) ──────────────────────────
// Compares the curated OpenCode Zen/Go catalog
// (packages/ai-providers/src/model-metadata/catalog-corrections.ts) against
// two live sources and reports drift:
//
//   1. models.dev api.json — metadata changes for known ids, retired ids that
//      upstream removed, and brand-new ids missing from curated + live.
//   2. opencode.ai /v1/models endpoints — ground truth of availability.
//
// Modes:
//   node scripts/sync-model-catalog.mjs            → drift report (exit 0; exit 1 with --check on hard drift)
//   node scripts/sync-model-catalog.mjs --check    → CI mode: HARD drift = model on live /models but absent from curated
//
// Hard drift is the only actionable condition: a curated id missing from the
// live gateway means we show a dead model. Everything else (price deltas,
// new unknown ids) is advisory — unknown ids bootstrap safely at runtime.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MODELSDV_API_URL = 'https://models.dev/api.json';
const ZEN_MODELS_URL = 'https://opencode.ai/zen/v1/models';
const GO_MODELS_URL = 'https://opencode.ai/zen/go/v1/models';
const CORRECTIONS_PATH =
  'packages/ai-providers/src/model-metadata/catalog-corrections.ts';

const args = process.argv.slice(2);
const check = args.includes('--check');
let hadHardDrift = false;

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

/** Extract `id` fields of catalog rows t('<id>', ...) from corrections source. */
function extractCuratedIds(sourceText, catalogConstName) {
  const start = sourceText.indexOf(`export const ${catalogConstName}`);
  if (start === -1) throw new Error(`catalog ${catalogConstName} not found`);
  const end = sourceText.indexOf('];', start);
  const body = sourceText.slice(start, end);
  const ids = [];
  for (const match of body.matchAll(/\bt\(\s*'([^']+)'/g)) ids.push(match[1]);
  return ids;
}

function report(providerLabel, curatedIds, liveIds, modelsDevIds) {
  console.log(`\n=== ${providerLabel} ===`);
  const curatedSet = new Set(curatedIds);
  const liveSet = new Set(liveIds);

  // Ids on the live gateway but absent from curated — runtime will bootstrap
  // them with defaults. Advisory unless --check promotes to hard drift.
  const newUpstream = liveIds.filter((id) => !curatedSet.has(id));
  // Curated ids no longer served — runtime drops them at refresh time; until
  // curated catches up they remain visible offline. This IS hard drift.
  const retired = curatedIds.filter((id) => !liveSet.has(id));

  if (newUpstream.length) {
    console.log(`[advisory] live-only ids (${newUpstream.length}): ${newUpstream.join(', ')}`);
    console.log('           → add rows to catalog-corrections.ts when pricing/limits are confirmed.');
  }
  if (retired.length) {
    hadHardDrift = true;
    console.log(`[HARD] curated ids absent from live gateway (${retired.length}):`);
    for (const id of retired) {
      const inModelsDev = modelsDevIds.has(id) ? 'still in models.dev' : 'also gone from models.dev';
      console.log(`  - ${id} (${inModelsDev})`);
    }
    console.log('           → remove these rows or confirm temporary gateway outage.');
  }
  if (!newUpstream.length && !retired.length) console.log('[ok] curated ids exactly match live gateway');

  const extraInModelsDev = [...modelsDevIds].filter(
    (id) => !curatedSet.has(id) && !liveSet.has(id),
  );
  if (extraInModelsDev.length) {
    console.log(`[advisory] models.dev-only ids (upstream stale, not served): ${extraInModelsDev.length}`);
  }
}

try {
  const [correctionsText, modelsDev] = await Promise.all([
    readFile(fileURLToPath(new URL('../' + CORRECTIONS_PATH, import.meta.url)), 'utf8'),
    fetchJson(MODELSDV_API_URL),
  ]);

  const [zenLive, goLive] = await Promise.all([
    fetchJson(ZEN_MODELS_URL).catch(() => undefined),
    fetchJson(GO_MODELS_URL).catch(() => undefined),
  ]);

  const zenLiveIds = (zenLive?.data ?? []).map((m) => m.id).filter(Boolean);
  const goLiveIds = (goLive?.data ?? []).map((m) => m.id).filter(Boolean);
  const zenModelsDevIds = new Set(Object.keys(modelsDev.opencode?.models ?? {}));
  const goModelsDevIds = new Set(Object.keys(modelsDev['opencode-go']?.models ?? {}));

  report(
    'OpenCode Zen',
    extractCuratedIds(correctionsText, 'ZEN_CATALOG'),
    zenLiveIds,
    zenModelsDevIds,
  );
  report(
    'OpenCode Go',
    extractCuratedIds(correctionsText, 'GO_CATALOG'),
    goLiveIds,
    goModelsDevIds,
  );

  if (check && hadHardDrift) {
    console.error('\nsync-model-catalog: HARD drift detected — failing (--check)');
    process.exit(1);
  }
  console.log('\ndrift report complete' + (check ? ' (clean)' : ''));
} catch (error) {
  console.error('sync-model-catalog failed:', error.message);
  // Network flakiness must not block CI; only explicit hard drift does.
  process.exit(check ? 1 : 0);
}
