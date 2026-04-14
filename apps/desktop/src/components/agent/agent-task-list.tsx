import { CheckCircle2, Circle, Loader2, AlertTriangle, ChevronDown, ChevronRight, ListTodo } from 'lucide-react';
import { useState } from 'react';
import { useAgentStore } from '@/stores/agent-store';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bgColor: string; animate?: boolean }> = {
  not_started: { icon: Circle, color: 'text-muted-foreground/40', bgColor: '' },
  in_progress: { icon: Loader2, color: 'text-accent', bgColor: 'bg-accent/5', animate: true },
  completed: { icon: CheckCircle2, color: 'text-green-400', bgColor: '' },
  blocked: { icon: AlertTriangle, color: 'text-yellow-400', bgColor: 'bg-yellow-400/5' },
};

export function AgentTaskList() {
  const tasks = useAgentStore((s) => s.agentTasks);
  const [expanded, setExpanded] = useState(true);

  if (tasks.length === 0) return null;

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const allDone = completed === total;

  return (
    <div className="mx-3 my-2">
      <div className="overflow-hidden rounded-lg border border-border/40 bg-[#0d1117]/40">
        {/* Header — clickable to expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.02]"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <ListTodo className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">
            Todos ({completed}/{total})
          </span>

          {/* Mini progress indicator */}
          {!allDone && (
            <div className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.round((completed / total) * 100)}%` }}
              />
            </div>
          )}
          {allDone && (
            <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-green-400" />
          )}
        </button>

        {/* Task items */}
        {expanded && (
          <div className="border-t border-border/20 px-1 py-1">
            {tasks.map((task) => {
              const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.not_started;
              const Icon = cfg.icon;
              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors',
                    cfg.bgColor,
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 flex-shrink-0',
                      cfg.color,
                      cfg.animate && 'animate-spin',
                    )}
                  />
                  <span
                    className={cn(
                      'truncate text-[11px]',
                      task.status === 'completed'
                        ? 'text-muted-foreground/60'
                        : task.status === 'in_progress'
                          ? 'text-foreground font-medium'
                          : 'text-foreground/80',
                    )}
                  >
                    {task.title}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
