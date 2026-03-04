import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { planSatisfies } from '@/lib/plan-enforcer';
import { getPlanDisplayName } from '@/lib/plan-display-names';

export const metadata = { title: 'Connections | LocalVector.ai' };

// ---------------------------------------------------------------------------
// ConnectionsPage — Server Component (Sprint 130 + 131)
//
// Platform connection management hub for Apple BC and Bing Places.
// Shows per-location connection status, sync history, and manual sync.
// Agency plan required — Growth and below see upgrade prompt.
// ---------------------------------------------------------------------------

interface ConnectionRow {
  id: string;
  location_id: string;
  apple_location_id: string | null;
  claim_status: string;
  last_synced_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  locations: { name: string } | null;
}

interface BingConnectionRow {
  id: string;
  location_id: string;
  bing_listing_id: string | null;
  claim_status: string;
  last_synced_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  conflict_note: string | null;
  locations: { name: string } | null;
}

function StatusBadge({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    claimed: 'bg-emerald-500/15 text-emerald-400',
    pending: 'bg-amber-500/15 text-amber-400',
    unclaimed: 'bg-slate-500/15 text-slate-400',
    error: 'bg-red-500/15 text-red-400',
    conflict: 'bg-orange-500/15 text-orange-400',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status ?? ''] ?? colors.unclaimed}`}>
      {status ?? 'unclaimed'}
    </span>
  );
}

function SyncStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    ok: 'text-emerald-400',
    error: 'text-red-400',
    pending: 'text-amber-400',
    no_changes: 'text-slate-400',
  };

  return (
    <span className={`text-xs ${colors[status] ?? 'text-slate-400'}`}>
      {status === 'ok' ? 'Synced' : status === 'no_changes' ? 'No changes' : status}
    </span>
  );
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function ConnectionsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const isAgency = planSatisfies(ctx.plan, 'agency');

  // Non-Agency: show upgrade prompt
  if (!isAgency) {
    return (
      <div className="max-w-2xl space-y-5" data-testid="connections-page">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Platform Connections</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Sync your business data to Apple Maps, Bing, and more.
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-sm text-slate-300">
            Platform sync is available on the <span className="font-medium text-white">{getPlanDisplayName('agency')}</span> plan.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Currently on: {getPlanDisplayName(ctx.plan)}
          </p>
          <a
            href="/dashboard/billing"
            className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Upgrade to {getPlanDisplayName('agency')}
          </a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  // Cast needed until database.types.ts regenerated with new tables
  const db = supabase as unknown as { from: (t: string) => any };

  // Fetch Apple BC connections
  const { data: appleConnections } = await db.from('apple_bc_connections')
    .select('id, location_id, apple_location_id, claim_status, last_synced_at, sync_status, sync_error, locations(name)')
    .eq('org_id', ctx.orgId!);

  // Fetch Bing connections (Sprint 131)
  const { data: bingConnections } = await db.from('bing_places_connections')
    .select('id, location_id, bing_listing_id, claim_status, last_synced_at, sync_status, sync_error, conflict_note, locations(name)')
    .eq('org_id', ctx.orgId!);

  // Fetch all locations for this org (to show unclaimed ones)
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('org_id', ctx.orgId!);

  const appleRows = (appleConnections ?? []) as unknown as ConnectionRow[];
  const bingRows = (bingConnections ?? []) as unknown as BingConnectionRow[];
  const connectedAppleLocationIds = new Set(appleRows.map(c => c.location_id));
  const connectedBingLocationIds = new Set(bingRows.map(c => c.location_id));
  const unclaimedAppleLocations = (locations ?? []).filter(l => !connectedAppleLocationIds.has(l.id));
  const unclaimedBingLocations = (locations ?? []).filter(l => !connectedBingLocationIds.has(l.id));

  return (
    <div className="max-w-2xl space-y-6" data-testid="connections-page">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Platform Connections</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Sync your business data to Apple Maps, Bing, and more.
        </p>
      </div>

      {/* ── Apple Business Connect ──────────────────────────────── */}
      <section data-testid="apple-bc-section">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🍎</span>
          <h2 className="text-base font-semibold text-white">Apple Business Connect</h2>
        </div>

        <div className="space-y-3">
          {appleRows.map(conn => (
            <div
              key={conn.id}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
              data-testid={`location-connection-${conn.location_id}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {(conn.locations as { name: string } | null)?.name ?? 'Unknown Location'}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={conn.claim_status} />
                    <SyncStatusBadge status={conn.sync_status} />
                    {conn.last_synced_at && (
                      <span className="text-xs text-slate-400">
                        Last synced: {formatTimeAgo(conn.last_synced_at)}
                      </span>
                    )}
                  </div>
                  {conn.sync_error && (
                    <p className="mt-1 text-xs text-red-400">{conn.sync_error}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {unclaimedAppleLocations.map(loc => (
            <div
              key={loc.id}
              className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4"
              data-testid={`location-connection-${loc.id}`}
            >
              <p className="text-sm font-medium text-white">{loc.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status="unclaimed" />
                <span className="text-xs text-slate-400">
                  Not connected to Apple Business Connect
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Visit{' '}
                <a
                  href="https://businessconnect.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  businessconnect.apple.com
                </a>
                {' '}to claim your listing, then enter your Apple Location ID here.
              </p>
            </div>
          ))}

          {appleRows.length === 0 && unclaimedAppleLocations.length === 0 && (
            <p className="text-sm text-slate-400">No locations found.</p>
          )}
        </div>
      </section>

      {/* ── Bing Places (Sprint 131) ───────────────────────────── */}
      <section data-testid="bing-places-section">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔍</span>
          <h2 className="text-base font-semibold text-white">Bing Places</h2>
        </div>

        <div className="space-y-3">
          {bingRows.map(conn => (
            <div
              key={conn.id}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
              data-testid={`bing-connection-${conn.location_id}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {(conn.locations as { name: string } | null)?.name ?? 'Unknown Location'}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={conn.claim_status} />
                    <SyncStatusBadge status={conn.sync_status} />
                    {conn.last_synced_at && (
                      <span className="text-xs text-slate-400">
                        Last synced: {formatTimeAgo(conn.last_synced_at)}
                      </span>
                    )}
                  </div>
                  {conn.conflict_note && (
                    <p className="mt-1 text-xs text-orange-400">{conn.conflict_note}</p>
                  )}
                  {conn.sync_error && (
                    <p className="mt-1 text-xs text-red-400">{conn.sync_error}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {unclaimedBingLocations.map(loc => (
            <div
              key={loc.id}
              className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4"
              data-testid={`bing-connection-${loc.id}`}
            >
              <p className="text-sm font-medium text-white">{loc.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status="unclaimed" />
                <span className="text-xs text-slate-400">
                  Not connected to Bing Places
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Visit{' '}
                <a
                  href="https://bingplaces.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  bingplaces.com
                </a>
                {' '}to claim your listing, then enter your Bing Listing ID here.
              </p>
            </div>
          ))}

          {bingRows.length === 0 && unclaimedBingLocations.length === 0 && (
            <p className="text-sm text-slate-400">No locations found.</p>
          )}
        </div>
      </section>
    </div>
  );
}
