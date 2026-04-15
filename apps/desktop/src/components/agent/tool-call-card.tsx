import {
  Wrench,
  Check,
  X,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  Terminal,
  GitBranch,
  FolderOpen,
  Pencil,
  Plus,
  Zap,
  Globe,
  Database,
  Network,
  type LucideIcon,
} from 'lucide-react';
import { useState, memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ToolCallDisplay } from '@/stores/agent-store';

// ─── Icon mapping ─────────────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, LucideIcon> = {
  read_file: FileText,
  write_file: Plus,
  create_file: Plus,
  edit_file: Pencil,
  search_code: Search,
  list_directory: FolderOpen,
  run_terminal_command: Terminal,
  git_status: GitBranch,
  git_diff: GitBranch,
  git_commit: GitBranch,
  activate_skill: Zap,
  list_skills: Zap,
  mcp_call: Globe,
  mcp_query: Network,
  database_query: Database,
};

// ─── Category detection ───────────────────────────────────────────────────────

type ToolCategory = 'file' | 'search' | 'terminal' | 'git' | 'skill' | 'mcp' | 'default';

function getToolCategory(name: string): ToolCategory {
  if (name.startsWith('mcp_')) return 'mcp';
  if (/read_file|write_file|create_file|edit_file|list_directory/.test(name)) return 'file';
  if (/search/.test(name)) return 'search';
  if (/terminal|command/.test(name)) return 'terminal';
  if (/git/.test(name)) return 'git';
  if (/skill/.test(name)) return 'skill';
  return 'default';
}

