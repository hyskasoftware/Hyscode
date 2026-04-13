import { Sparkles, User, Bot, Loader2 } from 'lucide-react';
import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStore } from '@/stores/agent-store';
import { ToolCallCard } from './tool-call-card';
import { ApprovalDialog } from './approval-dialog';
import { cn } from '@/lib/utils';

export function AgentMessages() {
  const messages = useAgentStore((s) => s.messages);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, pendingApprovals]);

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
        <div className="flex flex-col gap-1 p-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-2.5',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {/* Avatar (assistant only) */}
              {msg.role === 'assistant' && (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10">
                  <Bot className="h-3.5 w-3.5 text-accent" />
                </div>
              )}

              {/* Bubble */}
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-accent/15 text-foreground'
                    : 'bg-surface-raised text-foreground',
                )}
              >
                {/* Markdown content */}
                {msg.content ? (
                  <div className="prose-sm prose-invert max-w-none [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-background [&_pre]:p-2 [&_pre]:text-[11px] [&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : isStreaming && msg.role === 'assistant' ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-accent" />
                    <span className="text-[11px] text-muted-foreground">Thinking...</span>
                  </div>
                ) : null}

                {/* Tool calls */}
                {msg.toolCalls?.map((tc) => (
                  <ToolCallCard key={tc.id} toolCall={tc} />
                ))}
              </div>

              {/* Avatar (user only) */}
              {msg.role === 'user' && (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                  <User className="h-3.5 w-3.5 text-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Pending approvals  */}
          {pendingApprovals.map((approval) => (
            <ApprovalDialog key={approval.id} approval={approval} />
          ))}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
