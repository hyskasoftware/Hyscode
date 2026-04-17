import { Files, Search, GitBranch, Settings, Bot, Puzzle, Blocks, Smartphone, Container } from 'lucide-react';
import { useSettingsStore } from '../../stores';
import { useGitStore } from '../../stores/git-store';
import { useDockerStore } from '../../stores/docker-store';
import { useAgentStore } from '../../stores/agent-store';
import { useExtensionStore } from '../../stores/extension-store';
import type { SidebarView } from './sidebar';

const items = [
  { id: 'files', icon: Files, label: 'Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'git', icon: GitBranch, label: 'Source Control' },
  { id: 'skills', icon: Puzzle, label: 'Skills' },
  { id: 'extensions', icon: Blocks, label: 'Extensions' },
  { id: 'agent', icon: Bot, label: 'Agent' },
  { id: 'devices', icon: Smartphone, label: 'Devices' },
  { id: 'docker', icon: Container, label: 'Docker' },
] as const;

interface ActivityBarProps {
  active: SidebarView;
  onSelect: (view: SidebarView) => void;
}

function ActivityBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums leading-none bg-accent text-accent-foreground"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function ActivityBar({ active, onSelect }: ActivityBarProps) {
  const openSettings = useSettingsStore((s) => s.openSettings);

  const gitCount = useGitStore(
    (s) => s.staged.length + s.unstaged.length + s.untracked.length + s.conflicts.length,
  );
  const runningContainers = useDockerStore(
    (s) => s.containers.filter((c) => c.state.toLowerCase() === 'running').length,
  );
  const pendingAgentSessions = useAgentStore(
    (s) => s.agentEditSessions.filter(
      (es) => es.phase === 'streaming' || es.phase === 'pending_review',
    ).length,
  );
  const disabledExtensions = useExtensionStore(
    (s) => s.extensions.filter((e) => !e.enabled).length,
  );

  const badges: Partial<Record<SidebarView, number>> = {
    git:        gitCount,
    docker:     runningContainers,
    agent:      pendingAgentSessions,
    extensions: disabledExtensions,
  };

  return (
    <div className="flex w-11 flex-col items-center gap-1 bg-sidebar py-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        const badge = badges[item.id as SidebarView];
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
              isActive
                ? 'bg-surface-raised text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised/50'
            }`}
            title={item.label}
          >
            <Icon className="h-[18px] w-[18px]" />
            {badge !== undefined && <ActivityBadge count={badge} />}
          </button>
        );
      })}

      <div className="mt-auto">
        <button
          onClick={openSettings}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-raised/50 transition-colors"
          title="Settings"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
