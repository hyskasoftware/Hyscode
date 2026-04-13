import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
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
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>()(
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
  })),
);
