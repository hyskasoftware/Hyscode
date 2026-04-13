import { Send, Square, Paperclip, ChevronDown } from 'lucide-react';
import { useState, useRef } from 'react';
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
import { useAgentStore } from '@/stores/agent-store';
import { useSettingsStore } from '@/stores/settings-store';
import { HarnessBridge } from '@/lib/harness-bridge';
import type { AgentMode } from '@/stores/agent-store';
import type { AgentType } from '@hyscode/agent-harness';
import { getAllAgentDefinitions } from '@hyscode/agent-harness';

const AGENT_DEFS = getAllAgentDefinitions();
const MODELS = ['claude-sonnet-4-5', 'gpt-4o', 'gemini-2.0-flash', 'llama-3.3-70b'];

export function AgentInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mode = useAgentStore((s) => s.mode);
  const setMode = useAgentStore((s) => s.setMode);
  const agentType = useAgentStore((s) => s.agentType);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const activeModelId = useSettingsStore((s) => s.activeModelId);

  const currentAgent = AGENT_DEFS.find((a) => a.type === agentType) ?? AGENT_DEFS[0];

  const placeholders: Record<AgentMode, string> = {
    chat: 'Ask anything...',
    build: 'Describe what to build...',
    review: 'What should I review?',
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    try {
      HarnessBridge.get().sendMessage(input.trim());
    } catch {
      // Bridge not initialized yet — ignore
    }
    setInput('');
  };

  const handleStop = () => {
    try {
      HarnessBridge.get().cancel();
    } catch {
      // ignore
    }
  };

  const handleAgentChange = (type: AgentType) => {
    try {
      HarnessBridge.get().setAgentType(type);
    } catch {
      useAgentStore.getState().setAgentType(type);
      useSettingsStore.getState().set('agentType', type);
    }
  };

  const handleModelChange = (modelId: string) => {
    useSettingsStore.getState().setActiveProvider(
      useSettingsStore.getState().activeProviderId ?? '',
      modelId,
    );
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
              <span className="truncate max-w-[90px]">{currentAgent.name}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="min-w-[160px]">
              {AGENT_DEFS.map((a) => (
                <DropdownMenuItem key={a.type} onClick={() => handleAgentChange(a.type)}>
                  <div className="flex flex-col">
                    <span className="text-[11px]">{a.name}</span>
                    <span className="text-[9px] text-muted-foreground">{a.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mode pills */}
          <div className="flex items-center gap-0.5 rounded-pill bg-background p-[2px]">
            {(['chat', 'build', 'review'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
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
              <span className="truncate max-w-[100px]">{activeModelId ?? 'Select model'}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="min-w-[180px]">
              {MODELS.map((m) => (
                <DropdownMenuItem key={m} onClick={() => handleModelChange(m)}>
                  {m}
                </DropdownMenuItem>
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

          {isStreaming ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    onClick={handleStop}
                    className="bg-red-600 hover:bg-red-700"
                  />
                }
              >
                <Square className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent side="top">Stop (Esc)</TooltipContent>
            </Tooltip>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
