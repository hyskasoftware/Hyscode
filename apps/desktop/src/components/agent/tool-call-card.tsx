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
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ToolCallDisplay } from '@/stores/agent-store';

interface ToolCallCardProps {
  toolCall: ToolCallDisplay;
}

// Icon mapping for common tool names
const TOOL_ICONS: Record<string, typeof Wrench> = {
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

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-yellow-400/70', bg: 'bg-yellow-400/5', label: 'Pending' },
  approved: { icon: Check, color: 'text-blue-400/70', bg: 'bg-blue-400/5', label: 'Approved' },
  running: { icon: Loader2, color: 'text-accent', bg: 'bg-accent/5', label: 'Running', animate: true },
  success: { icon: Check, color: 'text-green-400/70', bg: 'bg-green-400/5', label: 'Done' },
  error: { icon: X, color: 'text-red-400/70', bg: 'bg-red-400/5', label: 'Failed' },
} as const;

/** Extract a short summary from tool input for inline preview */
function getToolSummary(name: string, input: Record<string, unknown>): string {
  const path = input.path as string | undefined;
  if (path) {
    const short = path.split(/[\\/]/).slice(-2).join('/');
    if (name === 'read_file') {
      const start = input.start_line as number | undefined;
      const end = input.end_line as number | undefined;
      if (start && end) return `${short} (L${start}-${end})`;
      return short;
    }
    return short;
  }
  const query = input.query as string | undefined;
  if (query) return query.length > 40 ? query.slice(0, 40) + '...' : query;
  const command = input.command as string | undefined;
  if (command) return command.length > 40 ? command.slice(0, 40) + '...' : command;
  return '';
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[toolCall.status];
  const StatusIcon = config.icon;
  const ToolIcon = TOOL_ICONS[toolCall.name] ?? Wrench;

  const duration =
    toolCall.startedAt && toolCall.completedAt
      ? `${((toolCall.completedAt - toolCall.startedAt) / 1000).toFixed(1)}s`
      : null;

  const summary = getToolSummary(toolCall.name, toolCall.input);

  return (
    <div className={cn(
      'rounded-md border border-border/30 transition-colors',
      config.bg,
    )}>
      {/* Header — compact inline */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
        )}

        <ToolIcon className="h-3 w-3 shrink-0 text-muted-foreground/60" />

        <span className="text-[10.5px] font-medium text-foreground/80">
          {toolCall.name}
        </span>

        {/* Inline summary */}
        {summary && (
          <span className="ml-1 truncate text-[10px] text-muted-foreground/50 font-mono">
            {summary}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {duration && (
            <span className="text-[9px] tabular-nums text-muted-foreground/50">{duration}</span>
          )}
          <StatusIcon
            className={cn(
              'h-3 w-3 shrink-0',
              config.color,
              'animate' in config && config.animate ? 'animate-spin' : '',
            )}
          />
        </div>
      </button>

      {/* Expandable details */}
      {expanded && (
        <div className="border-t border-border/20 px-2.5 py-2 text-[10px]">
          {/* Input */}
          <div className="mb-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">Input</span>
            <pre className="mt-0.5 overflow-x-auto rounded bg-[#0d1117] p-2 font-mono text-[10px] leading-relaxed text-foreground/70">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {toolCall.output && (
            <div>
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">Output</span>
              <pre className="mt-0.5 max-h-40 overflow-auto rounded bg-[#0d1117] p-2 font-mono text-[10px] leading-relaxed text-foreground/70">
                {toolCall.output}
              </pre>
            </div>
          )}

          {/* Error */}
          {toolCall.error && (
            <div>
              <span className="text-[9px] font-medium uppercase tracking-wider text-red-400/80">Error</span>
              <pre className="mt-0.5 overflow-x-auto rounded bg-red-950/20 p-2 font-mono text-[10px] leading-relaxed text-red-300/80">
                {toolCall.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
