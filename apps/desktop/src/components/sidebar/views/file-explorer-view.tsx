import { FolderOpen, RefreshCw } from 'lucide-react';
import { useFileStore, useProjectStore } from '../../../stores';
import { pickFolder } from '../../../lib/tauri-dialog';
import { FileTree } from './file-tree';

export function FileExplorerView() {
  const rootPath = useFileStore((s) => s.rootPath);
  const openFolder = useFileStore((s) => s.openFolder);
  const projectName = useProjectStore((s) => s.name);
  const openProject = useProjectStore((s) => s.openProject);

  const handleOpenFolder = async () => {
    const path = await pickFolder();
    if (path) {
      openProject(path);
      await openFolder(path);
    }
  };

  const handleRefresh = async () => {
    if (rootPath) {
      await openFolder(rootPath);
    }
  };

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <FolderOpen className="mb-3 h-8 w-8 opacity-30" />
        <p className="text-xs">No folder open</p>
        <button
          onClick={handleOpenFolder}
          className="mt-3 rounded-md border border-border-hover px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent-muted transition-colors"
        >
          Open Folder
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {projectName}
        </span>
        <button
          onClick={handleRefresh}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-auto">
        <FileTree />
      </div>
    </div>
  );
}
