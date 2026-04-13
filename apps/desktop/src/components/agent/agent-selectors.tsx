import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type AgentMode = 'chat' | 'build' | 'review';

interface AgentSelectorsProps {
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  model: string;
  agent: string;
}

const AGENTS = ['HysCode Agent', 'Researcher', 'Architect'];
const MODELS = ['claude-sonnet-4-5', 'gpt-4o', 'gemini-2.0-flash'];

export function AgentSelectors({ mode, onModeChange, model, agent }: AgentSelectorsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-surface-raised px-3 py-2">
      {/* Agent selector */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex cursor-pointer items-center gap-1 rounded-pill bg-muted px-2.5 py-[3px] text-[10px] text-muted-foreground transition-colors hover:text-foreground focus:outline-none">
          <span>{agent}</span>
          <ChevronDown className="h-2.5 w-2.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[160px]">
          {AGENTS.map((a) => (
            <DropdownMenuItem key={a}>{a}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mode pills */}
      <div className="flex items-center gap-0.5 rounded-pill bg-background p-[2px]">
        {(['chat', 'build', 'review'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={cn(
              'cursor-pointer rounded-pill px-2.5 py-[2px] text-[10px] font-medium capitalize transition-colors',
              mode === m
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Model selector */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex cursor-pointer items-center gap-1 rounded-pill bg-muted px-2.5 py-[3px] text-[10px] text-muted-foreground transition-colors hover:text-foreground focus:outline-none">
          <span>{model}</span>
          <ChevronDown className="h-2.5 w-2.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[180px]">
          {MODELS.map((m) => (
            <DropdownMenuItem key={m}>{m}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
