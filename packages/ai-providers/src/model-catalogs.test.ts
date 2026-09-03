import { describe, expect, it } from 'vitest';

import {
  AnthropicProvider,
  ClaudeAgentProvider,
  GeminiProvider,
  GitHubCopilotProvider,
  OpenAIProvider,
  OpenCodeGoProvider,
  OpenCodeZenProvider,
  OpenRouterProvider,
} from './index';

function modelIds(provider: { models: Array<{ id: string }> }): string[] {
  return provider.models.map((model) => model.id);
}

describe('provider model catalogs', () => {
  it('exposes the current direct-provider model families', () => {
    // SOTA-only direct catalogs (Sep 2026): current flagship generations per
    // official vendor docs — legacy models serve via gateways, not direct.
    expect(modelIds(new AnthropicProvider('key'))).toEqual([
      'claude-fable-5-1',
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-haiku-4-5-20251001',
    ]);
    expect(modelIds(new ClaudeAgentProvider('key'))).toEqual(
      expect.arrayContaining([
        'claude-fable-5',
        'claude-opus-5',
        'claude-opus-4-8',
        'claude-sonnet-5',
        'claude-haiku-4-5',
      ]),
    );
    expect(modelIds(new OpenAIProvider('key'))).toEqual(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']);
    expect(modelIds(new GeminiProvider('key'))).toEqual([
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ]);
    expect(modelIds(new GeminiProvider('key'))).not.toContain('gemini-3.1-flash-lite');
  });

  it('removes models retired from GitHub Copilot', () => {
    const ids = modelIds(new GitHubCopilotProvider('key'));

    expect(ids).toEqual(
      expect.arrayContaining([
        'gpt-5.5',
        'claude-opus-4.8',
        'gemini-3.5-flash',
        'mai-code-1-flash',
      ]),
    );
    expect(ids).not.toEqual(
      expect.arrayContaining(['gpt-4.1', 'gpt-4o', 'gpt-5.2', 'gpt-5.2-codex', 'grok-code-fast-1']),
    );
  });

  it('keeps gateway fallbacks aligned with their current discovery APIs', () => {
    expect(modelIds(new OpenRouterProvider('key'))).toEqual(
      expect.arrayContaining([
        'anthropic/claude-fable-5',
        'anthropic/claude-opus-4.8',
        'openai/gpt-5.5',
        'google/gemini-3.5-flash',
        'x-ai/grok-4.5',
        'moonshotai/kimi-k3',
        'tencent/hy3',
      ]),
    );
    expect(modelIds(new OpenRouterProvider('key'))).not.toEqual(
      expect.arrayContaining([
        'openai/o3',
        'openai/o4-mini',
        'meta-llama/llama-4-scout',
        'deepseek/deepseek-r1',
        'google/gemini-2.5-flash',
      ]),
    );
    expect(modelIds(new OpenCodeZenProvider('key'))).toEqual(
      expect.arrayContaining([
        'claude-fable-5-1',
        'claude-fable-5',
        'claude-opus-4-8',
        'claude-sonnet-5',
        'gemini-3.5-flash',
        'gemini-3.7-flash',
        'gemini-3.8-flash',
        'gpt-5.2-codex',
        'glm-5.2',
        'grok-4.5',
        'kimi-k3',
        'kimi-k2.5',
        'minimax-m2.5',
        'muse-spark-1.2',
        'muse-spark-1.3-contributor-free',
        'muse-spark-1.2-contributor-free',
        'ling-3.0-flash-fin-free',
        'big-pickle',
        'mimo-v2.5-free',
      ]),
    );
    // Retired upstream must not linger in the static fallback.
    expect(modelIds(new OpenCodeZenProvider('key'))).toEqual(
      expect.not.arrayContaining([
        'claude-sonnet-4',
        'laguna-s-2.1-free',
        'deepseek-v4-flash-free',
        'hy3-free',
        'north-mini-code-free',
        'x-preview-f-free',
      ]),
    );
    expect(modelIds(new OpenCodeGoProvider('key'))).toEqual(
      expect.arrayContaining([
        'grok-4.6',
        'gpt-5.6-luna',
        'glm-5.2',
        'glm-5.3',
        'glm-5.3-flash',
        'glm-5.1',
        'longcat-2.0',
        'kimi-k3',
        'kimi-k2.7-code',
        'kimi-k2.6',
        'deepseek-v4-flash-vision-exp',
        'deepseek-v4-pro',
        'deepseek-v4-flash',
        'minimax-m3',
        'minimax-m2.7',
        'minimax-m2.5',
        'muse-spark-1.3-contributor',
        'muse-spark-1.2-contributor',
        'qwen3.8-max',
        'qwen3.8-flash',
        'qwen3.7-max',
        'qwen3.7-plus',
        'qwen3.6-plus',
        'mimo-v2.5',
        'mimo-v2.5-pro',
        'hy4-preview',
        'hy3',
      ]),
    );
    // Retired from Go upstream must not linger in the static fallback.
    expect(modelIds(new OpenCodeGoProvider('key'))).toEqual(
      expect.not.arrayContaining([
        'grok-4.5',
        'glm-5',
        'kimi-k2.5',
        'qwen3.5-plus',
        'mimo-v2-pro',
        'mimo-v2-omni',
        'hy3-preview',
      ]),
    );
  });
});
