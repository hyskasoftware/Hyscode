import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AgentType } from '@hyscode/agent-harness';

// ── Types ────────────────────────────────────────────────────────────────────

export type ApprovalMode = 'manual' | 'yolo' | 'custom';
export type WordWrap = 'on' | 'off' | 'wordWrapColumn';
export type LineNumbers = 'on' | 'off' | 'relative';
export type CursorStyle = 'line' | 'block' | 'underline';
export type RenderWhitespace = 'none' | 'boundary' | 'all';
export type AutoSave = 'off' | 'afterDelay' | 'onFocusChange';
export type TerminalCursorStyle = 'block' | 'underline' | 'bar';

export type ThemeId =
  | 'hyscode-dark'
  | 'hyscode-light'
  | 'nord'
  | 'monokai'
  | 'dracula'
  | 'github-dark'
  | (string & {}); // allows extension theme ids while keeping autocomplete

export interface ProviderConfig {
  providerId: string;
  modelId: string;
  isActive: boolean;
}

export interface CustomModel {
  providerId: string;
  modelId: string;
  name: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'websocket';
  /** For stdio: command to run */
  command?: string;
  /** For stdio: args for command */
  args?: string[];
  /** For SSE: url */
  url?: string;
  /** For WebSocket: url */
  wsUrl?: string;
  enabled: boolean;
}

// ── State ────────────────────────────────────────────────────────────────────

interface SettingsState {
  // ─ Theme ─
  themeId: ThemeId;

  // ─ Editor ─
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  tabSize: number;
  wordWrap: WordWrap;
  minimap: boolean;
  lineNumbers: LineNumbers;
  cursorStyle: CursorStyle;
  renderWhitespace: RenderWhitespace;
  bracketPairColorization: boolean;
  autoSave: AutoSave;

  // ─ Terminal ─
  terminalFontSize: number;
  terminalFontFamily: string;
  terminalScrollback: number;
  terminalShell: string;
  terminalCursorStyle: TerminalCursorStyle;

  // ─ Git ─
  gitUserName: string;
  gitUserEmail: string;
  gitDefaultBranch: string;
  gitAutoFetch: boolean;
  gitAutoFetchInterval: number;
  gitConfirmDiscard: boolean;

  // ─ General ─
  confirmOnClose: boolean;
  showWelcomeOnStartup: boolean;
  reducedMotion: boolean;

  // ─ Agent / Provider ─
  activeProviderId: string | null;
  activeModelId: string | null;
  agentType: AgentType;
  providers: ProviderConfig[];
  approvalMode: ApprovalMode;
  maxIterations: number;
  temperature: number;
  maxTokens: number;
  topP: number | null;

  // ─ Per-provider enabled models ─
  /** Maps provider id → array of enabled model ids */
  enabledModels: Record<string, string[]>;
  /** User-added custom models (primarily for OpenRouter) */
  customModels: CustomModel[];

  // ─ MCP Servers ─
  mcpServers: McpServerConfig[];

  // ─ Skills ─
  skillsPath: string;

  // ─ Settings modal ─
  settingsOpen: boolean;

  // ─ Actions ─
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  setThemeId: (id: ThemeId) => void;
  setActiveProvider: (providerId: string, modelId: string) => void;
  openSettings: () => void;
  closeSettings: () => void;
  addMcpServer: (server: McpServerConfig) => void;
  removeMcpServer: (id: string) => void;
  updateMcpServer: (id: string, patch: Partial<McpServerConfig>) => void;
  toggleModel: (providerId: string, modelId: string) => void;
  setEnabledModels: (providerId: string, modelIds: string[]) => void;
  addCustomModel: (model: CustomModel) => void;
  removeCustomModel: (providerId: string, modelId: string) => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      // Theme
      themeId: 'hyscode-dark',

      // Editor
      fontSize: 14,
      fontFamily: 'Geist Mono',
      lineHeight: 1.5,
      tabSize: 2,
      wordWrap: 'off',
      minimap: true,
      lineNumbers: 'on',
      cursorStyle: 'line',
      renderWhitespace: 'none',
      bracketPairColorization: true,
      autoSave: 'off',

