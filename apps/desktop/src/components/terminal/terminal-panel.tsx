import { Terminal, Plus, X } from 'lucide-react';

export function TerminalPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between bg-surface-raised px-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Terminal
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Plus className="h-3 w-3" />
          </button>
          <button className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 p-3 font-mono text-xs text-muted-foreground">
        <span className="text-accent opacity-50">&#x276F;</span>
        <span className="ml-1.5 animate-pulse">_</span>
      </div>
    </div>
  );
}
