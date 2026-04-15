/**
 * Extension overlays — renders quick-pick and input-box modals
 * triggered by extensions via the ui API.
 */

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useExtensionUiStore } from '../../stores/extension-ui-store';

// ── Quick Pick ───────────────────────────────────────────────────────────────

export function ExtensionQuickPick() {
  const { visible, items, title, placeholder } = useExtensionUiStore((s) => s.quickPick);
  const resolveQuickPick = useExtensionUiStore((s) => s.resolveQuickPick);
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (visible) {
      setFilter('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveQuickPick(undefined);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, resolveQuickPick]);

  if (!visible) return null;

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(filter.toLowerCase()) ||
    i.description?.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[100000] flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => resolveQuickPick(undefined)}
      />
      <div className="relative w-[440px] animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl border border-border/60 bg-surface/95 backdrop-blur-xl shadow-2xl shadow-black/30">
        {title && (
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-[11px] font-semibold text-foreground">{title}</span>
            <button onClick={() => resolveQuickPick(undefined)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={placeholder ?? 'Type to filter...'}
            className="flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto p-1">
          {filtered.map((item, i) => (
            <button
              key={i}
              onClick={() => resolveQuickPick(item)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11.5px] hover:bg-surface-raised transition-colors"
            >
              <span className="font-medium text-foreground">{item.label}</span>
              {item.description && (
                <span className="text-muted-foreground text-[10px]">{item.description}</span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">No results</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Input Box ────────────────────────────────────────────────────────────────

export function ExtensionInputBox() {
  const { visible, title, placeholder, value: defaultValue, prompt } = useExtensionUiStore((s) => s.inputBox);
  const resolveInputBox = useExtensionUiStore((s) => s.resolveInputBox);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) {
      setValue(defaultValue ?? '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible, defaultValue]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveInputBox(undefined);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, resolveInputBox]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => resolveInputBox(undefined)}
      />
      <div className="relative w-[400px] animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl border border-border/60 bg-surface/95 backdrop-blur-xl shadow-2xl shadow-black/30 p-4">
        {title && <div className="text-[12px] font-semibold text-foreground mb-2">{title}</div>}
        {prompt && <div className="text-[11px] text-muted-foreground mb-3">{prompt}</div>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') resolveInputBox(value);
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:border-accent transition-colors"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => resolveInputBox(undefined)}
            className="rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => resolveInputBox(value)}
            className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Combined overlay wrapper ─────────────────────────────────────────────────

export function ExtensionOverlays() {
  return (
    <>
      <ExtensionQuickPick />
      <ExtensionInputBox />
    </>
  );
}
