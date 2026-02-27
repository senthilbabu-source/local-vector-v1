'use client';

// ---------------------------------------------------------------------------
// GBPImportInterstitial — Sprint 89
//
// Shown on the onboarding page when the user has a GBP connection but hasn't
// imported data yet. Offers one-click import or manual entry fallback.
//
// States: idle → importing → success | error
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { triggerGBPImport, type GBPImportResult } from '@/app/actions/gbp-import';
import type { MappedLocationData } from '@/lib/gbp/gbp-data-mapper';

const ERROR_MESSAGES: Record<string, string> = {
  not_connected: 'Your Google Business Profile connection was lost. Please reconnect in Settings.',
  token_expired: 'Your Google authorization has expired. Please reconnect your Google Business Profile.',
  gbp_api_error: 'We couldn\u2019t reach Google\u2019s servers right now. Try again in a moment, or enter your info manually.',
  no_location: 'No business location found to update. Please enter your info manually.',
  upsert_failed: 'Something went wrong saving your data. Please try again or enter manually.',
};

function formatHoursSummary(hours: MappedLocationData['hours_data']): string {
  if (!hours) return '';
  const entries = Object.entries(hours);
  const openDays = entries.filter(([, v]) => v !== 'closed' && typeof v === 'object');
  if (openDays.length === 0) return 'All days closed';
  if (openDays.length === 7) return 'Open 7 days';
  return `Open ${openDays.length} days/week`;
}

function formatAmenitiesSummary(amenities: MappedLocationData['amenities']): string {
  if (!amenities) return '';
  const labels: Record<string, string> = {
    wifi: 'WiFi',
    outdoor_seating: 'Outdoor Seating',
    alcohol: 'Full Bar',
    bar: 'Bar',
    live_music: 'Live Music',
    reservations: 'Reservations',
    dine_in: 'Dine In',
    takeout: 'Takeout',
    delivery: 'Delivery',
    parking: 'Parking',
    wheelchair_accessible: 'Wheelchair Accessible',
  };
  return Object.keys(amenities)
    .filter((k) => amenities[k])
    .map((k) => labels[k] ?? k)
    .join(' \u00b7 ');
}

type ImportState = 'idle' | 'importing' | 'success' | 'error';

export default function GBPImportInterstitial() {
  const router = useRouter();
  const [state, setState] = useState<ImportState>('idle');
  const [result, setResult] = useState<GBPImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  async function handleImport() {
    setState('importing');
    const importResult = await triggerGBPImport();
    setResult(importResult);

    if (importResult.ok) {
      setState('success');
      // Auto-advance to dashboard after 2 seconds
      setTimeout(() => router.push('/dashboard'), 2000);
    } else {
      setState('error');
      setErrorMessage(
        ERROR_MESSAGES[importResult.error_code ?? ''] ?? importResult.error ?? 'Import failed. Please try again.',
      );
    }
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (state === 'success' && result?.mapped) {
    const mapped = result.mapped;
    return (
      <div
        data-testid="gbp-import-success"
        className="rounded-2xl border border-signal-green/30 bg-signal-green/5 p-8"
      >
        <div className="mb-4 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-signal-green/20 text-signal-green text-xl mb-3">
            &#10003;
          </div>
          <h2 className="text-lg font-semibold text-white">Imported Successfully!</h2>
        </div>

        <div className="space-y-2 text-sm text-slate-300 mb-6">
          {mapped.business_name && (
            <p>{mapped.business_name}</p>
          )}
          {mapped.phone && (
            <p>{mapped.phone}</p>
          )}
          {mapped.hours_data && (
            <p>{formatHoursSummary(mapped.hours_data)}</p>
          )}
          {mapped.amenities && Object.keys(mapped.amenities).length > 0 && (
            <p className="text-xs text-slate-400">{formatAmenitiesSummary(mapped.amenities)}</p>
          )}
        </div>

        <button
          data-testid="gbp-import-continue"
          onClick={() => router.push('/dashboard')}
          className="w-full rounded-lg bg-signal-green px-4 py-2.5 text-sm font-medium text-midnight-slate transition-colors hover:bg-signal-green/90"
        >
          Continue to Dashboard
        </button>

        <p className="mt-3 text-center text-xs text-slate-500">
          Need to make changes? You can edit anytime in Settings.
        </p>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div
        data-testid="gbp-import-error"
        className="rounded-2xl border border-alert-crimson/30 bg-alert-crimson/5 p-8"
      >
        <div className="mb-4 text-center">
          <h2 className="text-lg font-semibold text-white mb-2">Import Failed</h2>
          <p className="text-sm text-slate-400">{errorMessage}</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            data-testid="gbp-import-retry"
            onClick={handleImport}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Try Again
          </button>
          <a
            href="/onboarding?source=gbp_skip"
            data-testid="gbp-import-manual-fallback"
            className="text-center text-sm text-slate-400 transition-colors hover:text-white"
          >
            Enter my info manually &rarr;
          </a>
        </div>
      </div>
    );
  }

  // ── Idle / Importing state ───────────────────────────────────────────────
  return (
    <div
      data-testid="gbp-import-interstitial"
      className="rounded-2xl border border-white/10 bg-card-dark/60 p-8"
    >
      <div className="mb-6 text-center">
        <h2 className="text-lg font-semibold text-white mb-2">
          Your Google Business Profile is connected!
        </h2>
        <p className="text-sm text-slate-400">
          We can import your business info automatically.
          Hours, phone, address, and amenities &mdash; in one click.
        </p>
      </div>

      <button
        data-testid="gbp-import-btn"
        onClick={handleImport}
        disabled={state === 'importing'}
        className="w-full rounded-lg bg-signal-green px-4 py-3 text-sm font-medium text-midnight-slate transition-colors hover:bg-signal-green/90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'importing' ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Importing...
          </span>
        ) : (
          'Import from Google Business Profile'
        )}
      </button>

      <p className="mt-2 text-center text-xs text-slate-500">Takes &lt; 5 seconds</p>

      <div className="flex items-center gap-3 w-full mt-6">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <a
        href="/onboarding?source=gbp_skip"
        data-testid="gbp-import-skip"
        className="mt-4 block text-center text-sm text-slate-400 transition-colors hover:text-white"
      >
        Enter my info manually &rarr;
      </a>
    </div>
  );
}
