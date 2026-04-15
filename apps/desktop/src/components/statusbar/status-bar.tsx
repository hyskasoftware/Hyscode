import { useRef, useState } from 'react';
import { GitBranch, Circle, Blocks, Zap } from 'lucide-react';
import { useGitStore, useEditorStore, useExtensionStore } from '../../stores';
import { useLspStore } from '../../stores/lsp-store';
import { detectLanguage } from '../../lib/lsp-bridge';
import { BranchPicker } from '../git/branch-picker';

export function StatusBar() {
  const isGitRepo = useGitStore((s) => s.isGitRepo);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const ahead = useGitStore((s) => s.ahead);
  const behind = useGitStore((s) => s.behind);
  const staged = useGitStore((s) => s.staged);
  const unstaged = useGitStore((s) => s.unstaged);
  const untracked = useGitStore((s) => s.untracked);

  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const statusBarItems = useExtensionStore((s) => s.contributions.statusBarItems);
  const extensionCount = useExtensionStore((s) => s.extensions.filter((e) => e.enabled).length);

  const serverStatuses = useLspStore((s) => s.serverStatuses);
  const activeLang = activeTab?.filePath ? detectLanguage(activeTab.filePath) : undefined;
  const lspInfo = activeLang ? serverStatuses[activeLang] : undefined;

  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const branchRef = useRef<HTMLButtonElement>(null);

  const totalChanges = staged.length + unstaged.length + untracked.length;

  return (
    <>
      <footer className="flex h-5 items-center justify-between bg-background px-3 text-[10px]">
        <div className="flex items-center gap-3">
          {isGitRepo ? (
            <button
              ref={branchRef}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setBranchPickerOpen(!branchPickerOpen)}
            >
              <GitBranch className="h-2.5 w-2.5" />
              <span>{currentBranch || 'HEAD'}</span>
              {ahead > 0 && <span className="text-green-400">↑{ahead}</span>}
              {behind > 0 && <span className="text-yellow-400">↓{behind}</span>}
              {totalChanges > 0 && (
                <span className="text-accent">{totalChanges}⨉</span>
              )}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <GitBranch className="h-2.5 w-2.5" />
              <span>No repo</span>
            </span>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Circle className="h-1.5 w-1.5 fill-success text-success" />
            <span>Ready</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          {/* Extension status bar items */}
          {statusBarItems.map((item) => (
            <span key={`${item.extensionName}-${item.id}`} className="flex items-center gap-1">
              {item.text}
            </span>
          ))}
          {extensionCount > 0 && (
            <span className="flex items-center gap-1" title={`${extensionCount} extension(s) active`}>
              <Blocks className="h-2.5 w-2.5" />
              <span>{extensionCount}</span>
            </span>
          )}
          <span>UTF-8</span>
          <span>{activeTab?.language ?? 'Plain Text'}</span>
          {lspInfo && (
            <span
              className={`flex items-center gap-1 ${
                lspInfo.status === 'ready'
                  ? 'text-success'
                  : lspInfo.status === 'starting'
                    ? 'text-yellow-400'
                    : lspInfo.status === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
              }`}
              title={`${lspInfo.displayName}: ${lspInfo.status}`}
            >
              <Zap className="h-2.5 w-2.5" />
              <span>{lspInfo.status === 'ready' ? 'LSP' : lspInfo.status}</span>
            </span>
          )}
        </div>
      </footer>
      <BranchPicker
        open={branchPickerOpen}
        onClose={() => setBranchPickerOpen(false)}
        anchorRef={branchRef as React.RefObject<HTMLElement>}
      />
    </>
  );
}
