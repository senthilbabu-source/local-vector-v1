// Server Component — fetches primary location + its magic_menu record,
// then delegates all interaction to the MenuWorkspace client shell.
// The existing /dashboard/magic-menus/[id] deep-edit route is unchanged.

import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { MenuWorkspaceData } from '@/lib/types/menu';
import MenuWorkspace from './_components/MenuWorkspace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PrimaryLocation = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchWorkspaceData(orgId: string): Promise<{
  location: PrimaryLocation | null;
  menu: MenuWorkspaceData | null;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Belt-and-suspenders: filter by org_id explicitly in addition to RLS.
  // The "public_published_location" RLS policy (migration 20260221000001)
  // also grants SELECT on locations that have a published magic_menu, so a
  // pure RLS-only query can return > 1 primary location when the golden
  // tenant has a published menu — causing .maybeSingle() to return null.
  // Matching the pattern used by app/dashboard/layout.tsx.
  const { data: location } = (await supabase
    .from('locations')
    .select('id, business_name, city, state')
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .maybeSingle()) as { data: PrimaryLocation | null };

  if (!location) return { location: null, menu: null };

  // Fetch the most recent magic_menu for this location (one workspace per location).
  const { data: menu } = (await supabase
    .from('magic_menus')
    .select(
      'id, location_id, processing_status, extracted_data, extraction_confidence, is_published, public_slug, human_verified, propagation_events'
    )
    .eq('location_id', location.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: MenuWorkspaceData | null };

  return { location, menu };
}

// ---------------------------------------------------------------------------
// MagicMenusPage
// ---------------------------------------------------------------------------

export default async function MagicMenusPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  // orgId is null only in the brief window after signup before the DB trigger
  // creates the org. In that case, skip the location query and show empty state.
  const { location, menu } = ctx.orgId
    ? await fetchWorkspaceData(ctx.orgId)
    : { location: null, menu: null };

  return (
    <div className="space-y-5">

      {/* ── Page header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Magic Menu
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          AI-readable menu that teaches ChatGPT, Perplexity, and Google the
          truth about your food.
        </p>
      </div>

      {/* ── Workspace ─────────────────────────────────────────────── */}
      {!location ? (
        // No primary location yet — guide the user
        <div className="rounded-2xl bg-surface-dark border border-white/5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-300">No location found.</p>
          <p className="mt-1 text-xs text-slate-500">
            Add a location first before creating your Magic Menu.
          </p>
          <a
            href="/dashboard/locations"
            className="mt-4 inline-flex items-center rounded-xl bg-electric-indigo/10 border border-electric-indigo/30 px-4 py-2 text-xs font-semibold text-electric-indigo hover:bg-electric-indigo/20 transition"
          >
            Add a Location →
          </a>
        </div>
      ) : (
        <MenuWorkspace
          locationId={location.id}
          locationName={location.business_name}
          locationCity={location.city}
          initialMenu={menu}
        />
      )}

    </div>
  );
}
