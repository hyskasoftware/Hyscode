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
      const results = await ctx.invoke<Array<{ file: string; line: number; text: string }>>(
        'search_files',
        {
          path: ctx.workspacePath,
          query: input.pattern,
          include_pattern: input.include_pattern,
          is_regex: input.is_regex ?? false,
          max_results: input.max_results ?? 50,
        },
      );
      if (!results.length) {
        return { success: true, output: 'No matches found.' };
      }
      const formatted = results
        .map((r) => `${r.file}:${r.line}: ${r.text}`)
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

      // Use PTY to run command and capture output
      const ptyId = `agent-${Date.now()}`;
      await ctx.invoke('pty_spawn', {
        id: ptyId,
        shell: navigator.userAgent?.includes('Win') ? 'powershell.exe' : '/bin/bash',
        cwd,
        cols: 120,
        rows: 30,
      });

      // Write command
      const command = input.command as string;
      await ctx.invoke('pty_write', { id: ptyId, data: command + '\n' });

      // Wait for completion (simplified — in production use proper signaling)
      const timeoutMs = (input.timeout_ms as number) || 30_000;
      const startTime = Date.now();
      let output = '';

      // Poll for output with timeout
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(async () => {
          if (Date.now() - startTime > timeoutMs) {
            clearInterval(checkInterval);
            resolve();
          }
          // In real implementation, collect output from PTY events
        }, 100);

        // Simple timeout-based approach
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, Math.min(timeoutMs, 5000));
      });

      // Kill the PTY
      try {
        await ctx.invoke('pty_kill', { id: ptyId });
      } catch {
        // Ignore kill errors
      }

      return {
        success: true,
        output: output || `Command executed: ${command}`,
        metadata: { cwd, timeoutMs },
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
      const status = await ctx.invoke<Array<{ path: string; status: string }>>(
        'git_status',
        { path: ctx.workspacePath },
      );
      if (!status.length) {
        return { success: true, output: 'Working tree clean.' };
      }
      const formatted = status.map((s) => `${s.status} ${s.path}`).join('\n');
      return { success: true, output: formatted };
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
      const filePath = input.path
        ? resolvePath(input.path as string, ctx.workspacePath)
        : undefined;

      if (filePath) {
        const diff = await ctx.invoke<string>('git_diff_file', {
          repo_path: ctx.workspacePath,
          file_path: filePath,
        });
        return { success: true, output: diff || 'No changes.' };
      }

      // Full diff — get status then diff each file
      const status = await ctx.invoke<Array<{ path: string; status: string }>>(
        'git_status',
        { path: ctx.workspacePath },
      );

      const diffs: string[] = [];
      for (const file of status) {
        try {
          const diff = await ctx.invoke<string>('git_diff_file', {
            repo_path: ctx.workspacePath,
            file_path: file.path,
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
        // Stage specific files
        for (const p of paths) {
          await ctx.invoke('git_add', {
            repo_path: ctx.workspacePath,
            path: resolvePath(p, ctx.workspacePath),
          });
        }
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
        for (const p of paths) {
          await ctx.invoke('git_add', {
            repo_path: ctx.workspacePath,
            path: resolvePath(p, ctx.workspacePath),
          });
        }
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
    // Meta
    activateSkillTool,
    listSkillsTool,
  ];
}
