import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetches the three tenant-scoped counts in parallel.
 *
 * Uses the SSR server client so every query runs under the logged-in user's
 * JWT — PostgreSQL RLS (`org_isolation_select` policies) automatically
 * filters each table to the user's own organization.
 *
 * Returns 0 for any table that errors or has no rows yet, so a newly
 * registered user with an empty org sees clean zeros rather than crashes.
 */
async function fetchDashboardCounts() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const [hallucinations, menus, locations] = await Promise.all([
    supabase
      .from('ai_hallucinations')
      .select('*', { count: 'exact', head: true }) as Promise<{ count: number | null; error: unknown }>,
    supabase
      .from('magic_menus')
      .select('*', { count: 'exact', head: true }) as Promise<{ count: number | null; error: unknown }>,
    supabase
      .from('locations')
      .select('*', { count: 'exact', head: true }) as Promise<{ count: number | null; error: unknown }>,
  ]);

  return {
    hallucinationCount: hallucinations.count ?? 0,
    menuCount: menus.count ?? 0,
    locationCount: locations.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const ctx = await getSafeAuthContext();

  if (!ctx) {
    redirect('/login');
  }

  // First name only — fall back to email prefix for users without a full_name
  const firstName =
    ctx.fullName?.split(' ')[0] ?? ctx.email.split('@')[0];

  const { hallucinationCount, menuCount, locationCount } =
    await fetchDashboardCounts();

  const stats = [
    {
      label: 'AI Hallucinations detected',
      value: hallucinationCount,
      color: 'text-red-600',
    },
    {
      label: 'Magic Menus synced',
      value: menuCount,
      color: 'text-indigo-600',
    },
    {
      label: 'Locations monitored',
      value: locationCount,
      color: 'text-emerald-600',
    },
  ];

  const hasData = hallucinationCount > 0 || menuCount > 0 || locationCount > 0;

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {hasData
            ? 'Here is a live snapshot of your AI audit data.'
            : 'Your AI audit dashboard is ready. More features are on the way.'}
        </p>
      </div>

      {/* Live stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {label}
            </p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${color}`}>
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Empty-state callout — only shown when org has no data yet */}
      {!hasData && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-500">
            No audit results yet
          </p>
          <p className="mt-1 text-xs text-slate-400">
            AI audit results will appear here once your first scan runs.
          </p>
        </div>
      )}
    </div>
  );
}
