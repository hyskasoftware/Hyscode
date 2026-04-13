import { Suspense, lazy, useEffect, useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { EditorTabs } from './editor-tabs';
import { EditorWelcome } from './editor-welcome';
import { DiffViewer } from './diff-viewer';
import { useEditorStore, useFileStore } from '../../stores';
import { tauriFs } from '../../lib/tauri-fs';
import { useGitDecorations } from '../../hooks/use-git-decorations';
import type * as monacoEditor from 'monaco-editor';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

function EditorLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export function EditorArea() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const markDirty = useEditorStore((s) => s.markDirty);
  const { fileCache, setFileContent } = useFileStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const contentRef = useRef<string | null>(null);

  // Monaco instance refs for git decorations
  const editorInstanceRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<typeof monacoEditor | null>(null);

  // Apply git diff decorations to gutter + minimap
  useGitDecorations(
    editorInstanceRef,
    monacoInstanceRef,
    activeTab?.type === 'file' ? (activeTab?.filePath ?? null) : null,
  );

  // Load file content when active tab changes
  useEffect(() => {
    if (!activeTab) {
      setContent(null);
      contentRef.current = null;
      return;
    }

    const cached = fileCache.get(activeTab.filePath);
    if (cached !== undefined) {
      setContent(cached);
      contentRef.current = cached;
      return;
    }

    let cancelled = false;
    setLoading(true);

    tauriFs
      .readFile(activeTab.filePath)
      .then((text) => {
        if (!cancelled) {
          setFileContent(activeTab.filePath, text);
          setContent(text);
          contentRef.current = text;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent('// Error reading file');
          contentRef.current = '// Error reading file';
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab?.filePath]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeTab || value === undefined) return;
      contentRef.current = value;
      setFileContent(activeTab.filePath, value);
      markDirty(activeTab.id, true);
    },
    [activeTab?.id, activeTab?.filePath, markDirty, setFileContent],
  );

  // Save with Ctrl+S
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!activeTab) return;
        const currentContent = contentRef.current;
        if (currentContent === null) return;
        try {
          await tauriFs.writeFile(activeTab.filePath, currentContent);
          markDirty(activeTab.id, false);
        } catch (err) {
          console.error('Failed to save file:', err);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab?.id, activeTab?.filePath, markDirty]);

  const hasOpenTabs = tabs.length > 0;

  return (
    <div className="flex h-full flex-col">
      {hasOpenTabs && <EditorTabs />}
      {!activeTab ? (
        <EditorWelcome />
      ) : activeTab.type === 'diff' && activeTab.diffProps ? (
        <DiffViewer
          filePath={activeTab.diffProps.filePath}
          staged={activeTab.diffProps.staged}
        />
      ) : loading ? (
        <EditorLoading />
      ) : (
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<EditorLoading />}>
            <MonacoEditor
              key={activeTab.filePath}
              language={activeTab.language}
              value={content ?? ''}
              onChange={handleEditorChange}
              theme="hyscode-dark"
              onMount={(editor, monaco) => {
                editorInstanceRef.current = editor;
                monacoInstanceRef.current = monaco;
              }}
              beforeMount={(monaco) => {
                monaco.editor.defineTheme('hyscode-dark', {
                  base: 'vs-dark',
                  inherit: true,
                    rules: [
                      { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
                      { token: 'keyword', foreground: 'c084fc' },
                      { token: 'string', foreground: '86efac' },
                      { token: 'number', foreground: 'fbbf24' },
                      { token: 'type', foreground: '60a5fa' },
                      { token: 'function', foreground: 'f0abfc' },
                    ],
                    colors: {
                      'editor.background': '#1a1a1a',
                      'editor.foreground': '#f0f0f0',
                      'editorLineNumber.foreground': '#4a4a4a',
                      'editorLineNumber.activeForeground': '#b0b0b0',
                      'editor.selectionBackground': '#a855f733',
                      'editor.lineHighlightBackground': '#ffffff08',
                      'editorCursor.foreground': '#a855f7',
                      'editorIndentGuide.background': '#2a2a2a',
                      'editorIndentGuide.activeBackground': '#3a3a3a',
                      'editorBracketMatch.background': '#a855f722',
                      'editorBracketMatch.border': '#a855f744',
                      'editor.wordHighlightBackground': '#a855f718',
                      'editorWidget.background': '#222222',
                      'editorWidget.border': '#a855f738',
                      'input.background': '#1a1a1a',
                      'input.foreground': '#f0f0f0',
                      'input.border': '#a855f738',
                      'minimap.background': '#141414',
                      'minimap.selectionHighlight': '#a855f755',
                      'minimapGutter.addedBackground': '#3fb950',
                      'minimapGutter.modifiedBackground': '#e3b341',
                      'minimapGutter.deletedBackground': '#f85149',
                      'editorOverviewRuler.addedForeground': '#3fb95088',
                      'editorOverviewRuler.modifiedForeground': '#e3b34188',
                      'editorOverviewRuler.deletedForeground': '#f8514988',
                      'scrollbarSlider.background': '#a855f722',
                      'scrollbarSlider.hoverBackground': '#a855f744',
                      'scrollbarSlider.activeBackground': '#a855f766',
                    },
                  });
              }}
              options={{
                fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 14,
                lineHeight: 1.6,
                minimap: { enabled: true, scale: 1 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
                wordWrap: 'off',
                tabSize: 2,
                insertSpaces: true,
                renderWhitespace: 'selection',
                padding: { top: 8 },
                // Overview ruler (scrollbar gutter) – needs at least 1 lane for git decorations
                overviewRulerLanes: 3,
                overviewRulerBorder: false,
                // Line decorations column for git gutter bars
                lineDecorationsWidth: 8,
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
