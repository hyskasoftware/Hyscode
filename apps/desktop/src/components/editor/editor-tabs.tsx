import { X, Circle, GitCompare, Wand2, Loader2, Pin } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useEditorStore } from '../../stores';
import { useAgentStore } from '../../stores/agent-store';
import { useShallow } from 'zustand/shallow';
import { TabContextMenu } from './tab-context-menu';
import type { AgentEditPhase } from '../../stores/agent-store';
import type { Tab } from '../../stores/editor-store';

export function EditorTabs() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: Tab } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tab });
  }, []);

  // Map filePath → phase for active edit sessions
  const editPhaseMap = useAgentStore(
    useShallow((s) => {
      const map: Record<string, AgentEditPhase> = {};
      for (const es of s.agentEditSessions) {
        if (es.phase === 'streaming' || es.phase === 'pending_review') {
          map[es.filePath] = es.phase;
        }
      }
      return map;
    }),
  );

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-8 items-center gap-0.5 bg-surface-raised px-2 overflow-x-auto shrink-0">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        const isDiff = tab.type === 'diff';
        const editPhase = tab.filePath ? editPhaseMap[tab.filePath] : undefined;
        const isStreaming = editPhase === 'streaming';
        const isPendingReview = editPhase === 'pending_review';
        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer select-none ${
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
            }`}
            onClick={() => setActiveTab(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab)}
          >
            {tab.isPinned && (
              <Pin className="h-2.5 w-2.5 shrink-0 text-accent opacity-60" />
            )}
            {isDiff && <GitCompare className="h-3 w-3 shrink-0 text-accent" />}
            {isStreaming && !isDiff && (
              <Loader2 className="h-3 w-3 shrink-0 text-purple-400 animate-spin" />
            )}
            {isPendingReview && !isDiff && (
              <Wand2 className="h-3 w-3 shrink-0 text-purple-400" />
            )}
            <span className={`truncate max-w-[120px] ${tab.isPreview ? 'italic' : ''}`}>{tab.fileName}</span>
            {tab.isDirty && (
              <Circle className="h-2 w-2 shrink-0 fill-accent text-accent" />
            )}
            <button
              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              title="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tab={contextMenu.tab}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
