import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentStore } from '@/stores/agent-store';
import { HarnessBridge } from '@/lib/harness-bridge';

export function PendingChangesBar() {
  const pendingCount = useAgentStore(
    (s) => s.pendingFileChanges.filter((c) => c.status === 'pending').length,
  );

  if (pendingCount === 0) return null;

  const handleAcceptAll = () => {
    HarnessBridge.get().resolveAllFileChanges(true);
  };

  const handleRejectAll = () => {
    HarnessBridge.get().resolveAllFileChanges(false);
  };

  return (
    <div className="flex items-center justify-between border-t border-border bg-muted/60 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">
        <strong className="text-foreground">{pendingCount}</strong> pending agent{' '}
        {pendingCount === 1 ? 'change' : 'changes'}
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="destructive" size="xs" onClick={handleRejectAll}>
          <X className="mr-1 h-3 w-3" />
          Reject All
        </Button>
        <Button variant="default" size="xs" onClick={handleAcceptAll}>
          <Check className="mr-1 h-3 w-3" />
          Accept All
        </Button>
      </div>
    </div>
  );
}
