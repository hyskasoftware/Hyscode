import { useEffect, useState, useCallback } from 'react';
import {
  Blocks,
  Search,
  Trash2,
  FolderOpen,
  RefreshCw,
  FileArchive,
  ChevronLeft,
  Power,
  PowerOff,
  Package,
  Palette,
  Code2,
  Filter,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useExtensionStore, type ExtensionFilter, type InstalledExtension } from '../../../stores/extension-store';

// ── Filter Tabs ──────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: ExtensionFilter; label: string; icon: typeof Blocks }[] = [
  { value: 'all', label: 'All', icon: Blocks },
  { value: 'enabled', label: 'Enabled', icon: Power },
  { value: 'disabled', label: 'Disabled', icon: PowerOff },
  { value: 'themes', label: 'Themes', icon: Palette },
  { value: 'languages', label: 'Languages', icon: Code2 },
];

// ── Extension Detail Panel ───────────────────────────────────────────────────

function ExtensionDetail({
  ext,
  onBack,
}: {
  ext: InstalledExtension;
  onBack: () => void;
}) {
  const toggleExtension = useExtensionStore((s) => s.toggleExtension);
  const uninstallExtension = useExtensionStore((s) => s.uninstallExtension);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  const contributes = ext.manifest?.contributes;
  const contributionSummary: { label: string; count: number }[] = [];
  if (contributes?.themes?.length) contributionSummary.push({ label: 'Themes', count: contributes.themes.length });
  if (contributes?.languages?.length) contributionSummary.push({ label: 'Languages', count: contributes.languages.length });
  if (contributes?.languageServers?.length) contributionSummary.push({ label: 'Language Servers', count: contributes.languageServers.length });
  if (contributes?.commands?.length) contributionSummary.push({ label: 'Commands', count: contributes.commands.length });
  if (contributes?.keybindings?.length) contributionSummary.push({ label: 'Keybindings', count: contributes.keybindings.length });
  if (contributes?.views?.length) contributionSummary.push({ label: 'Views', count: contributes.views.length });
  if (contributes?.statusBarItems?.length) contributionSummary.push({ label: 'Status Bar Items', count: contributes.statusBarItems.length });
  if (contributes?.snippets?.length) contributionSummary.push({ label: 'Snippets', count: contributes.snippets.length });
  if (contributes?.configuration) contributionSummary.push({ label: 'Settings', count: Object.keys(contributes.configuration.properties || {}).length });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        <button
          onClick={onBack}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] font-medium text-foreground truncate">
          {ext.displayName || ext.name}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Extension info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[12px] font-semibold text-foreground leading-tight">
                {ext.displayName || ext.name}
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {ext.publisher} · v{ext.version}
              </p>
            </div>
          </div>
          {ext.description && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {ext.description}
            </p>
          )}
        </div>

        {/* Status + Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => toggleExtension(ext.name)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[10px] font-medium transition-colors ${
              ext.enabled
                ? 'bg-accent/10 text-accent hover:bg-accent/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {ext.enabled ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Enabled
              </>
            ) : (
              <>
                <PowerOff className="h-3 w-3" />
                Disabled
              </>
            )}
          </button>
          {!confirmUninstall ? (
            <button
              onClick={() => setConfirmUninstall(true)}
              className="flex items-center justify-center gap-1 rounded-md bg-muted px-3 py-1.5 text-[10px] text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : (
            <button
              onClick={() => uninstallExtension(ext.name)}
              className="flex items-center justify-center gap-1 rounded-md bg-red-500/10 px-3 py-1.5 text-[10px] text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Confirm
            </button>
          )}
        </div>

        {/* Categories */}
        {ext.categories.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Categories
            </p>
            <div className="flex flex-wrap gap-1">
              {ext.categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contributions */}
        {contributionSummary.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Contributions
            </p>
            <div className="space-y-0.5">
              {contributionSummary.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center justify-between rounded px-2 py-1 text-[10px]"
                >
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-mono text-[9px] text-foreground/60">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activation Events */}
        {ext.activationEvents.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Activation Events
            </p>
            <div className="space-y-0.5">
              {ext.activationEvents.map((ev) => (
                <div
                  key={ev}
                  className="rounded bg-muted px-2 py-0.5 text-[9px] font-mono text-muted-foreground"
                >
                  {ev}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Details
          </p>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Identifier</span>
              <span className="font-mono text-[9px] text-foreground/60">{ext.name}</span>
            </div>
            {ext.installedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Installed</span>
                <span className="text-foreground/60">{ext.installedAt}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Has Code</span>
              <span className="text-foreground/60">{ext.hasMain ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Extension Row ────────────────────────────────────────────────────────────

function ExtensionRow({
  ext,
  onSelect,
}: {
  ext: InstalledExtension;
  onSelect: () => void;
}) {
  const toggleExtension = useExtensionStore((s) => s.toggleExtension);

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 transition-colors cursor-pointer group"
      onClick={onSelect}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[11px] font-medium truncate ${
              ext.enabled ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {ext.displayName || ext.name}
          </span>
          {!ext.enabled && (
            <span className="shrink-0 rounded bg-muted px-1 py-px text-[8px] text-muted-foreground/60">
              OFF
            </span>
          )}
        </div>
        <div className="truncate text-[10px] text-muted-foreground/70">
          {ext.description || 'No description'}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleExtension(ext.name);
        }}
        className={`shrink-0 rounded-full p-1 transition-colors ${
          ext.enabled
            ? 'text-accent hover:bg-accent/10'
            : 'text-muted-foreground/40 hover:bg-muted'
        }`}
        title={ext.enabled ? 'Disable' : 'Enable'}
      >
        {ext.enabled ? (
          <Power className="h-3 w-3" />
        ) : (
          <PowerOff className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

// ── Main View ────────────────────────────────────────────────────────────────

export function ExtensionsView() {
  const extensions = useExtensionStore((s) => s.extensions);
  const loading = useExtensionStore((s) => s.loading);
  const installing = useExtensionStore((s) => s.installing);
  const error = useExtensionStore((s) => s.error);
  const searchQuery = useExtensionStore((s) => s.searchQuery);
  const filter = useExtensionStore((s) => s.filter);
  const selectedExtension = useExtensionStore((s) => s.selectedExtension);
  const loadExtensions = useExtensionStore((s) => s.loadExtensions);
  const installFromFolder = useExtensionStore((s) => s.installFromFolder);
  const installFromZip = useExtensionStore((s) => s.installFromZip);
  const setSearchQuery = useExtensionStore((s) => s.setSearchQuery);
  const setFilter = useExtensionStore((s) => s.setFilter);
  const selectExtension = useExtensionStore((s) => s.selectExtension);
  const getFiltered = useExtensionStore((s) => s.getFiltered);

  useEffect(() => {
    loadExtensions();
  }, [loadExtensions]);

  const handleInstallFolder = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, title: 'Select Extension Folder' });
      if (selected && typeof selected === 'string') {
        await installFromFolder(selected);
      }
    } catch {
      // user cancelled
    }
  }, [installFromFolder]);

  const handleInstallZip = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: 'Install Extension from .zip',
        filters: [{ name: 'Extension Package', extensions: ['zip'] }],
      });
      if (selected && typeof selected === 'string') {
        await installFromZip(selected);
      }
    } catch {
      // user cancelled
    }
  }, [installFromZip]);

  // If an extension is selected, show detail
  const selectedExt = selectedExtension
    ? extensions.find((e) => e.name === selectedExtension)
    : null;

  if (selectedExt) {
    return (
      <ExtensionDetail ext={selectedExt} onBack={() => selectExtension(null)} />
    );
  }

  const filtered = getFiltered();
  const enabledCount = extensions.filter((e) => e.enabled).length;

  return (
    <div className="flex h-full flex-col">
      {/* Search Bar */}
      <div className="px-2 pt-1 pb-1">
        <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
          <Search className="h-3 w-3 shrink-0 text-muted-foreground/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search extensions..."
            className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-0.5 px-2 pb-1 overflow-x-auto">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium transition-colors whitespace-nowrap ${
              filter === opt.value
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-[9px] text-muted-foreground/60">
          {enabledCount}/{extensions.length} active
          {filtered.length !== extensions.length && ` · ${filtered.length} shown`}
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={() => loadExtensions()}
            className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleInstallZip}
            className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
            title="Install from .zip"
          >
            <FileArchive className="h-3 w-3" />
          </button>
          <button
            onClick={handleInstallFolder}
            className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
            title="Install from folder"
          >
            <FolderOpen className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-red-400 bg-red-500/5 border-b border-red-500/10">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Installing indicator */}
      {installing && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-accent bg-accent/5 border-b border-accent/10">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          <span>Installing extension...</span>
        </div>
      )}

      {/* Extensions List */}
      <div className="flex-1 overflow-auto">
        {filtered.map((ext) => (
          <ExtensionRow
            key={ext.name}
            ext={ext}
            onSelect={() => selectExtension(ext.name)}
          />
        ))}

        {filtered.length === 0 && !loading && extensions.length > 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Filter className="mb-2 h-5 w-5 opacity-20" />
            <p className="text-[10px]">No matching extensions</p>
          </div>
        )}

        {extensions.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Blocks className="mb-3 h-8 w-8 opacity-20" />
            <p className="text-[11px] font-medium">No extensions installed</p>
            <p className="mt-1 text-[10px] text-muted-foreground/60 text-center px-4">
              Install extensions from .zip files or folders to add themes, languages, and more.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleInstallZip}
                className="flex items-center gap-1.5 rounded-md bg-accent/10 px-3 py-1.5 text-[10px] font-medium text-accent hover:bg-accent/20 transition-colors"
              >
                <FileArchive className="h-3 w-3" />
                Install .zip
              </button>
              <button
                onClick={handleInstallFolder}
                className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <FolderOpen className="h-3 w-3" />
                Open Folder
              </button>
            </div>
          </div>
        )}

        {loading && extensions.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}
