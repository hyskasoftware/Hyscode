import { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Loader2,
  CheckCircle2,
  FileCode2,
  ChevronLeft,
  ChevronRight,
  Eye,
  SplitSquareHorizontal,
  Plus,
  X,
  Send,
} from 'lucide-react';
import { useReviewStore } from '@/stores/review-store';
import { useGitStore } from '@/stores/git-store';
import { useSettingsStore } from '@/stores/settings-store';
import { defineAllMonacoThemes, getMonacoThemeName } from '@/lib/monaco-themes';
import { cn } from '@/lib/utils';
import type { ReviewComment, ReviewSeverity } from '@/stores/review-store';

const MonacoDiffEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.DiffEditor })),
);

// ─── Language detection ─────────────────────────────────────────────────────

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescriptreact',
  js: 'javascript', jsx: 'javascriptreact',
  json: 'json', md: 'markdown', css: 'css', html: 'html',
  rs: 'rust', py: 'python', toml: 'toml', yaml: 'yaml',
  yml: 'yaml', sql: 'sql', sh: 'shell',
};

function detectLang(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return LANG_MAP[ext] || 'plaintext';
}

// ─── Severity config ────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<ReviewSeverity, { label: string; color: string; bg: string; border: string }> = {
  p0: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25' },
  p1: { label: 'Important', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
  p2: { label: 'Suggestion', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25' },
};

// ─── Inline Comment Annotation ──────────────────────────────────────────────

function InlineComment({ comment }: { comment: ReviewComment }) {
  const { label, color, bg, border } = SEVERITY_CONFIG[comment.severity];
  const resolveComment = useReviewStore((s) => s.resolveComment);
  const unresolveComment = useReviewStore((s) => s.unresolveComment);

  return (
    <div className={cn(
      'mx-2 my-1 rounded-md border px-3 py-2 transition-opacity',
      comment.resolved ? 'opacity-50' : '',
      bg,
      border,
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[9px] font-bold uppercase', color)}>{label}</span>
          <span className="text-[9px] text-muted-foreground">{comment.category}</span>
          <span className="text-[9px] text-muted-foreground/50">L{comment.line}{comment.endLine ? `-${comment.endLine}` : ''}</span>
        </div>
        <button
          onClick={() => comment.resolved ? unresolveComment(comment.id) : resolveComment(comment.id)}
          className={cn(
            'flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors',
            comment.resolved
              ? 'text-green-400 hover:bg-green-500/15'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <CheckCircle2 className="h-2.5 w-2.5" />
          {comment.resolved ? 'Resolved' : 'Resolve'}
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-foreground/80">{comment.message}</p>
      {comment.suggestion && (
        <div className="mt-1.5 rounded bg-surface-raised/60 px-2 py-1.5">
          <span className="text-[9px] font-medium text-muted-foreground">Suggestion: </span>
          <span className="text-[10px] text-foreground/70">{comment.suggestion}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ReviewDiffPanel() {
  const selectedFile = useReviewStore((s) => s.selectedFile);
  const files = useReviewStore((s) => s.files);
  const comments = useReviewStore((s) => s.comments);
  const markFileReviewed = useReviewStore((s) => s.markFileReviewed);
  const setSelectedFile = useReviewStore((s) => s.setSelectedFile);
  const getFileContent = useGitStore((s) => s.getFileContent);
  const themeId = useSettingsStore((s) => s.themeId);
  const monacoTheme = getMonacoThemeName(themeId);

  const addComment = useReviewStore((s) => s.addComment);

  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  const [loading, setLoading] = useState(false);
  const [sideBySide, setSideBySide] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickLine, setQuickLine] = useState('');
  const [quickMsg, setQuickMsg] = useState('');
  const [quickSev, setQuickSev] = useState<ReviewSeverity>('p1');

  const handleQuickAdd = () => {
    if (!quickMsg.trim() || !selectedFile) return;
    addComment({
      id: crypto.randomUUID(),
      filePath: selectedFile,
      line: parseInt(quickLine, 10) || 1,
      severity: quickSev,
      category: 'general',
      message: quickMsg.trim(),
      resolved: false,
    });
    setQuickMsg('');
    setQuickLine('');
    setShowQuickAdd(false);
  };

  // Comments for current file
  const fileComments = useMemo(
    () => comments.filter((c) => c.filePath === selectedFile).sort((a, b) => a.line - b.line),
    [comments, selectedFile],
  );

  // Current file index for navigation
  const currentIndex = files.findIndex((f) => f.path === selectedFile);
  const currentFile = files[currentIndex] ?? null;

  // Load diff content when file changes
  useEffect(() => {
    if (!selectedFile) {
      setOriginal('');
      setModified('');
      return;
    }

    let cancelled = false;
    setLoading(true);

    getFileContent(selectedFile)
      .then((content) => {
        if (!cancelled) {
          setOriginal(content.original);
          setModified(content.modified);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOriginal('');
          setModified('// Error loading file');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedFile, getFileContent]);

  const goToPrev = () => {
    if (currentIndex > 0) {
      setSelectedFile(files[currentIndex - 1].path);
    }
  };

  const goToNext = () => {
    if (currentIndex < files.length - 1) {
      setSelectedFile(files[currentIndex + 1].path);
    }
  };

  if (!selectedFile || !currentFile) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Eye className="mb-3 h-8 w-8 opacity-20" />
        <span className="text-[11px]">Select a file to review</span>
      </div>
    );
  }

  const fileName = selectedFile.split(/[\\/]/).pop() ?? selectedFile;

  return (
    <div className="flex h-full flex-col">
      {/* File header bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-3 py-1.5">
        {/* Nav arrows */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={goToPrev}
            disabled={currentIndex <= 0}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={goToNext}
            disabled={currentIndex >= files.length - 1}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* File info */}
        <FileCode2 className="h-3 w-3 text-muted-foreground" />
        <span className="truncate text-[11px] font-medium text-foreground">{fileName}</span>
        <span className="text-[9px] text-muted-foreground uppercase">{detectLang(selectedFile)}</span>

        <span className="text-[9px] text-muted-foreground tabular-nums">
          {currentIndex + 1}/{files.length}
        </span>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setSideBySide(!sideBySide)}
            className={cn(
              'flex h-5 items-center gap-1 rounded px-1.5 text-[9px] font-medium transition-colors',
              sideBySide
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
            title={sideBySide ? 'Inline diff' : 'Side by side'}
          >
            <SplitSquareHorizontal className="h-3 w-3" />
          </button>
          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className={cn(
              'flex h-5 items-center gap-1 rounded px-1.5 text-[9px] font-medium transition-colors',
              showQuickAdd
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
            title="Add comment"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            onClick={() => markFileReviewed(selectedFile)}
            className={cn(
              'flex h-5 items-center gap-1 rounded px-2 text-[10px] font-medium transition-colors',
              currentFile.reviewed
                ? 'bg-green-500/15 text-green-400'
                : 'text-muted-foreground hover:bg-green-500/10 hover:text-green-400',
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            {currentFile.reviewed ? 'Reviewed' : 'Mark reviewed'}
          </button>
        </div>
      </div>

      {/* Quick-add comment bar */}
      {showQuickAdd && (
        <div className="shrink-0 flex items-center gap-1.5 border-b border-border/30 px-3 py-1.5 bg-surface-raised/40">
          <input
            type="number"
            min={1}
            placeholder="Line"
            value={quickLine}
            onChange={(e) => setQuickLine(e.target.value)}
            className="w-12 rounded bg-surface border border-border/40 px-1.5 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/50"
          />
          <div className="flex items-center gap-0.5 rounded bg-surface p-0.5">
            {(['p0', 'p1', 'p2'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setQuickSev(s)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[8px] font-bold uppercase transition-colors',
                  quickSev === s
                    ? s === 'p0' ? 'bg-red-500/15 text-red-400'
                      : s === 'p1' ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-blue-500/15 text-blue-400'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={quickMsg}
            onChange={(e) => setQuickMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
            placeholder="Comment..."
            className="flex-1 rounded bg-surface border border-border/40 px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/50"
          />
          <button
            onClick={handleQuickAdd}
            disabled={!quickMsg.trim()}
            className="rounded bg-accent/15 px-2 py-1 text-[9px] font-medium text-accent hover:bg-accent/25 disabled:opacity-30 transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Diff + inline comments */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Inline annotations above diff */}
        {fileComments.length > 0 && (
          <div className="shrink-0 max-h-[40%] overflow-auto border-b border-border/20 py-1">
            {fileComments.map((c) => (
              <InlineComment key={c.id} comment={c} />
            ))}
          </div>
        )}

        {/* Diff viewer */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Suspense fallback={
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }>
              <MonacoDiffEditor
                original={original}
                modified={modified}
                language={detectLang(selectedFile)}
                theme={monacoTheme}
                beforeMount={defineAllMonacoThemes}
                options={{
                  fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: 13,
                  lineHeight: 1.6,
                  readOnly: true,
                  renderSideBySide: sideBySide,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  minimap: { enabled: false },
                  padding: { top: 8 },
                  overviewRulerLanes: 0,
                  overviewRulerBorder: false,
                }}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
