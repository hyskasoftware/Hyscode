import { Send, Square, Paperclip, ChevronDown, Settings, MessageSquare, Hammer, Search, Bug, ClipboardList } from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/stores/agent-store';
import { useSettingsStore } from '@/stores/settings-store';
import { HarnessBridge } from '@/lib/harness-bridge';
import type { AgentMode } from '@/stores/agent-store';

// ─── Agent capability map ───────────────────────────────────────────────────

interface AgentCapability {
  icon: typeof MessageSquare;
  label: string;
  description: string;
  badge: string;
  color: string;
  activeColor: string;
  placeholder: string;
}

const AGENT_CAPABILITIES: Record<AgentMode, AgentCapability> = {
  chat: {
    icon: MessageSquare,
    label: 'Chat',
    description: 'General-purpose assistant for questions and explanations.',
    badge: 'read-only',
    color: 'text-blue-400',
    activeColor: 'bg-blue-500/15 text-blue-400',
    placeholder: 'Ask anything...',
  },
  build: {
    icon: Hammer,
    label: 'Build',
    description: 'Implements features, writes code, creates files, runs commands.',
    badge: 'full access',
    color: 'text-accent',
    activeColor: 'bg-accent/15 text-accent',
    placeholder: 'Describe what to build...',
  },
  review: {
    icon: Search,
    label: 'Review',
    description: 'Reviews code for bugs, security, performance, best practices.',
    badge: 'read-only',
    color: 'text-purple-400',
    activeColor: 'bg-purple-500/15 text-purple-400',
    placeholder: 'What should I review?',
  },
  debug: {
    icon: Bug,
    label: 'Debug',
    description: 'Diagnoses and fixes bugs, errors, and unexpected behavior.',
    badge: 'full access',
    color: 'text-red-400',
    activeColor: 'bg-red-500/15 text-red-400',
    placeholder: 'Describe the bug or error...',
  },
  plan: {
    icon: ClipboardList,
    label: 'Plan',
    description: 'Plans architecture, writes specs, designs systems.',
    badge: 'writes docs',
    color: 'text-amber-400',
    activeColor: 'bg-amber-500/15 text-amber-400',
    placeholder: 'Describe what to plan or design...',
  },
};

const AGENT_MODES: AgentMode[] = ['chat', 'build', 'review', 'debug', 'plan'];

// ─── Provider & model catalog (mirrors ai-tab.tsx) ──────────────────────────

interface ModelInfo { id: string; name: string; }

