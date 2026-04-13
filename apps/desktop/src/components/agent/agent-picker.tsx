import {
  MessageSquare,
  Hammer,
  Search,
  RefreshCw,
  Bug,
  TestTube2,
  ChevronRight,
} from 'lucide-react';
import { useAgentStore } from '@/stores/agent-store';
import { HarnessBridge } from '@/lib/harness-bridge';
import { cn } from '@/lib/utils';
import type { AgentType } from '@hyscode/agent-harness';
import { getAllAgentDefinitions } from '@hyscode/agent-harness';

const AGENT_ICONS: Record<AgentType, typeof MessageSquare> = {
  chat: MessageSquare,
  build: Hammer,
  review: Search,
  refactor: RefreshCw,
  debug: Bug,
  test: TestTube2,
};

const AGENT_COLORS: Record<AgentType, string> = {
  chat: 'text-blue-400',
  build: 'text-accent',
  review: 'text-purple-400',
  refactor: 'text-orange-400',
  debug: 'text-red-400',
  test: 'text-green-400',
};

const AGENT_DEFS = getAllAgentDefinitions();

export function AgentPicker() {
  const currentType = useAgentStore((s) => s.agentType);

  const handleSelect = (type: AgentType) => {
    try {
      HarnessBridge.get().setAgentType(type);
    } catch {
      useAgentStore.getState().setAgentType(type);
    }
  };

  return (
    <div className="flex flex-col gap-1 p-2">
      <span className="px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Agents
      </span>
      {AGENT_DEFS.map((agent) => {
        const Icon = AGENT_ICONS[agent.type] ?? MessageSquare;
        const color = AGENT_COLORS[agent.type] ?? 'text-accent';
        const isActive = agent.type === currentType;

        return (
          <button
            key={agent.type}
            onClick={() => handleSelect(agent.type)}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
              isActive
                ? 'bg-surface-raised text-foreground'
                : 'text-muted-foreground hover:bg-surface-raised/50 hover:text-foreground',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', isActive ? color : '')} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-medium">{agent.name}</span>
              <span className="truncate text-[9px] text-muted-foreground">
                {agent.description}
              </span>
            </div>
            {isActive && <ChevronRight className="h-3 w-3 shrink-0 text-accent" />}
          </button>
        );
      })}
    </div>
  );
}
