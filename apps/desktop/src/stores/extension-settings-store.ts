/**
 * Extension Settings Store
 *
 * Persisted key-value store for extension settings values.
 * Keys are automatically scoped by extension name in the loader
 * (e.g. `my-ext.myKey`) so this store is a flat namespace.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ── Types ────────────────────────────────────────────────────────────────────

type Listener = (value: unknown) => void;

interface ExtensionSettingsState {
  values: Record<string, unknown>;

  getValue<T>(key: string, defaultValue?: T): T | undefined;
  setValue(key: string, value: unknown): void;
  subscribe(key: string, handler: Listener): () => void;
}

// ── Module-level listeners map (not in Zustand state to avoid serialisation) ─

const _listeners = new Map<string, Set<Listener>>();

function notifyListeners(key: string, value: unknown) {
  _listeners.get(key)?.forEach((fn) => fn(value));
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useExtensionSettingsStore = create<ExtensionSettingsState>()(
  persist(
    immer((set, get) => ({
      values: {},

      getValue<T>(key: string, defaultValue?: T): T | undefined {
        const v = get().values[key];
        return (v !== undefined ? v : defaultValue) as T | undefined;
      },

      setValue(key: string, value: unknown): void {
        set((s) => {
          s.values[key] = value;
        });
        notifyListeners(key, value);
      },

      subscribe(key: string, handler: Listener): () => void {
        if (!_listeners.has(key)) _listeners.set(key, new Set());
        _listeners.get(key)!.add(handler);
        return () => {
          _listeners.get(key)?.delete(handler);
        };
      },
    })),
    {
      name: 'hyscode:ext-settings',
    },
  ),
);
