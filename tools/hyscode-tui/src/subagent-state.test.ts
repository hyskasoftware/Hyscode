import { describe, expect, it } from 'vitest';
import { SUBAGENT_OUTPUT_CAP, appendCappedText, mergeTokenUsage } from './subagent-state';

describe('subagent streaming state helpers', () => {
  it('keeps the trailing window of streamed text under the cap', () => {
    const first = appendCappedText('', 'a'.repeat(100), SUBAGENT_OUTPUT_CAP);
    const second = appendCappedText(first, 'b'.repeat(50), SUBAGENT_OUTPUT_CAP);
    expect(second.length).toBe(150);
    expect(second.endsWith('b'.repeat(50))).toBe(true);

    const flooded = appendCappedText(first, 'c'.repeat(SUBAGENT_OUTPUT_CAP + 10), SUBAGENT_OUTPUT_CAP);
    expect(flooded.length).toBe(SUBAGENT_OUTPUT_CAP);
    expect(flooded.endsWith('c')).toBe(true);
  });

  it('ignores empty stream appends', () => {
    expect(appendCappedText('keep', undefined, 10)).toBe('keep');
    expect(appendCappedText('keep', '', 10)).toBe('keep');
  });

  it('merges token usage cumulatively across provider requests', () => {
    const seeded = mergeTokenUsage(null, { inputTokens: 100, outputTokens: 20, totalTokens: 120, requestCount: 1, estimatedCostUsd: 0.01 });
    const merged = mergeTokenUsage(seeded, { inputTokens: 30, outputTokens: 5, totalTokens: 35, requestCount: 1 });
    expect(merged).toMatchObject({
      inputTokens: 130,
      outputTokens: 25,
      totalTokens: 155,
      requestCount: 2,
      estimatedCostUsd: 0.01,
    });
  });
});
