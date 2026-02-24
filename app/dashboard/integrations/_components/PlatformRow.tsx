'use client';

// ---------------------------------------------------------------------------
// PlatformRow — Sprint 27A: Big 6 + listing URL input
//
// Renders one row in the Listings table for a single platform.
// Supports all 6 NAP platforms (google, yelp, apple, facebook, tripadvisor, bing).
//
// New in Sprint 27A:
//   • listingUrl prop + editable URL input (saved on blur via savePlatformUrl)
//   • Deep Night theme (surface-dark / slate palette) consistent with dashboard
//   • Platform config expanded to all Big 6
// ---------------------------------------------------------------------------

import { useState, useTransition, useRef } from 'react';
import { toggleIntegration, mockSyncIntegration, savePlatformUrl } from '../actions';
import type { Big6Platform } from '@/lib/schemas/integrations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntegrationData = {
  id: string;
  platform: string;
  status: string;
  last_sync_at: string | null;
  listing_url: string | null;
} | null;

interface Props {
  locationId: string;
  platform: Big6Platform;
  /** null when no integration row exists for this platform (not connected / no URL set) */
  integration: IntegrationData;
}

// ---------------------------------------------------------------------------
// Static config — Big 6 platforms
// ---------------------------------------------------------------------------

const PLATFORM_CONFIG: Record<Big6Platform, {
  name: string;
  description: string;
  badge: string;
  badgeClass: string;
}> = {
  google: {
    name: 'Google Business Profile',
    description: 'Appears in Google Search & Maps',
    badge: 'G',
    badgeClass: 'bg-blue-500/20 text-blue-400',
  },
  yelp: {
    name: 'Yelp for Business',
    description: 'Reviews & discovery on Yelp',
    badge: 'Y',
    badgeClass: 'bg-red-500/20 text-red-400',
  },
  apple: {
    name: 'Apple Business Connect',
    description: 'Appears in Apple Maps & Siri',
    badge: '\u{F8FF}',
    badgeClass: 'bg-slate-700 text-slate-300',
  },
  facebook: {
    name: 'Facebook Places',
    description: 'Business listing on Facebook & Instagram',
    badge: 'f',
    badgeClass: 'bg-blue-600/20 text-blue-300',
  },
  tripadvisor: {
    name: 'Tripadvisor',
    description: 'Reviews & ranking on Tripadvisor',
    badge: 'TA',
    badgeClass: 'bg-green-600/20 text-green-400',
  },
  bing: {
    name: 'Bing Places for Business',
    description: 'Appears in Bing Search & Maps',
    badge: 'B',
    badgeClass: 'bg-orange-500/20 text-orange-400',
  },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  connected: {
    label: 'Connected',
    className: 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/20',
  },
  syncing: {
    label: 'Syncing…',
    className: 'bg-signal-green/10 text-signal-green ring-signal-green/20',
  },
  error: {
    label: 'Error',
    className: 'bg-red-400/10 text-red-400 ring-red-400/20',
  },
  disconnected: {
    label: 'Not connected',
    className: 'bg-slate-400/10 text-slate-500 ring-slate-500/20',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlatformRow({ locationId, platform, integration }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [urlSaved, setUrlSaved] = useState(false);

  // Local URL state — initialised from DB; user edits in-place, saved on blur
  const [urlValue, setUrlValue] = useState(integration?.listing_url ?? '');
  const prevUrlRef = useRef(integration?.listing_url ?? '');

  const config = PLATFORM_CONFIG[platform];
  const isConnected = integration?.status === 'connected';
  const statusKey = integration?.status ?? 'disconnected';
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.disconnected;

  // ── Toggle connect / disconnect ──────────────────────────────────────────
  function handleToggle() {
    setError(null);
    setUrlSaved(false);
    startTransition(async () => {
      const result = await toggleIntegration({
        location_id: locationId,
        platform: platform as 'google' | 'apple' | 'bing',
        connect: !isConnected,
      });
      if (!result.success) setError(result.error);
    });
  }

  // ── Trigger sync ─────────────────────────────────────────────────────────
  function handleSync() {
    setError(null);
    setUrlSaved(false);
    startTransition(async () => {
      const result = await mockSyncIntegration({
        location_id: locationId,
        platform: platform as 'google' | 'apple' | 'bing',
      });
      if (!result.success) setError(result.error);
    });
  }

  // ── Save listing URL on blur (only if value changed) ─────────────────────
  function handleUrlBlur() {
    const trimmed = urlValue.trim();
    if (trimmed === prevUrlRef.current) return;  // no change — skip round-trip
    if (trimmed === '') return;                    // empty — don't save blank URLs
    setError(null);
    setUrlSaved(false);
    startTransition(async () => {
      const result = await savePlatformUrl(platform, trimmed, locationId);
      if (result.success) {
        prevUrlRef.current = trimmed;
        setUrlSaved(true);
        setTimeout(() => setUrlSaved(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className={[
        'px-5 py-4 transition-opacity',
        isPending ? 'opacity-50' : '',
      ].join(' ')}
    >
      {/* ── Main row (icon + name + status + toggle) ─────────────────── */}
      <div className="flex items-center gap-4">

        {/* Platform badge */}
        <span
          className={[
            'flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-lg text-sm font-bold',
            config.badgeClass,
          ].join(' ')}
          aria-hidden
        >
          {config.badge}
        </span>

        {/* Name + description */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{config.name}</p>
          <p className="text-xs text-slate-500">{config.description}</p>

          {/* Last sync time */}
          {integration?.last_sync_at && (
            <p className="mt-0.5 text-xs text-slate-600">
              Last synced: {formatSyncTime(integration.last_sync_at)}
            </p>
          )}
        </div>

        {/* Status chip */}
        <span
          className={[
            'hidden shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset sm:inline-flex',
            statusCfg.className,
          ].join(' ')}
        >
          {statusCfg.label}
        </span>

        {/* Sync Now button — only when connected (and toggle supports platform) */}
        {isConnected && (platform === 'google' || platform === 'apple' || platform === 'bing') && (
          <button
            onClick={handleSync}
            disabled={isPending}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-signal-green focus:ring-offset-1 focus:ring-offset-midnight-slate disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
          >
            {isPending ? (
              <>
                <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
        )}

        {/* Connect / Disconnect toggle */}
        {(platform === 'google' || platform === 'apple' || platform === 'bing') && (
          <button
            onClick={handleToggle}
            disabled={isPending}
            role="switch"
            aria-checked={isConnected}
            aria-label={`${isConnected ? 'Disconnect from' : 'Connect to'} ${config.name}`}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-signal-green focus:ring-offset-2 focus:ring-offset-midnight-slate disabled:cursor-not-allowed disabled:opacity-50',
              isConnected ? 'bg-signal-green' : 'bg-slate-700',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                isConnected ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        )}
      </div>

      {/* ── Listing URL input (all platforms) ───────────────────────── */}
      <div className="mt-3 pl-13">
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={urlValue}
            onChange={(e) => { setUrlValue(e.target.value); setUrlSaved(false); }}
            onBlur={handleUrlBlur}
            placeholder={`https://www.${platform === 'google' ? 'g.page' : platform}.com/your-business`}
            disabled={isPending}
            className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 transition focus:border-signal-green/60 focus:outline-none focus:ring-1 focus:ring-signal-green/60 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`${config.name} listing URL`}
          />
          {/* Saved confirmation */}
          {urlSaved && (
            <span className="shrink-0 text-xs font-medium text-emerald-400">Saved</span>
          )}
        </div>

        {/* Inline error */}
        {error && (
          <p className="mt-1.5 text-xs font-medium text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
