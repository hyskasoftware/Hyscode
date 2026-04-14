// ─── Typed Tauri Invoke Wrapper ──────────────────────────────────────────────
// Centralises invoke usage and provides per-command type safety.

import { invoke } from '@tauri-apps/api/core';

// ─── Shared types ───────────────────────────────────────────────────────────

interface GitFile {
  path: string;
  status: string;
  old_path: string | null;
}

// ─── Command signatures ─────────────────────────────────────────────────────

interface TauriCommands {
  // FS
  read_file: { args: { path: string }; ret: string };
  write_file: { args: { path: string; content: string }; ret: void };
  create_file: { args: { path: string; content?: string }; ret: void };
  delete_path: { args: { path: string }; ret: void };
  list_dir: { args: { path: string }; ret: Array<{ name: string; path: string; is_dir: boolean; size: number }> };
  stat_path: { args: { path: string }; ret: { path: string; is_dir: boolean; is_file: boolean; size: number; modified: number | null } };
  rename_path: { args: { from: string; to: string }; ret: void };
  create_directory: { args: { path: string }; ret: void };
  search_files: { args: { root: string; query: string; maxResults?: number }; ret: Array<{ path: string; line_number: number; line_content: string }> };

  // Git
  git_is_repo: { args: { path: string }; ret: boolean };
  git_status: { args: { repoPath: string }; ret: { staged: GitFile[]; unstaged: GitFile[]; untracked: GitFile[]; conflicts: GitFile[] } };
  git_diff_file: { args: { repoPath: string; filePath: string; staged: boolean }; ret: string };
  git_add: { args: { repoPath: string; paths: string[] }; ret: void };
  git_add_all: { args: { repoPath: string }; ret: void };
  git_commit: { args: { repoPath: string; message: string }; ret: string };
  git_log: { args: { repoPath: string; limit: number }; ret: Array<{ hash: string; short_hash: string; message: string; author: string; email: string; timestamp: number }> };
  git_checkout: { args: { repoPath: string; branch: string }; ret: void };
  git_branch_current: { args: { repoPath: string }; ret: string };
  git_branch_list: { args: { repoPath: string }; ret: Array<{ name: string; is_current: boolean; is_remote: boolean; upstream: string | null }> };
  git_branch_create: { args: { repoPath: string; name: string; checkout: boolean }; ret: void };

  // PTY — spawn returns the pty_id; output arrives via 'pty:data' events
  pty_spawn: { args: { shell?: string; cwd?: string; env?: Record<string, string> }; ret: string };
  pty_write: { args: { ptyId: string; data: string }; ret: void };
  pty_resize: { args: { ptyId: string; cols: number; rows: number }; ret: void };
  pty_kill: { args: { ptyId: string }; ret: void };

  // Keychain
  keychain_set: { args: { service: string; account: string; password: string }; ret: void };
  keychain_get: { args: { service: string; account: string }; ret: string | null };
  keychain_delete: { args: { service: string; account: string }; ret: void };
  keychain_has: { args: { service: string; account: string }; ret: boolean };

  // AI Streaming
  ai_stream_request: { args: { requestId: string; provider: string; url: string; headers: Record<string, string>; body: string; timeoutMs?: number }; ret: void };
  ai_stream_cancel: { args: { requestId: string }; ret: void };

  // Database: Projects
  db_ensure_project: { args: { id: string; path: string }; ret: void };

  // Database: Conversations
  db_list_conversations: { args: { projectId: string }; ret: Array<{ id: string; title: string; mode: string; model_id: string | null; provider_id: string | null; message_count: number; created_at: string; updated_at: string }> };
  db_get_conversation: { args: { conversationId: string }; ret: { id: string; title: string; mode: string; model_id: string | null; provider_id: string | null; created_at: string; updated_at: string } | null };
  db_create_conversation: { args: { id: string; projectId: string; title: string; mode: string; modelId?: string; providerId?: string }; ret: void };
  db_update_conversation: { args: { conversationId: string; title?: string }; ret: void };
  db_delete_conversation: { args: { conversationId: string }; ret: void };

  // Database: Messages
  db_list_messages: { args: { conversationId: string }; ret: Array<{ id: string; role: string; content: string; tool_calls: string | null; token_input: number; token_output: number; created_at: string }> };
  db_create_message: { args: { id: string; conversationId: string; role: string; content: string; toolCalls?: string; tokenInput?: number; tokenOutput?: number }; ret: void };
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
