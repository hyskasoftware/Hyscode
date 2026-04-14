import { Send, Square, Paperclip, ChevronDown, Settings } from 'lucide-react';
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
import type { AgentType } from '@hyscode/agent-harness';
import { getAllAgentDefinitions } from '@hyscode/agent-harness';

const AGENT_DEFS = getAllAgentDefinitions();

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
  const agentType = useAgentStore((s) => s.agentType);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const activeModelId = useSettingsStore((s) => s.activeModelId);
  const activeProviderId = useSettingsStore((s) => s.activeProviderId);
  const enabledModels = useSettingsStore((s) => s.enabledModels);
  const customModels = useSettingsStore((s) => s.customModels);
  const openSettings = useSettingsStore((s) => s.openSettings);

  const currentAgent = AGENT_DEFS.find((a) => a.type === agentType) ?? AGENT_DEFS[0];

  // Build the enabled model list for the active provider
  const availableModels = useMemo(() => {
    const providerId = activeProviderId ?? '';
    const catalog = PROVIDER_MODELS[providerId] ?? [];
    const customs = customModels
      .filter((c) => c.providerId === providerId)
      .map((c) => ({ id: c.modelId, name: c.name }));
    const all = [...catalog, ...customs];

    const explicit = enabledModels[providerId];
    if (!explicit) return all; // No explicit list = all enabled
    return all.filter((m) => explicit.includes(m.id));
  }, [activeProviderId, enabledModels, customModels]);

  // Display name for active model
  const activeModelLabel = useMemo(() => {
    if (!activeModelId) return 'Select model';
    const found = availableModels.find((m) => m.id === activeModelId);
    if (found) return found.name;
    // For custom/free-text model ids, show the id itself (truncated)
    return activeModelId.length > 30 ? activeModelId.slice(0, 28) + '…' : activeModelId;
  }, [activeModelId, availableModels]);

  const placeholders: Record<AgentMode, string> = {
    chat: 'Ask anything...',
    build: 'Describe what to build...',
    review: 'What should I review?',
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    try {
      HarnessBridge.get().sendMessage(input.trim());
    } catch {
      // Bridge not initialized yet — ignore
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

  const handleAgentChange = (type: AgentType) => {
    try {
      HarnessBridge.get().setAgentType(type);
    } catch {
      useAgentStore.getState().setAgentType(type);
      useSettingsStore.getState().set('agentType', type);
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
          placeholder={placeholders[mode]}
          className="max-h-32 min-h-[36px] w-full border-0 bg-transparent text-xs leading-relaxed focus-visible:ring-0 resize-none overflow-y-auto"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
      </div>

      {/* Bottom toolbar: selectors left, actions right */}
      <div className="flex items-center justify-between gap-2">
        {/* Selectors */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {/* Agent */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex cursor-pointer items-center gap-0.5 rounded-pill bg-muted px-2 py-[3px] text-[10px] text-muted-foreground transition-colors hover:text-foreground focus:outline-none">
              <span className="truncate max-w-[90px]">{currentAgent.name}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="min-w-[160px]">
              {AGENT_DEFS.map((a) => (
                <DropdownMenuItem key={a.type} onClick={() => handleAgentChange(a.type)}>
                  <div className="flex flex-col">
                    <span className="text-[11px]">{a.name}</span>
                    <span className="text-[9px] text-muted-foreground">{a.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mode pills */}
          <div className="flex items-center gap-0.5 rounded-pill bg-background p-[2px]">
            {(['chat', 'build', 'review'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'cursor-pointer rounded-pill px-2.5 py-[2px] text-[10px] font-medium capitalize transition-colors',
                  mode === m
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Model */}
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
