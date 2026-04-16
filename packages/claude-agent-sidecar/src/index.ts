#!/usr/bin/env node
// ─── Claude Agent Sidecar ────────────────────────────────────────────────────
// Standalone process that wraps @anthropic-ai/claude-agent-sdk.
// Reads a JSON request from stdin, calls the SDK's query() function,
// and writes NDJSON events to stdout for the Tauri host to consume.

import { query, type Message as SdkMessage } from '@anthropic-ai/claude-agent-sdk';

// ─── Protocol Types ──────────────────────────────────────────────────────────

interface SidecarRequest {
  apiKey: string;
  model: string;
  systemPrompt?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  maxTurns?: number;
  cwd?: string;
  allowedTools?: string[];
}

interface SidecarEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'usage' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolInput?: string;
  callId?: string;
  inputTokens?: number;
  outputTokens?: number;
  stopReason?: string;
  error?: string;
}

function emit(event: SidecarEvent): void {
  process.stdout.write(JSON.stringify(event) + '\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let request: SidecarRequest;
  try {
    request = JSON.parse(input);
  } catch {
    emit({ type: 'error', error: 'Invalid JSON input' });
    process.exit(1);
  }

  // Set the API key as environment variable for the SDK
  process.env.ANTHROPIC_API_KEY = request.apiKey;

  // Change working directory if specified
  if (request.cwd) {
    try {
      process.chdir(request.cwd);
    } catch {
      // Ignore if directory doesn't exist; SDK will use current dir
    }
  }

  // Convert messages to SDK format
  const messages: SdkMessage[] = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const result = await query({
      model: request.model,
      systemPrompt: request.systemPrompt ?? 'You are a helpful coding assistant.',
      messages,
      maxTurns: request.maxTurns ?? 10,
      abortController: new AbortController(),
      options: {
        maxConnections: 1,
      },
    });

    // Process the result messages
    for (const msg of result) {
      if (msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          emit({ type: 'text', content: msg.content });
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'text') {
              emit({ type: 'text', content: block.text });
            } else if (block.type === 'thinking') {
              emit({ type: 'thinking', content: block.thinking });
            } else if (block.type === 'tool_use') {
              emit({
                type: 'tool_use',
                callId: block.id,
                toolName: block.name,
                toolInput: JSON.stringify(block.input),
              });
            }
          }
        }
      } else if (msg.role === 'tool') {
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'tool_result') {
              emit({
                type: 'tool_result',
                callId: block.tool_use_id,
                content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
              });
            }
          }
        }
      }
    }

    emit({ type: 'done', stopReason: 'end_turn' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: 'error', error: message });
    process.exit(1);
  }
}

main();
