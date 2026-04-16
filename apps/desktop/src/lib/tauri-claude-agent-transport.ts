// ─── Tauri Claude Agent Transport ──────────────────────────────────────────────
// Bridges the ClaudeAgentProvider to the Tauri `claude_agent_run` command.
// Returns an AsyncIterable<StreamChunk> that maps sidecar NDJSON events to
// the standard StreamChunk union used by the provider layer.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { StreamChunk } from '@hyscode/ai-providers';
import type { ClaudeAgentInvoke } from '@hyscode/ai-providers';

interface ClaudeAgentChunk {
  request_id: string;
  type: string;
  content?: string | null;
  tool_name?: string | null;
  tool_input?: string | null;
  call_id?: string | null;
  stop_reason?: string | null;
  error?: string | null;
  done: boolean;
}

let _counter = 0;
function nextRequestId(): string {
  return `agent-${Date.now()}-${++_counter}`;
}

/**
 * Creates the ClaudeAgentInvoke function that bridges TS ↔ Tauri sidecar.
 */
export function createClaudeAgentInvoke(): ClaudeAgentInvoke {
  return function claudeAgentInvoke(params) {
    const requestId = nextRequestId();

    // Return an async iterable
    return {
      [Symbol.asyncIterator]() {
        const queue: Array<StreamChunk | null> = [];
        let resolve: (() => void) | null = null;
        let unlisten: (() => void) | null = null;
        let started = false;

        function enqueue(item: StreamChunk | null): void {
          queue.push(item);
          if (resolve) {
            const fn = resolve;
            resolve = null;
            fn();
          }
        }

        function mapChunk(chunk: ClaudeAgentChunk): void {
          switch (chunk.type) {
            case 'text':
              if (chunk.content) {
                enqueue({ type: 'text_delta', text: chunk.content });
              }
              break;

            case 'thinking':
              if (chunk.content) {
                enqueue({ type: 'thinking_delta', text: chunk.content });
              }
              break;

            case 'tool_use':
              if (chunk.call_id && chunk.tool_name) {
                enqueue({ type: 'tool_call_start', id: chunk.call_id, name: chunk.tool_name });
                if (chunk.tool_input) {
                  enqueue({ type: 'tool_call_delta', id: chunk.call_id, input: chunk.tool_input });
                }
                enqueue({ type: 'tool_call_end', id: chunk.call_id });
              }
              break;

            case 'done':
              enqueue({
                type: 'done',
                stopReason: (chunk.stop_reason as 'end_turn') ?? 'end_turn',
              });
              enqueue(null); // signal end
              break;

            case 'error':
              enqueue({ type: 'error', error: chunk.error ?? 'Unknown sidecar error' });
              enqueue(null);
              break;
          }
        }

        async function start(): Promise<void> {
          if (started) return;
          started = true;

          // Listen for agent:chunk events
          unlisten = (await listen<ClaudeAgentChunk>('agent:chunk', (event) => {
            if (event.payload.request_id === requestId) {
              mapChunk(event.payload);
            }
          })) as unknown as () => void;

          // Invoke the Rust command
          try {
            await invoke<void>('claude_agent_run', {
              request: {
                request_id: requestId,
                model: params.model,
                system_prompt: params.systemPrompt,
                messages: params.messages,
                max_turns: params.maxTurns,
                cwd: params.cwd,
              },
            });
          } catch (err) {
            unlisten?.();
            enqueue({
              type: 'error',
              error: err instanceof Error ? err.message : String(err),
            });
            enqueue(null);
          }
        }

        return {
          async next(): Promise<IteratorResult<StreamChunk>> {
            await start();

            while (queue.length === 0) {
              await new Promise<void>((r) => {
                resolve = r;
              });
            }

            const item = queue.shift()!;
            if (item === null) {
              unlisten?.();
              return { done: true, value: undefined };
            }
            return { done: false, value: item };
          },

          async return(): Promise<IteratorResult<StreamChunk>> {
            unlisten?.();
            return { done: true, value: undefined };
          },

          [Symbol.asyncIterator]() {
            return this;
          },
        };
      },
    };
  };
}
