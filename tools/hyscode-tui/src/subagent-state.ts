import type { TokenUsage } from '@hyscode/ai-providers';
import type { SubAgentView } from './types';

/**
 * Streaming buffers for delegated agents are capped so a long-running child
 * cannot grow controller memory without bound. The tail is kept because live
 * progress reads recency; the full final report still arrives through the
 * parent's spawn_subagent tool result.
 */
export const SUBAGENT_OUTPUT_CAP = 32_768;
export const SUBAGENT_THINKING_CAP = 16_384;

/** Keeps the trailing `cap` characters of the accumulated text. */
export function appendCappedText(current: string, append: string | undefined, cap: number): string {
  if (!append) return current;
  const next = `${current}${append}`;
  return next.length > cap ? next.slice(next.length - cap) : next;
}

export function mergeTokenUsage(previous: TokenUsage | null, current: TokenUsage): TokenUsage {
  if (!previous) return { ...current };
  return {
    ...current,
    inputTokens: previous.inputTokens + current.inputTokens,
    outputTokens: previous.outputTokens + current.outputTokens,
    totalTokens: previous.totalTokens + current.totalTokens,
    requestCount: (previous.requestCount ?? 0) + (current.requestCount ?? 0),
    cacheReadTokens: (previous.cacheReadTokens ?? 0) + (current.cacheReadTokens ?? 0),
    cacheWriteTokens: (previous.cacheWriteTokens ?? 0) + (current.cacheWriteTokens ?? 0),
    reasoningTokens: (previous.reasoningTokens ?? 0) + (current.reasoningTokens ?? 0),
    retryCount: (previous.retryCount ?? 0) + (current.retryCount ?? 0),
    estimatedCostUsd: (previous.estimatedCostUsd ?? 0) + (current.estimatedCostUsd ?? 0),
  };
}

export function createSubAgentView(ownerId: string): SubAgentView {
  return {
    ownerId,
    mode: 'agent',
    task: '',
    status: 'queued',
    output: '',
    thinking: '',
    toolIds: [],
    startedAt: Date.now(),
    endedAt: null,
    tokenUsage: null,
  };
}

