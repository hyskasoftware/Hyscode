// ─── Typed Tauri Invoke Wrapper ──────────────────────────────────────────────
// Centralises invoke usage and provides per-command type safety.

import { invoke } from '@tauri-apps/api/core';

// ─── Command signatures ─────────────────────────────────────────────────────

interface TauriCommands {
  // FS
  read_file: { args: { path: string }; ret: string };
  write_file: { args: { path: string; content: string }; ret: void };
  create_file: { args: { path: string; content?: string }; ret: void };
  delete_path: { args: { path: string }; ret: void };
  list_dir: { args: { path: string }; ret: unknown[] };
  stat_path: { args: { path: string }; ret: unknown };
  rename_path: { args: { oldPath: string; newPath: string }; ret: void };
  copy_path: { args: { source: string; destination: string }; ret: void };
  search_in_files: { args: { dir: string; pattern: string; maxResults?: number }; ret: unknown[] };

  // Git
  git_status: { args: { path: string }; ret: unknown };
  git_diff: { args: { path: string; file?: string }; ret: string };
  git_add: { args: { path: string; files: string[] }; ret: void };
  git_commit: { args: { path: string; message: string }; ret: string };
  git_log: { args: { path: string; limit?: number }; ret: unknown[] };

  // PTY
  pty_spawn: { args: { id: string; shell: string; args: string[]; cwd?: string; cols: number; rows: number; env?: Record<string, string> }; ret: void };
  pty_write: { args: { id: string; data: string }; ret: void };
  pty_resize: { args: { id: string; cols: number; rows: number }; ret: void };
  pty_kill: { args: { id: string }; ret: void };

  // Keychain
  keychain_set: { args: { service: string; account: string; password: string }; ret: void };
  keychain_get: { args: { service: string; account: string }; ret: string | null };
  keychain_delete: { args: { service: string; account: string }; ret: void };
  keychain_has: { args: { service: string; account: string }; ret: boolean };

  // AI Streaming
  ai_stream_request: { args: { requestId: string; provider: string; url: string; headers: Record<string, string>; body: string; timeoutMs?: number }; ret: void };
  ai_stream_cancel: { args: { requestId: string }; ret: void };
}

// ─── Typed invoke ───────────────────────────────────────────────────────────

export function tauriInvoke<K extends keyof TauriCommands>(
  command: K,
  args: TauriCommands[K]['args'],
): Promise<TauriCommands[K]['ret']> {
  return invoke(command, args as Record<string, unknown>) as Promise<TauriCommands[K]['ret']>;
}

// ─── Generic invoke (for dynamic / unknown commands) ────────────────────────

export function tauriInvokeRaw<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}
