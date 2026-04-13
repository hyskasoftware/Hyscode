import { useSettingsStore } from '../../../stores';

export function GitTab() {
  const store = useSettingsStore();

  return (
    <div className="flex flex-col gap-6">
      <Section title="User">
        <Row label="User Name">
          <TextInput
            value={store.gitUserName}
            onChange={(v) => store.set('gitUserName', v)}
            placeholder="Your Name"
          />
        </Row>
        <Row label="User Email">
          <TextInput
            value={store.gitUserEmail}
            onChange={(v) => store.set('gitUserEmail', v)}
            placeholder="you@example.com"
          />
        </Row>
      </Section>

      <Section title="Defaults">
        <Row label="Default Branch">
          <TextInput
            value={store.gitDefaultBranch}
            onChange={(v) => store.set('gitDefaultBranch', v)}
            placeholder="main"
          />
        </Row>
      </Section>

      <Section title="Behavior">
        <Row label="Auto Fetch">
          <Toggle
            checked={store.gitAutoFetch}
            onChange={(v) => store.set('gitAutoFetch', v)}
          />
        </Row>
        {store.gitAutoFetch && (
          <Row label="Auto Fetch Interval (min)">
            <NumberInput
              value={store.gitAutoFetchInterval}
              onChange={(v) => store.set('gitAutoFetchInterval', v)}
              min={1}
              max={60}
            />
          </Row>
        )}
        <Row label="Confirm Before Discard">
          <Toggle
            checked={store.gitConfirmDiscard}
            onChange={(v) => store.set('gitConfirmDiscard', v)}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-raised px-3 py-2.5">
      <span className="text-[12px] text-foreground">{label}</span>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 w-44 rounded-md bg-muted px-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-accent"
      />
      <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
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
