import { Suspense, lazy } from 'react';
import { Check, Undo2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HarnessBridge } from '@/lib/harness-bridge';
import type { PendingFileChange } from '@/stores/agent-store';

const MonacoDiffEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.DiffEditor })),
);

function DiffLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  rs: 'rust',
  py: 'python',
  toml: 'toml',
  yaml: 'yaml',
  yml: 'yaml',
  sql: 'sql',
  sh: 'shell',
};

interface AgentDiffViewerProps {
  change: PendingFileChange;
}

export function AgentDiffViewer({ change }: AgentDiffViewerProps) {
  const ext = change.filePath.split('.').pop()?.toLowerCase() ?? '';
  const language = LANG_MAP[ext] || 'plaintext';

  const handleKeep = () => {
    HarnessBridge.get().resolveFileChange(change.id, true);
  };

  const handleUndo = () => {
    HarnessBridge.get().resolveFileChange(change.id, false);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Action bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          Agent changed this file via <code className="text-[10px]">{change.toolName}</code>
        </span>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="xs" onClick={handleUndo}>
            <Undo2 className="mr-1 h-3 w-3" />
            Undo
          </Button>
          <Button variant="default" size="xs" onClick={handleKeep}>
            <Check className="mr-1 h-3 w-3" />
            Keep
          </Button>
        </div>
      </div>

      {/* Inline diff */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<DiffLoading />}>
          <MonacoDiffEditor
            original={change.originalContent ?? ''}
            modified={change.newContent}
            language={language}
            theme="hyscode-dark"
            options={{
              fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
              fontSize: 14,
              lineHeight: 1.6,
              readOnly: true,
              renderSideBySide: false,
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              minimap: { enabled: false },
              padding: { top: 8 },
              overviewRulerLanes: 0,
              overviewRulerBorder: false,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
