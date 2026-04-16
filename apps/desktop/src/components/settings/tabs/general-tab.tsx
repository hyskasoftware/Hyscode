import { useSettingsStore } from '../../../stores';
import type { ApprovalMode } from '../../../stores/settings-store';

export function GeneralTab() {
  const store = useSettingsStore();

  return (
    <div className="flex flex-col gap-6">
      <Section title="Application">
        <Row
          label="Confirm Before Close"
          description="Show a confirmation dialog when closing the application"
        >
          <Toggle
            checked={store.confirmOnClose}
            onChange={(v) => store.set('confirmOnClose', v)}
          />
        </Row>
        <Row
          label="Show Welcome on Startup"
          description="Display welcome page when no project is open"
        >
          <Toggle
            checked={store.showWelcomeOnStartup}
            onChange={(v) => store.set('showWelcomeOnStartup', v)}
          />
        </Row>
        <Row
          label="Reduced Motion"
          description="Minimize animations across the application"
        >
          <Toggle
            checked={store.reducedMotion}
            onChange={(v) => store.set('reducedMotion', v)}
          />
        </Row>
      </Section>

      <Section title="Agent">
        <Row label="Approval Mode">
          <SelectInput<ApprovalMode>
            value={store.approvalMode}
            onChange={(v) => store.set('approvalMode', v)}
            options={[
              { value: 'manual',        label: 'Manual – review every call' },
              { value: 'smart',         label: 'Smart – auto-approve safe tools' },
              { value: 'session-trust', label: 'Session Trust – approve once per tool' },
              { value: 'notify',        label: 'Notify Only – auto-approve, log all' },
              { value: 'yolo',          label: 'Auto-approve – approve everything' },
              { value: 'custom',        label: 'Custom Rules – per-category config' },
            ]}
          />
        </Row>
        <Row label="Max Iterations">
          <NumberInput
            value={store.maxIterations}
            onChange={(v) => store.set('maxIterations', v)}
            min={1}
            max={100}
          />
        </Row>
        <Row label="Temperature">
          <NumberInput
            value={store.temperature}
            onChange={(v) => store.set('temperature', v)}
            min={0}
            max={2}
            step={0.1}
          />
        </Row>
        <Row label="Max Output Tokens">
          <NumberInput
            value={store.maxTokens}
            onChange={(v) => store.set('maxTokens', v)}
            min={256}
            max={32768}
            step={256}
          />
        </Row>
      </Section>
    </div>
  );
}

// ── Shared atoms ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-raised px-3 py-2.5">
      <div className="flex flex-col">
        <span className="text-[12px] text-foreground">{label}</span>
        {description && (
          <span className="text-[10px] text-muted-foreground">{description}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-accent"
      />
      <span className="w-12 text-right text-[11px] tabular-nums text-muted-foreground">
        {step < 1 ? value.toFixed(1) : value}
      </span>
    </div>
  );
}

function SelectInput<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-7 rounded-md bg-muted px-2 text-[12px] text-foreground outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-foreground transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
