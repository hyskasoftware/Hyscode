import { useEffect, useRef } from 'react';
import {
  X,
  XCircle,
  ArrowRightFromLine,
  CheckCircle2,
  Layers,
  Copy,
  ClipboardCopy,
  FolderSearch,
  Pin,
  PinOff,
} from 'lucide-react';
import { useEditorStore, useFileStore } from '../../stores';
import type { Tab } from '../../stores/editor-store';

interface TabContextMenuProps {
  x: number;
  y: number;
  tab: Tab;
  onClose: () => void;
}

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled,
}: {
  icon: typeof X;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
        disabled
          ? 'text-muted-foreground/50 cursor-not-allowed'
          : 'text-foreground hover:bg-surface-raised'
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

function Separator() {
  return <div className="my-1 h-px bg-border" />;
}

export function TabContextMenu({ x, y, tab, onClose }: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const closeTab = useEditorStore((s) => s.closeTab);
  const closeOtherTabs = useEditorStore((s) => s.closeOtherTabs);
  const closeTabsToTheRight = useEditorStore((s) => s.closeTabsToTheRight);
  const closeSavedTabs = useEditorStore((s) => s.closeSavedTabs);
  const closeAllTabs = useEditorStore((s) => s.closeAllTabs);
  const pinTab = useEditorStore((s) => s.pinTab);
  const unpinTab = useEditorStore((s) => s.unpinTab);
  const tabs = useEditorStore((s) => s.tabs);
  const rootPath = useFileStore((s) => s.rootPath);

  const isUntitled = tab.filePath.startsWith('untitled:');
  const tabIdx = tabs.findIndex((t) => t.id === tab.id);
  const hasTabsToRight = tabIdx < tabs.length - 1;

  // Close menu on outside click or scroll
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Position: ensure menu stays within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 9999,
  };

  // Adjust position if near edges
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${vw - rect.width - 4}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${vh - rect.height - 4}px`;
    }
  }, [x, y]);

  const handleClose = () => {
    onClose();
    closeTab(tab.id);
  };

  const handleCloseOthers = () => {
    onClose();
    closeOtherTabs(tab.id);
  };

  const handleCloseToTheRight = () => {
    onClose();
    closeTabsToTheRight(tab.id);
  };

  const handleCloseSaved = () => {
    onClose();
    closeSavedTabs();
  };

  const handleCloseAll = () => {
    onClose();
    closeAllTabs();
  };

  const handleCopyPath = async () => {
    onClose();
    if (isUntitled) return;
    try {
      await navigator.clipboard.writeText(tab.filePath);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const handleCopyRelativePath = async () => {
    onClose();
    if (isUntitled || !rootPath) return;
    const normalized = tab.filePath.replace(/\\/g, '/');
    let root = rootPath.replace(/\\/g, '/');
    if (!root.endsWith('/')) root += '/';
    const relPath = normalized.startsWith(root) ? normalized.slice(root.length) : normalized;
    try {
      await navigator.clipboard.writeText(relPath);
    } catch (err) {
      console.error('Failed to copy relative path:', err);
    }
  };

  const handleRevealInFileExplorer = async () => {
    onClose();
    if (isUntitled) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('reveal_path', { path: tab.filePath });
    } catch (err) {
      console.error('Failed to reveal in file explorer:', err);
    }
  };

  const handlePin = () => {
    onClose();
    if (tab.isPinned) {
      unpinTab(tab.id);
    } else {
      pinTab(tab.id);
    }
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="min-w-[220px] rounded-lg border border-border bg-surface p-1 shadow-lg"
    >
      <MenuItem icon={X} label="Close" shortcut="Ctrl+F4" onClick={handleClose} />
      <MenuItem icon={XCircle} label="Close Others" onClick={handleCloseOthers} />
      <MenuItem
        icon={ArrowRightFromLine}
        label="Close to the Right"
        onClick={handleCloseToTheRight}
        disabled={!hasTabsToRight}
      />
      <MenuItem icon={CheckCircle2} label="Close Saved" shortcut="Ctrl+K U" onClick={handleCloseSaved} />
      <MenuItem icon={Layers} label="Close All" shortcut="Ctrl+K W" onClick={handleCloseAll} />

      <Separator />

      <MenuItem
        icon={Copy}
        label="Copy Path"
        shortcut="Shift+Alt+C"
        onClick={handleCopyPath}
        disabled={isUntitled}
      />
      <MenuItem
        icon={ClipboardCopy}
        label="Copy Relative Path"
        shortcut="Ctrl+K Ctrl+Shift+C"
        onClick={handleCopyRelativePath}
        disabled={isUntitled || !rootPath}
      />

      <Separator />

      <MenuItem
        icon={FolderSearch}
        label="Reveal in File Explorer"
        shortcut="Shift+Alt+R"
        onClick={handleRevealInFileExplorer}
        disabled={isUntitled}
      />

      <Separator />

      <MenuItem
        icon={tab.isPinned ? PinOff : Pin}
        label={tab.isPinned ? 'Unpin' : 'Pin'}
        shortcut="Ctrl+K Shift+Enter"
        onClick={handlePin}
      />
    </div>
  );
}
