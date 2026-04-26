import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Scissors,
  Copy,
  ClipboardPaste,
  Wand2,
  Command,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useExtensionUiStore } from '../../stores/extension-ui-store';
import { useEditorStore, useSettingsStore } from '../../stores';
import { detectLanguage } from '../../lib/lsp-bridge';
import type { MenuActionContext } from '@hyscode/extension-api';

// ── Icon map for extension-contributed icons ─────────────────────────────────
const iconMap: Record<string, LucideIcon> = {
  wand: Wand2,
  sparkles: Sparkles,
  scissors: Scissors,
  copy: Copy,
  paste: ClipboardPaste,
  command: Command,
};

function getIcon(name?: string): LucideIcon {
  if (!name) return Command;
  return iconMap[name.toLowerCase()] ?? Command;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface EditorContextMenuProps {
  x: number;
  y: number;
  editorInstance: { getPosition: () => { lineNumber: number; column: number } | null; getSelection: () => { startLineNumber: number; endLineNumber: number } | null; getModel: () => { getValueInRange: (range: unknown) => string } | null; trigger: (source: string, handlerId: string, payload?: unknown) => void; focus: () => void } | null;
  onClose: () => void;
}

interface ContextItemProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  submenu?: boolean;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ContextItem({ icon: Icon, label, shortcut, onClick, disabled, accent, submenu }: ContextItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
        disabled
          ? 'text-muted-foreground/50 cursor-not-allowed'
          : accent
            ? 'text-accent hover:bg-accent/10 hover:text-accent'
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
}

function Separator() {
  return <div className="my-1 h-px bg-border" />;
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
    <div className="ml-1 mt-1 rounded-lg border border-border bg-surface p-1 shadow-lg">
      {formatters.map((f) => (
        <button
          key={f.item.id}
          onClick={() => onSelect(f.item.id)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-foreground hover:bg-surface-raised transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span>{f.item.displayName}</span>
          <span className="ml-auto text-[9px] text-muted-foreground">{f.extensionName}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function EditorContextMenu({ x, y, editorInstance, onClose }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showFormatSubmenu, setShowFormatSubmenu] = useState(false);

  const contextMenuItems = useExtensionUiStore((s) => s.contextMenuItems);
  const formatters = useExtensionUiStore((s) => s.formatters);

  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const tabSize = useSettingsStore((s) => s.tabSize);

  const languageId = activeTab?.filePath ? (detectLanguage(activeTab.filePath) ?? activeTab.language ?? 'plaintext') : 'plaintext';
  const availableFormatters = formatters.filter(
    (f) => f.item.languageIds.includes(languageId) || f.item.languageIds.includes('*'),
  );

  // Build the menu action context
  const getMenuContext = useCallback((): MenuActionContext => {
    const pos = editorInstance?.getPosition?.();
    const sel = editorInstance?.getSelection?.();
    let selectedText: string | null = null;
    if (sel && editorInstance?.getModel?.()) {
      const model = editorInstance.getModel();
      try {
        selectedText = model?.getValueInRange(sel) ?? null;
      } catch { selectedText = null; }
    }
    return {
      filePath: activeTab?.filePath ?? null,
      languageId,
      selectedText: selectedText || null,
      cursorLine: pos?.lineNumber ?? 1,
      cursorColumn: pos?.column ?? 1,
    };
  }, [editorInstance, activeTab, languageId]);

  // Close on outside click / escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Position adjustment
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [x, y]);

  // Built-in actions
  const handleCut = () => { onClose(); editorInstance?.trigger('contextMenu', 'editor.action.clipboardCutAction'); };
  const handleCopy = () => { onClose(); editorInstance?.trigger('contextMenu', 'editor.action.clipboardCopyAction'); };
  const handlePaste = () => { onClose(); editorInstance?.trigger('contextMenu', 'editor.action.clipboardPasteAction'); };

  const handleFormat = async (formatterId: string) => {
    onClose();
    const formatter = formatters.find((f) => f.item.id === formatterId);
    if (!formatter || !editorInstance) return;

    const model = editorInstance.getModel?.();
    if (!model) return;

    const content = (model as unknown as { getValue: () => string }).getValue();
    try {
      const formatted = await formatter.item.format({
        content,
        filePath: activeTab?.filePath ?? '',
        languageId,
        tabSize,
        insertSpaces: true,
      });
      // Replace content via Monaco edit operation
      const fullRange = (model as unknown as { getFullModelRange: () => unknown }).getFullModelRange();
      (model as unknown as { pushStackElement: () => void }).pushStackElement();
      (model as unknown as {
        pushEditOperations: (sel: null, ops: Array<{ range: unknown; text: string }>, cb: () => null) => void;
      }).pushEditOperations(null, [{ range: fullRange, text: formatted }], () => null);
      (model as unknown as { pushStackElement: () => void }).pushStackElement();
      editorInstance.focus();
    } catch (err) {
      console.error('[EditorContextMenu] Format error:', err);
    }
  };

  // Group extension items
  const sortedExtItems = [...contextMenuItems].sort((a, b) => (a.item.order ?? 50) - (b.item.order ?? 50));

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
      className="min-w-[240px] max-w-[300px] rounded-lg border border-border bg-surface p-1 shadow-lg"
    >
      {/* Built-in editor actions */}
      <ContextItem icon={Scissors} label="Cut" shortcut="Ctrl+X" onClick={handleCut} />
      <ContextItem icon={Copy} label="Copy" shortcut="Ctrl+C" onClick={handleCopy} />
      <ContextItem icon={ClipboardPaste} label="Paste" shortcut="Ctrl+V" onClick={handlePaste} />

      {/* Format section */}
      {availableFormatters.length > 0 && (
        <>
          <Separator />
          {availableFormatters.length === 1 ? (
            <ContextItem
              icon={Sparkles}
              label={`Format with ${availableFormatters[0].item.displayName}`}
              shortcut="Shift+Alt+F"
              onClick={() => handleFormat(availableFormatters[0].item.id)}
              accent
            />
          ) : (
            <div className="relative">
              <ContextItem
                icon={Sparkles}
                label="Format Document..."
                shortcut="Shift+Alt+F"
                onClick={() => setShowFormatSubmenu(!showFormatSubmenu)}
                accent
                submenu
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

      {/* Extension-contributed items */}
      {sortedExtItems.length > 0 && (
        <>
          <Separator />
          {sortedExtItems.map((reg) => {
            const Icon = getIcon(reg.item.icon);
            return (
              <ContextItem
                key={`${reg.extensionName}-${reg.item.id}`}
                icon={Icon}
                label={reg.item.label}
                onClick={() => {
                  onClose();
                  const ctx = getMenuContext();
                  Promise.resolve(reg.item.handler(ctx)).catch(console.error);
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
