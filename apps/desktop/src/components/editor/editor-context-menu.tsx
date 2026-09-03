import { useEffect, useLayoutEffect, useRef, useCallback, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Scissors,
  Copy,
  ClipboardPaste,
  Wand2,
  Command,
  ChevronRight,
  Sparkles,
  Navigation,
  ArrowRight,
  FileSearch,
  FileCode,
  Search,
  Type,
  Lightbulb,
  AlignLeft,
  FolderOpen,
  Terminal,
  Link2,
  History,
  Undo2,
  Redo2,
  TextSelect,
  Eye,
  ListTree,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { useExtensionUiStore } from '../../stores/extension-ui-store';
import { useEditorStore, useSettingsStore } from '../../stores';
import { useLayoutStore } from '../../stores/layout-store';
import { useTerminalStore } from '../../stores/terminal-store';
import { useFileStore } from '../../stores/file-store';
import { useLspStore } from '../../stores/lsp-store';
import { detectLanguage } from '../../lib/lsp-bridge';
import { detectLspLanguage, getBuiltinServerForLanguage } from '@hyscode/lsp-client';
import { writeClipboard } from '../../lib/utils';
import { tauriInvoke } from '../../lib/tauri-invoke';
import { tauriFs } from '../../lib/tauri-fs';
import {
  dirnameOf,
  toRepoRelativePath,
  hasNonEmptySelection,
  trimSelectionText,
  buildPathWithLine,
  clampMenuPosition,
  groupExtensionItems,
  isLspActionAvailable,
  type EditorSelectionLike,
} from '../../lib/editor-context-menu-utils';
import type { MenuActionContext } from '@hyscode/extension-api';

// ── Icon map for extension-contributed icons ─────────────────────────────────

const iconMap: Record<string, LucideIcon> = {
  wand: Wand2,
  sparkles: Sparkles,
  scissors: Scissors,
  copy: Copy,
  paste: ClipboardPaste,
  command: Command,
  history: History,
  link: Link2,
  terminal: Terminal,
  folder: FolderOpen,
  folderopen: FolderOpen,
  search: Search,
  type: Type,
  lightbulb: Lightbulb,
  filecode: FileCode,
  filesearch: FileSearch,
  navigation: Navigation,
  arrowright: ArrowRight,
  undo: Undo2,
  redo: Redo2,
  eye: Eye,
  symbol: ListTree,
  listtree: ListTree,
  settings: Settings2,
  select: TextSelect,
};

function getIcon(name?: string): LucideIcon {
  if (!name) return Command;
  return iconMap[name.toLowerCase().replace(/[-_\s]/g, '')] ?? Command;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface EditorContextMenuInstance {
  getPosition: () => { lineNumber: number; column: number } | null;
  getSelection: () => EditorSelectionLike | null;
  getModel: () => {
    getValue: () => string;
    getValueInRange: (range: unknown) => string;
    getFullModelRange: () => unknown;
    pushStackElement: () => void;
    pushEditOperations: (
      selections: null,
      ops: Array<{ range: unknown; text: string }>,
      cb: () => null,
    ) => void;
  } | null;
  trigger: (source: string, handlerId: string, payload?: unknown) => void;
  focus: () => void;
}

interface EditorContextMenuProps {
  x: number;
  y: number;
  editorInstance: EditorContextMenuInstance | null;
  onClose: () => void;
}

interface ContextItemProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  submenu?: boolean;
  expanded?: boolean;
  title?: string;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ContextItem({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled,
  primary,
  submenu,
  expanded,
  title,
}: ContextItemProps) {
  const button = (
    <button
      type="button"
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? undefined : title}
      aria-haspopup={submenu ? 'menu' : undefined}
      aria-expanded={submenu ? expanded : undefined}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 ${
        disabled
          ? 'text-muted-foreground/50 cursor-not-allowed'
          : primary
            ? 'text-primary hover:bg-primary/10 hover:text-primary'
            : 'text-foreground hover:bg-surface-raised'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="ml-4 text-[10px] text-muted-foreground">{shortcut}</span>
      )}
      {submenu && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
  // Disabled buttons don't receive mouse events, so a native `title` on the
  // button itself would never show — wrap in a span that carries the tooltip.
  if (disabled && title) {
    return (
      <span title={title} className="block">
        {button}
      </span>
    );
  }
  return button;
}

function Separator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}

// ── Format sub-menu ──────────────────────────────────────────────────────────

function FormatSubmenu({
  formatters,
  onSelect,
}: {
  formatters: Array<{ extensionName: string; item: { id: string; displayName: string } }>;
  onSelect: (formatterId: string) => void;
}) {
  if (formatters.length === 0) return null;

  return (
    <div
      role="menu"
      className="ml-1 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
    >
      {formatters.map((f) => (
        <button
          key={f.item.id}
          type="button"
          role="menuitem"
          onClick={() => onSelect(f.item.id)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-foreground hover:bg-surface-raised transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{f.item.displayName}</span>
          <span className="ml-auto text-[9px] text-muted-foreground">{f.extensionName}</span>
        </button>
      ))}
    </div>
  );
}

// ── Git history sub-menu ─────────────────────────────────────────────────────

interface GitCommitInfo {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
}

function formatCommitDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
}

function HistorySubmenu({
  commits,
  onSelect,
}: {
  commits: GitCommitInfo[];
  onSelect: (commit: GitCommitInfo) => void;
}) {
  if (commits.length === 0) {
    return (
      <div className="ml-1 mt-1 rounded-lg border border-border bg-surface p-2 shadow-lg">
        <span className="text-[11px] text-muted-foreground">No history found</span>
      </div>
    );
  }

  return (
    <div
      role="menu"
      className="ml-1 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
    >
      {commits.map((c) => (
        <button
          key={c.hash}
          type="button"
          role="menuitem"
          title={`${c.message}\n${c.author} — ${formatCommitDate(c.timestamp)}`}
          onClick={() => onSelect(c)}
          className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-surface-raised transition-colors"
        >
          <span className="truncate font-medium">{c.message.split('\n')[0] || c.short_hash}</span>
          <span className="text-[10px] text-muted-foreground">
            {c.short_hash} — {c.author} — {formatCommitDate(c.timestamp)}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function EditorContextMenu({ x, y, editorInstance, onClose }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showFormatSubmenu, setShowFormatSubmenu] = useState(false);
  const [showHistorySubmenu, setShowHistorySubmenu] = useState(false);
  const [historyCommits, setHistoryCommits] = useState<GitCommitInfo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ left: x, top: y, flipX: false });

  const contextMenuItems = useExtensionUiStore((s) => s.contextMenuItems);
  const getFormattersForLanguage = useExtensionUiStore((s) => s.getFormattersForLanguage);

  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const tabSize = useSettingsStore((s) => s.tabSize);
  const insertSpaces = useSettingsStore((s) => s.insertSpaces);
  const openSettingsOnTab = useSettingsStore((s) => s.openSettingsOnTab);
  const rootPath = useFileStore((s) => s.rootPath);
  const serverStatuses = useLspStore((s) => s.serverStatuses);

  const languageId = activeTab?.filePath
    ? (detectLanguage(activeTab.filePath) || activeTab.language || 'plaintext')
    : 'plaintext';
  const lspLanguage = activeTab?.filePath
    ? (detectLspLanguage(activeTab.filePath) ?? null)
    : null;
  const lspStatus = lspLanguage ? serverStatuses[lspLanguage]?.status : undefined;
  const lspCapable = isLspActionAvailable(lspLanguage, lspStatus);
  const builtinServer = lspLanguage ? getBuiltinServerForLanguage(lspLanguage) : undefined;
  const lspDisabledHint = !lspCapable && lspLanguage
    ? builtinServer
      ? `Requires the ${builtinServer.displayName} language server (not running)`
      : `No language server available for ${lspLanguage}`
    : undefined;

  const availableFormatters = getFormattersForLanguage(languageId);

  const isUntitled = activeTab?.filePath?.startsWith('untitled:') ?? true;

  const notify = useCallback(
    (type: 'info' | 'warning' | 'error', message: string, title?: string) => {
      useExtensionUiStore.getState().showNotification(type, message, title);
    },
    [],
  );

  // Selection snapshot taken when the menu opens (the editor loses focus).
  const [menuSelection] = useState(() => {
    try {
      const sel = editorInstance?.getSelection?.() ?? null;
      const model = editorInstance?.getModel?.() ?? null;
      let text: string | null = null;
      if (sel && model) {
        try {
          text = model.getValueInRange(sel);
        } catch {
          text = null;
        }
      }
      return { sel, text };
    } catch {
      return { sel: null as EditorSelectionLike | null, text: null as string | null };
    }
  });
  const hasSelection = hasNonEmptySelection(menuSelection.sel) && !!menuSelection.text;

  // Reset history state when switching files.
  useEffect(() => {
    setShowHistorySubmenu(false);
    setHistoryCommits([]);
    setHistoryLoading(false);
    setHistoryError(null);
  }, [activeTab?.filePath]);

  // Build the menu action context for extensions.
  const getMenuContext = useCallback((): MenuActionContext => {
    const pos = editorInstance?.getPosition?.();
    return {
      filePath: activeTab?.filePath ?? null,
      languageId,
      selectedText: menuSelection.text || null,
      cursorLine: pos?.lineNumber ?? 1,
      cursorColumn: pos?.column ?? 1,
    };
  }, [editorInstance, activeTab, languageId, menuSelection.text]);

  // Group + filter extension items by `when`-clause and `group`.
  const groupedExtItems = groupExtensionItems([...contextMenuItems], {
    hasSelection,
    languageId,
  });

  // Close on outside click / escape / scroll / resize / tab switch.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();
    const handleResize = () => onClose();
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [onClose]);

  // Close a stale menu when the user switches tabs underneath it.
  // (Skipped on mount — otherwise the menu would close immediately.)
  const prevTabIdRef = useRef(activeTabId);
  useEffect(() => {
    if (prevTabIdRef.current !== activeTabId) {
      prevTabIdRef.current = activeTabId;
      onClose();
    }
  }, [activeTabId, onClose]);

  // Clamp to all four viewport edges; re-run when submenus open.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) {
      setMenuPos((p) => ({ ...p, left: x, top: y }));
      return;
    }
    const rect = el.getBoundingClientRect();
    setMenuPos(
      clampMenuPosition(x, y, rect.width, rect.height, window.innerWidth, window.innerHeight),
    );
  }, [x, y, showFormatSubmenu, showHistorySubmenu, historyCommits.length, historyLoading]);

  // Focus the first enabled item + arrow-key navigation.
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLButtonElement>('button:not([disabled])');
    first?.focus();
  }, []);

  const handleMenuKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    const el = menuRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if (items.length === 0) return;
    const current = document.activeElement as HTMLElement | null;
    const idx = items.findIndex((b) => b === current);
    if (e.key === 'Home') {
      items[0].focus();
    } else if (e.key === 'End') {
      items[items.length - 1].focus();
    } else if (e.key === 'ArrowDown') {
      items[(idx + 1) % items.length].focus();
    } else {
      items[(idx - 1 + items.length) % items.length].focus();
    }
  };

  const triggerAction = (handlerId: string) => {
    onClose();
    editorInstance?.trigger('contextMenu', handlerId);
  };

  // ── Navigation actions (LSP-gated) ────────────────────────────────────────
  const handleGoToDefinition = () => triggerAction('editor.action.revealDefinition');
  const handleGoToDeclaration = () => triggerAction('editor.action.revealDeclaration');
  const handleGoToTypeDefinition = () => triggerAction('editor.action.goToTypeDefinition');
  const handleGoToImplementation = () => triggerAction('editor.action.goToImplementation');
  const handleFindAllReferences = () => triggerAction('editor.action.goToReferences');
  const handlePeekDefinition = () => triggerAction('editor.action.peekDefinition');
  const handleGoToSymbol = () => triggerAction('editor.action.quickOutline');

  // ── Refactoring actions (LSP-gated) ───────────────────────────────────────
  const handleRenameSymbol = () => triggerAction('editor.action.rename');

  // ── Code actions (LSP-gated) ──────────────────────────────────────────────
  const handleShowCodeActions = () => triggerAction('editor.action.quickFix');
  const handleConfigureLanguageServers = () => {
    onClose();
    openSettingsOnTab('languages');
  };

  // ── Edit actions ──────────────────────────────────────────────────────────
  const handleUndo = () => triggerAction('undo');
  const handleRedo = () => triggerAction('redo');
  const handleSelectAll = () => triggerAction('editor.action.selectAll');
  const handleOpenCommandPalette = () => triggerAction('editor.action.quickCommand');

  // ── Clipboard actions ─────────────────────────────────────────────────────
  const handleCut = () => triggerAction('editor.action.clipboardCutAction');
  const handleCopy = () => triggerAction('editor.action.clipboardCopyAction');
  const handlePaste = () => triggerAction('editor.action.clipboardPasteAction');

  const handleCopyAndTrim = () => {
    onClose();
    if (!hasSelection || !menuSelection.text) return;
    try {
      const trimmed = trimSelectionText(menuSelection.text);
      if (!trimmed) {
        notify('warning', 'Selection is empty after trimming — clipboard unchanged.', 'Copy and Trim');
        return;
      }
      writeClipboard(trimmed).catch((err: unknown) => {
        notify('error', `Failed to copy: ${err instanceof Error ? err.message : String(err)}`, 'Copy and Trim');
      });
    } catch (err) {
      notify(
        'error',
        `Copy and trim failed: ${err instanceof Error ? err.message : String(err)}`,
        'Copy and Trim',
      );
    }
  };

  // ── Format action ─────────────────────────────────────────────────────────
  const handleFormat = async (formatterId: string) => {
    const tabIdAtInvoke = activeTabId;
    const filePathAtInvoke = activeTab?.filePath ?? '';
    const languageAtInvoke = languageId;
    const tabSizeAtInvoke = tabSize;
    const insertSpacesAtInvoke = insertSpaces;
    onClose();
    const formatter = useExtensionUiStore
      .getState()
      .formatters.find((f) => f.item.id === formatterId);
    if (!formatter || !editorInstance || !tabIdAtInvoke) return;

    const model = editorInstance.getModel?.();
    if (!model) return;

    const content = model.getValue();
    let formatted: string;
    try {
      formatted = await formatter.item.format({
        content,
        filePath: filePathAtInvoke,
        languageId: languageAtInvoke,
        tabSize: tabSizeAtInvoke,
        insertSpaces: insertSpacesAtInvoke,
      });
    } catch (err) {
      notify(
        'error',
        `Formatter "${formatter.item.displayName}" failed: ${err instanceof Error ? err.message : String(err)}`,
        'Format Document',
      );
      return;
    }
    if (typeof formatted !== 'string') {
      notify(
        'error',
        `Formatter "${formatter.item.displayName}" returned invalid output (expected string).`,
        'Format Document',
      );
      return;
    }
    if (formatted === content) {
      editorInstance.focus();
      return;
    }
    // Anti-race: abort when the user switched tabs or kept typing mid-format.
    if (useEditorStore.getState().activeTabId !== tabIdAtInvoke) return;
    if (model.getValue() !== content) {
      notify(
        'warning',
        'File changed while formatting — skipped applying to avoid losing edits.',
        'Format Document',
      );
      return;
    }
    try {
      const fullRange = model.getFullModelRange();
      model.pushStackElement();
      model.pushEditOperations(null, [{ range: fullRange, text: formatted }], () => null);
      model.pushStackElement();
      useFileStore.getState().setFileContent(filePathAtInvoke, formatted);
      useEditorStore.getState().markDirty(tabIdAtInvoke, true);
      editorInstance.focus();
    } catch (err) {
      notify(
        'error',
        `Failed to apply formatting: ${err instanceof Error ? err.message : String(err)}`,
        'Format Document',
      );
    }
  };

  // ── File actions ──────────────────────────────────────────────────────────
  const handleRevealInFileExplorer = async () => {
    onClose();
    if (isUntitled || !activeTab?.filePath) return;
    try {
      await tauriInvoke('reveal_path', { path: activeTab.filePath });
    } catch (err) {
      notify(
        'error',
        `Failed to reveal in file explorer: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleOpenInTerminal = async () => {
    onClose();
    if (!activeTab?.filePath) return;
    const dir = dirnameOf(activeTab.filePath, rootPath);
    if (!dir) {
      notify('warning', 'Cannot determine a directory for this file.', 'Open in Terminal');
      return;
    }
    try {
      const stat = await tauriFs.statPath(dir);
      if (!stat.is_dir) {
        notify('error', `Not a directory: ${dir}`, 'Open in Terminal');
        return;
      }
    } catch (err) {
      notify(
        'error',
        `Cannot open terminal here: ${err instanceof Error ? err.message : String(err)}`,
        'Open in Terminal',
      );
      return;
    }

    const { createSession } = useTerminalStore.getState();
    const { setTerminalVisible } = useLayoutStore.getState();
    createSession(undefined, false, dir);
    setTerminalVisible(true);
  };

  const handleCopyPathWithLine = async () => {
    onClose();
    if (!activeTab?.filePath) return;
    const pos = editorInstance?.getPosition?.();
    const label = buildPathWithLine(activeTab.filePath, pos, menuSelection.sel);
    try {
      await writeClipboard(label);
    } catch (err) {
      notify(
        'error',
        `Failed to copy path: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleViewFileHistory = async () => {
    if (!rootPath || !activeTab?.filePath || isUntitled) return;
    const relPath = toRepoRelativePath(activeTab.filePath, rootPath);
    if (!relPath) {
      notify('warning', 'This file is outside the open workspace.', 'File History');
      return;
    }

    if (!showHistorySubmenu) {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const log = await tauriInvoke('git_log_file', {
          repoPath: rootPath,
          filePath: relPath,
          limit: 20,
        });
        setHistoryCommits(log);
      } catch (err) {
        setHistoryCommits([]);
        const message = err instanceof Error ? err.message : String(err);
        setHistoryError(message);
        notify('error', `Failed to load file history: ${message}`, 'File History');
      } finally {
        setHistoryLoading(false);
      }
    }
    setShowHistorySubmenu(!showHistorySubmenu);
  };

  const handleOpenCommit = (commit: GitCommitInfo) => {
    onClose();
    useEditorStore
      .getState()
      .openCommitTab(commit.hash, commit.short_hash, commit.message.split('\n')[0] || commit.short_hash);
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Editor context menu"
      onKeyDown={handleMenuKeyDown}
      style={{ position: 'fixed', left: menuPos.left, top: menuPos.top, zIndex: 9999 }}
      className="min-w-[240px] max-w-[320px] rounded-lg border border-border bg-surface p-1 shadow-lg"
    >
      {/* Navigation */}
      <ContextItem
        icon={Navigation}
        label="Go to Definition"
        shortcut="F12"
        onClick={handleGoToDefinition}
        disabled={!lspCapable}
        title={lspDisabledHint}
      />
      <ContextItem
        icon={ArrowRight}
        label="Go to Declaration"
        onClick={handleGoToDeclaration}
        disabled={!lspCapable}
        title={lspDisabledHint}
      />
      <ContextItem
        icon={FileCode}
        label="Go to Type Definition"
        onClick={handleGoToTypeDefinition}
        disabled={!lspCapable}
        title={lspDisabledHint}
      />
      <ContextItem
        icon={FileSearch}
        label="Go to Implementation"
        shortcut="Ctrl+F12"
        onClick={handleGoToImplementation}
        disabled={!lspCapable}
        title={lspDisabledHint}
      />
      <ContextItem
        icon={Search}
        label="Find All References"
        shortcut="Alt+Shift+F12"
        onClick={handleFindAllReferences}
        disabled={!lspCapable}
        title={lspDisabledHint}
      />
      <ContextItem
        icon={Eye}
        label="Peek Definition"
        shortcut="Alt+F12"
        onClick={handlePeekDefinition}
        disabled={!lspCapable}
        title={lspDisabledHint}
      />
      <ContextItem icon={ListTree} label="Go to Symbol in File" shortcut="Ctrl+Shift+O" onClick={handleGoToSymbol} />

      <Separator />

      {/* Refactoring */}
      <ContextItem
        icon={Type}
        label="Rename Symbol"
        shortcut="F2"
        onClick={handleRenameSymbol}
        disabled={!lspCapable}
        title={lspDisabledHint}
      />

      {/* Format */}
      {availableFormatters.length > 0 && (
        <>
          {availableFormatters.length === 1 ? (
            <ContextItem
              icon={Sparkles}
              label={`Format with ${availableFormatters[0].item.displayName}`}
              shortcut="Shift+Alt+F"
              onClick={() => handleFormat(availableFormatters[0].item.id)}
              primary
            />
          ) : (
            <div className="relative">
              <ContextItem
                icon={Sparkles}
                label="Format Document..."
                shortcut="Shift+Alt+F"
                onClick={() => setShowFormatSubmenu(!showFormatSubmenu)}
                primary
                submenu
                expanded={showFormatSubmenu}
              />
              {showFormatSubmenu && (
                <FormatSubmenu
                  formatters={availableFormatters}
                  onSelect={handleFormat}
                />
              )}
            </div>
          )}
        </>
      )}

      <ContextItem
        icon={Lightbulb}
        label="Show Code Actions"
        shortcut="Ctrl+."
        onClick={handleShowCodeActions}
        disabled={!lspCapable}
        title={lspDisabledHint}
      />
      {!lspCapable && builtinServer && (
        <ContextItem
          icon={Settings2}
          label="Configure Language Servers..."
          onClick={handleConfigureLanguageServers}
        />
      )}
      <ContextItem
        icon={Command}
        label="Command Palette"
        shortcut="Ctrl+Shift+P"
        onClick={handleOpenCommandPalette}
      />

      <Separator />

      {/* Edit */}
      <ContextItem icon={Undo2} label="Undo" shortcut="Ctrl+Z" onClick={handleUndo} />
      <ContextItem icon={Redo2} label="Redo" shortcut="Ctrl+Y" onClick={handleRedo} />

      <Separator />

      {/* Clipboard */}
      <ContextItem icon={Scissors} label="Cut" shortcut="Ctrl+X" onClick={handleCut} />
      <ContextItem icon={Copy} label="Copy" shortcut="Ctrl+C" onClick={handleCopy} />
      <ContextItem
        icon={AlignLeft}
        label="Copy and Trim"
        onClick={handleCopyAndTrim}
        disabled={!hasSelection}
        title={hasSelection ? undefined : 'Select text first'}
      />
      <ContextItem icon={ClipboardPaste} label="Paste" shortcut="Ctrl+V" onClick={handlePaste} />
      <ContextItem
        icon={TextSelect}
        label="Select All"
        shortcut="Ctrl+A"
        onClick={handleSelectAll}
      />

      <Separator />

      {/* File actions */}
      <ContextItem
        icon={FolderOpen}
        label="Reveal in File Explorer"
        shortcut="Ctrl+K R"
        onClick={handleRevealInFileExplorer}
        disabled={isUntitled}
      />
      <ContextItem
        icon={Terminal}
        label="Open in Terminal"
        onClick={handleOpenInTerminal}
        disabled={isUntitled}
      />
      <ContextItem
        icon={Link2}
        label="Copy Path with Line"
        onClick={handleCopyPathWithLine}
        disabled={isUntitled}
      />
      <div className="relative">
        <ContextItem
          icon={History}
          label="View File History"
          onClick={handleViewFileHistory}
          disabled={isUntitled || !rootPath}
          submenu
          expanded={showHistorySubmenu}
        />
        {showHistorySubmenu && (
          <div
            className={`absolute top-0 min-w-[240px] max-w-[300px] ${
              menuPos.flipX ? 'right-full mr-1' : 'left-full ml-1'
            }`}
          >
            {historyLoading ? (
              <div className="rounded-lg border border-border bg-surface p-2 shadow-lg">
                <span className="text-[11px] text-muted-foreground">Loading...</span>
              </div>
            ) : historyError && historyCommits.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-2 shadow-lg">
                <span className="text-[11px] text-muted-foreground">
                  Couldn&apos;t load history
                </span>
              </div>
            ) : (
              <HistorySubmenu commits={historyCommits} onSelect={handleOpenCommit} />
            )}
          </div>
        )}
      </div>

      {/* Extension-contributed items, grouped by `group` */}
      {groupedExtItems.map(({ group, items }, gi) => (
        <div key={group}>
          <Separator />
          {gi === 0 && <div className="px-2 pt-1 text-[9px] uppercase tracking-wide text-muted-foreground">Extensions</div>}
          {items.map((reg) => {
            const Icon = getIcon(reg.item.icon);
            return (
              <ContextItem
                key={`${reg.extensionName}-${reg.item.id}`}
                icon={Icon}
                label={reg.item.label}
                onClick={() => {
                  onClose();
                  const ctx = getMenuContext();
                  Promise.resolve(reg.item.handler(ctx)).catch((err: unknown) => {
                    notify(
                      'error',
                      `Extension "${reg.extensionName}" action failed: ${err instanceof Error ? err.message : String(err)}`,
                    );
                  });
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
