import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useTerminalStore } from '../../stores/terminal-store';
import { useProjectStore } from '../../stores/project-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useExtensionStore } from '../../stores/extension-store';
import { getXtermTheme } from '../../lib/monaco-themes';

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
}

export function TerminalInstance({ sessionId, isActive }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  const setPtyId = useTerminalStore((s) => s.setPtyId);
  const rootPath = useProjectStore((s) => s.rootPath);
  const themeId = useSettingsStore((s) => s.themeId);
  const extensionThemesVersion = useExtensionStore((s) => s.extensionThemesVersion);
  // Keep a ref so the one-time init effect always reads the latest themeId
  const themeIdRef = useRef(themeId);
  useEffect(() => { themeIdRef.current = themeId; }, [themeId]);

  // Update xterm theme whenever the theme setting or extension themes change
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.options.theme = getXtermTheme(themeId);
  }, [themeId, extensionThemesVersion]);

  const handleResize = useCallback(() => {
    const container = containerRef.current;
    if (!fitAddonRef.current || !ptyIdRef.current || !xtermRef.current) return;
    if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) return;
    try {
      fitAddonRef.current.fit();
      invoke('pty_resize', {
        ptyId: ptyIdRef.current,
        cols: xtermRef.current.cols,
        rows: xtermRef.current.rows,
      }).catch(() => {});
    } catch {
      // ignore fit errors when container is invisible
    }
  }, []);

  // Initialize xterm + PTY. Uses a `cancelled` flag to handle React StrictMode's
  // double-invocation: if the cleanup fires before the async PTY spawn completes,
  // we kill the orphaned process and bail out.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const unlistenFns: UnlistenFn[] = [];

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'Geist Mono', 'Cascadia Code', 'Consolas', monospace",
      lineHeight: 1.4,
      theme: getXtermTheme(themeIdRef.current),
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(container);

    // Forward user keystrokes to the PTY
    const onDataDisposable = term.onData((data) => {
      if (ptyIdRef.current) {
        invoke('pty_write', { ptyId: ptyIdRef.current, data }).catch(() => {});
      }
    });

    // Refit on container resize
    const observer = new ResizeObserver(() => {
      if (!cancelled) handleResize();
    });
    observer.observe(container);

    // Spawn PTY after a frame so the container has real pixel dimensions
    let rafId: number;
    rafId = requestAnimationFrame(async () => {
      if (cancelled) return;

      try { fitAddon.fit(); } catch { /* not yet visible */ }

      try {
        const ptyId = await invoke<string>('pty_spawn', {
          shell: null,
          cwd: rootPath ?? null,
          env: null,
        });

        if (cancelled) {
          await invoke('pty_kill', { ptyId }).catch(() => {});
          return;
        }

        ptyIdRef.current = ptyId;
        setPtyId(sessionId, ptyId);

        const unlistenData = await listen<{ pty_id: string; data: string }>('pty:data', (e) => {
          if (e.payload.pty_id === ptyId && !cancelled) {
            term.write(e.payload.data);
          }
        });
        unlistenFns.push(unlistenData);

        const unlistenExit = await listen<{ pty_id: string }>('pty:exit', (e) => {
          if (e.payload.pty_id === ptyId && !cancelled) {
            term.writeln('\r\n\x1b[90m[Process exited]\x1b[0m');
          }
        });
        unlistenFns.push(unlistenExit);

        if (!cancelled && term.cols && term.rows) {
          await invoke('pty_resize', { ptyId, cols: term.cols, rows: term.rows });
        }
      } catch (err) {
        if (!cancelled) {
          term.writeln(`\x1b[31mFailed to spawn terminal: ${err}\x1b[0m`);
        }
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      onDataDisposable.dispose();
      observer.disconnect();
      unlistenFns.forEach((fn) => fn());
      if (ptyIdRef.current) {
        invoke('pty_kill', { ptyId: ptyIdRef.current }).catch(() => {});
        ptyIdRef.current = null;
      }
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  // sessionId is stable per instance; rootPath/setPtyId are fine to capture once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // When switching to this tab, refit and focus
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        handleResize();
        xtermRef.current?.focus();
      });
    }
  }, [isActive, handleResize]);

  return (
    // Absolute fill — all instances overlay each other; only the active one is visible.
    // This preserves PTY state without re-spawning shells on tab switches.
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: isActive ? 'block' : 'none',
        overflow: 'hidden',
      }}
    />
  );
}
