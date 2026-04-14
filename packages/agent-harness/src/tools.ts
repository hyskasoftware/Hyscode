// ─── Built-in Tool Handlers ─────────────────────────────────────────────────
// Implementations for all built-in tools the agent can use.
// Each tool maps to Tauri backend commands via invoke().

import type { ToolDefinition } from '@hyscode/ai-providers';
import type { ToolHandler, ToolResult, ToolExecutionContext, ToolCategory } from './types';

// ─── Helper ─────────────────────────────────────────────────────────────────

function defineTool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  category: ToolCategory,
  requiresApproval: boolean,
  execute: (input: Record<string, unknown>, ctx: ToolExecutionContext) => Promise<ToolResult>,
): ToolHandler {
  const definition: ToolDefinition = {
    name,
    description,
    inputSchema: { type: 'object', properties, required },
  };
  return { definition, category, requiresApproval, execute };
}

function resolvePath(path: string, workspacePath: string): string {
  // If already absolute, return as-is
  if (path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)) {
    return path;
  }
  // Otherwise, resolve relative to workspace
  return `${workspacePath}/${path}`;
}

// ─── Filesystem Tools ───────────────────────────────────────────────────────

export const readFileTool = defineTool(
  'read_file',
  'Read the contents of a file. You can specify a line range to read only part of the file. Line numbers are 1-indexed.',
  {
    path: { type: 'string', description: 'Absolute or workspace-relative path to the file' },
    start_line: { type: 'integer', description: 'Starting line number (1-indexed, inclusive). Omit to read from beginning.' },
    end_line: { type: 'integer', description: 'Ending line number (1-indexed, inclusive). Omit to read to end.' },
  },
  ['path'],
  'filesystem',
  false,
  async (input, ctx) => {
    try {
      const filePath = resolvePath(input.path as string, ctx.workspacePath);
      const content = await ctx.invoke<string>('read_file', { path: filePath });

      // Apply line range if specified
      if (input.start_line || input.end_line) {
        const lines = content.split('\n');
        const start = ((input.start_line as number) || 1) - 1;
        const end = (input.end_line as number) || lines.length;
        const sliced = lines.slice(start, end);
        const numbered = sliced.map((line, i) => `${start + i + 1} | ${line}`).join('\n');
        return { success: true, output: numbered };
      }

      // Add line numbers
      const numbered = content.split('\n').map((line, i) => `${i + 1} | ${line}`).join('\n');
      return { success: true, output: numbered };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

export const writeFileTool = defineTool(
  'write_file',
  'Write content to a file. If the file exists, it will be overwritten. If parent directories don\'t exist, they will be created.',
  {
    path: { type: 'string', description: 'Absolute or workspace-relative path to the file' },
    content: { type: 'string', description: 'The full content to write to the file' },
  },
  ['path', 'content'],
  'filesystem',
  true,
  async (input, ctx) => {
    try {
      const filePath = resolvePath(input.path as string, ctx.workspacePath);
      await ctx.invoke('write_file', { path: filePath, content: input.content });
      return { success: true, output: `File written: ${input.path}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

export const editFileTool = defineTool(
  'edit_file',
  'Make a targeted edit to a file by replacing an exact string with a new string. The old_string must match exactly (including whitespace and indentation). Include enough context lines to uniquely identify the location.',
  {
    path: { type: 'string', description: 'Absolute or workspace-relative path to the file' },
    old_string: { type: 'string', description: 'The exact text to find and replace. Must match exactly one location in the file.' },
    new_string: { type: 'string', description: 'The text to replace old_string with' },
  },
  ['path', 'old_string', 'new_string'],
  'filesystem',
  true,
  async (input, ctx) => {
    try {
      const filePath = resolvePath(input.path as string, ctx.workspacePath);
      const content = await ctx.invoke<string>('read_file', { path: filePath });
      const oldStr = input.old_string as string;
      const newStr = input.new_string as string;

      // Find occurrences
      const occurrences = content.split(oldStr).length - 1;
      if (occurrences === 0) {
        return { success: false, output: '', error: 'old_string not found in file.' };
      }
      if (occurrences > 1) {
        return {
          success: false,
          output: '',
          error: `old_string matches ${occurrences} locations. Include more context to make it unique.`,
        };
      }

      const newContent = content.replace(oldStr, newStr);
      await ctx.invoke('write_file', { path: filePath, content: newContent });

      // Find the line range affected
      const beforeLines = content.slice(0, content.indexOf(oldStr)).split('\n').length;
      const newLines = newStr.split('\n').length;
      return {
        success: true,
        output: `File edited: ${input.path} (lines ${beforeLines}-${beforeLines + newLines - 1})`,
      };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

export const createFileTool = defineTool(
  'create_file',
  'Create a new file with the specified content. Fails if the file already exists. Parent directories are created automatically.',
  {
    path: { type: 'string', description: 'Absolute or workspace-relative path for the new file' },
    content: { type: 'string', description: 'The content for the new file' },
  },
  ['path', 'content'],
  'filesystem',
  true,
  async (input, ctx) => {
    try {
      const filePath = resolvePath(input.path as string, ctx.workspacePath);
      await ctx.invoke('create_file', { path: filePath, content: input.content });
      return { success: true, output: `File created: ${input.path}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

export const listDirectoryTool = defineTool(
  'list_directory',
  'List the contents of a directory. Returns file and folder names. Folders end with /.',
  {
    path: { type: 'string', description: 'Absolute or workspace-relative path to the directory' },
    recursive: { type: 'boolean', description: 'If true, list all files recursively (default: false)' },
    max_depth: { type: 'integer', description: 'Maximum depth for recursive listing (default: 3)' },
  },
  ['path'],
  'filesystem',
  false,
  async (input, ctx) => {
    try {
      const dirPath = resolvePath(input.path as string, ctx.workspacePath);
      const entries = await ctx.invoke<Array<{ name: string; is_dir: boolean }>>(
        'list_dir',
        { path: dirPath },
      );
      const formatted = entries
        .map((e) => (e.is_dir ? `${e.name}/` : e.name))
        .join('\n');
      return { success: true, output: formatted };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

export const searchCodeTool = defineTool(
  'search_code',
  'Search for text or regex patterns across files in the workspace. Returns matching lines with file paths and line numbers.',
  {
    pattern: { type: 'string', description: 'Text or regex pattern to search for (case-insensitive)' },
    include_pattern: { type: 'string', description: "Glob pattern to filter files (e.g., '**/*.ts')" },
    is_regex: { type: 'boolean', description: 'Whether pattern is a regex (default: false)' },
    max_results: { type: 'integer', description: 'Maximum number of matches to return (default: 50)' },
  },
  ['pattern'],
  'filesystem',
  false,
  async (input, ctx) => {
    try {
      const results = await ctx.invoke<Array<{ path: string; line_number: number; line_content: string }>>(
        'search_files',
        {
          root: ctx.workspacePath,
          query: input.pattern as string,
          max_results: (input.max_results as number) ?? 50,
        },
      );
      if (!results.length) {
        return { success: true, output: 'No matches found.' };
      }
      const formatted = results
        .map((r) => `${r.path}:${r.line_number}: ${r.line_content}`)
        .join('\n');
      return { success: true, output: formatted };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

// ─── Terminal Tools ─────────────────────────────────────────────────────────

export const runTerminalCommandTool = defineTool(
  'run_terminal_command',
  'Execute a command in the terminal. Returns stdout and stderr. Use for running tests, installing packages, running scripts, etc.',
  {
    command: { type: 'string', description: 'The command to execute' },
    cwd: { type: 'string', description: 'Working directory (default: workspace root)' },
    timeout_ms: { type: 'integer', description: 'Timeout in milliseconds (default: 30000)' },
  },
  ['command'],
  'terminal',
  true,
  async (input, ctx) => {
    try {
      const cwd = input.cwd
        ? resolvePath(input.cwd as string, ctx.workspacePath)
        : ctx.workspacePath;
      const command = input.command as string;
      const timeoutMs = (input.timeout_ms as number) || 30_000;

      // If no event listener available, return a clear error
      if (!ctx.listen) {
        return {
          success: false,
          output: '',
          error: 'Terminal execution requires event listener support. The listen callback is not available.',
        };
      }

      // Spawn a dedicated PTY for this command
      const ptyId = await ctx.invoke<string>('pty_spawn', { cwd });

      // Collect output via pty:data events
      let output = '';
      let exited = false;
      let exitCode: number | null = null;

      const unlisten = await ctx.listen('pty:data', (payload: unknown) => {
        const data = payload as { pty_id: string; data: string };
        if (data.pty_id === ptyId) {
          output += data.data;
        }
      });

      const unlistenExit = await ctx.listen('pty:exit', (payload: unknown) => {
        const data = payload as { pty_id: string; code: number | null };
        if (data.pty_id === ptyId) {
          exited = true;
          exitCode = data.code ?? null;
        }
      });

      // Write command followed by an exit marker
      const exitMarker = `__HYSCODE_EXIT_${Date.now()}__`;
      const isWin = typeof navigator !== 'undefined' && navigator.userAgent?.includes('Win');
      const wrappedCommand = isWin
        ? `${command}; echo ${exitMarker}; echo EXIT_CODE:$LASTEXITCODE\r\n`
        : `${command}; echo "${exitMarker}"; echo "EXIT_CODE:$?"\n`;
      await ctx.invoke('pty_write', { pty_id: ptyId, data: wrappedCommand });

      // Wait for exit marker or timeout
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs && !exited) {
        // Check if we've received the exit marker
        if (output.includes(exitMarker)) {
          const exitMatch = output.match(/EXIT_CODE:(\d+)/);
          exitCode = exitMatch ? parseInt(exitMatch[1], 10) : 0;
          const markerIdx = output.indexOf(exitMarker);
          output = output.slice(0, markerIdx).trim();
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      // Cleanup
      unlisten();
      unlistenExit();
      try {
        await ctx.invoke('pty_kill', { pty_id: ptyId });
      } catch {
        // Ignore kill errors if PTY already exited
      }

      // Trim PTY noise (echoed command prompt)
      const lines = output.split('\n');
      const cmdIdx = lines.findIndex((l) => l.includes(command.slice(0, 40)));
      if (cmdIdx >= 0 && cmdIdx < 3) {
        output = lines.slice(cmdIdx + 1).join('\n').trim();
      }

      const timedOut = !exited && !output.includes(exitMarker) && exitCode === null;
      if (timedOut) {
        return {
          success: false,
          output: output || '',
          error: `Command timed out after ${Math.round(timeoutMs / 1000)}s`,
          metadata: { cwd, timeoutMs, timedOut: true },
        };
      }

      return {
        success: exitCode === 0 || exitCode === null,
        output: output || `Command completed with exit code ${exitCode}`,
        error: exitCode !== null && exitCode !== 0 ? `Exit code: ${exitCode}` : undefined,
        metadata: { cwd, exitCode, timeoutMs },
      };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

// ─── Git Tools ──────────────────────────────────────────────────────────────

export const gitStatusTool = defineTool(
  'git_status',
  'Get the current git status of the workspace. Shows modified, added, deleted, and untracked files.',
  {},
  [],
  'git',
  false,
  async (_input, ctx) => {
    try {
      const result = await ctx.invoke<{
        staged: Array<{ path: string; status: string }>;
        unstaged: Array<{ path: string; status: string }>;
        untracked: Array<{ path: string; status: string }>;
        conflicts: Array<{ path: string; status: string }>;
      }>(
        'git_status',
        { repo_path: ctx.workspacePath },
      );

      const lines: string[] = [];
      for (const f of result.staged) lines.push(`staged    ${f.status} ${f.path}`);
      for (const f of result.unstaged) lines.push(`unstaged  ${f.status} ${f.path}`);
      for (const f of result.untracked) lines.push(`untracked ? ${f.path}`);
      for (const f of result.conflicts) lines.push(`conflict  U ${f.path}`);

      if (lines.length === 0) {
        return { success: true, output: 'Working tree clean.' };
      }
      return { success: true, output: lines.join('\n') };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

export const gitDiffTool = defineTool(
  'git_diff',
  'Get the git diff of uncommitted changes.',
  {
    staged: { type: 'boolean', description: 'If true, show diff of staged changes only (default: false)' },
    path: { type: 'string', description: 'Optional: diff only this file' },
  },
  [],
  'git',
  false,
  async (input, ctx) => {
    try {
      const staged = (input.staged as boolean) ?? false;
      const filePath = input.path
        ? resolvePath(input.path as string, ctx.workspacePath)
        : undefined;

      if (filePath) {
        const diff = await ctx.invoke<string>('git_diff_file', {
          repo_path: ctx.workspacePath,
          file_path: filePath,
          staged,
        });
        return { success: true, output: diff || 'No changes.' };
      }

      // Full diff — get status then diff each file
      const result = await ctx.invoke<{
        staged: Array<{ path: string }>;
        unstaged: Array<{ path: string }>;
      }>(
        'git_status',
        { repo_path: ctx.workspacePath },
      );

      const filesToDiff = staged ? result.staged : result.unstaged;
      const diffs: string[] = [];
      for (const file of filesToDiff) {
        try {
          const diff = await ctx.invoke<string>('git_diff_file', {
            repo_path: ctx.workspacePath,
            file_path: file.path,
            staged,
          });
          if (diff) diffs.push(diff);
        } catch {
          // Skip files that can't be diffed
        }
      }

      return { success: true, output: diffs.join('\n') || 'No changes.' };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

export const gitCommitTool = defineTool(
  'git_commit',
  'Stage files and create a git commit with the specified message.',
  {
    message: { type: 'string', description: 'Commit message (follow conventional commits format)' },
    paths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Files to stage and commit. If empty, commits all staged changes.',
    },
  },
  ['message'],
  'git',
  true,
  async (input, ctx) => {
    try {
      const paths = input.paths as string[] | undefined;

      if (paths && paths.length > 0) {
        const resolved = paths.map((p) => resolvePath(p, ctx.workspacePath));
        await ctx.invoke('git_add', {
          repo_path: ctx.workspacePath,
          paths: resolved,
        });
      }

      const result = await ctx.invoke<string>('git_commit', {
        repo_path: ctx.workspacePath,
        message: input.message,
      });

      return { success: true, output: result || `Committed: ${input.message}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

export const gitAddTool = defineTool(
  'git_add',
  'Stage files for commit.',
  {
    paths: {
      type: 'array',
      items: { type: 'string' },
      description: 'File paths to stage. If empty, stages all changes.',
    },
  },
  [],
  'git',
  true,
  async (input, ctx) => {
    try {
      const paths = input.paths as string[] | undefined;
      if (paths && paths.length > 0) {
        const resolved = paths.map((p) => resolvePath(p, ctx.workspacePath));
        await ctx.invoke('git_add', {
          repo_path: ctx.workspacePath,
          paths: resolved,
        });
        return { success: true, output: `Staged: ${paths.join(', ')}` };
      } else {
        await ctx.invoke('git_add_all', { repo_path: ctx.workspacePath });
        return { success: true, output: 'Staged all changes.' };
      }
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

// ─── Extended Git Tools ─────────────────────────────────────────────────────

export const gitLogTool = defineTool(
  'git_log',
  'Show recent git commit history.',
  {
    max_count: {
      type: 'number',
      description: 'Max number of commits to return (default: 20).',
    },
    file: {
      type: 'string',
      description: 'Optionally limit to commits affecting this file path.',
    },
  },
  [],
  'git',
  false,
  async (input, ctx) => {
    try {
      const limit = (input.max_count as number) || 20;
      const file = input.file ? resolvePath(input.file as string, ctx.workspacePath) : undefined;

      if (file) {
        const commits = await ctx.invoke<Array<{ short_hash: string; message: string; author: string; timestamp: number }>>(
          'git_log_file',
          { repo_path: ctx.workspacePath, file_path: file, limit },
        );
        if (!commits.length) return { success: true, output: 'No commits found.' };
        const formatted = commits.map(c => `${c.short_hash} ${c.message.split('\n')[0]} (${c.author})`).join('\n');
        return { success: true, output: formatted };
      }

      const commits = await ctx.invoke<Array<{ short_hash: string; message: string; author: string; timestamp: number }>>(
        'git_log',
        { repo_path: ctx.workspacePath, limit },
      );
      if (!commits.length) return { success: true, output: 'No commits found.' };
      const formatted = commits.map(c => `${c.short_hash} ${c.message.split('\n')[0]} (${c.author})`).join('\n');
      return { success: true, output: formatted };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

export const gitCheckoutTool = defineTool(
  'git_checkout',
  'Switch to a branch or create a new branch.',
  {
    branch: { type: 'string', description: 'Branch name to switch to.' },
    create: {
      type: 'boolean',
      description: 'If true, create the branch before switching (git checkout -b).',
    },
  },
  ['branch'],
  'git',
  true,
  async (input, ctx) => {
    try {
      const branch = input.branch as string;
      const create = input.create as boolean | undefined;

      if (create) {
        await ctx.invoke('git_branch_create', {
          repo_path: ctx.workspacePath,
          name: branch,
          checkout: true,
        });
        return { success: true, output: `Created and switched to branch: ${branch}` };
      }

      await ctx.invoke('git_checkout', {
        repo_path: ctx.workspacePath,
        branch,
      });
      return { success: true, output: `Switched to branch: ${branch}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

// ─── Code Tools ─────────────────────────────────────────────────────────────

export const getDiagnosticsTool = defineTool(
  'get_diagnostics',
  'Get compiler/linter diagnostics (errors and warnings) from the editor for a file or the entire workspace.',
  {
    file: {
      type: 'string',
      description: 'File path to get diagnostics for. Omit for all workspace diagnostics.',
    },
  },
  [],
  'code',
  false,
  async (input, ctx) => {
    try {
      const file = input.file ? resolvePath(input.file as string, ctx.workspacePath) : undefined;
      const diagnostics = await ctx.invoke<Array<{
        file: string;
        line: number;
        col: number;
        severity: string;
        message: string;
        source?: string;
      }>>('get_diagnostics', { path: file });

      if (!diagnostics || diagnostics.length === 0) {
        return { success: true, output: file ? 'No diagnostics for this file.' : 'No diagnostics in workspace.' };
      }

      const formatted = diagnostics.map(
        (d) => `${d.file}:${d.line}:${d.col} [${d.severity}] ${d.message}${d.source ? ` (${d.source})` : ''}`,
      ).join('\n');

      return {
        success: true,
        output: `${diagnostics.length} diagnostic(s):\n${formatted}`,
        metadata: { count: diagnostics.length },
      };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

// ─── Browser Tools ──────────────────────────────────────────────────────────

export const webFetchTool = defineTool(
  'web_fetch',
  'Fetch the text content of a web page or API endpoint. Useful for reading documentation, API responses, or web content relevant to the task.',
  {
    url: { type: 'string', description: 'The URL to fetch.' },
    max_length: {
      type: 'number',
      description: 'Max characters to return (default: 10000).',
    },
  },
  ['url'],
  'browser',
  false,
  async (input, ctx) => {
    try {
      const url = input.url as string;
      const maxLen = (input.max_length as number) || 10_000;

      // Validate URL to prevent SSRF — only allow http/https
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return { success: false, output: '', error: 'Invalid URL format.' };
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { success: false, output: '', error: 'Only http and https URLs are allowed.' };
      }

      // Block internal/private IPs
      const hostname = parsed.hostname;
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.') ||
        hostname === '::1' ||
        hostname === '[::1]'
      ) {
        return { success: false, output: '', error: 'Fetching internal/private addresses is not allowed.' };
      }

      const result = await ctx.invoke<string>('web_fetch', { url, max_length: maxLen });
      const text = result?.slice(0, maxLen) ?? '';
      return {
        success: true,
        output: text || '(empty response)',
        metadata: { url, length: text.length, truncated: text.length >= maxLen },
      };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
);

// ─── Meta Tools ─────────────────────────────────────────────────────────────

export const activateSkillTool = defineTool(
  'activate_skill',
  'Activate a skill to enhance your capabilities for the current conversation. Skills provide domain-specific instructions and best practices. Use this BEFORE performing specialized tasks like testing, security review, performance optimization, documentation, or git workflows.',
  {
    skill_name: { type: 'string', description: 'Name of the skill to activate (use list_skills to discover available names)' },
  },
  ['skill_name'],
  'meta',
  false,
  async (input, _ctx) => {
    return {
      success: true,
      output: `Skill activation requested: ${input.skill_name}`,
      metadata: { action: 'activate_skill', skillName: input.skill_name },
    };
  },
);

export const listSkillsTool = defineTool(
  'list_skills',
  'List all available skills with their names, descriptions, and activation status. Use this to discover which skills you can activate for the current task. Always check available skills before specialized work.',
  {},
  [],
  'meta',
  false,
  async (_input, _ctx) => {
    // The harness intercepts this via metadata action and injects the real skill list.
    return {
      success: true,
      output: 'Skills list requested.',
      metadata: { action: 'list_skills' },
    };
  },
);

// ─── Task Management Tool ───────────────────────────────────────────────────

export const manageTasksTool = defineTool(
  'manage_tasks',
  'Create, update, and track a task list for the current conversation. Use this to plan multi-step work, track progress, and give the user visibility into what you are doing. Provide the FULL task list each time (existing + new items). Mark tasks in_progress before starting, completed when done.',
  {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Sequential task ID (1, 2, 3...)' },
          title: { type: 'string', description: 'Short task title (3-7 words)' },
          status: {
            type: 'string',
            description: 'not_started | in_progress | completed | blocked',
          },
        },
        required: ['id', 'title', 'status'],
      },
      description: 'The complete list of tasks. Must include ALL items (existing and new).',
    },
  },
  ['tasks'],
  'meta',
  false,
  async (input, _ctx) => {
    const tasks = input.tasks as Array<{ id: number; title: string; status: string }>;
    // The harness bridge reads the metadata action and forwards to the store
    return {
      success: true,
      output: `Task list updated (${tasks.length} tasks, ${tasks.filter((t) => t.status === 'completed').length} completed).`,
      metadata: { action: 'manage_tasks', tasks },
    };
  },
);

// ─── Export All Tools ───────────────────────────────────────────────────────

export function getAllBuiltinTools(): ToolHandler[] {
  return [
    // Filesystem
    readFileTool,
    writeFileTool,
    editFileTool,
    createFileTool,
    listDirectoryTool,
    searchCodeTool,
    // Terminal
    runTerminalCommandTool,
    // Git
    gitStatusTool,
    gitDiffTool,
    gitCommitTool,
    gitAddTool,
    gitLogTool,
    gitCheckoutTool,
    // Code
    getDiagnosticsTool,
    // Browser
    webFetchTool,
    // Meta
    activateSkillTool,
    listSkillsTool,
    manageTasksTool,
  ];
}
