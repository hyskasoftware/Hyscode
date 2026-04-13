import { useEffect } from 'react';
import { Blocks, ToggleLeft, ToggleRight, Trash2, FolderOpen, RefreshCw } from 'lucide-react';
import { useExtensionStore } from '../../../stores/extension-store';

export function ExtensionsView() {
  const extensions = useExtensionStore((s) => s.extensions);
  const loading = useExtensionStore((s) => s.loading);
  const error = useExtensionStore((s) => s.error);
  const loadExtensions = useExtensionStore((s) => s.loadExtensions);
  const installExtension = useExtensionStore((s) => s.installExtension);
  const uninstallExtension = useExtensionStore((s) => s.uninstallExtension);
  const enableExtension = useExtensionStore((s) => s.enableExtension);
  const disableExtension = useExtensionStore((s) => s.disableExtension);

  useEffect(() => {
    loadExtensions();
  }, [loadExtensions]);

  const handleInstall = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, title: 'Select Extension Folder' });
      if (selected && typeof selected === 'string') {
        await installExtension(selected);
      }
    } catch {
      // user cancelled or dialog error
    }
  };

  const enabledCount = extensions.filter((e) => e.enabled).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-raised px-2 py-1">
        <span className="text-[10px] text-muted-foreground">
          {enabledCount}/{extensions.length} active
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => loadExtensions()}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleInstall}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Install Extension..."
          >
            <FolderOpen className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-2 py-1 text-[10px] text-red-400 bg-red-500/10">
          {error}
        </div>
      )}

      {/* Extensions list */}
      <div className="flex-1 overflow-auto">
        {extensions.map((ext) => (
          <div
            key={ext.name}
            className="flex items-start gap-2 px-2 py-1.5 hover:bg-muted transition-colors group"
          >
            <button
              onClick={() =>
                ext.enabled ? disableExtension(ext.name) : enableExtension(ext.name)
              }
              className="mt-0.5 shrink-0"
              title={ext.enabled ? 'Disable' : 'Enable'}
            >
              {ext.enabled ? (
                <ToggleRight className="h-4 w-4 text-accent" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-muted-foreground opacity-50" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div
                className={`text-[11px] font-medium ${ext.enabled ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {ext.displayName || ext.name}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {ext.description || 'No description'}
              </div>
              <div className="text-[9px] text-muted-foreground/60">
                {ext.publisher} · v{ext.version}
              </div>
            </div>

            <button
              onClick={() => uninstallExtension(ext.name)}
              className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-red-400 transition-all"
              title="Uninstall"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {extensions.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Blocks className="mb-3 h-8 w-8 opacity-30" />
            <p className="text-xs">No extensions installed</p>
            <button
              onClick={handleInstall}
              className="mt-2 rounded px-2 py-1 text-[10px] text-accent hover:bg-muted transition-colors"
            >
              Install Extension...
            </button>
          </div>
        )}

        {loading && extensions.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
