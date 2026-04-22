import { Suspense, lazy, useEffect, useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { EditorTabs } from './editor-tabs';
import { EditorWelcome } from './editor-welcome';
import { DiffViewer } from './diff-viewer';
import { AgentDiffViewer } from './agent-diff-viewer';
import { PendingChangesBar } from './pending-changes-bar';
import { InlineReviewBar } from './inline-review-bar';
import { EditorContextMenu } from './editor-context-menu';
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
import { useExtensionStore } from '../../stores/extension-store';
import { tauriFs } from '../../lib/tauri-fs';
import { saveFileDialog } from '../../lib/tauri-dialog';
import { useGitDecorations } from '../../hooks/use-git-decorations';
import { useAgentDecorations } from '../../hooks/use-agent-decorations';
import { defineAllMonacoThemes, getMonacoThemeName } from '../../lib/monaco-themes';
import { LspBridge, detectLanguage } from '../../lib/lsp-bridge';
import { registerAllLanguages } from '@hyscode/lsp-client';
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
  const themeId = useSettingsStore((s) => s.themeId);
  const monacoTheme = getMonacoThemeName(themeId);
  const extensionThemesVersion = useExtensionStore((s) => s.extensionThemesVersion);

  // Re-define custom themes + re-apply when extension themes finish loading asynchronously
  useEffect(() => {
    const monaco = monacoInstanceRef.current;
    if (!monaco) return;
    defineAllMonacoThemes(monaco);
    monaco.editor.setTheme(getMonacoThemeName(themeId));
  }, [extensionThemesVersion]);

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

  // ── Editor context menu (right-click) ──────────────────────────────────────
  const [editorCtxMenu, setEditorCtxMenu] = useState<{ x: number; y: number } | null>(null);

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
      setLoading(false);
      return;
    }

    // Untitled files start with empty content — no disk read
    if (activeTab.filePath.startsWith('untitled:')) {
      const cached = fileCache.get(activeTab.filePath) ?? '';
      setContent(cached);
      contentRef.current = cached;
      setLoading(false);
      return;
    }

    const cached = fileCache.get(activeTab.filePath);
    if (cached !== undefined) {
      setContent(cached);
      contentRef.current = cached;
      setLoading(false);
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

  // Track previous active tab for LSP close notifications
  const prevTabRef = useRef<{ filePath: string; language: string } | null>(null);

  // Track closed tabs to notify LSP even when they aren't the active tab
  const prevTabsRef = useRef<typeof tabs>([]);
  useEffect(() => {
    const prevTabs = prevTabsRef.current;
    const closedTabs = prevTabs.filter((pt) => !tabs.some((t) => t.id === pt.id));
    for (const tab of closedTabs) {
      if (tab.type === 'file' || tab.type === 'diff') {
        const lang = detectLanguage(tab.filePath) ?? tab.language ?? 'plaintext';
        LspBridge.onFileClosed(tab.filePath, lang).catch(() => {});
      }
    }
    prevTabsRef.current = tabs;
  }, [tabs]);

  // Notify LSP when a text file is opened / closed
  useEffect(() => {
    // Close previous document
    if (prevTabRef.current) {
      const { filePath, language } = prevTabRef.current;
      LspBridge.onFileClosed(filePath, language).catch(() => {});
    }

    // Open new document
    if (activeTab && isTextViewer && content !== null) {
      const lang = detectLanguage(activeTab.filePath) ?? activeTab.language ?? 'plaintext';
      LspBridge.onFileOpened(activeTab.filePath, lang, content).catch(() => {});
      prevTabRef.current = { filePath: activeTab.filePath, language: lang };
    } else {
      prevTabRef.current = null;
    }
  }, [activeTab?.filePath, isTextViewer, content !== null]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeTab || value === undefined) return;
      contentRef.current = value;
      setFileContent(activeTab.filePath, value);
      markDirty(activeTab.id, true);

      // Notify LSP of content change (debounced inside bridge)
      const lang = detectLanguage(activeTab.filePath) ?? activeTab.language ?? 'plaintext';
      LspBridge.onFileChanged(activeTab.filePath, lang, value);
    },
    [activeTab?.id, activeTab?.filePath, activeTab?.language, markDirty, setFileContent],
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
          const lang = detectLanguage(activeTab.filePath) ?? activeTab.language ?? 'plaintext';
          LspBridge.onFileSaved(activeTab.filePath, lang, currentContent);
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
              language={detectLanguage(activeTab.filePath)}
              value={content ?? ''}
              onChange={handleEditorChange}
              theme={monacoTheme}
              onMount={(editor, monaco) => {
                editorInstanceRef.current = editor;
                monacoInstanceRef.current = monaco;

                // Disable Monaco's built-in context menu so we show our own
                editor.updateOptions({ contextmenu: false });

                // Intercept right-click on the editor's DOM
                const domNode = editor.getDomNode();
                if (domNode) {
                  domNode.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditorCtxMenu({ x: e.clientX, y: e.clientY });
                  });
                }
              }}
              beforeMount={(monaco) => {
                defineAllMonacoThemes(monaco);
                registerAllLanguages(monaco);
                LspBridge.setMonaco(monaco);
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

      {editorCtxMenu && (
        <EditorContextMenu
          x={editorCtxMenu.x}
          y={editorCtxMenu.y}
          editorInstance={editorInstanceRef.current as unknown as Parameters<typeof EditorContextMenu>[0]['editorInstance']}
          onClose={() => setEditorCtxMenu(null)}
        />
      )}
    </div>
  );
}
