import React, { useState } from 'react';
import { RefreshCw, Circle, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { useLspStore } from '../../../stores/lsp-store';
import { LspBridge } from '../../../lib/lsp-bridge';
import { BUILTIN_SERVERS } from '@hyscode/lsp-client';
import type { BuiltinServerConfig } from '@hyscode/lsp-client';

function StatusDot({ status }: { status: string }) {
  switch (status) {
    case 'ready':
      return <CheckCircle2 className="h-3 w-3 text-success" />;
    case 'starting':
      return <Circle className="h-3 w-3 animate-pulse text-yellow-400" />;
    case 'error':
      return <XCircle className="h-3 w-3 text-destructive" />;
    default:
      return <Circle className="h-3 w-3 text-muted-foreground" />;
  }
}

function CopyCode({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <span className="group flex items-center gap-1.5">
      <code className={`select-text font-mono ${className ?? ''}`}>{text}</code>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        title="Copy"
      >
        {copied
          ? <Check className="h-2.5 w-2.5 text-success" />
          : <Copy className="h-2.5 w-2.5" />
        }
      </button>
    </span>
  );
}

function ServerRow({ server }: { server: BuiltinServerConfig }) {
  const [expanded, setExpanded] = useState(false);
  const probeResults = useLspStore((s) => s.probeResults);
  const serverStatuses = useLspStore((s) => s.serverStatuses);
  const disabledServers = useLspStore((s) => s.disabledServers);
  const toggleServer = useLspStore((s) => s.toggleServer);

  const command = server.command.split(' ')[0];
  const installed = probeResults[command];
  const isEnabled = !disabledServers.has(server.id);

  // Find active status for any of this server's languages
  const activeStatus = server.languageIds
    .map((id) => serverStatuses[id])
    .find((s) => s !== undefined);

  return (
    <div className="rounded-lg border border-border bg-background">
      <button
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium">{server.displayName}</span>
            {activeStatus && <StatusDot status={activeStatus.status} />}
          </div>
          <span className="text-[10px] text-muted-foreground">{server.description}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {installed === undefined ? (
            <span className="text-[10px] text-muted-foreground">Checking…</span>
          ) : installed ? (
            <span className="text-[10px] text-success">Installed</span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-yellow-400">
              <AlertTriangle className="h-2.5 w-2.5" />
              Not found
            </span>
          )}

          <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={() => toggleServer(server.id, !isEnabled)}
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-muted rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-foreground after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
            <span className="text-muted-foreground">Command:</span>
            <CopyCode
              text={`${server.command}${server.args?.length ? ' ' + server.args.join(' ') : ''}`}
              className="text-foreground"
            />

            <span className="text-muted-foreground">Languages:</span>
            <span>{server.languageIds.join(', ')}</span>

            {!installed && server.installInstructions && (
              <>
                <span className="text-muted-foreground col-span-2 mt-1 font-medium">Install:</span>
                {Object.entries(server.installInstructions).map(([platform, cmd]) => (
                  <React.Fragment key={platform}>
                    <span className="text-muted-foreground capitalize">{platform}:</span>
                    <CopyCode text={cmd} className="text-accent" />
                  </React.Fragment>
                ))}
              </>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
              onClick={() => {
                for (const langId of server.languageIds) {
                  LspBridge.restartServer(langId);
                }
              }}
            >
              <RefreshCw className="h-2.5 w-2.5 inline mr-1" />
              Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LanguageServersTab() {
  const probeComplete = useLspStore((s) => s.probeComplete);
  const [rescanning, setRescanning] = React.useState(false);

  async function handleRescan() {
    setRescanning(true);
    await LspBridge.reprobeServers();
    setRescanning(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[13px] font-semibold">Language Servers</h3>
          <p className="text-[11px] text-muted-foreground">
            Built-in language servers for code intelligence. Servers start automatically when you open a supported file.
          </p>
        </div>
        <button
          onClick={handleRescan}
          disabled={rescanning || !probeComplete}
          className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50"
          title="Re-scan after installing language servers"
        >
          <RefreshCw className={`h-2.5 w-2.5 ${rescanning ? 'animate-spin' : ''}`} />
          Re-scan
        </button>
      </div>

      {!probeComplete && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Scanning for installed language servers…
        </div>
      )}

      <div className="space-y-1.5">
        {BUILTIN_SERVERS.map((server) => (
          <ServerRow key={server.id} server={server} />
        ))}
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-[10px] text-muted-foreground">
          Extensions can contribute additional language servers. Install language extensions from the Extensions panel.
        </p>
      </div>
    </div>
  );
}
