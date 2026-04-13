import { ShieldAlert, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PendingApproval } from '@/stores/agent-store';
import { HarnessBridge } from '@/lib/harness-bridge';

interface ApprovalDialogProps {
  approval: PendingApproval;
}

export function ApprovalDialog({ approval }: ApprovalDialogProps) {
  const handleApprove = () => {
    HarnessBridge.get().resolveApproval(approval.id, true);
  };

  const handleDeny = () => {
    HarnessBridge.get().resolveApproval(approval.id, false);
  };

  return (
    <div className="my-2 rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-yellow-400" />
        <span className="text-[11px] font-semibold text-yellow-300">
          Tool requires approval
        </span>
      </div>

      {/* Description */}
      <p className="mb-2 text-[11px] text-foreground/80">{approval.description}</p>

      {/* Tool name & input */}
      <div className="mb-3 rounded bg-surface-raised p-2">
        <span className="text-[10px] font-medium text-muted-foreground">{approval.toolName}</span>
        <pre className="mt-1 overflow-x-auto text-[10px] font-mono text-foreground/70">
          {JSON.stringify(approval.input, null, 2)}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleApprove}
          className="h-7 gap-1.5 bg-green-600 px-3 text-[11px] hover:bg-green-700"
        >
          <Check className="h-3 w-3" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDeny}
          className="h-7 gap-1.5 px-3 text-[11px] text-red-400 hover:bg-red-950/30 hover:text-red-300"
        >
          <X className="h-3 w-3" />
          Deny
        </Button>
      </div>
    </div>
  );
}
