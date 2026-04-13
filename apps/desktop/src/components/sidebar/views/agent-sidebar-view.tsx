import { Bot, Settings, MessageSquare, Hammer, Eye, Zap } from 'lucide-react';
import { useAgentStore } from '../../../stores';
import type { AgentMode } from '../../../stores/agent-store';

const MODE_OPTIONS: { mode: AgentMode; icon: typeof MessageSquare; label: string; description: string }[] = [
  { mode: 'chat', icon: MessageSquare, label: 'Chat', description: 'Ask questions, get explanations' },
  { mode: 'build', icon: Hammer, label: 'Build', description: 'Generate and edit code' },
  { mode: 'review', icon: Eye, label: 'Review', description: 'Review code, find issues' },
];

export function AgentSidebarView() {
  const { mode, setMode, contextFiles, removeContextFile, messages } = useAgentStore();

  const messageCount = messages.length;
  const lastMessage = messages[messages.length - 1];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1">
        <Bot className="h-3.5 w-3.5 text-accent" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Agent
        </span>
      </div>

      {/* Mode selector */}
      <div className="border-b border-border px-2 py-2">
        <span className="text-[10px] text-muted-foreground mb-1 block">Mode</span>
        <div className="flex gap-1">
          {MODE_OPTIONS.map(({ mode: m, icon: Icon, label }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-medium transition-colors ${
                mode === m
                  ? 'border-accent/30 bg-accent/5 text-accent'
                  : 'border-border text-muted-foreground hover:border-border-hover hover:text-foreground'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {MODE_OPTIONS.find((o) => o.mode === mode)?.description}
        </p>
      </div>

      {/* Context Files */}
      <div className="border-b border-border px-2 py-2">
        <span className="text-[10px] text-muted-foreground mb-1 block">
          Context Files ({contextFiles.length})
        </span>
        {contextFiles.length === 0 ? (
          <p className="text-[10px] text-muted-foreground opacity-50">
            Drag files here or use @ in chat
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {contextFiles.map((file) => {
              const name = file.split(/[\\/]/).pop() ?? file;
              return (
                <div
                  key={file}
                  className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] hover:bg-accent-muted group"
                >
                  <span className="truncate text-foreground">{name}</span>
                  <button
                    onClick={() => removeContextFile(file)}
                    className="ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground text-[10px]"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session info */}
      <div className="px-2 py-2">
        <span className="text-[10px] text-muted-foreground mb-1 block">Session</span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Zap className="h-3 w-3" />
          <span>{messageCount} messages</span>
        </div>
        {lastMessage && (
          <p className="mt-1 truncate text-[10px] text-muted-foreground opacity-60">
            Last: {lastMessage.role === 'user' ? 'You' : 'Agent'}
          </p>
        )}
      </div>
    </div>
  );
}
