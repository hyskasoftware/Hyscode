import { Minus, Square, X } from 'lucide-react';
import { useState } from 'react';

type WorkspaceMode = 'editor' | 'build' | 'review';

export function TitleBar() {
  const [mode, setMode] = useState<WorkspaceMode>('editor');

  return (
    <header
      data-tauri-drag-region
      className="flex h-10 items-center justify-between border-b border-border bg-background px-4"
    >
      {/* Left: window pills */}
      <div className="flex items-center gap-1.5" data-tauri-drag-region>
        <span className="inline-block h-2.5 w-2.5 rounded-full border border-border-hover" />
        <span className="inline-block h-2.5 w-2.5 rounded-full border border-border-hover" />
        <span className="inline-block h-2.5 w-2.5 rounded-full border border-border-hover" />
        <span className="ml-3 text-[11px] font-medium tracking-widest text-muted-foreground">
          HYSCODE
        </span>
      </div>

      {/* Center: mode pills */}
      <div
        className="flex items-center gap-0.5 rounded-pill border border-border p-[3px]"
        data-tauri-drag-region
      >
        {(['editor', 'build', 'review'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-pill px-4 py-[3px] text-[10px] font-medium uppercase tracking-wider transition-colors ${
              mode === m
                ? 'bg-surface-raised text-foreground border border-border-hover'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Right: window controls */}
      <div className="flex items-center gap-0.5">
        <button className="flex h-6 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors">
          <Minus className="h-3 w-3" />
        </button>
        <button className="flex h-6 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors">
          <Square className="h-2.5 w-2.5" />
        </button>
        <button className="flex h-6 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-error hover:bg-error/10 transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>
    </header>
  );
}
