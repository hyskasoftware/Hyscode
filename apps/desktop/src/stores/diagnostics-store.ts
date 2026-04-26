import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface FileDiagnostics {
  errors: number;
  warnings: number;
}

interface DiagnosticsState {
  diagnostics: Map<string, FileDiagnostics>;
  setDiagnostics: (path: string, counts: FileDiagnostics) => void;
  clearDiagnostics: (path: string) => void;
  clearAll: () => void;
}

export const useDiagnosticsStore = create<DiagnosticsState>()(
  immer((set) => ({
    diagnostics: new Map(),

    setDiagnostics: (path, counts) =>
      set((state) => {
        state.diagnostics.set(path, counts);
      }),

    clearDiagnostics: (path) =>
      set((state) => {
        state.diagnostics.delete(path);
      }),

    clearAll: () =>
      set((state) => {
        state.diagnostics.clear();
      }),
  })),
);
