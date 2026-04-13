import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../stores/git-store';
import { useFileStore } from '../stores/file-store';
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
      border-left: 3px solid #3fb950;
      margin-left: 3px;
      box-sizing: border-box;
    }
    .monaco-editor .git-gutter-modified {
      border-left: 3px solid #e3b341;
      margin-left: 3px;
      box-sizing: border-box;
    }
    /* Deleted: downward-pointing triangle at hunk boundary */
    .monaco-editor .git-gutter-deleted {
      bottom: 0;
      width: 0 !important;
      height: 0 !important;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 7px solid #f85149;
      margin-left: 5px;
      margin-top: -3px;
    }
  `;
  document.head.appendChild(el);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGitDecorations(
  editorRef: React.MutableRefObject<IEditor | null>,
  monacoRef: React.MutableRefObject<IMonaco | null>,
  filePath: string | null,
) {
  const staged = useGitStore((s) => s.staged);
  const unstaged = useGitStore((s) => s.unstaged);
  const rootPath = useFileStore((s) => s.rootPath);
  const collectionRef = useRef<IDecorationsCollection | null>(null);

  // Inject CSS once on mount
  useEffect(() => {
    ensureGitGutterCss();
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Clear decorations when no editor / no file
    if (!editor || !monaco) return;

    if (!filePath || !rootPath) {
      collectionRef.current?.clear();
      return;
    }

    // Normalise paths to forward-slash
    const relPath = (() => {
      const norm = filePath.replace(/\\/g, '/');
      let root = rootPath.replace(/\\/g, '/');
      if (!root.endsWith('/')) root += '/';
      return norm.startsWith(root) ? norm.slice(root.length) : norm;
    })();

    // Check if this file has any git changes
    const inUnstaged = unstaged.some((f) => f.path === relPath);
    const inStaged = staged.some((f) => f.path === relPath);

    if (!inUnstaged && !inStaged) {
      collectionRef.current?.clear();
      return;
    }

    // Prefer unstaged diff (working tree vs index) for live editing feedback
    const useStaged = inStaged && !inUnstaged;

    invoke<DiffHunkInfo[]>('git_diff_hunks', {
      repoPath: rootPath,
      filePath: relPath,
      staged: useStaged,
    })
      .then((hunks) => {
        const ed = editorRef.current;
        const mn = monacoRef.current;
        if (!ed || !mn) return;

        const decorations: monacoEditor.editor.IModelDeltaDecoration[] = [];

        for (const hunk of hunks) {
          const isAddition = hunk.old_lines === 0;
          const isDeletion = hunk.new_lines === 0;

          if (isDeletion) {
            // Red triangle at boundary line
            const line = Math.max(1, hunk.new_start);
            decorations.push({
              range: new mn.Range(line, 1, line, 1),
              options: {
                linesDecorationsClassName: 'git-gutter-deleted',
                minimap: {
                  color: '#f85149',
                  position: mn.editor.MinimapPosition.Inline,
                },
                overviewRuler: {
                  color: '#f85149',
                  position: mn.editor.OverviewRulerLane.Left,
                },
              },
            });
          } else {
            const gutterClass = isAddition ? 'git-gutter-added' : 'git-gutter-modified';
            const color = isAddition ? '#3fb950' : '#e3b341';
            const endLine = Math.max(
              hunk.new_start,
              hunk.new_start + hunk.new_lines - 1,
            );

            decorations.push({
              range: new mn.Range(hunk.new_start, 1, endLine, 1),
              options: {
                linesDecorationsClassName: gutterClass,
                minimap: {
                  color,
                  position: mn.editor.MinimapPosition.Inline,
                },
                overviewRuler: {
                  color,
                  position: mn.editor.OverviewRulerLane.Left,
                },
              },
            });
          }
        }

        // Apply — use createDecorationsCollection for clean lifecycle
        if (!collectionRef.current) {
          collectionRef.current = ed.createDecorationsCollection(decorations);
        } else {
          collectionRef.current.set(decorations);
        }
      })
      .catch((err) => {
        console.warn('[git-decorations]', err);
        collectionRef.current?.clear();
      });
  }, [filePath, staged, unstaged, rootPath]);

  // Clean up collection on unmount
  useEffect(() => {
    return () => {
      collectionRef.current?.clear();
    };
  }, []);
}
