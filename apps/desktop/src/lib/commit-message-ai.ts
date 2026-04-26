/**
 * AI-powered commit message generation.
 *
 * Sends the staged diff to the selected (or active) provider and returns
 * a conventional-commits-style message.
 */

import { getProviderRegistry } from '@hyscode/ai-providers';

const SYSTEM_PROMPT = `You are an expert developer assistant that writes concise, high-quality Git commit messages.

Rules:
- Follow the Conventional Commits specification: <type>(<optional scope>): <description>
- Types: feat, fix, refactor, perf, style, test, docs, build, ci, chore
- Subject line: max 72 chars, imperative mood, no period at end
- If the change is complex, add a blank line then a short body (max 3 lines)
- Do NOT include bullet lists, only prose
- Respond with ONLY the commit message — no explanation, no markdown fences`;

const buildUserMessage = (diff: string) =>
  `Generate a commit message for the following staged diff:\n\n${diff}`;

export interface GenerateOptions {
  providerId: string;
  modelId: string;
  diff: string;
  signal?: AbortSignal;
}

/**
 * Stream-collects the AI response and returns the full commit message string.
 * Throws if the provider is not configured or the request fails.
 */
export async function generateCommitMessage(opts: GenerateOptions): Promise<string> {
  const { providerId, modelId, diff, signal } = opts;
  const registry = getProviderRegistry();

  const chunks: string[] = [];

  for await (const chunk of registry.chat({
    providerId,
    model: modelId,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: buildUserMessage(diff) }],
      },
    ],
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 256,
    temperature: 0.2,
    signal,
  })) {
    if (signal?.aborted) break;
    if (chunk.type === 'text_delta') {
      chunks.push(chunk.text);
    }
  }

  return chunks.join('').trim();
}
