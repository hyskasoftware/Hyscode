import { GitBranch, Circle } from 'lucide-react';

export function StatusBar() {
  return (
    <footer className="flex h-5 items-center justify-between bg-background px-3 text-[10px]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <GitBranch className="h-2.5 w-2.5" />
          <span>main</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Circle className="h-1.5 w-1.5 fill-success text-success" />
          <span>Ready</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <span>UTF-8</span>
        <span>TypeScript</span>
        <span>Ln 1, Col 1</span>
      </div>
    </footer>
  );
}
