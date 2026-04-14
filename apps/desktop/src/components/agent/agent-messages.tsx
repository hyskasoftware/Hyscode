import { Sparkles, User, Bot, ChevronDown, ChevronRight, Bug, Copy, Check } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStore } from '@/stores/agent-store';
import { ToolCallGroup } from './tool-call-card';
import { ApprovalDialog } from './approval-dialog';
import { cn } from '@/lib/utils';

// ─── Code Block with Copy Button ─────────────────────────────────────────────

function CodeBlock({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const handleCopy = useCallback(() => {
    const text = codeRef.current?.textContent ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  // Only wrap in fancy block if it's a fenced code block (has language class)
  const isInline = !className;
  if (isInline) {
    return (
      <code className="rounded-[4px] bg-[#1e1e1e] px-1.5 py-0.5 text-[11px] font-mono text-[#e8912d]" {...props}>
        {children}
      </code>
    );
  }

  const lang = className?.replace('hljs language-', '').replace('language-', '') ?? '';

  return (
    <div className="group/code relative my-2 overflow-hidden rounded-md border border-border/40 bg-[#0d1117]">
      {/* Header bar */}
      <div className="flex h-7 items-center justify-between border-b border-border/30 bg-[#161b22] px-3">
        <span className="text-[10px] font-medium text-muted-foreground">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[11.5px] leading-[1.6]">
        <code ref={codeRef} className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="agent-markdown text-[12.5px] leading-[1.7] text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: CodeBlock as any,
          pre: ({ children }) => <>{children}</>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-foreground/85">{children}</li>,
          h1: ({ children }) => <h1 className="mb-2 mt-4 text-[15px] font-semibold text-foreground">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-[14px] font-semibold text-foreground">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2.5 text-[13px] font-semibold text-foreground">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-accent/40 pl-3 text-muted-foreground italic">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-md border border-border/40">
              <table className="w-full text-[11px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-border/40 bg-surface-raised px-3 py-1.5 text-left font-medium text-foreground">{children}</th>,
          td: ({ children }) => <td className="border-b border-border/20 px-3 py-1.5 text-foreground/80">{children}</td>,
          hr: () => <hr className="my-3 border-border/30" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Streaming Cursor ─────────────────────────────────────────────────────────

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
      </div>
      <span className="text-[11px] text-muted-foreground">Thinking...</span>
    </div>
  );
}

// ─── Agent Messages ───────────────────────────────────────────────────────────

export function AgentMessages() {
  const messages = useAgentStore((s) => s.messages);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const debugLines = useAgentStore((s) => s.debugLines);
  const debugExpanded = useAgentStore((s) => s.debugExpanded);
  const setDebugExpanded = useAgentStore((s) => s.setDebugExpanded);
  const bottomRef = useRef<HTMLDivElement>(null);
  const debugBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, pendingApprovals]);

  // Auto-scroll debug panel when expanded
  useEffect(() => {
    if (debugExpanded) {
      debugBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [debugLines, debugExpanded]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex min-h-[200px] items-center justify-center p-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised">
                <Sparkles className="h-5 w-5 text-accent opacity-60" />
              </div>
              <p className="text-xs font-medium">How can I help?</p>
              <p className="max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
                Ask me to write code, explain concepts, review changes, or build features.
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-0 px-4 py-3">
          {messages.map((msg, idx) => {
            // Check if previous message was also from the same role (consecutive assistant messages)
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const isConsecutiveAssistant =
              msg.role === 'assistant' && prevMsg?.role === 'assistant';

            return (
              <div key={msg.id} className="group/msg">
                {/* User message */}
                {msg.role === 'user' && (
                  <div className="mb-3 mt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-3 w-3 text-foreground/70" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground">You</span>
                    </div>
                    <div className="pl-7">
                      <MarkdownContent content={msg.content} />
                    </div>
                  </div>
                )}

                {/* Assistant message */}
                {msg.role === 'assistant' && (
                  <div className={cn('mb-1', isConsecutiveAssistant ? '' : 'mt-1')}>
                    {/* Only show header for the FIRST assistant message in a sequence */}
                    {!isConsecutiveAssistant && (
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
                          <Bot className="h-3 w-3 text-accent" />
                        </div>
                        <span className="text-[11px] font-semibold text-foreground">HysCode</span>
                      </div>
                    )}
                    <div className="pl-7">
                      {/* Markdown content */}
                      {msg.content ? (
                        <MarkdownContent content={msg.content} />
                      ) : isStreaming && idx === messages.length - 1 ? (
                        <StreamingIndicator />
                      ) : null}

                      {/* Tool calls — collapsed group between text turns */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <ToolCallGroup toolCalls={msg.toolCalls} />
                      )}
                    </div>
                  </div>
                )}

                {/* Separator — only between user↔assistant boundaries */}
                {idx < messages.length - 1 &&
                  msg.role === 'user' &&
                  messages[idx + 1].role === 'assistant' ? null : // no separator between user→assistant
                  idx < messages.length - 1 &&
                  msg.role === 'assistant' &&
                  messages[idx + 1]?.role === 'user' ? (
                    <div className="border-b border-border/20 my-2" />
                  ) : null}
              </div>
            );
          })}

          {/* Pending approvals  */}
          {pendingApprovals.map((approval) => (
            <ApprovalDialog key={approval.id} approval={approval} />
          ))}

          {/* Debug log panel */}
          {debugLines.length > 0 && (
            <div className="mt-3 rounded-md border border-border/30 bg-[#0d1117]/60 text-[10px] font-mono">
              <button
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setDebugExpanded(!debugExpanded)}
              >
                {debugExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                <Bug className="h-3 w-3 shrink-0 text-yellow-500/60" />
                <span className="text-yellow-500/60">Debug</span>
                <span className="ml-auto rounded-full bg-muted/50 px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground">
                  {debugLines.length}
                </span>
              </button>
              {debugExpanded && (
                <div className="max-h-[200px] overflow-y-auto border-t border-border/20 px-2.5 py-1.5">
                  {debugLines.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        'leading-5',
                        line.includes('ERRO') ? 'text-red-400' : 'text-muted-foreground/70',
                      )}
                    >
                      {line}
                    </div>
                  ))}
                  <div ref={debugBottomRef} />
                </div>
              )}
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
