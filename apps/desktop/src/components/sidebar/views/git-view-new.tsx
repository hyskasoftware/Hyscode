import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GitBranch,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  MoreHorizontal,
  History,
  Archive,
} from 'lucide-react';
import { useGitStore, useEditorStore } from '../../../stores';
import { GitFileItem } from '../../git/git-file-item';
import { GitLogView } from '../../git/git-log-view';
import type { GitFile } from '../../../stores/git-store';

type PanelMode = 'changes' | 'log';

export function GitView() {
  const isGitRepo = useGitStore((s) => s.isGitRepo);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const staged = useGitStore((s) => s.staged);
  const unstaged = useGitStore((s) => s.unstaged);
  const untracked = useGitStore((s) => s.untracked);
  const conflicts = useGitStore((s) => s.conflicts);
  const ahead = useGitStore((s) => s.ahead);
  const behind = useGitStore((s) => s.behind);
  const commitMessage = useGitStore((s) => s.commitMessage);
  const isLoading = useGitStore((s) => s.isLoading);

  const refresh = useGitStore((s) => s.refresh);
  const stageFiles = useGitStore((s) => s.stageFiles);
  const stageAll = useGitStore((s) => s.stageAll);
  const unstageFiles = useGitStore((s) => s.unstageFiles);
  const discardFiles = useGitStore((s) => s.discardFiles);
  const commit = useGitStore((s) => s.commit);
  const setCommitMessage = useGitStore((s) => s.setCommitMessage);
  const initRepo = useGitStore((s) => s.initRepo);
  const stashChanges = useGitStore((s) => s.stashChanges);

  const openTab = useEditorStore((s) => s.openTab);

  const [panelMode, setPanelMode] = useState<PanelMode>('changes');
  const [showMenu, setShowMenu] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // Refresh on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim() || staged.length === 0) return;
    setIsCommitting(true);
    setCommitError(null);
    try {
      await commit();
    } catch (err: any) {
      setCommitError(err.message ?? String(err));
    } finally {
      setIsCommitting(false);
    }
  }, [commitMessage, staged.length, commit]);

  const openDiffTab = useCallback(
    (file: GitFile, isStaged: boolean) => {
      const fileName = file.path.split(/[\\/]/).pop() ?? file.path;
      openTab({
        id: `diff:${isStaged ? 'staged' : 'unstaged'}:${file.path}`,
        filePath: file.path,
        fileName: `${fileName} (${isStaged ? 'Staged' : 'Working Tree'})`,
        language: getLanguageFromPath(file.path),
        type: 'diff',
        diffProps: { filePath: file.path, staged: isStaged },
      });
    },
    [openTab],
  );

  const openFileTab = useCallback(
    (file: GitFile) => {
      const fileName = file.path.split(/[\\/]/).pop() ?? file.path;
      openTab({
        id: file.path,
        filePath: file.path,
        fileName,
        language: getLanguageFromPath(file.path),
      });
    },
    [openTab],
  );

  // Not a git repo
  if (!isGitRepo) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <GitBranch className="mb-3 h-8 w-8 opacity-30" />
        <p className="text-xs">Not a Git repository</p>
        <button
          onClick={initRepo}
          className="mt-3 rounded-md bg-accent px-3 py-1.5 text-[11px] text-white hover:bg-accent/80 transition-colors"
        >
          Initialize Repository
        </button>
      </div>
    );
  }

  if (panelMode === 'log') {
    return <GitLogView onClose={() => setPanelMode('changes')} />;
  }

  const totalChanges = staged.length + unstaged.length + untracked.length + conflicts.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3 w-3 text-accent" />
          <span className="text-[11px] font-medium text-foreground">{currentBranch}</span>
          {ahead > 0 && <span className="text-[10px] text-green-400">↑{ahead}</span>}
          {behind > 0 && <span className="text-[10px] text-yellow-400">↓{behind}</span>}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={refresh}
            className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="More actions"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
            {showMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 top-6 z-50 min-w-[140px] rounded-lg border border-border bg-background p-1 shadow-xl"
              >
                <MenuBtn
                  icon={History}
                  label="View History"
                  onClick={() => { setShowMenu(false); setPanelMode('log'); }}
                />
                <MenuBtn
                  icon={Archive}
                  label="Stash Changes"
                  onClick={async () => { setShowMenu(false); await stashChanges(); }}
                />
                <MenuBtn
                  icon={Plus}
                  label="Stage All"
                  onClick={async () => { setShowMenu(false); await stageAll(); }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commit Input */}
      <div className="border-b border-border px-2 py-1.5">
        <textarea
          ref={messageRef}
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          rows={2}
          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/40 transition-colors"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleCommit();
            }
          }}
        />
        {commitError && (
          <p className="mt-0.5 text-[10px] text-red-400">{commitError}</p>
        )}
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || staged.length === 0 || isCommitting}
          className="mt-1 w-full rounded-md bg-accent px-3 py-1 text-[11px] font-medium text-white hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isCommitting ? (
            <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
          ) : (
            `Commit${staged.length > 0 ? ` (${staged.length})` : ''}`
          )}
        </button>
      </div>

      {/* File Lists */}
      <div className="flex-1 overflow-auto">
        {totalChanges === 0 && !isLoading && (
          <div className="px-3 py-8 text-center text-[11px] text-muted-foreground">
            No changes detected
          </div>
        )}

        {conflicts.length > 0 && (
          <FileSection
            title="Merge Conflicts"
            count={conflicts.length}
            defaultOpen
          >
            {conflicts.map((f) => (
              <GitFileItem
                key={`conflict:${f.path}`}
                file={f}
                mode="conflict"
                onOpenDiff={() => openDiffTab(f, false)}
                onOpenFile={() => openFileTab(f)}
              />
            ))}
          </FileSection>
        )}

        {staged.length > 0 && (
          <FileSection
            title="Staged Changes"
            count={staged.length}
            defaultOpen
            action={
              <button
                onClick={() => unstageFiles(staged.map((f) => f.path))}
                className="flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors"
                title="Unstage All"
              >
                <Minus className="h-3 w-3" />
              </button>
            }
          >
            {staged.map((f) => (
              <GitFileItem
                key={`staged:${f.path}`}
                file={f}
                mode="staged"
                onUnstage={() => unstageFiles([f.path])}
                onOpenDiff={() => openDiffTab(f, true)}
                onOpenFile={() => openFileTab(f)}
              />
            ))}
          </FileSection>
        )}

        {unstaged.length > 0 && (
          <FileSection
            title="Changes"
            count={unstaged.length}
            defaultOpen
            action={
              <button
                onClick={() => stageFiles(unstaged.map((f) => f.path))}
                className="flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors"
                title="Stage All"
              >
                <Plus className="h-3 w-3" />
              </button>
            }
          >
            {unstaged.map((f) => (
              <GitFileItem
                key={`unstaged:${f.path}`}
                file={f}
                mode="unstaged"
                onStage={() => stageFiles([f.path])}
                onDiscard={() => discardFiles([f.path])}
                onOpenDiff={() => openDiffTab(f, false)}
                onOpenFile={() => openFileTab(f)}
              />
            ))}
          </FileSection>
        )}

        {untracked.length > 0 && (
          <FileSection
            title="Untracked"
            count={untracked.length}
            defaultOpen
            action={
              <button
                onClick={() => stageFiles(untracked.map((f) => f.path))}
                className="flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors"
                title="Stage All"
              >
                <Plus className="h-3 w-3" />
              </button>
            }
          >
            {untracked.map((f) => (
              <GitFileItem
                key={`untracked:${f.path}`}
                file={f}
                mode="untracked"
                onStage={() => stageFiles([f.path])}
                onDiscard={() => discardFiles([f.path])}
                onOpenFile={() => openFileTab(f)}
              />
            ))}
          </FileSection>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function FileSection({
  title,
  count,
  children,
  defaultOpen = true,
  action,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span>{title}</span>
        <span className="font-normal">{count}</span>
        {action && <span className="ml-auto" onClick={(e) => e.stopPropagation()}>{action}</span>}
      </button>
      {open && children}
    </div>
  );
}

function MenuBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof History;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-foreground hover:bg-surface-raised transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact',
    js: 'javascript', jsx: 'javascriptreact',
    json: 'json', md: 'markdown', css: 'css', html: 'html',
    rs: 'rust', py: 'python', toml: 'toml', yaml: 'yaml',
    yml: 'yaml', sql: 'sql', sh: 'shell',
  };
  return map[ext] || 'plaintext';
}
