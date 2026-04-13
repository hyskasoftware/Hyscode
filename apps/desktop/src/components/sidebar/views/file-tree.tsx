import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  File,
  Image,
  Loader2,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useFileStore, useEditorStore, useGitStore } from '../../../stores';
import { tauriFs } from '../../../lib/tauri-fs';
import { getViewerType } from '../../../lib/utils';
import type { FileNode } from '../../../stores/file-store';
import type { GitFile } from '../../../stores/git-store';

// ── Git status colors (matching VS Code) ─────────────────────────────────────
const GIT_NAME_COLORS: Record<string, string> = {
  M: 'text-amber-300',       // Modified – yellow/amber
  A: 'text-green-400',       // Added – green
  D: 'text-red-400',         // Deleted – red, strike-through added separately
  R: 'text-green-400',       // Renamed – green
  C: 'text-green-400',       // Copied – green
  T: 'text-purple-400',      // Type changed
  U: 'text-orange-400',      // Conflict
  '?': 'text-green-400',     // Untracked – green
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

/** Build a map of relative path → highest-priority git status letter */
function buildGitStatusMap(
  staged: GitFile[],
  unstaged: GitFile[],
  untracked: GitFile[],
  conflicts: GitFile[],
): Map<string, string> {
  const map = new Map<string, string>();
  // Priority: conflicts > staged > unstaged > untracked
  for (const f of untracked) map.set(f.path, f.status);
  for (const f of unstaged) map.set(f.path, f.status);
  for (const f of staged) map.set(f.path, f.status);
  for (const f of conflicts) map.set(f.path, f.status);
  return map;
}

/**
 * For a directory, count changed files inside it and determine
 * the "dominant" status to color the folder dot.
 */
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
      // prioritize M over A for folder dot color (amber)
      if (!dominantStatus) dominantStatus = status;
      else if (status === 'M' || status === 'U') dominantStatus = status;
    }
  }
  return { count, dominantStatus };
}

const FILE_ICONS: Record<string, typeof FileText> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  rs: FileCode,
  py: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
  toml: FileText,
  yaml: FileText,
  yml: FileText,
  png: Image,
  jpg: Image,
  jpeg: Image,
  svg: Image,
  gif: Image,
};

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] || File;
}

function getLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    rs: 'rust',
    py: 'python',
    toml: 'toml',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
  };
  return map[ext] || 'plaintext';
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    // Directories first
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    // Then alphabetical case-insensitive
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode | null;
}

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
      // Select the filename part (before extension)
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

  const Icon = isDir ? Folder : File;

  return (
    <div
      className="flex items-center gap-1 px-1 py-[3px]"
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      <span className="w-3 shrink-0" />
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
  node,
  depth,
  onContextMenu,
  renamingPath,
  creatingIn,
  onRenameSubmit,
  onRenameCancel,
  onCreateSubmit,
  onCreateCancel,
  gitMap,
  rootPath,
}: FileTreeNodeProps) {
  const { expandDirectory, toggleExpand } = useFileStore();
  const { openTab, tabs } = useEditorStore();
  const activeTabId = useEditorStore((s) => s.activeTabId);

  // Compute relative path for git matching
  const relPath = useMemo(() => {
    if (!rootPath) return node.path;
    const normalized = node.path.replace(/\\/g, '/');
    let root = rootPath.replace(/\\/g, '/');
    if (!root.endsWith('/')) root += '/';
    return normalized.startsWith(root) ? normalized.slice(root.length) : normalized;
  }, [node.path, rootPath]);

  // Git status for this node
  const gitStatus = gitMap.get(relPath) ?? null;

  // For directories, get aggregated info
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
      // Open file in editor
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

  const FolderIcon = node.isExpanded ? FolderOpen : Folder;
  const FileIcon = getFileIcon(node.name);
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
          isActive
            ? 'bg-accent-muted'
            : 'hover:bg-surface-raised'
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
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-accent opacity-70" />
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className={`truncate ${nameColorClass || ''} ${gitStatus === 'D' ? 'line-through opacity-70' : ''}`}>{node.name}</span>
        {/* Git badge for files: status letter */}
        {!node.isDir && gitStatus && (
          <span className={`ml-auto shrink-0 pr-1 text-[10px] font-mono font-medium ${GIT_BADGE_COLORS[gitStatus] ?? 'text-muted-foreground'}`}>
            {gitStatus === '?' ? 'U' : gitStatus}
          </span>
        )}
        {/* Git badge for directories: colored dot */}
        {node.isDir && dirGit && dirGit.count > 0 && (
          <span className={`ml-auto shrink-0 pr-1 h-[6px] w-[6px] rounded-full ${
            dirGit.dominantStatus === 'M' || dirGit.dominantStatus === 'U'
              ? 'bg-amber-400'
              : dirGit.dominantStatus === 'D'
                ? 'bg-red-400'
                : 'bg-green-400'
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

export function FileTree() {
  const tree = useFileStore((s) => s.tree);
  const rootPath = useFileStore((s) => s.rootPath);
  const { expandDirectory, openFolder } = useFileStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<{ parentPath: string; isDir: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Build git status map once at the top level
  const staged = useGitStore((s) => s.staged);
  const unstaged = useGitStore((s) => s.unstaged);
  const untracked = useGitStore((s) => s.untracked);
  const conflicts = useGitStore((s) => s.conflicts);
  const gitMap = useMemo(
    () => buildGitStatusMap(staged, unstaged, untracked, conflicts),
    [staged, unstaged, untracked, conflicts],
  );

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleNewFile = async () => {
    if (!contextMenu?.node) return;
    const parentPath = contextMenu.node.isDir ? contextMenu.node.path : getParentPath(contextMenu.node.path);
    // Make sure directory is expanded
    if (contextMenu.node.isDir && !contextMenu.node.isExpanded) {
      await expandDirectory(contextMenu.node.path);
    }
    setCreatingIn({ parentPath, isDir: false });
    setContextMenu(null);
  };

  const handleNewFolder = async () => {
    if (!contextMenu?.node) return;
    const parentPath = contextMenu.node.isDir ? contextMenu.node.path : getParentPath(contextMenu.node.path);
    if (contextMenu.node.isDir && !contextMenu.node.isExpanded) {
      await expandDirectory(contextMenu.node.path);
    }
    setCreatingIn({ parentPath, isDir: true });
    setContextMenu(null);
  };

  const handleRename = () => {
    if (!contextMenu?.node) return;
    setRenamingPath(contextMenu.node.path);
    setContextMenu(null);
  };

  const handleDelete = async () => {
    if (!contextMenu?.node) return;
    const node = contextMenu.node;
    setContextMenu(null);
    try {
      await tauriFs.deletePath(node.path);
      // Refresh parent directory
      const parentPath = getParentPath(node.path);
      if (parentPath === rootPath) {
        await openFolder(rootPath!);
      } else {
        await expandDirectory(parentPath);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleRenameSubmit = async (node: FileNode, newName: string) => {
    setRenamingPath(null);
    if (newName === node.name) return;
    const parentPath = getParentPath(node.path);
    const sep = node.path.includes('/') ? '/' : '\\';
    const newPath = parentPath + sep + newName;
    try {
      // Use Tauri invoke to rename
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('rename_path', { from: node.path, to: newPath });
      // Refresh parent
      if (parentPath === rootPath) {
        await openFolder(rootPath!);
      } else {
        await expandDirectory(parentPath);
      }
    } catch (err) {
      console.error('Failed to rename:', err);
    }
  };

  const handleCreateSubmit = async (name: string) => {
    if (!creatingIn) return;
    const sep = creatingIn.parentPath.includes('/') ? '/' : '\\';
    const newPath = creatingIn.parentPath + sep + name;
    try {
      if (creatingIn.isDir) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('create_directory', { path: newPath });
      } else {
        await tauriFs.createFile(newPath, '');
      }
      // Refresh parent
      await expandDirectory(creatingIn.parentPath);
    } catch (err) {
      console.error('Failed to create:', err);
    }
    setCreatingIn(null);
  };

  if (tree.length === 0) {
    return null;
  }

  const sortedTree = sortNodes(tree);

  return (
    <div className="relative flex flex-col py-1">
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
          className="fixed z-50 min-w-[160px] rounded-lg bg-muted p-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <ContextMenuItem icon={FilePlus} label="New File" onClick={handleNewFile} />
          <ContextMenuItem icon={FolderPlus} label="New Folder" onClick={handleNewFolder} />
          <div className="my-1 h-px bg-surface-raised" />
          <ContextMenuItem icon={Pencil} label="Rename" onClick={handleRename} />
          <ContextMenuItem icon={Trash2} label="Delete" onClick={handleDelete} danger />
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof FilePlus;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
        danger
          ? 'text-error hover:bg-error/10'
          : 'text-foreground hover:bg-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function getParentPath(path: string): string {
  const sep = path.includes('/') ? '/' : '\\';
  const parts = path.split(sep);
  parts.pop();
  return parts.join(sep);
}
