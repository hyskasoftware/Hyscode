// Golden parity: resolver output MUST reproduce, field-for-field, the static
// catalogs that shipped before issue #51 (dumped to tests/golden-*.json by
// tests/dump-catalogs.ts at refactor time). Order-insensitive: joined on id.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveGoCatalog, resolveZenCatalog } from '../src/model-metadata/resolver';
import type { AIModel } from '../src/types';

interface GoldenFile {
  asOf: string;
  models: AIModel[];
}

function loadGolden(name: string): GoldenFile {
  return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')) as GoldenFile;
}

// KNOWN_INTENTIONAL_DIFFS: C2-curated corrections that supersede the retired
// static catalog on purpose (each line cites its source):
//  - deepseek-v4-pro (Zen): old static carried models.dev's $1.74/$3.84
//    instead of the official Zen docs pricing $0.66/$1.98 input/output,
//    $0.022 cached read (off-peak) — dev.opencode.ai/docs/zen §Pricing.
const KNOWN_INTENTIONAL_DIFFS = new Set([
  'deepseek-v4-pro.inputPricePerMToken',
  'deepseek-v4-pro.outputPricePerMToken',
  'deepseek-v4-pro.cachedInputPricePerMToken',
]);

/** Full AIModel comparison, provider included, minus documented C2 corrections. */
function diffModels(actual: readonly AIModel[], expected: readonly AIModel[]): string[] {
  const problems: string[] = [];
  const expectedById = new Map(expected.map((m) => [m.id, m]));
  const actualById = new Map(actual.map((m) => [m.id, m]));

  for (const [id, want] of expectedById) {
    const got = actualById.get(id);
    if (!got) {
      problems.push(`${id}: missing from resolver output`);
      continue;
    }
    for (const key of Object.keys(want) as Array<keyof AIModel>) {
      if (JSON.stringify(got[key]) === JSON.stringify(want[key])) continue;
      if (KNOWN_INTENTIONAL_DIFFS.has(`${id}.${String(key)}`)) continue;
      problems.push(`${id}.${String(key)}: expected ${JSON.stringify(want[key])}, got ${JSON.stringify(got[key])}`);
    }
  }
  for (const id of actualById.keys()) {
    if (!expectedById.has(id)) problems.push(`${id}: unexpected extra model`);
  }
  return problems;
}

describe('zen catalog golden parity', () => {
  const golden = loadGolden('golden-zen.json');

  it('resolver reproduces the retired static catalog exactly', () => {
    const { models } = resolveZenCatalog();
    expect(diffModels(models, golden.models)).toEqual([]);
  });
});

describe('go catalog golden parity', () => {
  const golden = loadGolden('golden-go.json');

  it('resolver reproduces the retired static catalog exactly', () => {
    const { models } = resolveGoCatalog();
    expect(diffModels(models, golden.models)).toEqual([]);
  });
});
