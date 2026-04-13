import { Bot } from 'lucide-react';
import { useState } from 'react';
import { AgentSelectors } from './agent-selectors';
import { AgentMessages } from './agent-messages';
import { AgentInput } from './agent-input';
import type { AgentMode } from './agent-selectors';

export function AgentPanel() {
  const [mode, setMode] = useState<AgentMode>('chat');

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-8 items-center gap-2 border-b border-border px-3">
        <Bot className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] font-medium">Agent</span>
      </div>

      {/* Selectors bar (agent, mode, model) */}
      <AgentSelectors
        mode={mode}
        onModeChange={setMode}
        model="claude-4-sonnet"
        agent="HysCode Agent"
      />

      {/* Messages */}
      <AgentMessages />

      {/* Input */}
      <AgentInput mode={mode} />
    </div>
  );
}
