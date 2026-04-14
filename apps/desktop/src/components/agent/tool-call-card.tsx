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
  if (query) return query.length > 50 ? query.slice(0, 50) + '…' : query;
  const command = input.command as string | undefined;
  if (command) return command.length > 50 ? command.slice(0, 50) + '…' : command;
  return '';
}

// ─── Single tool call line (used inside ToolCallGroup) ────────────────────────

interface ToolCallCardProps {
  toolCall: ToolCallDisplay;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const ToolIcon = TOOL_ICONS[toolCall.name] ?? Wrench;
  const summary = getToolSummary(toolCall.name, toolCall.input);

  const isRunning = toolCall.status === 'running';
  const isFailed = toolCall.status === 'error';
  const isDone = toolCall.status === 'success';

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="group/tc flex w-full items-center gap-1.5 rounded px-1.5 py-[3px] text-left transition-colors hover:bg-white/[0.03]"
      >
        {/* Status indicator */}
        {isRunning ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent/70" />
        ) : isDone ? (
          <Check className="h-3 w-3 shrink-0 text-green-400/60" />
        ) : isFailed ? (
          <X className="h-3 w-3 shrink-0 text-red-400/60" />
        ) : (
          <Clock className="h-3 w-3 shrink-0 text-yellow-400/50" />
        )}

        {/* Tool icon + name */}
        <ToolIcon className="h-3 w-3 shrink-0 text-muted-foreground/40" />
        <span className={cn(
          'text-[11px]',
          isFailed ? 'text-red-400/80' : 'text-foreground/70',
        )}>
          {getToolLabel(toolCall.name)}
        </span>

        {/* Inline summary */}
        {summary && (
          <span className="ml-0.5 truncate font-mono text-[10px] text-muted-foreground/40">
            {summary}
          </span>
        )}

        {/* Expand chevron on hover */}
        <div className="ml-auto opacity-0 transition-opacity group-hover/tc:opacity-100">
          {expanded ? (
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40" />
          ) : (
            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" />
          )}
        </div>
      </button>

      {/* Expandable detail panel */}
      {expanded && (
        <div className="ml-[18px] mt-0.5 mb-1 rounded border border-border/20 bg-[#0d1117]/60 px-2.5 py-2 text-[10px]">
          <div className="mb-1">
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50">Input</span>
            <pre className="mt-0.5 overflow-x-auto rounded bg-[#0d1117] p-2 font-mono text-[10px] leading-relaxed text-foreground/60">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.output && (
            <div>
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50">Output</span>
              <pre className="mt-0.5 max-h-32 overflow-auto rounded bg-[#0d1117] p-2 font-mono text-[10px] leading-relaxed text-foreground/60">
                {toolCall.output}
              </pre>
            </div>
          )}
          {toolCall.error && (
            <div>
              <span className="text-[9px] font-medium uppercase tracking-wider text-red-400/70">Error</span>
              <pre className="mt-0.5 overflow-x-auto rounded bg-red-950/20 p-2 font-mono text-[10px] leading-relaxed text-red-300/70">
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

  // Build status label
  let statusLabel: string;
  if (runningCount > 0) {
    statusLabel = `Running ${runningCount} tool${runningCount > 1 ? 's' : ''}…`;
  } else if (allDone) {
    statusLabel = `Used ${total} tool${total > 1 ? 's' : ''}`;
  } else {
    statusLabel = `${doneCount}/${total} tools`;
  }

  return (
    <div className="my-1.5 rounded-md border border-border/20 bg-[#0d1117]/30">
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/40" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
        )}

        {/* Status icon */}
        {runningCount > 0 ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent/70" />
        ) : allDone && errorCount === 0 ? (
          <Check className="h-3 w-3 shrink-0 text-green-400/60" />
        ) : allDone && errorCount > 0 ? (
          <X className="h-3 w-3 shrink-0 text-red-400/60" />
        ) : (
          <Wrench className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        )}

        <span className="text-[11px] text-muted-foreground/70">{statusLabel}</span>

        {/* Error badge */}
        {errorCount > 0 && (
          <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-400/80">
            {errorCount} failed
          </span>
        )}
      </button>

      {/* Tool list */}
      {expanded && (
        <div className="border-t border-border/15 px-1 py-0.5">
          {toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
});
