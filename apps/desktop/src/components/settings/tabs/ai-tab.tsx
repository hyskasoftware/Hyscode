import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import type { McpServerConfig, CustomModel } from '@/stores/settings-store';
import { Button } from '@/components/ui/button';
import { tauriInvoke } from '@/lib/tauri-invoke';
import { reinitProvider } from '@/lib/init-providers';
import { McpServerForm } from './mcp-server-form';

// ─── Provider & Model Catalog ───────────────────────────────────────────────

interface ModelInfo {
  id: string;
  name: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
  needsKey: boolean;
  supportsCustomModels?: boolean;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    needsKey: true,
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    needsKey: true,
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    needsKey: true,
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    needsKey: true,
    supportsCustomModels: true,
    models: [
      { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'openai/gpt-5.4', name: 'GPT-5.4' },
      { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    needsKey: false,
    supportsCustomModels: true,
    models: [
      { id: 'llama4', name: 'Llama 4' },
      { id: 'qwen3', name: 'Qwen 3' },
      { id: 'deepseek-r1', name: 'DeepSeek R1' },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2' },
    ],
  },
];

/** Get all models for a provider (catalog + user custom) */
function getProviderModels(provider: ProviderInfo, customModels: CustomModel[]): ModelInfo[] {
  const customs = customModels
    .filter((c) => c.providerId === provider.id)
    .map((c) => ({ id: c.modelId, name: c.name }));
  return [...provider.models, ...customs];
}

/** Check if a model is enabled for a provider */
function isModelEnabled(
  enabledModels: Record<string, string[]>,
  providerId: string,
  modelId: string,
): boolean {
  const explicit = enabledModels[providerId];
  // No explicit list = all catalog models enabled by default
  if (!explicit) return true;
  return explicit.includes(modelId);
}

export function AiTab() {
  const store = useSettingsStore();
  const [showingMcpForm, setShowingMcpForm] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [customModelInput, setCustomModelInput] = useState('');

  /** Get enabled models as flat list for a given provider */
  const getEnabledModelsForProvider = (providerId: string): ModelInfo[] => {
    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return [];
    const all = getProviderModels(provider, store.customModels);
    return all.filter((m) => isModelEnabled(store.enabledModels, providerId, m.id));
  };

  const handleToggleModel = (provider: ProviderInfo, modelId: string) => {
    const all = getProviderModels(provider, store.customModels);
    const explicit = store.enabledModels[provider.id];
    if (!explicit) {
      // First toggle: materialize the full list minus this model
      const allIds = all.map((m) => m.id).filter((id) => id !== modelId);
      store.setEnabledModels(provider.id, allIds);
    } else {
      store.toggleModel(provider.id, modelId);
    }
  };

  const handleAddCustomModel = (providerId: string) => {
    const trimmed = customModelInput.trim();
    if (!trimmed) return;
    const name = trimmed.split('/').pop()?.replace(/:.*$/, '') ?? trimmed;
    store.addCustomModel({ providerId, modelId: trimmed, name });
    setCustomModelInput('');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Active Provider & Model ────────────────────────────────── */}
      <Section title="Active Provider & Model">
        <Row label="Provider">
          <SelectInput
            value={store.activeProviderId ?? ''}
            onChange={(v) => {
              const enabled = getEnabledModelsForProvider(v);
              store.setActiveProvider(v, enabled[0]?.id ?? '');
            }}
            options={PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Row>
        <Row label="Model">
          {store.activeProviderId === 'openrouter' ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={store.activeModelId ?? ''}
                onChange={(e) => store.set('activeModelId', e.target.value)}
                placeholder="provider/model-name"
                className="h-7 w-52 rounded-md bg-muted px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          ) : (
            <SelectInput
              value={store.activeModelId ?? ''}
              onChange={(v) => store.set('activeModelId', v)}
              options={getEnabledModelsForProvider(store.activeProviderId ?? '').map((m) => ({
                value: m.id,
                label: m.name,
              }))}
            />
          )}
        </Row>
      </Section>

      {/* ─── Models per Provider ────────────────────────────────────── */}
      <Section title="Models">
        <p className="text-[10px] text-muted-foreground -mt-1 mb-1">
          Enable or disable models for each provider. Enabled models appear in the model selector.
        </p>
        {PROVIDERS.map((provider) => {
          const all = getProviderModels(provider, store.customModels);
          const enabledCount = all.filter((m) =>
            isModelEnabled(store.enabledModels, provider.id, m.id),
          ).length;
          const isExpanded = expandedProvider === provider.id;

          return (
            <div key={provider.id} className="rounded-lg bg-surface-raised overflow-hidden">
              <button
                onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <span className="text-[12px] font-medium text-foreground">{provider.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {enabledCount}/{all.length} models
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-border px-3 py-2 flex flex-col gap-1">
                  {all.map((model) => {
                    const isCustom = store.customModels.some(
                      (c) => c.providerId === provider.id && c.modelId === model.id,
                    );
                    const enabled = isModelEnabled(store.enabledModels, provider.id, model.id);

                    return (
                      <div
                        key={model.id}
                        className="flex items-center justify-between gap-2 py-1"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] text-foreground">{model.name}</span>
                          <span className="ml-1.5 text-[9px] text-muted-foreground">{model.id}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isCustom && (
                            <button
                              onClick={() => store.removeCustomModel(provider.id, model.id)}
                              className="rounded p-0.5 text-muted-foreground hover:text-red-400"
                              title="Remove custom model"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleModel(provider, model.id)}
                            className="shrink-0"
                          >
                            {enabled ? (
                              <ToggleRight className="h-4 w-4 text-accent" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground opacity-50" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom model input */}
                  {provider.supportsCustomModels && (
                    <div className="mt-1 flex items-center gap-1.5 border-t border-border pt-2">
                      <input
                        type="text"
                        value={expandedProvider === provider.id ? customModelInput : ''}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddCustomModel(provider.id);
                        }}
                        placeholder={
                          provider.id === 'openrouter'
                            ? 'e.g. z-ai/glm-4.5-air:free'
                            : 'e.g. my-model:latest'
                        }
                        className="h-7 flex-1 rounded-md bg-muted px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddCustomModel(provider.id)}
                        disabled={!customModelInput.trim()}
                        className="h-7 px-2 text-[10px]"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Section>

      {/* ─── API Keys ──────────────────────────────────────────────── */}
      <Section title="API Keys">
        {PROVIDERS.filter((p) => p.needsKey).map((provider) => (
          <ApiKeyRow key={provider.id} providerId={provider.id} providerName={provider.name} />
        ))}
      </Section>

      {/* ─── Generation Settings ───────────────────────────────────── */}
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
        <Row label="Top P" description="Nucleus sampling (leave empty for default)">
          <NumberInput
            value={store.topP ?? 1}
            onChange={(v) => store.set('topP', v)}
            min={0}
            max={1}
            step={0.05}
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
  const [hasExisting, setHasExisting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(false);

  // Load existing key on mount
  useEffect(() => {
    tauriInvoke<string | null>('keychain_get', {
      service: 'hyscode',
      account: `${providerId}_api_key`,
    }).then((existing) => {
      if (existing) {
        setValue(existing);
        setHasExisting(true);
      }
    });
  }, [providerId]);

  const handleSave = async () => {
    if (!value.trim()) return;
    await tauriInvoke('keychain_set', {
      service: 'hyscode',
      account: `${providerId}_api_key`,
      password: value.trim(),
    });
    // Re-initialize this provider so it picks up the new key immediately
    await reinitProvider(providerId).catch(console.error);
    setHasExisting(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-raised px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Key className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[12px] text-foreground">{providerName}</span>
        {hasExisting && !saved && (
          <span className="text-[9px] text-accent">● configured</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => { setValue(e.target.value); setHasExisting(false); }}
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
          {saved ? 'Saved ✓' : hasExisting ? 'Update' : 'Save'}
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
