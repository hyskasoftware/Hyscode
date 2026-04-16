import { Clock } from 'lucide-react';

export function ReviewComingSoon() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
          <Clock className="h-8 w-8 text-accent" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold text-foreground">Em breve</h2>
          <p className="max-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
            O modo de review ainda está em desenvolvimento.
            Fique ligado para novidades!
          </p>
        </div>
      </div>
    </div>
  );
}
