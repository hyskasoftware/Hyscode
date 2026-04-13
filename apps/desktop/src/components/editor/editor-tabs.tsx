import { X, Circle } from 'lucide-react';
import { useEditorStore } from '../../stores';

export function EditorTabs() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-8 items-center gap-0.5 border-b border-border px-2 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer select-none ${
              isActive
                ? 'text-foreground bg-accent-muted border border-border-hover'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
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
