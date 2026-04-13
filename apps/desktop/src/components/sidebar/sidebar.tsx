import { useState } from 'react';
import { ActivityBar } from './activity-bar';
import { SidebarContent } from './sidebar-content';

const viewLabels: Record<SidebarView, string> = {
  files: 'Explorer',
  search: 'Search',
  git: 'Source Control',
  skills: 'Skills',
  extensions: 'Extensions',
  agent: 'Agent',
};

export type SidebarView = 'files' | 'search' | 'git' | 'skills' | 'extensions' | 'agent';

export function Sidebar() {
  const [activeView, setActiveView] = useState<SidebarView>('files');

  return (
    <div className="flex h-full">
      <ActivityBar active={activeView} onSelect={setActiveView} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-8 items-center px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {viewLabels[activeView]}
        </div>
        <div className="flex-1 overflow-auto px-2">
          <SidebarContent view={activeView} />
        </div>
      </div>
    </div>
  );
}
