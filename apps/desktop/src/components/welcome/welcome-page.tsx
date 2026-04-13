import { FolderOpen, Clock, Trash2, Code2, ArrowRight } from 'lucide-react';
import { useProjectStore, useFileStore } from '../../stores';
import { pickFolder } from '../../lib/tauri-dialog';
import type { RecentProject } from '../../stores/project-store';

export function WelcomePage() {
  const openProject = useProjectStore((s) => s.openProject);
  const openFolder = useFileStore((s) => s.openFolder);
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const removeRecent = useProjectStore((s) => s.removeRecent);

  const handleOpenFolder = async () => {
    const path = await pickFolder();
    if (path) {
      openProject(path);
      await openFolder(path);
    }
  };

  const handleOpenRecent = async (project: RecentProject) => {
    openProject(project.path);
    await openFolder(project.path);
  };

  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const shortenPath = (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/');
    if (parts.length <= 3) return normalized;
    return `.../${parts.slice(-3).join('/')}`;
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-2xl flex-col items-center gap-10 px-8">
        {/* Logo and title */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted border border-border">
            <Code2 className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-light tracking-tight text-foreground">
            HysCode
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-powered code editor
          </p>
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={handleOpenFolder}
            className="group flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 text-left transition-all hover:bg-surface-raised hover:border-border-hover"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted">
              <FolderOpen className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Open Folder</p>
              <p className="text-[11px] text-muted-foreground">
                Browse and select a project directory
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="flex w-full flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Recent Projects
              </span>
            </div>

            <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-1">
              {recentProjects.map((project) => (
                <div
                  key={project.path}
                  className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent-muted cursor-pointer"
                  onClick={() => handleOpenRecent(project)}
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-accent opacity-60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {project.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {shortenPath(project.path)}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDate(project.lastOpened)}
                  </span>
                  <button
                    className="flex h-5 w-5 items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-error transition-all"
                    title="Remove from recent"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecent(project.path);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keyboard shortcuts */}
        <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px]">
              Ctrl+K Ctrl+O
            </kbd>
            <span>Open Folder</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px]">
              Ctrl+L
            </kbd>
            <span>Focus Agent</span>
          </div>
        </div>
      </div>
    </div>
  );
}
