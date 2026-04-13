import type { SidebarView } from './sidebar';
import {
  FileExplorerView,
  SearchView,
  GitView,
  SkillsView,
  ExtensionsView,
  AgentSidebarView,
} from './views';

interface SidebarContentProps {
  view: SidebarView;
}

export function SidebarContent({ view }: SidebarContentProps) {
  switch (view) {
    case 'files':
      return <FileExplorerView />;
    case 'search':
      return <SearchView />;
    case 'git':
      return <GitView />;
    case 'skills':
      return <SkillsView />;
    case 'extensions':
      return <ExtensionsView />;
    case 'agent':
      return <AgentSidebarView />;
  }
}
