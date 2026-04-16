import { FileMenu } from './file-menu';
import { ViewMenu } from './view-menu';
import { BrandMark } from '../brand-mark';
import { useLayoutStore } from '../../stores/layout-store';
import type { WorkspaceMode } from '../../stores/layout-store';

const MODE_LABELS: Record<WorkspaceMode, string> = {
  editor: 'editor',
  agent: 'agent',
  review: 'review',
};

export function TitleBar() {
  const mode = useLayoutStore((s) => s.workspaceMode);
  const setMode = useLayoutStore((s) => s.setWorkspaceMode);

  return (
    <header
      data-tauri-drag-region
      className="flex h-10 items-center bg-background px-2"
    >
      {/* Left: brand + menus */}
      <div className="flex items-center shrink-0 gap-2">
        <div data-tauri-drag-region className="flex items-center gap-2 px-1">
          <BrandMark className="h-4 w-4 rounded-[4px]" alt="HysCode" />
          <span className="text-[11px] font-medium text-muted-foreground">HysCode</span>
        </div>
        <FileMenu />
        <ViewMenu />
      </div>

      {/* Center: filled mode pills */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-0.5 rounded-pill bg-surface-raised p-[3px]">
          {(['editor', 'agent', 'review'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-pill px-4 py-[3px] text-[10px] font-medium uppercase tracking-wider transition-colors ${
                mode === m
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Right spacer for visual balance */}
      <div className="w-16 shrink-0" />
    </header>
  );
}
