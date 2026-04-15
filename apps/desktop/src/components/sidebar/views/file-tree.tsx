import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Copy,
  ClipboardCopy,
  FolderSearch,
  Files,
} from 'lucide-react';
import { useFileStore, useEditorStore, useGitStore } from '../../../stores';
import { tauriFs } from '../../../lib/tauri-fs';
import { getViewerType } from '../../../lib/utils';
import { getFileIcon, getFolderIcon, FolderIcon as DefaultFolderIcon } from './file-icons';
import { promptInput, promptConfirm } from '../../ui/dialogs';
import type { FileNode } from '../../../stores/file-store';
import type { GitFile } from '../../../stores/git-store';

// ── Git status colors (matching VS Code) ─────────────────────────────────────
const GIT_NAME_COLORS: Record<string, string> = {
  M: 'text-amber-300',
  A: 'text-green-400',
  D: 'text-red-400',
  R: 'text-green-400',
  C: 'text-green-400',
  T: 'text-purple-400',
  U: 'text-orange-400',
  '?': 'text-green-400',
};

const GIT_BADGE_COLORS: Record<string, string> = {
  M: 'text-amber-300',
  A: 'text-green-400',
  D: 'text-red-400',
  R: 'text-green-400',
  C: 'text-green-400',
  T: 'text-purple-400',
  U: 'text-orange-400',
  '?': 'text-green-400',
};

function buildGitStatusMap(
  staged: GitFile[],
  unstaged: GitFile[],
  untracked: GitFile[],
  conflicts: GitFile[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of untracked) map.set(f.path, f.status);
  for (const f of unstaged) map.set(f.path, f.status);
  for (const f of staged) map.set(f.path, f.status);
  for (const f of conflicts) map.set(f.path, f.status);
  return map;
}

function getDirGitInfo(
  relDir: string,
  gitMap: Map<string, string>,
): { count: number; dominantStatus: string | null } {
  let count = 0;
  let dominantStatus: string | null = null;
  const prefix = relDir + '/';
  for (const [path, status] of gitMap) {
    if (path.startsWith(prefix)) {
      count++;
      if (!dominantStatus) dominantStatus = status;
      else if (status === 'M' || status === 'U') dominantStatus = status;
    }
  }
  return { count, dominantStatus };
}

function getLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    json: 'json', md: 'markdown', css: 'css', html: 'html', rs: 'rust', py: 'python',
    toml: 'toml', yaml: 'yaml', yml: 'yaml', sql: 'sql', sh: 'shell', bash: 'shell',
  };
  return map[ext] || 'plaintext';
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

function getParentPath(path: string): string {
  const sep = path.includes('/') ? '/' : '\\';
  const parts = path.split(sep);
  parts.pop();
  return parts.join(sep);
}

function getSep(path: string): string {
  return path.includes('/') ? '/' : '\\';
}

// ── Context Menu State ──────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode | null; // null = right-clicked on empty space
}

// ── Inline Input (for inline rename / create) ───────────────────────────────

interface InlineInputProps {
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  depth: number;
  isDir: boolean;
}

function InlineInput({ defaultValue = '', onSubmit, onCancel, depth, isDir }: InlineInputProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (defaultValue) {
      const dotIdx = defaultValue.lastIndexOf('.');
      inputRef.current?.setSelectionRange(0, dotIdx > 0 ? dotIdx : defaultValue.length);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) onSubmit(value.trim());
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const IconComp = isDir ? DefaultFolderIcon : getFileIcon(value || 'file');

  return (
    <div
      className="flex items-center gap-1 px-1 py-[3px]"
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      <span className="w-3 shrink-0" />
      <IconComp className="h-3.5 w-3.5 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        className="flex-1 rounded-sm bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-accent/40"
      />
    </div>
  );
}

// ── FileTreeNode ────────────────────────────────────────────────────────────

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  renamingPath: string | null;
  creatingIn: { parentPath: string; isDir: boolean } | null;
  onRenameSubmit: (node: FileNode, newName: string) => void;
  onRenameCancel: () => void;
  onCreateSubmit: (name: string) => void;
  onCreateCancel: () => void;
  gitMap: Map<string, string>;
  rootPath: string | null;
}

