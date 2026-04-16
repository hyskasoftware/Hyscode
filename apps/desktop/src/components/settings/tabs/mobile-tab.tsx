import { FolderOpen } from 'lucide-react';
import { useSettingsStore } from '../../../stores';
import { pickFolder } from '../../../lib/tauri-dialog';

export function MobileTab() {
  const store = useSettingsStore();

  const browse = async (key: 'flutterSdkPath' | 'androidSdkPath') => {
    const folder = await pickFolder();
    if (folder) store.set(key, folder);
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Flutter / Dart">
        <Row label="Flutter SDK Path">
          <PathInput
            value={store.flutterSdkPath}
            onChange={(v) => store.set('flutterSdkPath', v)}
            placeholder="Auto-detect (leave empty)"
            onBrowse={() => browse('flutterSdkPath')}
          />
        </Row>
        <Row label="Android SDK Path">
          <PathInput
            value={store.androidSdkPath}
            onChange={(v) => store.set('androidSdkPath', v)}
            placeholder="Auto-detect (leave empty)"
            onBrowse={() => browse('androidSdkPath')}
          />
        </Row>
      </Section>

      <Section title="React Native">
        <Row label="Auto-detect Projects">
          <Toggle
            checked={store.reactNativeAutoDetect}
            onChange={(v) => store.set('reactNativeAutoDetect', v)}
          />
        </Row>
      </Section>

      <Section title="Info">
        <div className="rounded-lg bg-surface-raised px-3 py-3 text-[11px] text-muted-foreground leading-relaxed">
          <p className="mb-2">
            <strong className="text-foreground">Flutter / Dart:</strong> If the SDK path is left
            empty, HysCode will try to find Flutter in your system PATH.
          </p>
          <p>
            <strong className="text-foreground">React Native:</strong> When auto-detect is enabled,
            HysCode will recognise React Native projects via{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-accent">app.json</code> and{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-accent">react-native.config.js</code>.
          </p>
        </div>
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

function PathInput({
  value,
  onChange,
  placeholder,
  onBrowse,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onBrowse: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-44 rounded-md bg-muted px-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        onClick={onBrowse}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
        title="Browse folder"
      >
        <FolderOpen className="h-3.5 w-3.5" />
      </button>
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
