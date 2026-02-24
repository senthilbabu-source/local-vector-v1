// ---------------------------------------------------------------------------
// /dashboard/integrations — Listings Big 6 table (Sprint 27A)
//
// Shows all 6 NAP platforms for each location, regardless of whether a
// connection row exists in the DB. Users can:
//   • Enter a listing URL (saved on blur via savePlatformUrl Server Action)
//   • Toggle connect/disconnect (mock OAuth state — real API in Phase 8b)
//   • Trigger a sync (mock — real API calls wired in Phase 8b)
//
// NAP Coverage badge per location: connected / 6 platforms.
// Deep Night theme (bg-surface-dark, bg-midnight-slate, etc.) matches
// the rest of the dashboard shell.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BIG_6_PLATFORMS } from '@/lib/schemas/integrations';
import PlatformRow, { type IntegrationData } from './_components/PlatformRow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Integration = {
  id: string;
  platform: string;
  status: string;
  last_sync_at: string | null;
  listing_url: string | null;
};

type LocationWithIntegrations = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  location_integrations: Integration[];
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPageData(): Promise<LocationWithIntegrations[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Fetch all org locations joined with their integration rows (including listing_url).
  // RLS org_isolation_select on both tables ensures only this org's data is returned.
  const { data, error } = (await supabase
    .from('locations')
    .select(
      'id, business_name, city, state, location_integrations(id, platform, status, last_sync_at, listing_url)'
    )
    .order('created_at', { ascending: true })) as {
    data: LocationWithIntegrations[] | null;
    error: unknown;
  };

  if (error) {
    console.error('[integrations] fetch error:', error);
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Helper: NAP coverage stats for a location
// ---------------------------------------------------------------------------

function napCoverage(integrations: Integration[]): { connected: number; pct: number } {
  const connected = integrations.filter((i) => i.status === 'connected').length;
  const pct = Math.round((connected / BIG_6_PLATFORMS.length) * 100);
  return { connected, pct };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function IntegrationsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const locations = await fetchPageData();

  // Overall connected count across all locations × all 6 platforms
  const totalConnected = locations.reduce(
    (n, loc) =>
      n + loc.location_integrations.filter((i) => i.status === 'connected').length,
    0
  );
  const totalPossible = locations.length * BIG_6_PLATFORMS.length;

  return (
    <div className="space-y-6">

      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Listings</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Add your listing URLs and connect to the Big 6 platforms so AI
            engines read your ground-truth NAP data directly.
          </p>
        </div>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────── */}
      {locations.length > 0 && (
        <div className="flex flex-wrap gap-4">
          <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
            <p className="text-xs text-slate-500">Locations</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">
              {locations.length}
            </p>
          </div>
          <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
            <p className="text-xs text-slate-500">Platforms connected</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-400">
              {totalConnected}
            </p>
          </div>
          <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
            <p className="text-xs text-slate-500">Not connected</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-500">
              {totalPossible - totalConnected}
            </p>
          </div>
        </div>
      )}

      {/* ── Empty state — no locations yet ─────────────────────────── */}
      {locations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center ring-1 ring-white/5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-10 w-10 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
            />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-400">No locations yet</p>
          <p className="mt-1 text-xs text-slate-500">
            You need at least one location before managing platform listings.
          </p>
          <Link
            href="/dashboard/locations"
            className="mt-4 inline-flex items-center rounded-lg bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy shadow-sm transition hover:opacity-90"
          >
            Add a Location
          </Link>
        </div>
      )}

      {/* ── Location cards ─────────────────────────────────────────── */}
      {locations.map((location) => {
        const { connected, pct } = napCoverage(location.location_integrations);
        const locationLabel = [location.business_name, location.city, location.state]
          .filter(Boolean)
          .join(', ');

        return (
          <div
            key={location.id}
            className="overflow-hidden rounded-xl bg-surface-dark ring-1 ring-white/5"
          >
            {/* Card header with NAP Coverage badge */}
            <div className="flex items-center justify-between border-b border-white/5 bg-midnight-slate px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-white">{locationLabel}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {connected}/{BIG_6_PLATFORMS.length} platforms connected
                </p>
              </div>
              {/* NAP Coverage badge */}
              <span
                className={[
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                  pct >= 67
                    ? 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/20'
                    : pct >= 34
                    ? 'bg-amber-400/10 text-amber-400 ring-amber-400/20'
                    : 'bg-slate-400/10 text-slate-400 ring-slate-400/20',
                ].join(' ')}
              >
                {connected}/{BIG_6_PLATFORMS.length} Platforms &mdash; {pct}% Coverage
              </span>
            </div>

            {/* Platform rows — all 6, regardless of DB rows */}
            <div className="divide-y divide-white/5">
              {BIG_6_PLATFORMS.map((platform) => {
                // Find the matching integration row, or pass null if not connected
                const integrationRow = location.location_integrations.find(
                  (i) => i.platform === platform
                );
                const integration: IntegrationData = integrationRow ?? null;

                return (
                  <PlatformRow
                    key={platform}
                    locationId={location.id}
                    platform={platform}
                    integration={integration}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Informational footer note ───────────────────────────────── */}
      {locations.length > 0 && (
        <p className="text-center text-xs text-slate-600">
          OAuth connection (real-time sync to Google Business Profile, Yelp, Apple Maps,
          Facebook, Tripadvisor, Bing Places) will be wired in Phase 8b. Enter your
          listing URLs now so AI engines can reference them immediately.
        </p>
      )}

    </div>
  );
}
