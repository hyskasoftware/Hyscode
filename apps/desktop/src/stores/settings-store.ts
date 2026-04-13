import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ThemeMode = 'dark' | 'light';
export type ApprovalMode = 'manual' | 'yolo' | 'custom';

export interface ProviderConfig {
  providerId: string;
  modelId: string;
  isActive: boolean;
}

interface SettingsState {
  theme: ThemeMode;
  fontSize: number;
  fontFamily: string;
  activeProviderId: string | null;
  activeModelId: string | null;
  providers: ProviderConfig[];
  approvalMode: ApprovalMode;
  maxIterations: number;
  temperature: number;
  maxTokens: number;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: number) => void;
  setActiveProvider: (providerId: string, modelId: string) => void;
  setApprovalMode: (mode: ApprovalMode) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  immer((set) => ({
    theme: 'dark',
    fontSize: 14,
    fontFamily: 'Geist Mono',
    activeProviderId: null,
    activeModelId: null,
    providers: [],
    approvalMode: 'manual',
    maxIterations: 25,
    temperature: 0.0,
    maxTokens: 8192,

    setTheme: (theme) =>
      set((state) => {
        state.theme = theme;
      }),

    setFontSize: (size) =>
      set((state) => {
        state.fontSize = size;
      }),

    setActiveProvider: (providerId, modelId) =>
      set((state) => {
        state.activeProviderId = providerId;
        state.activeModelId = modelId;
      }),

    setApprovalMode: (mode) =>
      set((state) => {
        state.approvalMode = mode;
      }),

    setTemperature: (temp) =>
      set((state) => {
        state.temperature = temp;
      }),

    setMaxTokens: (tokens) =>
      set((state) => {
        state.maxTokens = tokens;
      }),
  })),
);
