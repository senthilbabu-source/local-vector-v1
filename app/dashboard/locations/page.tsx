import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { maxLocations, type PlanTier } from '@/lib/plan-enforcer';
import AddLocationModal from './_components/AddLocationModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Location = {
  id: string;
  name: string;
  business_name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
  operational_status: string | null;
  is_primary: boolean;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchLocations(orgId: string | null): Promise<Location[]> {
  const supabase = await createClient();

  // Belt-and-suspenders: filter by org_id explicitly in addition to RLS.
  let query = supabase
    .from('locations')
    .select(
      'id, name, business_name, address_line1, city, state, zip, phone, website_url, operational_status, is_primary, created_at'
    )
    .order('created_at', { ascending: false });

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query as {
    data: Location[] | null;
    error: unknown;
  };

  if (error) {
    console.error('[locations] fetch error:', error);
    return [];
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAddress(loc: Location): string {
  const parts = [loc.city, loc.state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function statusBadge(status: string | null) {
  if (!status || status === 'OPERATIONAL') {
    return (
      <span className="inline-flex items-center rounded-full bg-signal-green/10 px-2.5 py-0.5 text-xs font-medium text-signal-green ring-1 ring-inset ring-signal-green/20">
        Operational
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-[#94A3B8]">
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LocationsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const locations = await fetchLocations(ctx.orgId);
  const plan = (ctx.plan ?? 'starter') as PlanTier;
  const limit = maxLocations(plan);
  const atLimit = locations.length >= limit;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Locations</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            Manage the physical locations you are monitoring for AI accuracy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atLimit && (
            <p className="text-xs text-alert-amber">
              {plan === 'agency'
                ? `${locations.length}/${limit} locations used`
                : 'Upgrade to Agency for more locations'}
            </p>
          )}
          <AddLocationModal />
        </div>
      </div>

      {/* Card grid */}
      {locations.length === 0 ? (
        <div className="overflow-hidden rounded-xl bg-surface-dark border border-white/5">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
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
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-[#94A3B8]">No locations yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Click &quot;Add Location&quot; to register your first business location.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="rounded-xl bg-surface-dark border border-white/5 p-5 transition hover:border-white/10"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-white truncate pr-2">
                  {loc.business_name}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  {loc.is_primary && (
                    <span className="rounded-full bg-electric-indigo/10 px-2 py-0.5 text-xs font-medium text-electric-indigo ring-1 ring-inset ring-electric-indigo/20">
                      Primary
                    </span>
                  )}
                  {statusBadge(loc.operational_status)}
                </div>
              </div>

              <p className="text-sm text-[#94A3B8] mb-1">{formatAddress(loc)}</p>
              {loc.address_line1 && (
                <p className="text-xs text-slate-500 mb-2">{loc.address_line1}</p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                <p className="text-xs text-slate-500">
                  {loc.phone ?? 'No phone'}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(loc.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
