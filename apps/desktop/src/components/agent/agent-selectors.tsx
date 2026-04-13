import { ChevronDown } from 'lucide-react';

export type AgentMode = 'chat' | 'build' | 'review';

interface AgentSelectorsProps {
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  model: string;
  agent: string;
}

export function AgentSelectors({ mode, onModeChange, model, agent }: AgentSelectorsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-surface-raised px-3 py-2">
      {/* Agent selector */}
      <button className="flex items-center gap-1 rounded-pill bg-muted px-2.5 py-[3px] text-[10px] text-muted-foreground hover:text-foreground transition-colors">
        <span>{agent}</span>
        <ChevronDown className="h-2.5 w-2.5" />
      </button>

      {/* Mode pills */}
      <div className="flex items-center gap-0.5 rounded-pill bg-background p-[2px]">
        {(['chat', 'build', 'review'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`rounded-pill px-2.5 py-[2px] text-[10px] font-medium capitalize transition-colors ${
              mode === m
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Model selector */}
      <button className="flex items-center gap-1 rounded-pill bg-muted px-2.5 py-[3px] text-[10px] text-muted-foreground hover:text-foreground transition-colors">
        <span>{model}</span>
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
