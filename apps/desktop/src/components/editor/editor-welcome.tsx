import { Code2 } from 'lucide-react';

export function EditorWelcome() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <Code2 className="h-12 w-12 opacity-15" />
        <p className="text-sm font-light tracking-tight text-foreground">HysCode</p>
        <p className="text-[11px] opacity-50">
          Open a file or start a conversation with the agent
        </p>
        <div className="mt-4 flex flex-col gap-1.5 text-[11px] text-muted-foreground">
          <kbd className="rounded-md border border-border px-2 py-0.5">
            Ctrl+K Ctrl+O — Open Folder
          </kbd>
          <kbd className="rounded-md border border-border px-2 py-0.5">
            Ctrl+L — Focus Agent
          </kbd>
          <kbd className="rounded-md border border-border px-2 py-0.5">
            Ctrl+P — Go to File
          </kbd>
        </div>
      </div>
    </div>
  );
}
