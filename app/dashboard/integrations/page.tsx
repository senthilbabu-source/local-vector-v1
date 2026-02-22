import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PlatformRow, { type IntegrationData } from './_components/PlatformRow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Integration = {
  id: string;
  platform: string;
  status: string;
  last_sync_at: string | null;
};

type LocationWithIntegrations = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  location_integrations: Integration[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS = ['google', 'apple', 'bing'] as const;

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Business Profile',
  apple:  'Apple Business Connect',
  bing:   'Bing Places',
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPageData(): Promise<LocationWithIntegrations[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Fetch all org locations joined with their integration rows.
  // RLS org_isolation_select on both tables ensures only this org's data is returned.
  const { data, error } = (await supabase
    .from('locations')
    .select(
      'id, business_name, city, state, location_integrations(id, platform, status, last_sync_at)'
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
// Page
// ---------------------------------------------------------------------------

export default async function IntegrationsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const locations = await fetchPageData();

  // Count totals for the summary strip
  const totalConnected = locations.reduce(
    (n, loc) =>
      n + loc.location_integrations.filter((i) => i.status === 'connected').length,
    0
  );
  const totalPossible = locations.length * PLATFORMS.length;

  return (
    <div className="space-y-6">

      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Integrations</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Connect your locations to Google, Apple, and Bing so AI engines
            read your ground-truth data directly.
          </p>
        </div>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────── */}
      {locations.length > 0 && (
        <div className="flex flex-wrap gap-4">
          <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs text-slate-500">Locations</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">
              {locations.length}
            </p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs text-slate-500">Connected</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-600">
              {totalConnected}
            </p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs text-slate-500">Not connected</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-400">
              {totalPossible - totalConnected}
            </p>
          </div>
        </div>
      )}

      {/* ── Empty state — no locations yet ─────────────────────────── */}
      {locations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-900/5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-10 w-10 text-slate-300"
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
          <p className="mt-3 text-sm font-medium text-slate-500">No locations yet</p>
          <p className="mt-1 text-xs text-slate-400">
            You need at least one location before connecting third-party platforms.
          </p>
          <Link
            href="/dashboard/locations"
            className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Add a Location
          </Link>
        </div>
      )}

      {/* ── Location cards ─────────────────────────────────────────── */}
      {locations.map((location) => {
        const locationLabel = [location.business_name, location.city, location.state]
          .filter(Boolean)
          .join(', ');

        return (
          <div
            key={location.id}
            className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5"
          >
            {/* Card header */}
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-800">{locationLabel}</h2>
              <p className="text-xs text-slate-500">
                {location.location_integrations.filter((i) => i.status === 'connected').length}
                {' '}of {PLATFORMS.length} platforms connected
              </p>
            </div>

            {/* Platform rows — one per supported platform */}
            <div className="divide-y divide-slate-100">
              {PLATFORMS.map((platform) => {
                // Find the matching integration row, or pass null if not connected
                const integration: IntegrationData =
                  location.location_integrations.find(
                    (i) => i.platform === platform
                  ) ?? null;

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
        <p className="text-center text-xs text-slate-400">
          Connections are mocked in Phase 8 scaffolding. Real API sync (
          {Object.values(PLATFORM_LABELS).join(', ')}) will be wired in
          Phase 8b when production API keys are configured.
        </p>
      )}

    </div>
  );
}