function FileTreeNode({
  node, depth, onContextMenu, renamingPath, creatingIn,
  onRenameSubmit, onRenameCancel, onCreateSubmit, onCreateCancel,
  gitMap, rootPath,
}: FileTreeNodeProps) {
  const { expandDirectory, toggleExpand } = useFileStore();
  const { openTab, tabs } = useEditorStore();
  const activeTabId = useEditorStore((s) => s.activeTabId);

  const relPath = useMemo(() => {
    if (!rootPath) return node.path;
    const normalized = node.path.replace(/\\/g, '/');
    let root = rootPath.replace(/\\/g, '/');
    if (!root.endsWith('/')) root += '/';
    return normalized.startsWith(root) ? normalized.slice(root.length) : normalized;
  }, [node.path, rootPath]);

  const gitStatus = gitMap.get(relPath) ?? null;

  const dirGit = useMemo(() => {
    if (!node.isDir) return null;
    return getDirGitInfo(relPath, gitMap);
  }, [node.isDir, relPath, gitMap]);

  const nameColorClass = gitStatus
    ? GIT_NAME_COLORS[gitStatus] ?? ''
    : dirGit && dirGit.count > 0
      ? GIT_NAME_COLORS[dirGit.dominantStatus ?? 'M'] ?? ''
      : '';

  const isActive = !node.isDir && tabs.find((t) => t.filePath === node.path)?.id === activeTabId;

  const handleClick = async () => {
    if (node.isDir) {
      if (!node.isExpanded && (!node.children || node.children.length === 0)) {
        await expandDirectory(node.path);
      } else {
        toggleExpand(node.path);
      }
    } else {
      const existing = tabs.find((t) => t.filePath === node.path);
      if (existing) {
        useEditorStore.getState().setActiveTab(existing.id);
      } else {
        openTab({
          id: node.path,
          filePath: node.path,
          fileName: node.name,
          language: getLanguage(node.name),
          viewerType: getViewerType(node.name),
        });
      }
    }
  };

  // Material icons
  const NodeIcon = node.isDir
    ? getFolderIcon(node.name, !!node.isExpanded)
    : getFileIcon(node.name);
  const ChevronIcon = node.isExpanded ? ChevronDown : ChevronRight;

  const isRenaming = renamingPath === node.path;

  if (isRenaming) {
    return (
      <InlineInput
        defaultValue={node.name}
        onSubmit={(newName) => onRenameSubmit(node, newName)}
        onCancel={onRenameCancel}
        depth={depth}
        isDir={node.isDir}
      />
    );
  }

  const sortedChildren = node.children ? sortNodes(node.children) : [];
  const showCreateInput =
    creatingIn && creatingIn.parentPath === node.path && node.isDir && node.isExpanded;

  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        className={`flex w-full items-center gap-1 rounded-sm px-1 py-[3px] text-[11px] transition-colors ${
          isActive ? 'bg-accent-muted' : 'hover:bg-surface-raised'
        } ${nameColorClass || 'text-foreground'}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {node.isDir ? (
          <>
            {node.isLoading ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <NodeIcon className="h-3.5 w-3.5 shrink-0" />
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <NodeIcon className="h-3.5 w-3.5 shrink-0" />
          </>
        )}
        <span className={`truncate ${nameColorClass || ''} ${gitStatus === 'D' ? 'line-through opacity-70' : ''}`}>
          {node.name}
        </span>
        {!node.isDir && gitStatus && (
          <span className={`ml-auto shrink-0 pr-1 text-[10px] font-mono font-medium ${GIT_BADGE_COLORS[gitStatus] ?? 'text-muted-foreground'}`}>
            {gitStatus === '?' ? 'U' : gitStatus}
          </span>
        )}
        {node.isDir && dirGit && dirGit.count > 0 && (
          <span className={`ml-auto shrink-0 pr-1 h-[6px] w-[6px] rounded-full ${
            dirGit.dominantStatus === 'M' || dirGit.dominantStatus === 'U'
              ? 'bg-amber-400'
              : dirGit.dominantStatus === 'D' ? 'bg-red-400' : 'bg-green-400'
          }`} />
        )}
      </button>

      {node.isDir && node.isExpanded && (
        <div>
          {showCreateInput && (
            <InlineInput
              onSubmit={onCreateSubmit}
              onCancel={onCreateCancel}
              depth={depth + 1}
              isDir={creatingIn!.isDir}
            />
          )}
          {sortedChildren.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              creatingIn={creatingIn}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
              gitMap={gitMap}
              rootPath={rootPath}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── Context Menu Item ────────────────────────────────────────────────────────

function ContextMenuItem({
  icon: Icon,
  label,
  shortcut,
  onClick,
  danger,
}: {
  icon: typeof FilePlus;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
        danger ? 'text-error hover:bg-error/10' : 'text-foreground hover:bg-surface-raised'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="ml-4 text-[10px] text-muted-foreground">{shortcut}</span>
      )}
    </button>
  );
}

function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

// ── Main FileTree ────────────────────────────────────────────────────────────

export function FileTree() {
  const tree = useFileStore((s) => s.tree);
  const rootPath = useFileStore((s) => s.rootPath);
  const { expandDirectory } = useFileStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<{ parentPath: string; isDir: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Build git status map
  const staged = useGitStore((s) => s.staged);
  const unstaged = useGitStore((s) => s.unstaged);
  const untracked = useGitStore((s) => s.untracked);
  const conflicts = useGitStore((s) => s.conflicts);
  const gitMap = useMemo(
    () => buildGitStatusMap(staged, unstaged, untracked, conflicts),
    [staged, unstaged, untracked, conflicts],
  );

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const scrollHandler = () => setContextMenu(null);
    document.addEventListener('mousedown', handler);
    document.addEventListener('scroll', scrollHandler, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('scroll', scrollHandler, true);
    };
  }, [contextMenu]);

  // ── Context menu on nodes ──────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  // ── Context menu on empty space ────────────────────────────────────────────
  const handleEmptyContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, node: null });
    },
    [],
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const getTargetParent = (node: FileNode | null): string => {
    if (!node) return rootPath ?? '';
    return node.isDir ? node.path : getParentPath(node.path);
  };

  const handleNewFile = async () => {
    const node = contextMenu?.node ?? null;
    setContextMenu(null);

    // Empty-space click: no node to host InlineInput → use dialog
    if (!node) {
      if (!rootPath) return;
      const name = await promptInput({ title: 'New File', placeholder: 'Enter file name' });
      if (!name?.trim()) return;
      try {
        await tauriFs.createFile(rootPath + getSep(rootPath) + name.trim(), '');
      } catch (err) {
        console.error('Failed to create file:', err);
      }
      return;
    }

    const parentPath = getTargetParent(node);
    if (!parentPath) return;
    if (node.isDir && !node.isExpanded) {
      await expandDirectory(node.path);
    }
    setCreatingIn({ parentPath, isDir: false });
  };

  const handleNewFolder = async () => {
    const node = contextMenu?.node ?? null;
    setContextMenu(null);

    // Empty-space click: use dialog
    if (!node) {
      if (!rootPath) return;
      const name = await promptInput({ title: 'New Folder', placeholder: 'Enter folder name' });
      if (!name?.trim()) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('create_directory', { path: rootPath + getSep(rootPath) + name.trim() });
      } catch (err) {
        console.error('Failed to create folder:', err);
      }
      return;
    }

    const parentPath = getTargetParent(node);
    if (!parentPath) return;
    if (node.isDir && !node.isExpanded) {
      await expandDirectory(node.path);
    }
    setCreatingIn({ parentPath, isDir: true });
  };

  const handleRename = async () => {
    if (!contextMenu?.node) return;
    const node = contextMenu.node;
    setContextMenu(null);

    const newName = await promptInput({
      title: `Rename ${node.isDir ? 'Folder' : 'File'}`,
      placeholder: 'Enter new name',
      defaultValue: node.name,
      confirmLabel: 'Rename',
    });

    if (!newName || newName === node.name) return;

    const parentPath = getParentPath(node.path);
    const sep = getSep(node.path);
    const newPath = parentPath + sep + newName;
    try {
      await tauriFs.renamePath(node.path, newPath);
    } catch (err) {
      console.error('Failed to rename:', err);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu?.node) return;
    const node = contextMenu.node;
    setContextMenu(null);

    const confirmed = await promptConfirm({
      title: `Delete "${node.name}"?`,
      description: node.isDir
        ? 'This will permanently delete the folder and all its contents.'
        : 'This will permanently delete this file.',
      confirmLabel: 'Delete',
      danger: true,
    });

    if (!confirmed) return;
    try {
      await tauriFs.deletePath(node.path);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleDuplicate = async () => {
    if (!contextMenu?.node) return;
    const node = contextMenu.node;
    setContextMenu(null);

    const parentPath = getParentPath(node.path);
    const sep = getSep(node.path);

    // Generate default duplicate name
    let defaultName: string;
    if (node.isDir) {
      defaultName = node.name + ' copy';
    } else {
      const dotIdx = node.name.lastIndexOf('.');
      if (dotIdx > 0) {
        defaultName = node.name.slice(0, dotIdx) + ' copy' + node.name.slice(dotIdx);
      } else {
        defaultName = node.name + ' copy';
      }
    }

    const newName = await promptInput({
      title: `Duplicate "${node.name}"`,
      placeholder: 'Enter name for copy',
      defaultValue: defaultName,
      confirmLabel: 'Duplicate',
    });

    if (!newName) return;

    const newPath = parentPath + sep + newName;
    try {
      await tauriFs.copyPath(node.path, newPath);
    } catch (err) {
      console.error('Failed to duplicate:', err);
    }
  };

  const handleCopyPath = async () => {
    if (!contextMenu?.node) return;
    const node = contextMenu.node;
    setContextMenu(null);
    try {
      await navigator.clipboard.writeText(node.path);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const handleCopyRelativePath = async () => {
    if (!contextMenu?.node || !rootPath) return;
    const node = contextMenu.node;
    setContextMenu(null);
    const normalized = node.path.replace(/\\/g, '/');
    let root = rootPath.replace(/\\/g, '/');
    if (!root.endsWith('/')) root += '/';
    const relPath = normalized.startsWith(root) ? normalized.slice(root.length) : normalized;
    try {
      await navigator.clipboard.writeText(relPath);
    } catch (err) {
      console.error('Failed to copy relative path:', err);
    }
  };

  const handleRevealInFileManager = async () => {
    if (!contextMenu?.node) return;
    const node = contextMenu.node;
    setContextMenu(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Open the containing folder with the OS file manager
      const target = node.isDir ? node.path : getParentPath(node.path);
      await invoke('plugin:shell|open', { path: target });
    } catch (err) {
      console.error('Failed to reveal in file manager:', err);
    }
  };

  // ── Create / Rename submit ─────────────────────────────────────────────────

  const handleRenameSubmit = async (node: FileNode, newName: string) => {
    setRenamingPath(null);
    if (newName === node.name) return;
    const parentPath = getParentPath(node.path);
    const sep = getSep(node.path);
    const newPath = parentPath + sep + newName;
    try {
      await tauriFs.renamePath(node.path, newPath);
    } catch (err) {
      console.error('Failed to rename:', err);
    }
  };

  const handleCreateSubmit = async (name: string) => {
    if (!creatingIn) return;
    const sep = getSep(creatingIn.parentPath);
    const newPath = creatingIn.parentPath + sep + name;
    try {
      if (creatingIn.isDir) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('create_directory', { path: newPath });
      } else {
        await tauriFs.createFile(newPath, '');
      }
    } catch (err) {
      console.error('Failed to create:', err);
    }
    setCreatingIn(null);
  };

  if (tree.length === 0) {
    return null;
  }

  const sortedTree = sortNodes(tree);
  const hasNode = !!contextMenu?.node;

  return (
    <div
      ref={treeContainerRef}
      className="relative flex min-h-full flex-col py-1"
      onContextMenu={handleEmptyContextMenu}
    >
      {sortedTree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          onContextMenu={handleContextMenu}
          renamingPath={renamingPath}
          creatingIn={creatingIn}
          onRenameSubmit={handleRenameSubmit}
          onRenameCancel={() => setRenamingPath(null)}
          onCreateSubmit={handleCreateSubmit}
          onCreateCancel={() => setCreatingIn(null)}
          gitMap={gitMap}
          rootPath={rootPath}
        />
      ))}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[200px] rounded-lg border border-border bg-surface p-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <ContextMenuItem icon={FilePlus} label="New File..." onClick={handleNewFile} />
          <ContextMenuItem icon={FolderPlus} label="New Folder..." onClick={handleNewFolder} />

          {hasNode && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem icon={Pencil} label="Rename..." shortcut="F2" onClick={handleRename} />
              <ContextMenuItem icon={Files} label="Duplicate..." onClick={handleDuplicate} />
              <ContextMenuItem icon={Trash2} label="Delete" shortcut="Del" onClick={handleDelete} danger />

              <ContextMenuSeparator />
              <ContextMenuItem icon={Copy} label="Copy Path" onClick={handleCopyPath} />
              <ContextMenuItem icon={ClipboardCopy} label="Copy Relative Path" onClick={handleCopyRelativePath} />

              <ContextMenuSeparator />
              <ContextMenuItem icon={FolderSearch} label="Reveal in File Manager" onClick={handleRevealInFileManager} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
