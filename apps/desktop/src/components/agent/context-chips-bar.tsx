import { FileCode, Brain, X } from 'lucide-react';
import { useAgentStore } from '@/stores/agent-store';

function relevanceColor(relevance: number): string {
  if (relevance >= 0.8) return 'text-green-400';
  if (relevance >= 0.5) return 'text-blue-400';
  return 'text-muted-foreground';
}

export function ContextChipsBar() {
  const contextFiles = useAgentStore((s) => s.contextFiles);
  const removeContextFile = useAgentStore((s) => s.removeContextFile);
  const gatheredContext = useAgentStore((s) => s.gatheredContext);

  if (contextFiles.length === 0 && gatheredContext.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-1.5">
      {contextFiles.length > 0 && (
        <>
          <span className="text-[10px] text-muted-foreground">Attached:</span>
          {contextFiles.map((file) => {
            const basename = file.split(/[\\/]/).pop() ?? file;
            return (
              <span
                key={file}
                className="flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-foreground"
                title={file}
              >
                <FileCode className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="max-w-[120px] truncate">{basename}</span>
                <button
                  onClick={() => removeContextFile(file)}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-2 w-2" />
                </button>
              </span>
            );
          })}
        </>
      )}
      {gatheredContext.length > 0 && (
        <>
          <span className="text-[10px] text-muted-foreground ml-1">Gathered:</span>
          {gatheredContext.map((entry) => {
            const basename = entry.path.split(/[\\/]/).pop() ?? entry.path;
            return (
              <span
                key={entry.path}
                className="flex items-center gap-1 rounded-full bg-surface-raised/60 px-2 py-0.5 text-[10px] text-foreground"
                title={`${entry.path} (relevance: ${entry.relevance.toFixed(2)}, ~${entry.tokenEstimate} tokens)`}
              >
                <Brain className={`h-2.5 w-2.5 ${relevanceColor(entry.relevance)}`} />
                <span className="max-w-[120px] truncate">{basename}</span>
              </span>
            );
          })}
        </>
      )}
    </div>
  );
}
