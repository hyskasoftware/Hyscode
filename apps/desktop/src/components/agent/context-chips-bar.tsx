import { FileCode, X } from 'lucide-react';
import { useAgentStore } from '@/stores/agent-store';

export function ContextChipsBar() {
  const contextFiles = useAgentStore((s) => s.contextFiles);
  const removeContextFile = useAgentStore((s) => s.removeContextFile);

  if (contextFiles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-1.5">
      <span className="text-[10px] text-muted-foreground">Context:</span>
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
    </div>
  );
}
