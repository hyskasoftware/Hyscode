import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
}

const placeholderTabs: Tab[] = [
  { id: '1', label: 'welcome.tsx' },
  { id: '2', label: 'readme.md' },
  { id: '3', label: 'index.ts' },
];

interface EditorTabsProps {
  activeTab: string;
  onSelect: (id: string) => void;
}

export function EditorTabs({ activeTab, onSelect }: EditorTabsProps) {
  return (
    <div className="flex h-8 items-center gap-0.5 border-b border-border px-2">
      {placeholderTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${
            activeTab === tab.id
              ? 'text-foreground bg-accent-muted border border-border-hover'
              : 'text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
