import { useState } from 'react';
import { FileMenu } from './file-menu';
import { ViewMenu } from './view-menu';

type WorkspaceMode = 'editor' | 'build' | 'review';

export function TitleBar() {
  const [mode, setMode] = useState<WorkspaceMode>('editor');

  return (
    <header
      data-tauri-drag-region
      className="flex h-10 items-center bg-background px-2"
    >
      {/* Left: File + View menus */}
      <div className="flex items-center shrink-0">
        <FileMenu />
        <ViewMenu />
      </div>

      {/* Center: filled mode pills */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-0.5 rounded-pill bg-surface-raised p-[3px]">
          {(['editor', 'build', 'review'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-pill px-4 py-[3px] text-[10px] font-medium uppercase tracking-wider transition-colors ${
                mode === m
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Right spacer for visual balance */}
      <div className="w-16 shrink-0" />
    </header>
  );
}
