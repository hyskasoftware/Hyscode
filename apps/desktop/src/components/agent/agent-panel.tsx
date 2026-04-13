import { Bot, Trash2, History } from 'lucide-react';
import { AgentMessages } from './agent-messages';
import { AgentInput } from './agent-input';
import { ContextChipsBar } from './context-chips-bar';
import { SessionHistory } from './session-history';
import { SddStepper } from './sdd/sdd-stepper';
import { useAgentStore } from '@/stores/agent-store';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function AgentPanel() {
  const sddPhase = useAgentStore((s) => s.sddPhase);
  const clearConversation = useAgentStore((s) => s.clearConversation);
  const messageCount = useAgentStore((s) => s.messages.length);
  const tokenUsage = useAgentStore((s) => s.tokenUsage);
  const historyOpen = useAgentStore((s) => s.historyOpen);
  const setHistoryOpen = useAgentStore((s) => s.setHistoryOpen);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between bg-surface-raised px-3">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-medium">Agent</span>
          {tokenUsage && (
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {tokenUsage.totalTokens.toLocaleString()} tokens
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setHistoryOpen(!historyOpen)}
                  className={historyOpen ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}
                />
              }
            >
              <History className="h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Session history</TooltipContent>
          </Tooltip>
          {messageCount > 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={clearConversation}
                    className="text-muted-foreground hover:text-foreground"
                  />
                }
              >
                <Trash2 className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent side="bottom">Clear conversation</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Session History overlay */}
      {historyOpen ? (
        <SessionHistory />
      ) : (
        <>
          {/* SDD Stepper (only visible in active SDD session) */}
          {sddPhase && <SddStepper />}

          {/* Context chips */}
          <ContextChipsBar />

          {/* Messages */}
          <AgentMessages />

          {/* Input + selectors at the bottom */}
          <AgentInput />
        </>
      )}
    </div>
  );
}
