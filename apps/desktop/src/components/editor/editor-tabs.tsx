import { X, Circle, GitCompare, Wand2 } from 'lucide-react';
import { useEditorStore } from '../../stores';
import { useAgentStore } from '../../stores/agent-store';
import { useShallow } from 'zustand/shallow';

export function EditorTabs() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);

  // useShallow performs array-content comparison so this selector is stable
  const pendingPathsArray = useAgentStore(
    useShallow((s) =>
      s.pendingFileChanges
        .filter((c) => c.status === 'pending')
        .map((c) => c.filePath),
    ),
  );
  const pendingPaths = new Set(pendingPathsArray);

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-8 items-center gap-0.5 bg-surface-raised px-2 overflow-x-auto shrink-0">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        const isDiff = tab.type === 'diff';
        const hasPendingChange = tab.filePath ? pendingPaths.has(tab.filePath) : false;
        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer select-none ${
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {isDiff && <GitCompare className="h-3 w-3 shrink-0 text-accent" />}
            {hasPendingChange && !isDiff && (
              <Wand2 className="h-3 w-3 shrink-0 text-amber-400" />
            )}
            <span className="truncate max-w-[120px]">{tab.fileName}</span>
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
    </div>
  );
}
