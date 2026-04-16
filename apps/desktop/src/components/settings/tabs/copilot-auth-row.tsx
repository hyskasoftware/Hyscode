// ─── GitHub Copilot OAuth Auth Row ──────────────────────────────────────────
// Replaces the standard ApiKeyRow for GitHub Copilot. Instead of entering an
// API key, the user authenticates via the GitHub OAuth Device Flow.

import { useState, useEffect, useRef } from 'react';
import { LogIn, LogOut, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tauriInvoke } from '@/lib/tauri-invoke';
import { reinitProvider } from '@/lib/init-providers';
import { useSettingsStore } from '@/stores/settings-store';

interface CopilotAuthRowProps {
  className?: string;
}

type AuthState =
  | { step: 'idle' }
  | { step: 'loading' }
  | { step: 'waiting'; userCode: string; verificationUri: string; deviceCode: string; interval: number }
  | { step: 'authenticated' }
  | { step: 'error'; message: string };

export function CopilotAuthRow({ className }: CopilotAuthRowProps) {
  const [authState, setAuthState] = useState<AuthState>({ step: 'idle' });
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clientId = useSettingsStore((s) => s.githubCopilotClientId);

  // Check initial auth status
  useEffect(() => {
    tauriInvoke('github_copilot_is_authenticated', {})
      .then((authed) => {
        if (authed) setAuthState({ step: 'authenticated' });
      })
      .catch(() => {});
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startAuth = async () => {
    if (!clientId?.trim()) {
      setAuthState({ step: 'error', message: 'Set your GitHub OAuth App Client ID in the field above first.' });
      return;
    }

    setAuthState({ step: 'loading' });

    try {
      const resp = await tauriInvoke('github_oauth_start', { clientId: clientId.trim() });

      setAuthState({
        step: 'waiting',
        userCode: resp.user_code,
        verificationUri: resp.verification_uri,
        deviceCode: resp.device_code,
        interval: resp.interval,
      });

      // Start polling
      const interval = Math.max(resp.interval, 5) * 1000;
      pollRef.current = setInterval(async () => {
        try {
          await tauriInvoke('github_oauth_poll', {
            clientId: clientId.trim(),
            deviceCode: resp.device_code,
          });

          // Success — get the Copilot token
          await tauriInvoke('github_copilot_ensure_token', {});
          await reinitProvider('github-copilot');

          if (pollRef.current) clearInterval(pollRef.current);
          setAuthState({ step: 'authenticated' });
        } catch (err) {
          const msg = String(err);
          if (msg.includes('authorization_pending') || msg.includes('slow_down')) {
            return; // Keep polling
          }
          // Actual error — stop polling
          if (pollRef.current) clearInterval(pollRef.current);
          setAuthState({ step: 'error', message: msg });
        }
      }, interval);
    } catch (err) {
      setAuthState({ step: 'error', message: String(err) });
    }
  };

  const disconnect = async () => {
    try {
      await tauriInvoke('github_copilot_disconnect', {});
      await reinitProvider('github-copilot');
      setAuthState({ step: 'idle' });
    } catch (err) {
      setAuthState({ step: 'error', message: String(err) });
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={className}>
      {/* Client ID input */}
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[11px] text-muted-foreground min-w-[100px]">OAuth Client ID</label>
        <input
          type="text"
          value={clientId ?? ''}
          onChange={(e) => useSettingsStore.getState().set('githubCopilotClientId', e.target.value)}
          placeholder="Iv1.xxxxxxxxxxxxxxxx"
          className="h-7 flex-1 rounded-md bg-muted px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50 font-mono"
        />
      </div>

      {/* Auth state display */}
      {authState.step === 'idle' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={startAuth}
          className="h-7 text-[11px] gap-1.5"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in with GitHub
        </Button>
      )}

      {authState.step === 'loading' && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Starting authentication...
        </div>
      )}

      {authState.step === 'waiting' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Enter code:</span>
            <code className="bg-muted px-2 py-0.5 rounded text-[12px] font-mono font-bold tracking-wider">
              {authState.userCode}
            </code>
            <button
              onClick={() => copyCode(authState.userCode)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <a
            href={authState.verificationUri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open GitHub to authorize
          </a>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Waiting for authorization...
          </div>
        </div>
      )}

      {authState.step === 'authenticated' && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-green-500">● Connected to GitHub Copilot</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={disconnect}
            className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-3 w-3" />
            Disconnect
          </Button>
        </div>
      )}

      {authState.step === 'error' && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-destructive">{authState.message}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={startAuth}
            className="h-6 text-[10px] gap-1 w-fit"
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
