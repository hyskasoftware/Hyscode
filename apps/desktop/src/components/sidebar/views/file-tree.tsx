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
} from 'lucide-react';
import { useFileStore, useEditorStore } from '../../../stores';
import { tauriFs } from '../../../lib/tauri-fs';
import type { FileNode } from '../../../stores/file-store';

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
  };
  return map[ext] || 'plaintext';
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
}

function FileTreeNode({ node, depth }: FileTreeNodeProps) {
  const { expandDirectory, toggleExpand } = useFileStore();
  const { openTab, tabs } = useEditorStore();

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
        });
      }
    }
  };

  const FolderIcon = node.isExpanded ? FolderOpen : Folder;
  const FileIcon = getFileIcon(node.name);
  const ChevronIcon = node.isExpanded ? ChevronDown : ChevronRight;

  return (
    <>
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-1 rounded-sm px-1 py-[3px] text-[11px] text-foreground hover:bg-accent-muted transition-colors"
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
        <span className="truncate">{node.name}</span>
      </button>

      {node.isDir && node.isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

export function FileTree() {
  const tree = useFileStore((s) => s.tree);

  if (tree.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col py-1">
      {tree.map((node) => (
        <FileTreeNode key={node.path} node={node} depth={0} />
      ))}
    </div>
  );
}
