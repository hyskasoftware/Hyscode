import { Send, Paperclip } from 'lucide-react';
import { useState } from 'react';
import type { AgentMode } from './agent-selectors';

interface AgentInputProps {
  mode: AgentMode;
}

export function AgentInput({ mode }: AgentInputProps) {
  const [input, setInput] = useState('');

  const placeholders: Record<AgentMode, string> = {
    chat: 'Ask anything...',
    build: 'Describe the feature to build...',
    review: 'What should I review?',
  };

  return (
    <div className="bg-surface-raised p-2.5">
      <div className="flex items-end gap-2 rounded-lg bg-background p-2 transition-colors">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholders[mode]}
          className="flex-1 resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
            }
          }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <button className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Paperclip className="h-3 w-3" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">Ctrl+L</span>
          <span className="text-[9px] text-muted-foreground">Shift+Enter for new line</span>
          <button
            className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground hover:text-accent disabled:opacity-30 transition-colors"
            disabled={!input.trim()}
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
