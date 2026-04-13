import { Check, Circle, Loader2, AlertCircle, SkipForward } from 'lucide-react';
import { useAgentStore } from '@/stores/agent-store';
import { cn } from '@/lib/utils';
import type { SddTaskStatus } from '@hyscode/agent-harness';

const STATUS_ICONS: Record<SddTaskStatus, { icon: typeof Check; color: string; animate?: boolean }> = {
  pending: { icon: Circle, color: 'text-muted-foreground/50' },
  in_progress: { icon: Loader2, color: 'text-accent', animate: true },
  completed: { icon: Check, color: 'text-green-400' },
  skipped: { icon: SkipForward, color: 'text-yellow-400' },
  failed: { icon: AlertCircle, color: 'text-red-400' },
};

export function SddTaskList() {
  const tasks = useAgentStore((s) => s.sddTasks);
  const sddProgress = useAgentStore((s) => s.sddProgress);

  if (tasks.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-surface-raised bg-background p-3">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground">Tasks</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {sddProgress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${sddProgress}%` }}
        />
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-1">
        {tasks.map((task, i) => {
          const statusConfig = STATUS_ICONS[task.status];
          const Icon = statusConfig.icon;
          return (
            <div
              key={task.id}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-surface-raised"
            >
              <Icon
                className={cn(
                  'mt-0.5 h-3 w-3 shrink-0',
                  statusConfig.color,
                  statusConfig.animate ? 'animate-spin' : '',
                )}
              />
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-medium text-foreground">
                  {i + 1}. {task.title}
                </span>
                {task.description && (
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    {task.description}
                  </p>
                )}
                {task.files.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {task.files.map((f) => (
                      <span
                        key={f}
                        className="rounded bg-surface-raised px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground"
                      >
                        {f.split(/[\\/]/).pop()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
