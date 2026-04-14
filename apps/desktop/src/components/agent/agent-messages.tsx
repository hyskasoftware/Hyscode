import { Sparkles, User, Bot, ChevronDown, ChevronRight, Bug, Copy, Check, Brain, AlertCircle } from 'lucide-react';
import { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStore } from '@/stores/agent-store';
import { ToolCallGroup } from './tool-call-card';
import { ApprovalDialog } from './approval-dialog';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/stores/agent-store';

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

// Stable components object — allocated once, never recreated
const MARKDOWN_COMPONENTS = {
  code: CodeBlock as any,
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  p: ({ children }: { children?: React.ReactNode }) => <p className="my-1.5">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-1.5 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="text-foreground/85">{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 mt-4 text-[15px] font-semibold text-foreground">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-1.5 mt-3 text-[14px] font-semibold text-foreground">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2.5 text-[13px] font-semibold text-foreground">{children}</h3>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-accent/40 pl-3 text-muted-foreground italic">{children}</blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-md border border-border/40">
      <table className="w-full text-[11px]">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => <th className="border-b border-border/40 bg-surface-raised px-3 py-1.5 text-left font-medium text-foreground">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="border-b border-border/20 px-3 py-1.5 text-foreground/80">{children}</td>,
  hr: () => <hr className="my-3 border-border/30" />,
};

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];

const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="agent-markdown text-[12.5px] leading-[1.7] text-foreground/90">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={MARKDOWN_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

// ─── Thinking Block (collapsible) ─────────────────────────────────────────────

const ThinkingBlock = memo(function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const lineCount = useMemo(() => content.split('\n').length, [content]);

  return (
    <div className="my-1.5 rounded-md border border-border/30 bg-[#161b22]/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <Brain className="h-3 w-3 shrink-0 text-purple-400/70" />
        <span className="text-[10px] font-medium text-purple-400/70">Thinking</span>
        {isStreaming && (
          <span className="ml-1 flex items-center gap-0.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-purple-400/60" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-purple-400/60 [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-purple-400/60 [animation-delay:300ms]" />
          </span>
        )}
        {!isStreaming && (
          <span className="ml-auto text-[9px] tabular-nums text-muted-foreground/50">
            {lineCount} lines
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-border/20 px-3 py-2 max-h-[300px] overflow-y-auto">
          <pre className="whitespace-pre-wrap text-[11px] leading-[1.6] text-muted-foreground/70 font-mono">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
});

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

// ─── Collapsible reasoning text (shown only when message also has tool calls) ──

const ReasoningText = memo(function ReasoningText({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
      >
        {open ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        <span>Reasoning</span>
      </button>
      {open && (
        <div className="mt-1 max-h-[160px] overflow-y-auto rounded border border-border/20 bg-[#0d1117]/40 px-2.5 py-1.5">
          <div className="text-[11px] leading-relaxed text-muted-foreground/60">
            {content}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Error Message ────────────────────────────────────────────────────────────

const ErrorMessage = memo(function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2.5">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
      <p className="text-[12px] leading-relaxed text-red-300/90">{message}</p>
    </div>
  );
});

// ─── Memoized Message Item ────────────────────────────────────────────────────

interface MessageItemProps {
  msg: ChatMessage;
  isConsecutiveAssistant: boolean;
  showSeparator: boolean;
  /** true only for the very last message when the agent is streaming */
  isActivelyStreaming: boolean;
}

const MessageItem = memo(function MessageItem({
  msg,
  isConsecutiveAssistant,
  showSeparator,
  isActivelyStreaming,
}: MessageItemProps) {
  const hasToolCalls = (msg.toolCalls?.length ?? 0) > 0;

  return (
    <div className="group/msg">
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
          {!isConsecutiveAssistant && (
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
                <Bot className="h-3 w-3 text-accent" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">HysCode</span>
            </div>
          )}
          <div className="pl-7">
            {/* Thinking block (collapsible) */}
            {msg.thinking && (
              <ThinkingBlock
                content={msg.thinking}
                isStreaming={isActivelyStreaming && !msg.content}
              />
            )}

            {hasToolCalls ? (
              /* Mid-loop message: show tool calls prominently, hide text behind toggle */
              <>
                {msg.content && <ReasoningText content={msg.content} />}
                <ToolCallGroup toolCalls={msg.toolCalls!} />
              </>
            ) : msg.isError ? (
              <ErrorMessage message={msg.content} />
            ) : msg.content ? (
              /* Final response: full markdown */
              <MarkdownContent content={msg.content} />
            ) : isActivelyStreaming ? (
              <StreamingIndicator />
            ) : null}
          </div>
        </div>
      )}

      {showSeparator && <div className="border-b border-border/20 my-2" />}
    </div>
  );
});

// ─── Debug Panel ──────────────────────────────────────────────────────────────

const DebugPanel = memo(function DebugPanel({
  lines,
  expanded,
  onToggle,
}: {
  lines: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const debugBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) {
      debugBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines.length, expanded]);

  if (lines.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-border/30 bg-[#0d1117]/60 text-[10px] font-mono">
      <button
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-muted-foreground hover:text-foreground transition-colors"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <Bug className="h-3 w-3 shrink-0 text-yellow-500/60" />
        <span className="text-yellow-500/60">Debug</span>
        <span className="ml-auto rounded-full bg-muted/50 px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground">
          {lines.length}
        </span>
      </button>
      {expanded && (
        <div className="max-h-[200px] overflow-y-auto border-t border-border/20 px-2.5 py-1.5">
          {lines.map((line, i) => (
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
  );
});

// ─── Agent Messages ───────────────────────────────────────────────────────────

export function AgentMessages() {
  // Split selectors: messageCount + lastMessageId for knowing WHEN to re-render the list,
  // but individual messages are read per-item via stable references.
  const messages = useAgentStore((s) => s.messages);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const debugLines = useAgentStore((s) => s.debugLines);
  const debugExpanded = useAgentStore((s) => s.debugExpanded);
  const setDebugExpanded = useAgentStore((s) => s.setDebugExpanded);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleToggleDebug = useCallback(() => {
    setDebugExpanded(!debugExpanded);
  }, [debugExpanded, setDebugExpanded]);

  // Auto-scroll on new messages (throttled to avoid jank during fast streaming)
  const lastScrollRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    // Throttle scroll to at most once per 100ms during streaming
    if (isStreaming && now - lastScrollRef.current < 100) return;
    lastScrollRef.current = now;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming, pendingApprovals.length]);

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
        <div className="flex flex-col gap-0 px-4 py-3 max-w-[720px] mx-auto w-full">
          {messages.map((msg, idx) => {
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
            const isConsecutiveAssistant =
              msg.role === 'assistant' && prevMsg?.role === 'assistant';
            const showSeparator =
              msg.role === 'assistant' && nextMsg?.role === 'user';
            const isLast = idx === messages.length - 1;

            return (
              <MessageItem
                key={msg.id}
                msg={msg}
                isConsecutiveAssistant={isConsecutiveAssistant}
                showSeparator={showSeparator}
                isActivelyStreaming={isStreaming && isLast}
              />
            );
          })}

          {/* Pending approvals */}
          {pendingApprovals.map((approval) => (
            <ApprovalDialog key={approval.id} approval={approval} />
          ))}

          {/* Debug log panel */}
          <DebugPanel
            lines={debugLines}
            expanded={debugExpanded}
            onToggle={handleToggleDebug}
          />

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
