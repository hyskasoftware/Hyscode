import { useEffect } from 'react';
import { GitCommit, Clock, User } from 'lucide-react';
import { useGitStore } from '../../stores';

function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

interface GitLogViewProps {
  onClose?: () => void;
}

export function GitLogView({ onClose }: GitLogViewProps) {
  const log = useGitStore((s) => s.log);
  const fetchLog = useGitStore((s) => s.fetchLog);

  useEffect(() => {
    fetchLog(100);
  }, [fetchLog]);

  if (log.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <GitCommit className="mb-2 h-6 w-6 opacity-30" />
        <p className="text-[11px]">No commits yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-[11px] font-medium text-foreground">Commit History</span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {log.map((commit) => (
          <div
            key={commit.hash}
            className="border-b border-border/50 px-2 py-1.5 hover:bg-surface-raised transition-colors cursor-default"
          >
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 rounded bg-accent/10 px-1 py-0.5 font-mono text-[10px] text-accent">
                {commit.short_hash}
              </span>
              <span className="truncate text-[11px] text-foreground">
                {commit.message.split('\n')[0]}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <User className="h-2.5 w-2.5" />
                {commit.author}
              </span>
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {formatRelativeTime(commit.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
