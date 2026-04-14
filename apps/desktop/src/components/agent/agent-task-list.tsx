import { Check, Circle, Loader2, AlertTriangle } from 'lucide-react';
import { useAgentStore } from '@/stores/agent-store';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { icon: typeof Check; color: string; animate?: boolean }> = {
  not_started: { icon: Circle, color: 'text-muted-foreground/50' },
  in_progress: { icon: Loader2, color: 'text-accent', animate: true },
  completed: { icon: Check, color: 'text-green-400' },
  blocked: { icon: AlertTriangle, color: 'text-yellow-400' },
};

export function AgentTaskList() {
  const tasks = useAgentStore((s) => s.agentTasks);

  if (tasks.length === 0) return null;

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const pct = Math.round((completed / tasks.length) * 100);

  return (
    <div className="mx-3 my-2 rounded-lg border border-border/50 bg-muted/30 p-3">
      {/* Header + progress */}
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="font-medium text-foreground">Tasks</span>
        <span className="text-muted-foreground">
          {completed}/{tasks.length} ({pct}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Task items */}
      <ul className="space-y-1">
        {tasks.map((task) => {
          const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.not_started;
          const Icon = cfg.icon;
          return (
            <li key={task.id} className="flex items-center gap-2 text-[11px]">
              <Icon
                className={cn(
                  'h-3 w-3 flex-shrink-0',
                  cfg.color,
                  cfg.animate && 'animate-spin',
                )}
              />
              <span
                className={cn(
                  'truncate',
                  task.status === 'completed'
                    ? 'text-muted-foreground line-through'
                    : 'text-foreground',
                )}
              >
                {task.title}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
