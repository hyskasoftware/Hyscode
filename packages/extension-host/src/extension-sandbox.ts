import type {
  ExtensionManifest,
  ExtensionModule,
  ExtensionContext,
  HyscodeAPI,
} from '@hyscode/extension-api';
import { createExtensionContext, disposeContext } from './extension-context';

interface ActiveExtension {
  manifest: ExtensionManifest;
  module: ExtensionModule;
  context: ExtensionContext;
}

export class ExtensionSandbox {
  private active = new Map<string, ActiveExtension>();

  async activate(
    manifest: ExtensionManifest,
    extensionPath: string,
    mainSource: string,
    api: HyscodeAPI,
  ): Promise<void> {
    if (this.active.has(manifest.name)) {
      console.warn(`[ExtensionSandbox] Extension "${manifest.name}" already active.`);
      return;
    }

    try {
      const blob = new Blob([mainSource], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      let mod: ExtensionModule;
      try {
        mod = await import(/* @vite-ignore */ blobUrl);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }

      if (typeof mod.activate !== 'function') {
        throw new Error(`Extension "${manifest.name}" does not export an activate() function.`);
      }

      const context = createExtensionContext(manifest.name, extensionPath, api);

      await mod.activate(context);

      this.active.set(manifest.name, { manifest, module: mod, context });
      console.log(`[ExtensionSandbox] Activated "${manifest.displayName}" v${manifest.version}`);
    } catch (err) {
      console.error(`[ExtensionSandbox] Failed to activate "${manifest.name}":`, err);
      throw err;
    }
  }

  async deactivate(name: string): Promise<void> {
    const ext = this.active.get(name);
    if (!ext) return;

    try {
      await ext.module.deactivate?.();
    } catch (err) {
      console.error(`[ExtensionSandbox] Error in deactivate() for "${name}":`, err);
    }

    disposeContext(ext.context);
    this.active.delete(name);
    console.log(`[ExtensionSandbox] Deactivated "${name}"`);
  }

  async deactivateAll(): Promise<void> {
    const names = Array.from(this.active.keys());
    for (const name of names) {
      await this.deactivate(name);
    }
  }

  isActive(name: string): boolean {
    return this.active.has(name);
  }

  getActiveNames(): string[] {
    return Array.from(this.active.keys());
  }
}
