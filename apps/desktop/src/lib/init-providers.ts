// ─── Provider Initialization ─────────────────────────────────────────────────
// Initializes the ProviderRegistry singleton with API keys from the Tauri keychain.
// Must be called once at app startup before any agent messages are sent.

import { getProviderRegistry } from '@hyscode/ai-providers';
import { tauriKeyStore } from './tauri-key-store';

let _initialized = false;

export async function initProviders(): Promise<void> {
  if (_initialized) return;
  const registry = getProviderRegistry();
  await registry.initialize(tauriKeyStore);
  _initialized = true;
}

export async function reinitProvider(providerId: string): Promise<void> {
  const registry = getProviderRegistry();
  await registry.reinitializeProvider(providerId, tauriKeyStore);
}
