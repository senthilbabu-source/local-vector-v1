import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import AddMenuModal from './_components/AddMenuModal';
import PublishToggle from './_components/PublishToggle';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LocationOption = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
};

type MagicMenu = {
  id: string;
  public_slug: string | null;
  processing_status: string;
  is_published: boolean;
  created_at: string;
  locations: {
    name: string;
    business_name: string;
    city: string | null;
    state: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Data fetching — parallel queries
// ---------------------------------------------------------------------------

async function fetchPageData(): Promise<{
  menus: MagicMenu[];
  locations: LocationOption[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const [menusResult, locationsResult] = await Promise.all([
    // Join magic_menus with locations so we can display location name in the table
    supabase
      .from('magic_menus')
      .select(
        'id, public_slug, processing_status, is_published, created_at, locations(name, business_name, city, state)'
      )
      .order('created_at', { ascending: false }) as Promise<{
        data: MagicMenu[] | null;
        error: unknown;
      }>,

    // Fetch org locations to populate the AddMenuModal dropdown
    supabase
      .from('locations')
      .select('id, business_name, city, state')
      .order('created_at', { ascending: true }) as Promise<{
        data: LocationOption[] | null;
        error: unknown;
      }>,
  ]);

  if (menusResult.error) {
    console.error('[magic-menus] fetch error:', menusResult.error);
  }
  if (locationsResult.error) {
    console.error('[magic-menus] locations fetch error:', locationsResult.error);
  }

  return {
    menus: menusResult.data ?? [],
    locations: locationsResult.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a public_slug into a human-readable display name.
 * Strips the timestamp suffix added by toUniqueSlug(), then title-cases.
 * e.g. "dinner-menu-1m3kx9" → "Dinner Menu"
 */
function slugToDisplayName(slug: string | null): string {
  if (!slug) return 'Untitled Menu';
  // Remove the trailing -[base36 timestamp] suffix (last hyphen-separated segment)
  const parts = slug.split('-');
  // Heuristic: if the last segment looks like a base-36 timestamp (6-8 chars, alphanumeric)
  const lastPart = parts[parts.length - 1];
  const isTimestamp = /^[a-z0-9]{6,9}$/.test(lastPart ?? '');
  const nameParts = isTimestamp ? parts.slice(0, -1) : parts;
  return nameParts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

const PROCESSING_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  uploading: {
    label: 'Uploading',
    className: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  },
  processing: {
    label: 'Processing',
    className: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  },
  review_ready: {
    label: 'Ready to Review',
    className: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  },
  published: {
    label: 'Published',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = PROCESSING_STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MagicMenusPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const { menus, locations } = await fetchPageData();

  const publishedCount = menus.filter((m) => m.is_published).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Magic Menus</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            AI-readable menus that teach ChatGPT, Perplexity, and Google the truth about
            your food.
          </p>
        </div>
        <AddMenuModal locations={locations} />
      </div>

      {/* Summary strip */}
      {menus.length > 0 && (
        <div className="flex flex-wrap gap-4">
          <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs text-slate-500">Total menus</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">
              {menus.length}
            </p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs text-slate-500">Published</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-600">
              {publishedCount}
            </p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs text-slate-500">Draft / Review</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-500">
              {menus.length - publishedCount}
            </p>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5">
        {menus.length === 0 ? (
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
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-500">No menus yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Click &quot;New Menu&quot; to create your first AI-readable menu.
            </p>
            {locations.length === 0 && (
              <p className="mt-3 text-xs text-amber-600">
                You must{' '}
                <a href="/dashboard/locations" className="underline font-medium">
                  add a location
                </a>{' '}
                first before creating a menu.
              </p>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-3 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Menu
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Added
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Published
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {menus.map((menu) => {
                const displayName = slugToDisplayName(menu.public_slug);
                const locationName =
                  menu.locations?.business_name ?? menu.locations?.name ?? '—';
                const locationCity = menu.locations?.city;
                const locationState = menu.locations?.state;

                return (
                  <tr key={menu.id} className="transition hover:bg-slate-50">
                    {/* Menu name */}
                    <td className="py-3.5 pl-6 pr-3">
                      <p className="text-sm font-medium text-slate-900">{displayName}</p>
                      {menu.public_slug && (
                        <p className="mt-0.5 font-mono text-xs text-slate-400">
                          /{menu.public_slug}
                        </p>
                      )}
                    </td>

                    {/* Location */}
                    <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-600">
                      {locationName}
                      {locationCity && (
                        <span className="text-slate-400">
                          {' '}
                          — {locationCity}
                          {locationState ? `, ${locationState}` : ''}
                        </span>
                      )}
                    </td>

                    {/* Processing status */}
                    <td className="whitespace-nowrap px-3 py-3.5">
                      <StatusBadge status={menu.processing_status} />
                    </td>

                    {/* Date added */}
                    <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-400">
                      {new Date(menu.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Publish toggle */}
                    <td className="whitespace-nowrap px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <PublishToggle
                          menuId={menu.id}
                          isPublished={menu.is_published}
                        />
                        <span className="text-xs text-slate-500">
                          {menu.is_published ? 'Live' : 'Draft'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
