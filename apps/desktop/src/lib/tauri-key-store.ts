// ─── Tauri KeyStore Adapter ──────────────────────────────────────────────────
// Implements the KeyStore interface from @hyscode/ai-providers,
// delegating to the Tauri keychain commands for secure API key storage.

import type { KeyStore } from '@hyscode/ai-providers';
import { tauriInvoke } from './tauri-invoke';

class TauriKeyStore implements KeyStore {
  async get(key: string): Promise<string | null> {
    return tauriInvoke('keychain_get', { service: 'hyscode', account: key });
  }

  async set(key: string, value: string): Promise<void> {
    await tauriInvoke('keychain_set', { service: 'hyscode', account: key, password: value });
  }

  async delete(key: string): Promise<void> {
    await tauriInvoke('keychain_delete', { service: 'hyscode', account: key });
  }
}

export const tauriKeyStore = new TauriKeyStore();