      // Terminal
      terminalFontSize: 13,
      terminalFontFamily: 'Geist Mono',
      terminalScrollback: 1000,
      terminalShell: '',
      terminalCursorStyle: 'block',

      // Git
      gitUserName: '',
      gitUserEmail: '',
      gitDefaultBranch: 'main',
      gitAutoFetch: false,
      gitAutoFetchInterval: 5,
      gitConfirmDiscard: true,

      // General
      confirmOnClose: false,
      showWelcomeOnStartup: true,
      reducedMotion: false,

      // Agent / Provider
      activeProviderId: null,
      activeModelId: null,
      agentType: 'chat' as AgentType,
      providers: [],
      approvalMode: 'manual',
      maxIterations: 25,
      temperature: 0.0,
      maxTokens: 8192,
      topP: null,

      // Per-provider enabled models (default: empty = all enabled)
      enabledModels: {},
      customModels: [],

      // MCP Servers
      mcpServers: [],

      // Skills
      skillsPath: '',

      // Settings modal
      settingsOpen: false,

      // Generic setter for any key
      set: (key, value) =>
        set((state) => {
          (state as Record<string, unknown>)[key as string] = value;
        }),

      setThemeId: (id) =>
        set((state) => {
          state.themeId = id;
        }),

      setActiveProvider: (providerId, modelId) =>
        set((state) => {
          state.activeProviderId = providerId;
          state.activeModelId = modelId;
        }),

      openSettings: () =>
        set((state) => {
          state.settingsOpen = true;
        }),

      closeSettings: () =>
        set((state) => {
          state.settingsOpen = false;
        }),

      addMcpServer: (server) =>
        set((state) => {
          state.mcpServers.push(server);
        }),

      removeMcpServer: (id) =>
        set((state) => {
          state.mcpServers = state.mcpServers.filter((s) => s.id !== id);
        }),

      updateMcpServer: (id, patch) =>
        set((state) => {
          const server = state.mcpServers.find((s) => s.id === id);
          if (server) Object.assign(server, patch);
        }),

      toggleModel: (providerId, modelId) =>
        set((state) => {
          const current = state.enabledModels[providerId];
          if (!current) {
            // First toggle for this provider — no entry means "all enabled"
            // We need to know all model ids to create the list minus this one.
            // Store an empty array convention: absent key = all on, present key = explicit list.
            // Toggle OFF: store all-except-this. But we don't know "all" here.
            // Instead: absent key = use default; present array = explicit enabled.
            // On first toggle-off, the UI will call setEnabledModels first.
            state.enabledModels[providerId] = [modelId];
          } else if (current.includes(modelId)) {
            state.enabledModels[providerId] = current.filter((m) => m !== modelId);
          } else {
            current.push(modelId);
          }
        }),

      setEnabledModels: (providerId, modelIds) =>
        set((state) => {
          state.enabledModels[providerId] = modelIds;
        }),

      addCustomModel: (model) =>
        set((state) => {
          // Avoid duplicates
          if (!state.customModels.some((m) => m.providerId === model.providerId && m.modelId === model.modelId)) {
            state.customModels.push(model);
            // Auto-enable the custom model
            if (!state.enabledModels[model.providerId]) {
              state.enabledModels[model.providerId] = [model.modelId];
            } else if (!state.enabledModels[model.providerId].includes(model.modelId)) {
              state.enabledModels[model.providerId].push(model.modelId);
            }
          }
        }),

      removeCustomModel: (providerId, modelId) =>
        set((state) => {
          state.customModels = state.customModels.filter(
            (m) => !(m.providerId === providerId && m.modelId === modelId),
          );
          // Also remove from enabled
          const enabled = state.enabledModels[providerId];
          if (enabled) {
            state.enabledModels[providerId] = enabled.filter((m) => m !== modelId);
          }
        }),
    })),
    {
      name: 'hyscode-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        // Exclude transient UI state and action functions from persistence
        const { settingsOpen: _, ...rest } = state;
        return rest;
      },
    },
  ),
);
