import { useState } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import type { McpServerConfig } from '@/stores/settings-store';
import { Button } from '@/components/ui/button';
import { tauriInvoke } from '@/lib/tauri-invoke';
import { McpServerForm } from './mcp-server-form';

// ─── Provider definitions (static) ─────────────────────────────────────────

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-5', 'claude-sonnet-4-20250514', 'claude-haiku-4-20250414'] },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'] },
  { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'] },
  { id: 'openrouter', name: 'OpenRouter', models: ['anthropic/claude-sonnet-4-5', 'openai/gpt-4o', 'meta-llama/llama-3.3-70b'] },
  { id: 'ollama', name: 'Ollama (local)', models: ['llama3.3', 'codellama', 'deepseek-coder'] },
];

export function AiTab() {
  const store = useSettingsStore();
  const [showingMcpForm, setShowingMcpForm] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Provider & Model ───────────────────────────────────────────── */}
      <Section title="Provider & Model">
        <Row label="Provider">
          <SelectInput
            value={store.activeProviderId ?? ''}
            onChange={(v) => {
              const provider = PROVIDERS.find((p) => p.id === v);
              store.setActiveProvider(v, provider?.models[0] ?? '');
            }}
            options={PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Row>
        <Row label="Model">
          <SelectInput
            value={store.activeModelId ?? ''}
            onChange={(v) => store.set('activeModelId', v)}
            options={
              (PROVIDERS.find((p) => p.id === store.activeProviderId)?.models ?? []).map((m) => ({
                value: m,
                label: m,
              }))
            }
          />
        </Row>
      </Section>

      {/* ─── API Keys ──────────────────────────────────────────────────── */}
      <Section title="API Keys">
        {PROVIDERS.filter((p) => p.id !== 'ollama').map((provider) => (
          <ApiKeyRow key={provider.id} providerId={provider.id} providerName={provider.name} />
        ))}
      </Section>

      {/* ─── Generation Settings ───────────────────────────────────────── */}
      <Section title="Generation">
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
        <Row label="Max Iterations">
          <NumberInput
            value={store.maxIterations}
            onChange={(v) => store.set('maxIterations', v)}
            min={1}
            max={100}
          />
        </Row>
        <Row label="Approval Mode">
          <SelectInput
            value={store.approvalMode}
            onChange={(v) => store.set('approvalMode', v)}
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'yolo', label: 'Auto-approve' },
              { value: 'custom', label: 'Custom rules' },
            ]}
          />
        </Row>
      </Section>

      {/* ─── MCP Servers ───────────────────────────────────────────────── */}
      <Section title="MCP Servers">
        {store.mcpServers.map((server) => (
          <div
            key={server.id}
            className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2.5"
          >
            <div className="flex flex-col">
              <span className="text-[12px] text-foreground">{server.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {server.transport} · {server.enabled ? 'enabled' : 'disabled'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Toggle
                checked={server.enabled}
                onChange={(v) => store.updateMcpServer(server.id, { enabled: v })}
              />
              <button
                onClick={() => store.removeMcpServer(server.id)}
                className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {showingMcpForm ? (
          <McpServerForm
            onSave={(server: McpServerConfig) => {
              store.addMcpServer(server);
              setShowingMcpForm(false);
            }}
            onCancel={() => setShowingMcpForm(false)}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowingMcpForm(true)}
            className="h-8 gap-1.5 self-start text-[11px]"
          >
            <Plus className="h-3 w-3" />
            Add MCP Server
          </Button>
        )}
      </Section>
    </div>
  );
}

// ─── API Key Row ────────────────────────────────────────────────────────────

function ApiKeyRow({ providerId, providerName }: { providerId: string; providerName: string }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    await tauriInvoke('keychain_set', {
      service: 'hyscode',
      account: `${providerId}_api_key`,
      password: value.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-raised px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Key className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[12px] text-foreground">{providerName}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-..."
            className="h-7 w-44 rounded-md bg-muted px-2 pr-7 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          <button
            onClick={() => setVisible(!visible)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!value.trim()}
          className="h-7 px-2.5 text-[10px]"
        >
          {saved ? 'Saved ✓' : 'Save'}
        </Button>
      </div>
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
      {options.length === 0 && (
        <option value="">Select...</option>
      )}
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
