import { useEffect, useCallback } from 'react';
import { Terminal, Plus, X, GripVertical } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTerminalStore } from '../../stores/terminal-store';
import { useLayoutStore } from '../../stores/layout-store';
import { TerminalInstance } from './terminal-instance';

export function TerminalPanel() {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const createSession = useTerminalStore((s) => s.createSession);
  const closeSession = useTerminalStore((s) => s.closeSession);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const terminalLocation = useLayoutStore((s) => s.terminalLocation);

  // Auto-create first terminal session
  useEffect(() => {
    if (sessions.length === 0) {
      createSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(
    (e: React.MouseEvent, sessionId: string, ptyId: string | null) => {
      e.stopPropagation();
      if (ptyId) {
        invoke('pty_kill', { ptyId }).catch(() => {});
      }
      closeSession(sessionId);
    },
    [closeSession],
  );

  // Drag the terminal header to move it to the sidebar
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('hyscode/terminal-move', 'to-sidebar');
      e.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar — session tabs always visible; drag grip only in bottom mode */}
      <div className="flex h-8 shrink-0 items-center justify-between bg-surface-raised">
        <div className="flex items-center gap-0 overflow-x-auto">
          {/* Draggable grip to move terminal to sidebar — only in bottom mode */}
          {terminalLocation === 'bottom' && (
            <div
              draggable
              onDragStart={handleDragStart}
              className="flex h-8 w-6 cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
              title="Drag to move terminal to sidebar"
            >
              <GripVertical className="h-3 w-3" />
            </div>
          )}
          {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setActiveSession(session.id)}
                className={`group flex h-8 items-center gap-1.5 px-3 text-[11px] transition-colors ${
                  session.id === activeSessionId
                    ? 'bg-surface text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Terminal className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[100px]">{session.name}</span>
                <span
                  role="button"
                  onClick={(e) => handleClose(e, session.id, session.ptyId)}
                  className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </button>
            ))}
            <button
              onClick={() => createSession()}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="New Terminal"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

      {/* Terminal instances */}
      <div className="relative flex-1 overflow-hidden bg-surface">
        {sessions.map((session) => (
          <TerminalInstance
            key={session.id}
            sessionId={session.id}
            isActive={session.id === activeSessionId}
          />
        ))}
        {sessions.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No terminals open
          </div>
        )}
      </div>
    </div>
  );
}
