import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../stores/git-store';
import { useFileStore } from '../stores/file-store';
import { computeDiffHunks } from '../lib/compute-diff';
import type { DiffHunk } from '../stores/agent-store';
import type * as monacoEditor from 'monaco-editor';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiffHunkInfo {
  new_start: number;
  new_lines: number;
  old_lines: number;
}

type IEditor = monacoEditor.editor.IStandaloneCodeEditor;
type IMonaco = typeof monacoEditor;
type IDecorationsCollection = monacoEditor.editor.IEditorDecorationsCollection;

// ── One-time CSS injection ────────────────────────────────────────────────────

let cssInjected = false;

function ensureGitGutterCss() {
  if (cssInjected) return;
  cssInjected = true;
  const el = document.createElement('style');
  el.textContent = `
    /* Left gutter bars – VS Code dirty-diff style */
    .monaco-editor .git-gutter-added {
      border-left: 3px solid #3fb950 !important;
      margin-left: 3px !important;
      box-sizing: border-box !important;
    }
    .monaco-editor .git-gutter-modified {
      border-left: 3px solid #e3b341 !important;
      margin-left: 3px !important;
      box-sizing: border-box !important;
    }
    /* Deleted: downward-pointing triangle at hunk boundary */
    .monaco-editor .git-gutter-deleted {
      bottom: 0 !important;
      width: 0 !important;
      height: 0 !important;
      border-left: 4px solid transparent !important;
      border-right: 4px solid transparent !important;
      border-top: 7px solid #f85149 !important;
      margin-left: 5px !important;
      margin-top: -3px !important;
    }
  `;
  document.head.appendChild(el);
  console.log('[git-decorations] CSS injected');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRelPath(filePath: string, rootPath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  let root = rootPath.replace(/\\/g, '/');
  if (!root.endsWith('/')) root += '/';
  const result = norm.startsWith(root) ? norm.slice(root.length) : norm;
  console.log('[git-decorations] normalizeRelPath:', { filePath, rootPath, result });
  return result;
}

function hunksToDecorations(
  hunks: DiffHunk[],
  monaco: IMonaco,
): monacoEditor.editor.IModelDeltaDecoration[] {
  const decorations: monacoEditor.editor.IModelDeltaDecoration[] = [];
  console.log('[git-decorations] Converting hunks to decorations:', hunks.length, 'hunks');

  for (const hunk of hunks) {
    switch (hunk.type) {
      case 'delete': {
        const line = Math.max(1, hunk.newStart);
        console.log('[git-decorations] Delete decoration at line:', line);
        decorations.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            linesDecorationsClassName: 'git-gutter-deleted',
            minimap: {
              color: '#f85149',
              position: monaco.editor.MinimapPosition.Inline,
            },
            overviewRuler: {
              color: '#f85149',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
        break;
      }
      case 'add': {
        const endLine = Math.max(hunk.newStart, hunk.newStart + hunk.newLines - 1);
        console.log('[git-decorations] Add decoration:', hunk.newStart, 'to', endLine);
        decorations.push({
          range: new monaco.Range(hunk.newStart, 1, endLine, 1),
          options: {
            linesDecorationsClassName: 'git-gutter-added',
            minimap: {
              color: '#3fb950',
              position: monaco.editor.MinimapPosition.Inline,
            },
            overviewRuler: {
              color: '#3fb950',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
        break;
      }
      case 'modify': {
        const endLine = Math.max(hunk.newStart, hunk.newStart + hunk.newLines - 1);
        console.log('[git-decorations] Modify decoration:', hunk.newStart, 'to', endLine);
        decorations.push({
          range: new monaco.Range(hunk.newStart, 1, endLine, 1),
          options: {
            linesDecorationsClassName: 'git-gutter-modified',
            minimap: {
              color: '#e3b341',
              position: monaco.editor.MinimapPosition.Inline,
            },
            overviewRuler: {
              color: '#e3b341',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
        break;
      }
    }
  }

  return decorations;
}

function backendHunksToDiffHunks(hunks: DiffHunkInfo[]): DiffHunk[] {
  console.log('[git-decorations] Backend hunks:', JSON.stringify(hunks));
  return hunks.map((h) => {
    const isAddition = h.old_lines === 0;
    const isDeletion = h.new_lines === 0;
    if (isDeletion) {
      return { type: 'delete' as const, oldStart: h.new_start, oldLines: h.old_lines, newStart: h.new_start, newLines: 0 };
    }
    if (isAddition) {
      return { type: 'add' as const, oldStart: h.new_start, oldLines: 0, newStart: h.new_start, newLines: h.new_lines };
    }
    return { type: 'modify' as const, oldStart: h.new_start, oldLines: h.old_lines, newStart: h.new_start, newLines: h.new_lines };
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGitDecorations(
  editorRef: React.MutableRefObject<IEditor | null>,
  monacoRef: React.MutableRefObject<IMonaco | null>,
  filePath: string | null,
  editorVersion: number,
) {
  const staged = useGitStore((s) => s.staged);
  const unstaged = useGitStore((s) => s.unstaged);
  const rootPath = useFileStore((s) => s.rootPath);
  const collectionRef = useRef<IDecorationsCollection | null>(null);
  const originalContentRef = useRef<string | null>(null);
  const currentFilePathRef = useRef<string | null>(null);

  console.log('[git-decorations] Hook called:', { filePath, rootPath, editorVersion, stagedCount: staged.length, unstagedCount: unstaged.length });

  // Inject CSS once on mount
  useEffect(() => {
    ensureGitGutterCss();
  }, []);

  // Core function to apply decorations
  const applyDecorations = useCallback(
    async (useEditorContent = false) => {
      console.log('[git-decorations] applyDecorations called, useEditorContent:', useEditorContent);
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      console.log('[git-decorations] Editor:', !!editor, 'Monaco:', !!monaco, 'filePath:', filePath, 'rootPath:', rootPath);
      
      if (!editor || !monaco || !filePath || !rootPath) {
        console.log('[git-decorations] Missing refs or paths, clearing');
        collectionRef.current?.clear();
        return;
      }

      const relPath = normalizeRelPath(filePath, rootPath);

      // Check if this file has any git changes
      const inUnstaged = unstaged.some((f) => f.path === relPath);
      const inStaged = staged.some((f) => f.path === relPath);
      console.log('[git-decorations] Git status:', { relPath, inUnstaged, inStaged, stagedPaths: staged.map(s => s.path), unstagedPaths: unstaged.map(u => u.path) });

      if (!inUnstaged && !inStaged) {
        console.log('[git-decorations] File not in git changes, clearing');
        collectionRef.current?.clear();
        return;
      }

      const useStaged = inStaged && !inUnstaged;
      console.log('[git-decorations] Using staged:', useStaged);

      try {
        let hunks: DiffHunk[] = [];

        if (useEditorContent && originalContentRef.current !== null) {
          console.log('[git-decorations] Computing real-time diff');
          // Real-time diff: compare original (HEAD) with current editor content
          const currentContent = editor.getModel()?.getValue() ?? '';
          console.log('[git-decorations] Original length:', originalContentRef.current.length, 'Current length:', currentContent.length);
          hunks = computeDiffHunks(originalContentRef.current, currentContent);
          console.log('[git-decorations] Real-time hunks:', JSON.stringify(hunks));
        } else {
          console.log('[git-decorations] Fetching backend diff for:', relPath);
          // Git diff from backend (disk vs index)
          const backendHunks = await invoke<DiffHunkInfo[]>('git_diff_hunks', {
            repoPath: rootPath,
            filePath: relPath,
            staged: useStaged,
          });
          console.log('[git-decorations] Backend returned hunks:', backendHunks.length);
          hunks = backendHunksToDiffHunks(backendHunks);
        }

        const ed = editorRef.current;
        const mn = monacoRef.current;
        if (!ed || !mn) {
          console.log('[git-decorations] Editor/monaco lost after async');
          return;
        }

        const decorations = hunksToDecorations(hunks, mn);
        console.log('[git-decorations] Generated decorations:', decorations.length);

        // Debug: check model
        const model = ed.getModel();
        console.log('[git-decorations] Editor model:', model ? { uri: model.uri.toString(), lineCount: model.getLineCount() } : 'null');

        // Debug: check CSS
        console.log('[git-decorations] CSS elements in head:', document.head.querySelectorAll('style').length);

        // Apply — use createDecorationsCollection for clean lifecycle
        if (!collectionRef.current) {
          console.log('[git-decorations] Creating new decorations collection');
          collectionRef.current = ed.createDecorationsCollection(decorations);
        } else {
          console.log('[git-decorations] Updating existing decorations collection');
          collectionRef.current.set(decorations);
        }
        console.log('[git-decorations] Decorations applied successfully, collection length:', collectionRef.current?.length ?? 0);
      } catch (err) {
        console.warn('[git-decorations] Error:', err);
        collectionRef.current?.clear();
      }
    },
    [editorRef, monacoRef, filePath, rootPath, staged, unstaged],
  );

  // Fetch original content when file opens or git status changes
  useEffect(() => {
    console.log('[git-decorations] Effect triggered:', { filePath, rootPath, editorVersion });
    const editor = editorRef.current;
    if (!editor || !filePath || !rootPath) {
      console.log('[git-decorations] Early return - missing editor/filePath/rootPath');
      originalContentRef.current = null;
      currentFilePathRef.current = null;
      return;
    }

    const relPath = normalizeRelPath(filePath, rootPath);
    const inUnstaged = unstaged.some((f) => f.path === relPath);
    const inStaged = staged.some((f) => f.path === relPath);

    if (!inUnstaged && !inStaged) {
      console.log('[git-decorations] File not modified in git');
      originalContentRef.current = null;
      currentFilePathRef.current = null;
      collectionRef.current?.clear();
      return;
    }

    // Fetch original content from HEAD for real-time diff
    if (currentFilePathRef.current !== filePath) {
      console.log('[git-decorations] New file, fetching original content from HEAD');
      currentFilePathRef.current = filePath;
      invoke<{ original: string }>('git_file_content', {
        repoPath: rootPath,
        filePath: relPath,
      })
        .then((result) => {
          console.log('[git-decorations] Original content fetched, length:', result.original.length);
          originalContentRef.current = result.original;
          // Apply initial decorations
          applyDecorations(false);
        })
        .catch((err) => {
          console.log('[git-decorations] Failed to fetch original content:', err);
          originalContentRef.current = null;
          applyDecorations(false);
        });
    } else {
      console.log('[git-decorations] Same file, re-applying decorations');
      // Same file, just re-apply
      applyDecorations(false);
    }
  }, [filePath, staged, unstaged, rootPath, editorVersion, applyDecorations]);

  // Real-time diff while typing (debounced)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !filePath || !rootPath) {
      console.log('[git-decorations] Real-time effect early return');
      return;
    }

    const relPath = normalizeRelPath(filePath, rootPath);
    const inUnstaged = unstaged.some((f) => f.path === relPath);
    const inStaged = staged.some((f) => f.path === relPath);

    if (!inUnstaged && !inStaged) {
      console.log('[git-decorations] Real-time effect: file not modified');
      return;
    }

    console.log('[git-decorations] Setting up onDidChangeModelContent listener');
    let timeout: ReturnType<typeof setTimeout>;
    const disposable = editor.onDidChangeModelContent(() => {
      console.log('[git-decorations] Model content changed');
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log('[git-decorations] Debounced apply decorations');
        applyDecorations(true);
      }, 300);
    });

    return () => {
      console.log('[git-decorations] Cleaning up onDidChangeModelContent listener');
      disposable.dispose();
      if (timeout) clearTimeout(timeout);
    };
  }, [editorRef, filePath, rootPath, staged, unstaged, applyDecorations]);

  // Clean up collection on unmount
  useEffect(() => {
    return () => {
      console.log('[git-decorations] Unmounting, clearing decorations');
      collectionRef.current?.clear();
      originalContentRef.current = null;
      currentFilePathRef.current = null;
    };
  }, []);
}
