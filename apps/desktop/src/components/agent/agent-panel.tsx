import { Bot } from 'lucide-react';
import { useState } from 'react';
import { AgentMessages } from './agent-messages';
import { AgentInput } from './agent-input';
import type { AgentMode } from './agent-selectors';

export function AgentPanel() {
  const [mode, setMode] = useState<AgentMode>('chat');

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center gap-2 bg-surface-raised px-3">
        <Bot className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] font-medium">Agent</span>
      </div>

      {/* Messages */}
      <AgentMessages />

      {/* Input + selectors at the bottom */}
      <AgentInput
        mode={mode}
        onModeChange={setMode}
        model="claude-sonnet-4-5"
        agent="HysCode Agent"
      />
    </div>
  );
}
