import { Terminal, GripVertical, Bot } from 'lucide-react';
import { useLayoutStore } from '@/stores/layout-store';
import { AgentPanel } from '@/components/agent';
import { TerminalPanel } from '@/components/terminal';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';

/**
 * Wraps AgentPanel and (optionally) TerminalPanel in a tabbed container
 * when the terminal is docked in the sidebar.
 */
export function SidebarPanel() {
  const terminalLocation = useLayoutStore((s) => s.terminalLocation);
  const terminalVisible = useLayoutStore((s) => s.terminalVisible);
  const activeTab = useLayoutStore((s) => s.sidebarActiveTab);
  const setSidebarActiveTab = useLayoutStore((s) => s.setSidebarActiveTab);
  const showTabs = terminalLocation === 'sidebar' && terminalVisible;

  // ── Drag source: terminal tab can be dragged out ──
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('hyscode/terminal-move', 'to-bottom');
      e.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  if (!showTabs) {
    // Terminal is in bottom panel — just render Agent
    return <AgentPanel />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex h-8 shrink-0 items-center bg-surface-raised">
        <button
          onClick={() => setSidebarActiveTab('chat')}
          className={cn(
            'flex h-8 items-center gap-1.5 px-3 text-[11px] font-medium transition-colors',
            activeTab === 'chat'
              ? 'bg-surface text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          <Bot className="h-3.5 w-3.5 shrink-0" />
          Chat
        </button>
        <button
          draggable
          onDragStart={handleDragStart}
          onClick={() => setSidebarActiveTab('terminal')}
          className={cn(
            'flex h-8 items-center gap-1.5 px-3 text-[11px] font-medium transition-colors cursor-grab active:cursor-grabbing',
            activeTab === 'terminal'
              ? 'bg-surface text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          <Terminal className="h-3 w-3 shrink-0" />
          Terminal
          <GripVertical className="h-2.5 w-2.5 text-muted-foreground/50" />
        </button>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-hidden">
        <div className={cn('absolute inset-0', activeTab === 'chat' ? 'z-10' : 'z-0 invisible')}>
          <AgentPanel />
        </div>
        <div className={cn('absolute inset-0', activeTab === 'terminal' ? 'z-10' : 'z-0 invisible')}>
          <TerminalPanel />
        </div>
      </div>
    </div>
  );
}
