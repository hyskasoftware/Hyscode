import { Send, Paperclip, ChevronDown } from 'lucide-react';
import { useState, useRef } from 'react';
import type { AgentMode } from './agent-selectors';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const AGENTS = ['HysCode Agent', 'Researcher', 'Architect'];
const MODELS = ['claude-sonnet-4-5', 'gpt-4o', 'gemini-2.0-flash'];

interface AgentInputProps {
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  model: string;
  agent: string;
}

export function AgentInput({ mode, onModeChange, model, agent }: AgentInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholders: Record<AgentMode, string> = {
    chat: 'Ask anything...',
    build: 'Describe what to build...',
    review: 'What should I review?',
  };

  const handleSend = () => {
    if (!input.trim()) return;
    // TODO: dispatch to agent store
    setInput('');
  };

  return (
    <div className="shrink-0 bg-surface-raised px-2.5 pt-2 pb-2.5 flex flex-col gap-1.5">
      {/* Textarea area */}
      <div className="rounded-lg bg-background px-2.5 py-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholders[mode]}
          className="max-h-32 min-h-[36px] w-full border-0 bg-transparent text-xs leading-relaxed focus-visible:ring-0 resize-none overflow-y-auto"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
      </div>

      {/* Bottom toolbar: selectors left, actions right */}
      <div className="flex items-center justify-between gap-2">
        {/* Selectors */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {/* Agent */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex cursor-pointer items-center gap-0.5 rounded-pill bg-muted px-2 py-[3px] text-[10px] text-muted-foreground transition-colors hover:text-foreground focus:outline-none">
              <span className="truncate max-w-[90px]">{agent}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="min-w-[160px]">
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

          {/* Model */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex cursor-pointer items-center gap-0.5 rounded-pill bg-muted px-2 py-[3px] text-[10px] text-muted-foreground transition-colors hover:text-foreground focus:outline-none">
              <span className="truncate max-w-[100px]">{model}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="min-w-[180px]">
              {MODELS.map((m) => (
                <DropdownMenuItem key={m}>{m}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-foreground"
                />
              }
            >
              <Paperclip />
            </TooltipTrigger>
            <TooltipContent side="top">Attach file</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  disabled={!input.trim()}
                  onClick={handleSend}
                  className="disabled:opacity-30"
                />
              }
            >
              <Send />
            </TooltipTrigger>
            <TooltipContent side="top">Send (Enter)</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
