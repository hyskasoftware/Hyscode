import { Suspense, lazy, useEffect, useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { EditorTabs } from './editor-tabs';
import { EditorWelcome } from './editor-welcome';
import { DiffViewer } from './diff-viewer';
import { AgentDiffViewer } from './agent-diff-viewer';
import { PendingChangesBar } from './pending-changes-bar';
import { InlineReviewBar } from './inline-review-bar';
import {
  MarkdownViewer,
  ImageViewer,
  PdfViewer,
  SpreadsheetViewer,
  DocxViewer,
  PptxViewer,
} from './viewers';
import { useEditorStore, useFileStore, useSettingsStore } from '../../stores';
import { useAgentStore } from '../../stores/agent-store';
import { tauriFs } from '../../lib/tauri-fs';
import { saveFileDialog } from '../../lib/tauri-dialog';
import { useGitDecorations } from '../../hooks/use-git-decorations';
import { useAgentDecorations } from '../../hooks/use-agent-decorations';
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
  const setMarkdownMode = useEditorStore((s) => s.setMarkdownMode);
  const { fileCache, setFileContent } = useFileStore();

  // Editor settings
  const editorFontSize = useSettingsStore((s) => s.fontSize);
  const editorFontFamily = useSettingsStore((s) => s.fontFamily);
  const editorLineHeight = useSettingsStore((s) => s.lineHeight);
  const editorTabSize = useSettingsStore((s) => s.tabSize);
  const editorWordWrap = useSettingsStore((s) => s.wordWrap);
  const editorMinimap = useSettingsStore((s) => s.minimap);
  const editorLineNumbers = useSettingsStore((s) => s.lineNumbers);
  const editorCursorStyle = useSettingsStore((s) => s.cursorStyle);
  const editorRenderWhitespace = useSettingsStore((s) => s.renderWhitespace);
  const editorBracketPairColorization = useSettingsStore((s) => s.bracketPairColorization);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const contentRef = useRef<string | null>(null);

  // Agent edit session for the active file (new inline model)
  const editSession = useAgentStore((s) =>
    activeTab?.filePath
      ? s.agentEditSessions.find(
          (es) =>
            es.filePath === activeTab.filePath &&
            (es.phase === 'streaming' || es.phase === 'pending_review'),
        ) ?? null
      : null,
  );

  // Toggle for full diff view
  const [showFullDiff, setShowFullDiff] = useState(false);

  // Reset full diff toggle when active tab or session changes
  useEffect(() => {
    setShowFullDiff(false);
  }, [activeTab?.id, editSession?.id]);

  // Monaco instance refs for decorations
  const editorInstanceRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<typeof monacoEditor | null>(null);

  // Apply git diff decorations to gutter + minimap
  useGitDecorations(
    editorInstanceRef,
    monacoInstanceRef,
    activeTab?.type === 'file' ? (activeTab?.filePath ?? null) : null,
  );

  // Apply agent edit decorations (glow, gutter markers, minimap)
  useAgentDecorations(
    editorInstanceRef,
    monacoInstanceRef,
    activeTab?.type === 'file' ? (activeTab?.filePath ?? null) : null,
  );

  // Push agent edit content to the Monaco model without remounting
  useEffect(() => {
    if (!editSession || !editorInstanceRef.current) return;
    const editor = editorInstanceRef.current;
    const model = editor.getModel();
    if (!model) return;

    const currentValue = model.getValue();
    if (currentValue !== editSession.newContent) {
      // Preserve cursor and scroll position
      const position = editor.getPosition();
      const scrollTop = editor.getScrollTop();
      const scrollLeft = editor.getScrollLeft();

      // Push an undo stop before agent content so user can Ctrl+Z
      model.pushStackElement();
      model.pushEditOperations(
        [],
        [
          {
            range: model.getFullModelRange(),
            text: editSession.newContent,
          },
        ],
        () => null,
      );
      model.pushStackElement();

      // Restore cursor/scroll
      if (position) editor.setPosition(position);
      editor.setScrollTop(scrollTop);
      editor.setScrollLeft(scrollLeft);

      // Sync cache
      contentRef.current = editSession.newContent;
      setContent(editSession.newContent);
      if (activeTab) {
        setFileContent(activeTab.filePath, editSession.newContent);
      }
    }
  }, [editSession?.newContent, editSession?.id]);

  // Viewer types that are handled as text (Monaco / markdown)
  const isTextViewer =
    !activeTab || activeTab.viewerType === 'code' || activeTab.viewerType === 'markdown';

  // Load file content when active tab changes (only for text-based viewers)
  useEffect(() => {
    if (!activeTab || !isTextViewer) {
      setContent(null);
      contentRef.current = null;
      return;
    }

    // Untitled files start with empty content — no disk read
    if (activeTab.filePath.startsWith('untitled:')) {
      const cached = fileCache.get(activeTab.filePath) ?? '';
      setContent(cached);
      contentRef.current = cached;
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

  // Save with Ctrl+S (only for text-editable viewers)
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!activeTab || !isTextViewer) return;
        const currentContent = contentRef.current;
        if (currentContent === null) return;

        // Untitled files → prompt Save As dialog
        if (activeTab.filePath.startsWith('untitled:')) {
          const path = await saveFileDialog(activeTab.fileName);
          if (!path) return;
          try {
            await tauriFs.writeFile(path, currentContent);
            markDirty(activeTab.id, false);
          } catch (err) {
            console.error('Failed to save file:', err);
          }
          return;
        }

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
  }, [activeTab?.id, activeTab?.filePath, activeTab?.fileName, markDirty]);

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
      ) : activeTab.viewerType === 'markdown' ? (
        loading ? (
          <EditorLoading />
        ) : (
          <MarkdownViewer
            content={content ?? ''}
            mode={activeTab.markdownMode ?? 'preview'}
            onModeChange={(mode) => setMarkdownMode(activeTab.id, mode)}
            onChange={handleEditorChange}
            language={activeTab.language}
          />
        )
      ) : activeTab.viewerType === 'image' ? (
        <ImageViewer filePath={activeTab.filePath} />
      ) : activeTab.viewerType === 'pdf' ? (
        <PdfViewer filePath={activeTab.filePath} />
      ) : activeTab.viewerType === 'spreadsheet' ? (
        <SpreadsheetViewer filePath={activeTab.filePath} />
      ) : activeTab.viewerType === 'docx' ? (
        <DocxViewer filePath={activeTab.filePath} />
      ) : activeTab.viewerType === 'pptx' ? (
        <PptxViewer filePath={activeTab.filePath} />
      ) : loading ? (
        <EditorLoading />
      ) : showFullDiff && editSession ? (
        <AgentDiffViewer change={{
          id: editSession.id,
          filePath: editSession.filePath,
          toolName: editSession.toolName,
          toolCallId: editSession.toolCallId,
          originalContent: editSession.originalContent,
          newContent: editSession.newContent,
          status: 'pending',
        }} />
      ) : (
        <>
          {editSession && (
            <InlineReviewBar
              session={editSession}
              onToggleDiff={() => setShowFullDiff((v) => !v)}
              showingDiff={showFullDiff}
            />
          )}
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
                fontFamily: `'${editorFontFamily}', 'JetBrains Mono', 'Fira Code', monospace`,
                fontSize: editorFontSize,
                lineHeight: editorLineHeight,
                minimap: { enabled: editorMinimap, scale: 1 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                cursorStyle: editorCursorStyle,
                bracketPairColorization: { enabled: editorBracketPairColorization },
                guides: { bracketPairs: editorBracketPairColorization, indentation: true },
                wordWrap: editorWordWrap,
                lineNumbers: editorLineNumbers,
                tabSize: editorTabSize,
                insertSpaces: true,
                renderWhitespace: editorRenderWhitespace === 'none' ? 'none' : editorRenderWhitespace,
                padding: { top: 8 },
                overviewRulerLanes: 3,
                overviewRulerBorder: false,
                lineDecorationsWidth: 8,
              }}
            />
          </Suspense>
        </div>
        </>
      )}
      <PendingChangesBar />
    </div>
  );
}
