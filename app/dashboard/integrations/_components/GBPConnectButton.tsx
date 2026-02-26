// ---------------------------------------------------------------------------
// GBPConnectButton — Sprint 57B: GBP OAuth Connect/Disconnect UI
//
// States:
//   1. Not configured (GOOGLE_CLIENT_ID absent) → "Not configured" disabled
//   2. Plan-gated (trial tier) → "Upgrade to Connect" link
//   3. Not connected (no google_oauth_tokens row) → "Connect GBP" button
//   4. Connected → Shows email + "Disconnect" button
//
// This is a client component that receives server-derived props.
// Tokens are NEVER exposed to the client — only email + connected status.
// ---------------------------------------------------------------------------

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { disconnectGBP } from '../actions';

export interface GBPConnectProps {
  /** Whether GOOGLE_CLIENT_ID is configured */
  configured: boolean;
  /** Whether the org's plan allows GBP connection */
  planAllowed: boolean;
  /** Whether a google_oauth_tokens row exists for this org */
  connected: boolean;
  /** The Google email associated with the connection */
  googleEmail: string | null;
  /** The GBP account name (accounts/xxxxx) */
  gbpAccountName: string | null;
}

export default function GBPConnectButton({
  configured,
  planAllowed,
  connected,
  googleEmail,
  gbpAccountName,
}: GBPConnectProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isDisconnected, setIsDisconnected] = useState(false);

  // After disconnect, show "not connected" state until page refreshes
  const showConnected = connected && !isDisconnected;

  function handleDisconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectGBP();
      if (result.success) {
        setIsDisconnected(true);
      } else {
        setError(result.error);
      }
    });
  }

  // State 1: Not configured
  if (!configured) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-slate-400/10 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-400/20">
          Not configured
        </span>
        <p className="text-xs text-slate-600">Google OAuth is not configured for this environment.</p>
      </div>
    );
  }

  // State 2: Plan-gated
  if (!planAllowed) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center rounded-lg bg-signal-green/10 px-3 py-1.5 text-xs font-semibold text-signal-green ring-1 ring-inset ring-signal-green/20 transition hover:bg-signal-green/20"
        >
          Upgrade to Connect
        </Link>
        <p className="text-xs text-slate-500">Upgrade your plan to connect Google Business Profile.</p>
      </div>
    );
  }

  // State 3: Not connected
  if (!showConnected) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <a
            href="/api/auth/google"
            className={`inline-flex items-center gap-2 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 ring-1 ring-inset ring-blue-400/20 transition hover:bg-blue-500/20 ${isPending ? 'pointer-events-none opacity-50' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Connect Google Business Profile
          </a>
        </div>
        {error && <p className="text-xs text-alert-crimson">{error}</p>}
      </div>
    );
  }

  // State 4: Connected
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
          Connected
        </span>
        {googleEmail && (
          <span className="text-xs text-slate-400">{googleEmail}</span>
        )}
        {gbpAccountName && (
          <span className="text-xs text-slate-600">{gbpAccountName}</span>
        )}
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={isPending}
          className="text-xs font-medium text-slate-500 hover:text-alert-crimson transition-colors disabled:opacity-50"
        >
          {isPending ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
      {error && <p className="text-xs text-alert-crimson">{error}</p>}
    </div>
  );
}
