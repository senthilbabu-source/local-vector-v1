'use client';

// ---------------------------------------------------------------------------
// GBPImportCard — Sprint 89
//
// Dashboard card for Growth+ users with GBP connected.
// Shows last sync time or "never synced" CTA.
// Plan-gated: only rendered when canConnectGBP(plan) is true.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { triggerGBPImport } from '@/app/actions/gbp-import';
import { useRouter } from 'next/navigation';

interface GBPImportCardProps {
  gbpSyncedAt: string | null;
}

function formatSyncAge(syncedAt: string): string {
  const diffMs = Date.now() - new Date(syncedAt).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function GBPImportCard({ gbpSyncedAt }: GBPImportCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);

  async function handleSync() {
    setLoading(true);
    const result = await triggerGBPImport();
    setLoading(false);

    if (result.ok) {
      setSynced(true);
      router.refresh();
    }
  }

  const hasSynced = !!gbpSyncedAt;
  const isStale = gbpSyncedAt
    ? Date.now() - new Date(gbpSyncedAt).getTime() > 30 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div
      data-testid="gbp-import-card"
      className="rounded-xl border border-white/10 bg-card-dark/60 p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Google Business Profile</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {synced
              ? 'Synced just now'
              : hasSynced
                ? `Connected \u00b7 Last synced ${formatSyncAge(gbpSyncedAt!)}`
                : 'Connected \u00b7 Never synced'}
          </p>
        </div>

        <button
          data-testid="gbp-sync-btn"
          onClick={handleSync}
          disabled={loading || synced}
          className="rounded-lg border border-signal-green/30 bg-signal-green/10 px-3 py-1.5 text-xs font-medium text-signal-green transition-colors hover:bg-signal-green/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Syncing...
            </span>
          ) : synced ? (
            'Synced'
          ) : hasSynced && !isStale ? (
            'Sync Now'
          ) : (
            'Import Your Business Data'
          )}
        </button>
      </div>
    </div>
  );
}
