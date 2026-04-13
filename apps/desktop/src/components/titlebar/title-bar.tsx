import { useState } from 'react';

type WorkspaceMode = 'editor' | 'build' | 'review';

export function TitleBar() {
  const [mode, setMode] = useState<WorkspaceMode>('editor');

  return (
    <header className="flex h-10 items-center justify-center border-b border-border bg-background px-4">
      {/* Center: mode pills */}
      <div className="flex items-center gap-0.5 rounded-pill border border-border p-[3px]">
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
    </header>
  );
}
