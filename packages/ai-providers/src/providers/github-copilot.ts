import type { AIModel, ChatParams, StreamChunk, FetchImpl } from '../types';
import { OpenAIProvider } from './openai';

// ─── GitHub Copilot Provider ────────────────────────────────────────────────
// GitHub Copilot exposes an OpenAI-compatible chat completions endpoint at
// https://api.githubcopilot.com. Auth is via a short-lived token obtained
// through the GitHub OAuth Device Flow + Copilot token exchange.
//
// The token lifecycle is managed by the Rust backend:
//   1. User initiates OAuth via `github_oauth_start` → gets device_code + user_code
//   2. User authorizes in browser, frontend polls `github_oauth_poll`
//   3. On success, the access_token is stored in keychain as `github_copilot_access_token`
//   4. Before each request, `github_copilot_ensure_token` refreshes the short-lived
//      Copilot API token from the long-lived OAuth access token
//
// The provider itself is a thin OpenAI adapter — auth header injection is
// handled by the Rust ai_stream_request proxy like all other providers.

// Models current as of April 2026 — see:
// https://docs.github.com/en/copilot/reference/ai-models/supported-models
// Retired: gpt-4o-mini, claude-3.5-sonnet (Nov 2025), o3-mini (Oct 2025),
//          gpt-4o (superseded by gpt-4.1)
const COPILOT_MODELS: AIModel[] = [
  // ── Free multiplier (all plans) ─────────────────────────────────────────
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1 (Copilot)',
    provider: 'github-copilot',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini (Copilot)',
    provider: 'github-copilot',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5 (Copilot)',
    provider: 'github-copilot',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
  },
  // ── Premium (1x multiplier, requires Copilot Pro+) ───────────────────────
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2 (Copilot)',
    provider: 'github-copilot',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Copilot)',
    provider: 'github-copilot',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro (Copilot)',
    provider: 'github-copilot',
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
];

export class GitHubCopilotProvider extends OpenAIProvider {
  override readonly id = 'github-copilot' as const;
  override readonly name = 'GitHub Copilot';
  override models: AIModel[] = [...COPILOT_MODELS];

  constructor(apiKey: string, fetchImpl?: FetchImpl) {
    // apiKey here is the short-lived Copilot token.
    // Extra headers identify this as an editor integration.
    super(apiKey, 'https://api.githubcopilot.com', {
      'Editor-Version': 'HysCode/0.1.0',
      'Editor-Plugin-Version': 'hyscode-copilot/0.1.0',
      'Copilot-Integration-Id': 'vscode-chat',
    }, fetchImpl);
  }

  override async *chat(params: ChatParams): AsyncIterable<StreamChunk> {
    yield* super.chat(params);
  }
}
