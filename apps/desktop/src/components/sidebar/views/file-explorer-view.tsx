import { FolderOpen, RefreshCw, FilePlus, FolderPlus, Eye, EyeOff } from 'lucide-react';
import { useFileStore, useProjectStore } from '../../../stores';
import { pickFolder } from '../../../lib/tauri-dialog';
import { tauriFs } from '../../../lib/tauri-fs';
import { promptInput } from '../../ui/dialogs';
import { FileTree } from './file-tree';

export function FileExplorerView() {
  const rootPath = useFileStore((s) => s.rootPath);
  const openFolder = useFileStore((s) => s.openFolder);
  const showHidden = useFileStore((s) => s.showHidden);
  const toggleShowHidden = useFileStore((s) => s.toggleShowHidden);
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

  const handleNewFileAtRoot = async () => {
    if (!rootPath) return;
    const name = await promptInput({ title: 'New File', placeholder: 'Enter file name' });
    if (!name?.trim()) return;
    const sep = rootPath.includes('/') ? '/' : '\\';
    try {
      await tauriFs.createFile(rootPath + sep + name.trim(), '');
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  };

  const handleNewFolderAtRoot = async () => {
    if (!rootPath) return;
    const name = await promptInput({ title: 'New Folder', placeholder: 'Enter folder name' });
    if (!name?.trim()) return;
    const sep = rootPath.includes('/') ? '/' : '\\';
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_directory', { path: rootPath + sep + name.trim() });
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <FolderOpen className="mb-3 h-8 w-8 opacity-30" />
        <p className="text-xs">No folder open</p>
        <button
          onClick={handleOpenFolder}
          className="mt-3 rounded-md bg-surface-raised px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
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
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleNewFileAtRoot}
            className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="New File"
          >
            <FilePlus className="h-3 w-3" />
          </button>
          <button
            onClick={handleNewFolderAtRoot}
            className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="New Folder"
          >
            <FolderPlus className="h-3 w-3" />
          </button>
          <button
            onClick={toggleShowHidden}
            className={`flex h-5 w-5 items-center justify-center rounded-sm transition-colors ${
              showHidden
                ? 'text-foreground bg-muted'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={showHidden ? 'Hide Hidden Files' : 'Show Hidden Files'}
          >
            {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
          <button
            onClick={handleRefresh}
            className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-auto">
        <FileTree />
      </div>
    </div>
  );
}
