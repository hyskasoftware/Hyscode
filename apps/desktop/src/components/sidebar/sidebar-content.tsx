import { Files } from 'lucide-react';
import type { SidebarView } from './sidebar';

interface SidebarContentProps {
  view: SidebarView;
}

export function SidebarContent({ view }: SidebarContentProps) {
  switch (view) {
    case 'files':
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Files className="mb-3 h-8 w-8 opacity-30" />
          <p className="text-xs">No folder open</p>
          <button className="mt-3 rounded-md border border-border-hover px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent-muted transition-colors">
            Open Folder
          </button>
        </div>
      );
    case 'search':
      return (
        <div className="py-2">
          <p className="px-2 text-[11px] text-muted-foreground">
            Search will be available after opening a folder.
          </p>
        </div>
      );
    case 'git':
      return (
        <div className="py-2">
          <p className="px-2 text-[11px] text-muted-foreground">No repository detected.</p>
        </div>
      );
    case 'skills':
      return (
        <div className="py-2">
          <p className="px-2 text-[11px] text-muted-foreground">Skills panel — coming soon.</p>
        </div>
      );
    case 'agent':
      return (
        <div className="py-2">
          <p className="px-2 text-[11px] text-muted-foreground">Agent controls — coming soon.</p>
        </div>
      );
  }
}
