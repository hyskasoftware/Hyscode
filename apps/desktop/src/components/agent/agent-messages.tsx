import { Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AgentMessages() {
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
