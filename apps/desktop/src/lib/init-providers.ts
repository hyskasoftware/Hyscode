// ─── Provider Initialization ─────────────────────────────────────────────────
// Initializes the ProviderRegistry singleton with API keys from the Tauri keychain.
// Must be called once at app startup before any agent messages are sent.

import { getProviderRegistry } from '@hyscode/ai-providers';
import { tauriKeyStore } from './tauri-key-store';
import { createTauriFetch } from './tauri-ai-transport';

let _initialized = false;
let _tauriFetch: ReturnType<typeof createTauriFetch> | null = null;

function getTauriFetch() {
  if (!_tauriFetch) {
    _tauriFetch = createTauriFetch();
  }
  return _tauriFetch;
}

export async function initProviders(): Promise<void> {
  if (_initialized) return;
  const registry = getProviderRegistry();
  await registry.initialize(tauriKeyStore, undefined, getTauriFetch());
  _initialized = true;
}

export async function reinitProvider(providerId: string): Promise<void> {
  const registry = getProviderRegistry();
  await registry.reinitializeProvider(providerId, tauriKeyStore, undefined, getTauriFetch());
}
