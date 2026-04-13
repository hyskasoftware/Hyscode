import { Files, Search, GitBranch, Settings, Bot, Puzzle } from 'lucide-react';
import type { SidebarView } from './sidebar';

const items = [
  { id: 'files', icon: Files, label: 'Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'git', icon: GitBranch, label: 'Source Control' },
  { id: 'skills', icon: Puzzle, label: 'Skills' },
  { id: 'agent', icon: Bot, label: 'Agent' },
] as const;

interface ActivityBarProps {
  active: SidebarView;
  onSelect: (view: SidebarView) => void;
}

export function ActivityBar({ active, onSelect }: ActivityBarProps) {
  return (
    <div className="flex w-11 flex-col items-center gap-1 border-r border-border py-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
              isActive
                ? 'text-foreground bg-accent-muted border border-border-hover'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
            title={item.label}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        );
      })}

      <div className="mt-auto">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent transition-colors"
          title="Settings"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
