// ---------------------------------------------------------------------------
// WordPressConnectButton — Sprint 61C: WordPress integration UI
//
// States:
//   1. Not connected → "Connect WordPress" button (opens modal)
//   2. Connected → Green badge + site URL + "Disconnect" button
//
// Client component that receives server-derived props.
// Credentials are NEVER exposed to the client.
// ---------------------------------------------------------------------------

'use client';

import { useState, useTransition } from 'react';
import { disconnectWordPress } from '../actions';
import WordPressConnectModal from './WordPressConnectModal';

export interface WordPressConnectProps {
  locationId: string;
  connected: boolean;
  siteUrl: string | null;
}

export default function WordPressConnectButton({
  locationId,
  connected,
  siteUrl,
}: WordPressConnectProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const showConnected = connected && !isDisconnected;

  function handleDisconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectWordPress(locationId);
      if (result.success) {
        setIsDisconnected(true);
      } else {
        setError(result.error);
      }
    });
  }

  // Not connected
  if (!showConnected) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-electric-indigo/10 px-4 py-2 text-sm font-semibold text-electric-indigo ring-1 ring-inset ring-electric-indigo/20 transition hover:bg-electric-indigo/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.47 2.52A8.22 8.22 0 0015.52.36c-2.57 0-4.96 1.15-6.56 3.14a.5.5 0 00.08.7.5.5 0 00.7-.08A7.22 7.22 0 0115.52 1.36a7.2 7.2 0 015.21 1.89 7.28 7.28 0 012.17 5.18A7.27 7.27 0 0120.73 13.6a7.22 7.22 0 01-5.21 2.18h-.94a.5.5 0 000 1h.94a8.22 8.22 0 005.95-2.49 8.27 8.27 0 002.43-5.87 8.28 8.28 0 00-2.43-5.9z" />
              <path d="M8.48 23.64a8.22 8.22 0 005.95-2.5.5.5 0 00-.01-.7.5.5 0 00-.7.01 7.22 7.22 0 01-5.24 2.19 7.27 7.27 0 01-5.21-2.17A7.28 7.28 0 011.1 15.29a7.27 7.27 0 012.17-5.17A7.22 7.22 0 018.48 7.94h.94a.5.5 0 000-1h-.94a8.22 8.22 0 00-5.95 2.49A8.27 8.27 0 00.1 15.3a8.28 8.28 0 002.43 5.9 8.22 8.22 0 005.95 2.44z" />
            </svg>
            Connect WordPress
          </button>
        </div>
        {error && <p className="text-xs text-alert-crimson">{error}</p>}
        <WordPressConnectModal
          locationId={locationId}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      </div>
    );
  }

  // Connected
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
          Connected
        </span>
        {siteUrl && (
          <span className="text-xs text-slate-400">{siteUrl}</span>
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
