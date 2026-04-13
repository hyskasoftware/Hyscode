import {
  Wrench,
  Check,
  X,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ToolCallDisplay } from '@/stores/agent-store';

interface ToolCallCardProps {
  toolCall: ToolCallDisplay;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-yellow-400', label: 'Pending approval' },
  approved: { icon: Check, color: 'text-blue-400', label: 'Approved' },
  running: { icon: Loader2, color: 'text-accent', label: 'Running', animate: true },
  success: { icon: Check, color: 'text-green-400', label: 'Completed' },
  error: { icon: X, color: 'text-red-400', label: 'Failed' },
} as const;

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[toolCall.status];
  const StatusIcon = config.icon;

  const duration =
    toolCall.startedAt && toolCall.completedAt
      ? `${((toolCall.completedAt - toolCall.startedAt) / 1000).toFixed(1)}s`
      : null;

  return (
    <div className="my-1 rounded-md border border-surface-raised bg-background">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}

        <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />

        <span className="flex-1 truncate text-[11px] font-medium text-foreground">
          {toolCall.name}
        </span>

        <StatusIcon
          className={cn(
            'h-3 w-3 shrink-0',
            config.color,
            'animate' in config && config.animate ? 'animate-spin' : '',
          )}
        />

        {duration && (
          <span className="text-[10px] tabular-nums text-muted-foreground">{duration}</span>
        )}
      </button>

      {/* Expandable details */}
      {expanded && (
        <div className="border-t border-surface-raised px-2.5 py-2 text-[10px]">
          {/* Input */}
          <div className="mb-1.5">
            <span className="font-medium uppercase tracking-wider text-muted-foreground">Input</span>
            <pre className="mt-0.5 overflow-x-auto rounded bg-surface-raised p-1.5 font-mono text-foreground/80">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {toolCall.output && (
            <div>
              <span className="font-medium uppercase tracking-wider text-muted-foreground">Output</span>
              <pre className="mt-0.5 max-h-40 overflow-auto rounded bg-surface-raised p-1.5 font-mono text-foreground/80">
                {toolCall.output}
              </pre>
            </div>
          )}

          {/* Error */}
          {toolCall.error && (
            <div>
              <span className="font-medium uppercase tracking-wider text-red-400">Error</span>
              <pre className="mt-0.5 overflow-x-auto rounded bg-red-950/30 p-1.5 font-mono text-red-300">
                {toolCall.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
