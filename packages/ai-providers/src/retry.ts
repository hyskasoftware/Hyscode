import { type RetryConfig, ProviderError } from './types';

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  retryableStatuses: [429, 500, 502, 503, 529],
};

function jitter(delayMs: number): number {
  return delayMs * (0.5 + Math.random() * 0.5);
}

function getDelay(attempt: number, config: RetryConfig): number {
  const exponential = config.baseDelayMs * Math.pow(2, attempt);
  return Math.min(jitter(exponential), config.maxDelayMs);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (err instanceof ProviderError) {
        // Auth errors should not be retried
        if (err.statusCode === 401 || err.statusCode === 403) {
          throw err;
        }
        // Only retry if the status is in the retryable list
        if (err.statusCode && !cfg.retryableStatuses.includes(err.statusCode)) {
          throw err;
        }
      }

      if (attempt < cfg.maxRetries) {
        const delay = getDelay(attempt, cfg);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Parse SSE (Server-Sent Events) stream into individual events.
 * Handles standard SSE format: `data: {...}\n\n`
 */
export async function* parseSSEStream(
  response: Response,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // skip empty lines and comments
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;
          yield data;
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        if (data !== '[DONE]') yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse NDJSON (newline-delimited JSON) stream.
 * Used by Ollama which returns one JSON object per line.
 */
export async function* parseNDJSONStream(
  response: Response,
  signal?: AbortSignal,
): AsyncIterable<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed);
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer.trim());
      } catch {
        // Skip malformed final line
      }
    }
  } finally {
    reader.releaseLock();
  }
}
