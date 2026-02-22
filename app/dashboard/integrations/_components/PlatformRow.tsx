'use client';

import { useState, useTransition } from 'react';
import { toggleIntegration, mockSyncIntegration } from '../actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntegrationData = {
  id: string;
  platform: string;
  status: string;
  last_sync_at: string | null;
} | null;

interface Props {
  locationId: string;
  platform: 'google' | 'apple' | 'bing';
  /** null when no integration row exists for this platform (not connected) */
  integration: IntegrationData;
}

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

const PLATFORM_CONFIG = {
  google: {
    name: 'Google Business Profile',
    description: 'Sync your data to Google Search & Maps',
    badge: 'G',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  apple: {
    name: 'Apple Business Connect',
    description: 'Sync your data to Apple Maps',
    badge: '',
    badgeClass: 'bg-slate-900 text-white',
  },
  bing: {
    name: 'Bing Places for Business',
    description: 'Sync your data to Microsoft Bing',
    badge: 'B',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
} as const;

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  connected: {
    label: 'Connected',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  syncing: {
    label: 'Syncing…',
    className: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  },
  error: {
    label: 'Error',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
  },
  disconnected: {
    label: 'Not connected',
    className: 'bg-slate-100 text-slate-500 ring-slate-500/20',
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

  const config = PLATFORM_CONFIG[platform];
  const isConnected = integration?.status === 'connected';
  const statusKey = integration?.status ?? 'disconnected';
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.disconnected;

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleIntegration({
        location_id: locationId,
        platform,
        connect: !isConnected,
      });
      if (!result.success) setError(result.error);
    });
  }

  function handleSync() {
    setError(null);
    startTransition(async () => {
      const result = await mockSyncIntegration({
        location_id: locationId,
        platform,
      });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 transition-opacity ${
        isPending ? 'opacity-50' : ''
      }`}
    >
      {/* ── Platform badge ─────────────────────────────────────────── */}
      <span
        className={`flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-lg text-sm font-bold ${config.badgeClass}`}
        aria-hidden
      >
        {/* Apple badge uses a Unicode apple symbol; G and B use letters */}
        {platform === 'apple' ? '\u{F8FF}' : config.badge}
      </span>

      {/* ── Name + description + metadata ──────────────────────────── */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{config.name}</p>
        <p className="text-xs text-slate-500">{config.description}</p>

        {/* Last sync time — shown when a successful sync has occurred */}
        {integration?.last_sync_at && (
          <p className="mt-0.5 text-xs text-slate-400">
            Last synced: {formatSyncTime(integration.last_sync_at)}
          </p>
        )}

        {/* Inline error feedback */}
        {error && (
          <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
        )}
      </div>

      {/* ── Status badge (hidden on very small screens) ─────────────── */}
      <span
        className={`hidden shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset sm:inline-flex ${statusCfg.className}`}
      >
        {statusCfg.label}
      </span>

      {/* ── Sync Now button — only visible when connected ───────────── */}
      {isConnected && (
        <button
          onClick={handleSync}
          disabled={isPending}
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
        >
          {isPending ? (
            <>
              {/* Spinning loader */}
              <svg
                className="h-3 w-3 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Syncing…
            </>
          ) : (
            <>
              {/* Refresh icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Sync Now
            </>
          )}
        </button>
      )}

      {/* ── Connect / Disconnect toggle switch ──────────────────────── */}
      {/*
        aria-checked reflects the connection state.
        isPending disables the button during any in-flight action (toggle or sync)
        so the two actions can't race each other.
      */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        role="switch"
        aria-checked={isConnected}
        aria-label={`${isConnected ? 'Disconnect from' : 'Connect to'} ${config.name}`}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          isConnected ? 'bg-indigo-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            isConnected ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
