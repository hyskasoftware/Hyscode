import { ShieldAlert, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { PendingApproval } from '@/stores/agent-store';
import { HarnessBridge } from '@/lib/harness-bridge';

interface ApprovalDialogProps {
  approval: PendingApproval;
}

export function ApprovalDialog({ approval }: ApprovalDialogProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const handleApprove = () => {
    HarnessBridge.get().resolveApproval(approval.id, true);
  };

  const handleDeny = () => {
    HarnessBridge.get().resolveApproval(approval.id, false);
  };

  return (
    <div className="agent-fade-in my-2.5 overflow-hidden rounded-lg border border-yellow-500/25 bg-yellow-500/[0.04]">
      {/* Accent bar */}
      <div className="h-[2px] w-full bg-gradient-to-r from-yellow-500/40 via-yellow-400/60 to-yellow-500/40" />

      <div className="p-3.5">
        {/* Header */}
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-500/10">
            <ShieldAlert className="h-3.5 w-3.5 text-yellow-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-yellow-300">
              Approval Required
            </span>
            <span className="text-[10px] text-yellow-400/50">{approval.toolName}</span>
          </div>
        </div>

        {/* Description */}
        <p className="mb-3 text-[11.5px] leading-relaxed text-foreground/75">{approval.description}</p>

        {/* Collapsible details */}
        <button
          onClick={() => setDetailOpen(!detailOpen)}
          className="mb-3 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground/50 transition-colors hover:bg-white/[0.02] hover:text-muted-foreground/80"
        >
          {detailOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          <span>View parameters</span>
        </button>

        {detailOpen && (
          <div className="agent-fade-in mb-3 overflow-hidden rounded-md border border-border/15 bg-surface-raised/40">
            <pre className="overflow-x-auto p-2.5 text-[10px] font-mono leading-relaxed text-foreground/60">
              {JSON.stringify(approval.input, null, 2)}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            className="h-7 gap-1.5 rounded-md bg-green-600 px-3.5 text-[11px] font-medium shadow-sm shadow-green-900/20 hover:bg-green-500 transition-colors"
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeny}
            className="h-7 gap-1.5 rounded-md px-3.5 text-[11px] text-red-400/80 hover:bg-red-950/20 hover:text-red-300 transition-colors"
          >
            <X className="h-3 w-3" />
            Deny
          </Button>
        </div>
      </div>
    </div>
  );
}
