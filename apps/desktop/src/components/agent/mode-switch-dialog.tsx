import { ArrowRight, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAgentStore } from '@/stores/agent-store';
import { HarnessBridge } from '@/lib/harness-bridge';
import type { ModeSwitchRequest } from '@hyscode/agent-harness';

// Agent mode display config
const MODE_DISPLAY: Record<string, { label: string; color: string }> = {
  chat: { label: 'Chat', color: 'text-blue-400' },
  build: { label: 'Build', color: 'text-accent' },
  review: { label: 'Review', color: 'text-purple-400' },
  debug: { label: 'Debug', color: 'text-red-400' },
  plan: { label: 'Plan', color: 'text-amber-400' },
};

export function ModeSwitchDialog() {
  const pendingModeSwitch = useAgentStore((s) => s.pendingModeSwitch);
  const [contextOpen, setContextOpen] = useState(false);

  if (!pendingModeSwitch) return null;

  const req: ModeSwitchRequest = pendingModeSwitch;
  const from = MODE_DISPLAY[req.fromMode] ?? { label: req.fromMode, color: 'text-foreground' };
  const to = MODE_DISPLAY[req.toMode] ?? { label: req.toMode, color: 'text-foreground' };

  const handleApprove = () => {
    HarnessBridge.get().resolveModeSwitch(true);
  };

  const handleDeny = () => {
    HarnessBridge.get().resolveModeSwitch(false);
  };

  return (
    <div className="agent-fade-in my-2.5 overflow-hidden rounded-lg border border-cyan-500/25 bg-cyan-500/[0.04]">
      {/* Accent bar */}
      <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500/40 via-cyan-400/60 to-cyan-500/40" />

      <div className="p-3.5">
        {/* Header */}
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10">
            <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-cyan-300">
              Agent Delegation
            </span>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={from.color}>{from.label}</span>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40" />
              <span className={to.color}>{to.label}</span>
            </div>
          </div>
        </div>

        {/* Reason */}
        <p className="mb-3 text-[11.5px] leading-relaxed text-foreground/75">{req.reason}</p>

        {/* Collapsible context summary */}
        {req.contextSummary && (
          <>
            <button
              onClick={() => setContextOpen(!contextOpen)}
              className="mb-3 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground/50 transition-colors hover:bg-white/[0.02] hover:text-muted-foreground/80"
            >
              {contextOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
              <span>View handoff context</span>
            </button>

            {contextOpen && (
              <div className="agent-fade-in mb-3 overflow-hidden rounded-md border border-border/15 bg-surface-raised/40">
                <pre className="overflow-x-auto whitespace-pre-wrap p-2.5 text-[10px] font-mono leading-relaxed text-foreground/60">
                  {req.contextSummary}
                </pre>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            className="h-7 gap-1.5 rounded-md bg-cyan-600 px-3.5 text-[11px] font-medium shadow-sm shadow-cyan-900/20 hover:bg-cyan-500 transition-colors"
          >
            <Check className="h-3 w-3" />
            Switch to {to.label}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeny}
            className="h-7 gap-1.5 rounded-md px-3.5 text-[11px] text-red-400/80 hover:bg-red-950/20 hover:text-red-300 transition-colors"
          >
            <X className="h-3 w-3" />
            Stay in {from.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
