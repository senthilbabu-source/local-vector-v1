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

async function fetchLocations(): Promise<Location[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from('locations')
    .select(
      'id, name, business_name, address_line1, city, state, zip, phone, website_url, operational_status, is_primary, created_at'
    )
    .order('created_at', { ascending: false }) as {
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
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        Operational
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
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

  const locations = await fetchLocations();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Locations</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage the physical locations you are monitoring for AI accuracy.
          </p>
        </div>
        <AddLocationModal />
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5">
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
            <p className="mt-3 text-sm font-medium text-slate-500">No locations yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Click &quot;Add Location&quot; to register your first business location.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-3 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  City / State
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Added
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {locations.map((loc) => (
                <tr key={loc.id} className="transition hover:bg-slate-50">
                  {/* Name */}
                  <td className="py-3.5 pl-6 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {loc.business_name}
                      </span>
                      {loc.is_primary && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                          Primary
                        </span>
                      )}
                    </div>
                    {loc.address_line1 && (
                      <p className="mt-0.5 text-xs text-slate-400">{loc.address_line1}</p>
                    )}
                  </td>

                  {/* City / State */}
                  <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-600">
                    {formatAddress(loc)}
                  </td>

                  {/* Phone */}
                  <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-600">
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