const PROVIDER_MODELS: Record<string, ModelInfo[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-5.4', name: 'GPT-5.4' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
  ],
  openrouter: [
    { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'openai/gpt-5.4', name: 'GPT-5.4' },
    { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
  ],
  ollama: [
    { id: 'llama4', name: 'Llama 4' },
    { id: 'qwen3', name: 'Qwen 3' },
    { id: 'deepseek-r1', name: 'DeepSeek R1' },
    { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2' },
  ],
};

export function AgentInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mode = useAgentStore((s) => s.mode);
  const setMode = useAgentStore((s) => s.setMode);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const activeModelId = useSettingsStore((s) => s.activeModelId);
  const activeProviderId = useSettingsStore((s) => s.activeProviderId);
  const enabledModels = useSettingsStore((s) => s.enabledModels);
  const customModels = useSettingsStore((s) => s.customModels);
  const openSettings = useSettingsStore((s) => s.openSettings);

  const currentCap = AGENT_CAPABILITIES[mode];

  // Build the enabled model list for the active provider
  const availableModels = useMemo(() => {
    const providerId = activeProviderId ?? '';
    const catalog = PROVIDER_MODELS[providerId] ?? [];
    const customs = customModels
      .filter((c) => c.providerId === providerId)
      .map((c) => ({ id: c.modelId, name: c.name }));
    const all = [...catalog, ...customs];

    const explicit = enabledModels[providerId];
    if (!explicit) return all;
    return all.filter((m) => explicit.includes(m.id));
  }, [activeProviderId, enabledModels, customModels]);

  // Display name for active model
  const activeModelLabel = useMemo(() => {
    if (!activeModelId) return 'Select model';
    const found = availableModels.find((m) => m.id === activeModelId);
    if (found) return found.name;
    return activeModelId.length > 30 ? activeModelId.slice(0, 28) + '…' : activeModelId;
  }, [activeModelId, availableModels]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    try {
      HarnessBridge.get().sendMessage(input.trim());
    } catch {
      // Bridge not initialized yet
    }
    setInput('');
  };

  const handleStop = () => {
    try {
      HarnessBridge.get().cancel();
    } catch {
      // ignore
    }
  };

  const handleAttachFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        title: 'Attach context file',
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        const addCtx = useAgentStore.getState().addContextFile;
        for (const p of paths) {
          if (typeof p === 'string') addCtx(p);
        }
      }
    } catch {
      // dialog cancelled or not available
    }
  };

  const handleModeChange = (newMode: AgentMode) => {
    try {
      HarnessBridge.get().setAgentType(newMode);
    } catch {
      setMode(newMode);
    }
  };

  const handleModelChange = (modelId: string) => {
    useSettingsStore.getState().setActiveProvider(
      useSettingsStore.getState().activeProviderId ?? '',
      modelId,
    );
  };

  return (
    <div className="shrink-0 bg-surface-raised px-2.5 pt-2 pb-2.5 flex flex-col gap-1.5">
      {/* Textarea area */}
      <div className="rounded-lg bg-background px-2.5 py-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={currentCap.placeholder}
          className="max-h-32 min-h-[36px] w-full border-0 bg-transparent text-xs leading-relaxed focus-visible:ring-0 resize-none overflow-y-auto"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
      </div>

      {/* Bottom toolbar: agent pills + model left, actions right */}
      <div className="flex items-center justify-between gap-2">
        {/* Agent pills + model selector */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {/* Unified agent mode pills */}
          <div className="flex items-center gap-0.5 rounded-pill bg-background p-[2px]">
            {AGENT_MODES.map((m) => {
              const cap = AGENT_CAPABILITIES[m];
              const Icon = cap.icon;
              const isActive = mode === m;

              return (
                <Tooltip key={m}>
                  <TooltipTrigger
                    render={
                      <button
                        onClick={() => handleModeChange(m)}
                        className={cn(
                          'flex cursor-pointer items-center gap-1 rounded-pill px-2 py-[2px] text-[10px] font-medium transition-colors',
                          isActive
                            ? cap.activeColor
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      />
                    }
                  >
                    <Icon className="h-3 w-3" />
                    <span>{cap.label}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium">{cap.label}</span>
                      <span className="text-[9px] text-muted-foreground">{cap.description}</span>
                      <span className={cn('text-[9px] font-medium', cap.color)}>{cap.badge}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Model selector */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex cursor-pointer items-center gap-0.5 rounded-pill bg-muted px-2 py-[3px] text-[10px] text-muted-foreground transition-colors hover:text-foreground focus:outline-none">
              <span className="truncate max-w-[100px]">{activeModelLabel}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="min-w-[200px] max-h-64 overflow-auto">
              {availableModels.map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => handleModelChange(m.id)}>
                  <div className="flex flex-col">
                    <span className="text-[11px]">{m.name}</span>
                    <span className="text-[9px] text-muted-foreground">{m.id}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              {activeProviderId === 'openrouter' && (
                <>
                  <div className="border-t border-border my-1" />
                  <div className="px-2 py-1.5">
                    <input
                      type="text"
                      placeholder="Type model id…"
                      className="h-6 w-full rounded bg-muted px-2 text-[10px] text-foreground outline-none placeholder:text-muted-foreground/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) handleModelChange(val);
                        }
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={openSettings}
                  className="text-muted-foreground hover:text-foreground"
                />
              }
            >
              <Settings className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">Settings</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handleAttachFile}
                />
              }
            >
              <Paperclip />
            </TooltipTrigger>
            <TooltipContent side="top">Attach file</TooltipContent>
          </Tooltip>

          {isStreaming ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    onClick={handleStop}
                    className="bg-red-600 hover:bg-red-700"
                  />
                }
              >
                <Square className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent side="top">Stop (Esc)</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    disabled={!input.trim()}
                    onClick={handleSend}
                    className="disabled:opacity-30"
                  />
                }
              >
                <Send />
              </TooltipTrigger>
              <TooltipContent side="top">Send (Enter)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