const CATEGORY_COLORS: Record<ToolCategory, { border: string; bg: string; text: string }> = {
  file:     { border: 'border-blue-500/20',   bg: 'bg-blue-500/[0.04]',  text: 'text-blue-400' },
  search:   { border: 'border-cyan-500/20',   bg: 'bg-cyan-500/[0.04]',  text: 'text-cyan-400' },
  terminal: { border: 'border-green-500/20',  bg: 'bg-green-500/[0.04]', text: 'text-green-400' },
  git:      { border: 'border-orange-500/20', bg: 'bg-orange-500/[0.04]', text: 'text-orange-400' },
  skill:    { border: 'border-yellow-500/20', bg: 'bg-yellow-500/[0.04]', text: 'text-yellow-400' },
  mcp:      { border: 'border-purple-500/20', bg: 'bg-purple-500/[0.04]', text: 'text-purple-400' },
  default:  { border: 'border-border/20',     bg: 'bg-white/[0.01]',     text: 'text-muted-foreground' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToolLabel(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getToolSummary(name: string, input: Record<string, unknown>): string {
  const path = input.path as string | undefined;
  if (path) {
    const short = path.split(/[\\/]/).slice(-2).join('/');
    if (name === 'read_file') {
      const start = input.start_line as number | undefined;
      const end = input.end_line as number | undefined;
      if (start && end) return `${short} L${start}-${end}`;
      return short;
    }
    return short;
  }
  const query = input.query as string | undefined;
  if (query) return query.length > 40 ? query.slice(0, 40) + '…' : query;
  const command = input.command as string | undefined;
  if (command) return command.length > 40 ? command.slice(0, 40) + '…' : command;
  return '';
}

function formatDuration(startedAt?: number, completedAt?: number): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = completedAt - startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Single tool call line (used inside ToolCallGroup) ────────────────────────

interface ToolCallCardProps {
  toolCall: ToolCallDisplay;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const ToolIcon = TOOL_ICONS[toolCall.name] ?? Wrench;
  const summary = getToolSummary(toolCall.name, toolCall.input);
  const category = getToolCategory(toolCall.name);
  const colors = CATEGORY_COLORS[category];
  const duration = formatDuration(toolCall.startedAt, toolCall.completedAt);

  const isRunning = toolCall.status === 'running';
  const isFailed = toolCall.status === 'error';
  const isDone = toolCall.status === 'success';

  return (
    <div className="agent-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'group/tc flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left transition-all',
          isRunning && 'bg-accent/[0.03]',
          'hover:bg-white/[0.03]',
        )}
      >
        {/* Status dot */}
        <div className="relative flex-shrink-0">
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          ) : isDone ? (
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500/15">
              <Check className="h-2 w-2 text-green-400" />
            </div>
          ) : isFailed ? (
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500/15">
              <X className="h-2 w-2 text-red-400" />
            </div>
          ) : (
            <Clock className="h-3.5 w-3.5 text-yellow-400/50" />
          )}
        </div>

        {/* Tool icon + name */}
        <ToolIcon className={cn('h-3 w-3 shrink-0', colors.text, 'opacity-60')} />
        <span className={cn(
          'text-[11px] font-medium',
          isFailed ? 'text-red-400/80' : 'text-foreground/75',
        )}>
          {getToolLabel(toolCall.name)}
        </span>

        {/* Inline summary */}
        {summary && (
          <span className="ml-0.5 max-w-[180px] truncate font-mono text-[10px] text-muted-foreground/35">
            {summary}
          </span>
        )}

        {/* Duration badge */}
        {duration && (
          <span className="ml-auto shrink-0 rounded-full bg-muted/30 px-1.5 py-[1px] text-[9px] tabular-nums text-muted-foreground/40">
            {duration}
          </span>
        )}

        {/* Expand chevron */}
        <div className={cn(
          'shrink-0 transition-opacity',
          duration ? '' : 'ml-auto',
          expanded ? 'opacity-100' : 'opacity-0 group-hover/tc:opacity-100',
        )}>
          {expanded ? (
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40" />
          ) : (
            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" />
          )}
        </div>
      </button>

      {/* Expandable detail panel */}
      {expanded && (
        <div className="agent-fade-in ml-5 mt-1 mb-1.5 overflow-hidden rounded-lg border border-border/15 bg-surface-raised/30">
          {/* Input section */}
          <div className="px-3 pt-2.5 pb-2">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">Input</span>
            <pre className="mt-1 overflow-x-auto rounded-md bg-[#0d1117]/60 p-2.5 font-mono text-[10px] leading-relaxed text-foreground/55">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {/* Output section */}
          {toolCall.output && (
            <div className="border-t border-border/10 px-3 pt-2 pb-2.5">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-green-400/50">Output</span>
              <pre className="mt-1 max-h-36 overflow-auto rounded-md bg-[#0d1117]/60 p-2.5 font-mono text-[10px] leading-relaxed text-foreground/55">
                {toolCall.output}
              </pre>
            </div>
          )}
          {/* Error section */}
          {toolCall.error && (
            <div className="border-t border-red-500/10 px-3 pt-2 pb-2.5">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-red-400/60">Error</span>
              <pre className="mt-1 overflow-x-auto rounded-md bg-red-950/15 p-2.5 font-mono text-[10px] leading-relaxed text-red-300/70">
                {toolCall.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tool Call Group (collapsible "Used N tools") ─────────────────────────────

interface ToolCallGroupProps {
  toolCalls: ToolCallDisplay[];
}

export const ToolCallGroup = memo(function ToolCallGroup({ toolCalls }: ToolCallGroupProps) {
  const [expanded, setExpanded] = useState(true);

  const { doneCount, errorCount, runningCount, total, allDone } = useMemo(() => {
    const done = toolCalls.filter((tc) => tc.status === 'success').length;
    const err = toolCalls.filter((tc) => tc.status === 'error').length;
    const running = toolCalls.filter((tc) => tc.status === 'running').length;
    const t = toolCalls.length;
    return { doneCount: done, errorCount: err, runningCount: running, total: t, allDone: done + err === t && running === 0 };
  }, [toolCalls]);

  // Check if this group contains MCP tools
  const hasMcpTools = useMemo(() => toolCalls.some(tc => tc.name.startsWith('mcp_')), [toolCalls]);

  // Build status label
  let statusLabel: string;
  if (runningCount > 0) {
    statusLabel = `Running ${runningCount} tool${runningCount > 1 ? 's' : ''}…`;
  } else if (allDone) {
    statusLabel = `Used ${total} tool${total > 1 ? 's' : ''}`;
  } else {
    statusLabel = `${doneCount}/${total} tools`;
  }

  const progressPct = total > 0 ? Math.round(((doneCount + errorCount) / total) * 100) : 0;

  return (
    <div className="agent-fade-in my-2 overflow-hidden rounded-lg border border-border/20 bg-surface-raised/20">
      {/* Shimmer bar when running */}
      {runningCount > 0 && (
        <div className="h-[2px] w-full agent-shimmer-bar opacity-30" />
      )}

      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.02]"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        )}

        {/* Status icon */}
        {runningCount > 0 ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/10">
            <Loader2 className="h-3 w-3 animate-spin text-accent" />
          </div>
        ) : allDone && errorCount === 0 ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-green-500/10">
            <Check className="h-3 w-3 text-green-400" />
          </div>
        ) : allDone && errorCount > 0 ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-red-500/10">
            <X className="h-3 w-3 text-red-400" />
          </div>
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-muted/30">
            <Wrench className="h-3 w-3 text-muted-foreground/60" />
          </div>
        )}

        <div className="flex flex-col gap-0">
          <span className="text-[11px] font-medium text-foreground/70">{statusLabel}</span>
          {hasMcpTools && (
            <span className="text-[9px] text-purple-400/50">via MCP</span>
          )}
        </div>

        {/* Error badge */}
        {errorCount > 0 && (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-medium text-red-400/80">
            {errorCount} failed
          </span>
        )}

        {/* Mini progress bar */}
        {!allDone && total > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="h-1 w-12 overflow-hidden rounded-full bg-muted/30">
              <div
                className="h-full rounded-full bg-accent/60 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground/40">
              {doneCount + errorCount}/{total}
            </span>
          </div>
        )}
      </button>

      {/* Tool list */}
      {expanded && (
        <div className="border-t border-border/10 px-1.5 py-1">
          {toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
});
