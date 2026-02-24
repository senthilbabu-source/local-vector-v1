import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Belt-and-suspenders: filter by org_id explicitly in addition to RLS.
  // Without this, multiple SELECT policies (org_isolation_select OR
  // public_published_location) are OR'd by PostgreSQL and can expose
  // locations from other orgs (e.g. the golden tenant with a published menu).
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
        <AddLocationModal />
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl bg-surface-dark border border-white/5">
        {locations.length === 0 ? (
          /* Empty state */
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
        ) : (
          <table className="min-w-full divide-y divide-white/5">
            <thead className="bg-midnight-slate">
              <tr>
                <th className="py-3 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                  Location
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                  City / State
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                  Phone
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                  Added
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-surface-dark">
              {locations.map((loc) => (
                <tr key={loc.id} className="transition hover:bg-white/5">
                  {/* Name */}
                  <td className="py-3.5 pl-6 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {loc.business_name}
                      </span>
                      {loc.is_primary && (
                        <span className="rounded-full bg-electric-indigo/10 px-2 py-0.5 text-xs font-medium text-electric-indigo ring-1 ring-inset ring-electric-indigo/20">
                          Primary
                        </span>
                      )}
                    </div>
                    {loc.address_line1 && (
                      <p className="mt-0.5 text-xs text-slate-400">{loc.address_line1}</p>
                    )}
                  </td>

                  {/* City / State */}
                  <td className="whitespace-nowrap px-3 py-3.5 text-sm text-[#94A3B8]">
                    {formatAddress(loc)}
                  </td>

                  {/* Phone */}
                  <td className="whitespace-nowrap px-3 py-3.5 text-sm text-[#94A3B8]">
                    {loc.phone ?? '—'}
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-3 py-3.5">
                    {statusBadge(loc.operational_status)}
                  </td>

                  {/* Created */}
                  <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-400">
                    {new Date(loc.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
