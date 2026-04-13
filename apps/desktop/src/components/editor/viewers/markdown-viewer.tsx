import { Suspense, lazy, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Code, Eye, Loader2 } from 'lucide-react';
import 'highlight.js/styles/github-dark.css';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface MarkdownViewerProps {
  content: string;
  mode: 'preview' | 'code';
  onModeChange: (mode: 'preview' | 'code') => void;
  onChange?: (value: string) => void;
  language?: string;
}

export function MarkdownViewer({
  content,
  mode,
  onModeChange,
  onChange,
  language,
}: MarkdownViewerProps) {
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) onChange?.(value);
    },
    [onChange],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Mode selector bar */}
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/40 bg-surface-raised px-3">
        <span className="mr-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Markdown
        </span>
        <button
          onClick={() => onModeChange('preview')}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            mode === 'preview'
              ? 'bg-accent/20 text-accent'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Eye className="h-3 w-3" />
          Preview
        </button>
        <button
          onClick={() => onModeChange('code')}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            mode === 'code'
              ? 'bg-accent/20 text-accent'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Code className="h-3 w-3" />
          Code
        </button>
      </div>

      {/* Content area */}
      {mode === 'preview' ? (
        <div className="flex-1 overflow-auto p-6">
          <article className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-accent prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[12px] prose-code:text-accent prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-border/30 prose-blockquote:border-accent/50 prose-blockquote:text-muted-foreground prose-th:text-foreground prose-td:text-foreground/80 prose-hr:border-border/40 prose-img:rounded-lg">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {content}
            </ReactMarkdown>
          </article>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <MonacoEditor
              language={language ?? 'markdown'}
              value={content}
              onChange={handleEditorChange}
              theme="hyscode-dark"
              options={{
                fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 14,
                lineHeight: 1.6,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                wordWrap: 'on',
                tabSize: 2,
                padding: { top: 8 },
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
