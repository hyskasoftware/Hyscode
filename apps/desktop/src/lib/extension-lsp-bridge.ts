// ─── Extension LSP Bridge ────────────────────────────────────────────────────
// Watches extension store contributions and forwards language server configs
// to the LspBridge singleton. Call `startWatching()` once at app init.

import { useExtensionStore } from '../stores/extension-store';
import { LspBridge } from './lsp-bridge';
import type { LspContribution } from '@hyscode/extension-api';

let previousServerIds = new Set<string>();

/**
 * Subscribe to extension store changes and sync language server contributions
 * to the LspBridge. Returns an unsubscribe function.
 */
export function startExtensionLspSync(): () => void {
  const unsubscribe = useExtensionStore.subscribe((state) => {
    const currentServers = state.contributions.languageServers;
    const currentIds = new Set(currentServers.map((s) => s.id));

    // Find newly added servers
    const newConfigs: LspContribution[] = [];
    for (const server of currentServers) {
      if (!previousServerIds.has(server.id)) {
        newConfigs.push(server);
      }
    }

    if (newConfigs.length > 0) {
      LspBridge.registerExtensionServers(newConfigs);
    }

    previousServerIds = currentIds;
  });

  // Initial sync: register any already-contributed servers
  const initial = useExtensionStore.getState().contributions.languageServers;
  if (initial.length > 0) {
    LspBridge.registerExtensionServers(initial);
    previousServerIds = new Set(initial.map((s) => s.id));
  }

  return unsubscribe;
}
