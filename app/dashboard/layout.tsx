import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/layout/DashboardShell';

// ---------------------------------------------------------------------------
// Dashboard Layout — Server Component
//
// Responsibilities (server only):
//   • Authenticate via getSafeAuthContext()
//   • Redirect unauthenticated visitors to /login
//   • Onboarding Guard: redirect to /onboarding if primary location lacks
//     hours_data or amenities (ground truth not yet collected)
//   • Derive display strings from the session
//   • Render <DashboardShell> (client) with children as the RSC slot
//
// The DashboardShell holds sidebar toggle state so this file stays async
// and never needs 'use client'.
//
// Onboarding Guard note:
//   The guard only fires when a primary location EXISTS but hasn't been
//   configured (hours_data AND amenities are both null). If there's no
//   primary location yet the user lands on the empty-state dashboard.
//   This prevents a redirect loop: /onboarding is outside /dashboard/ so
//   this layout is never invoked for that route.
// ---------------------------------------------------------------------------

type PrimaryLocation = {
  hours_data: Record<string, unknown> | null;
  amenities: Record<string, unknown> | null;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();

  // Belt-and-suspenders: middleware should redirect first, but if the session
  // cookie expires mid-render this catches it.
  if (!ctx) {
    redirect('/login');
  }

  // ── Onboarding Guard ──────────────────────────────────────────────────────
  // Only run when the user belongs to an org (orgId non-null). If the org
  // trigger hasn't fired yet (edge case right after signup) we skip the guard
  // and let the dashboard show an empty state.
  if (ctx.orgId) {
    const supabase = await createClient();

    // Scope by org_id explicitly (belt-and-suspenders alongside RLS) so the
    // query is unambiguous when multiple orgs share the same DB instance.
    const { data: primaryLocation } = (await supabase
      .from('locations')
      .select('hours_data, amenities')
      .eq('org_id', ctx.orgId)
      .eq('is_primary', true)
      .maybeSingle()) as { data: PrimaryLocation | null };

    console.log('[OnboardingGuard] orgId=%s primaryLocation=%o', ctx.orgId, primaryLocation);

    // Redirect to onboarding if a primary location exists but ground truth
    // hasn't been collected yet (both columns are null).
    //
    // NOTE: We intentionally do NOT redirect when primaryLocation is null
    // (i.e. 0 locations). That would cause a redirect loop:
    //   /dashboard → /onboarding → /dashboard/locations → /onboarding → ...
    // because /dashboard/locations is inside this layout too.
    // Instead, `createLocation` sets is_primary=true for the first location,
    // so adding a location naturally triggers this guard on the next render.
    if (
      primaryLocation &&
      !primaryLocation.hours_data &&
      !primaryLocation.amenities
    ) {
      redirect('/onboarding');
    }
  }

  // ── Fetch all locations for location switcher (Sprint 62F) ────────────────
  let locations: { id: string; business_name: string; city: string | null; state: string | null; is_primary: boolean }[] = [];
  let selectedLocationId: string | null = null;

  if (ctx.orgId) {
    const locSupa = await createClient();
    const { data: allLocations } = await locSupa
      .from('locations')
      .select('id, business_name, city, state, is_primary')
      .eq('org_id', ctx.orgId)
      .order('is_primary', { ascending: false });

    locations = (allLocations ?? []).map((l) => ({
      id: l.id,
      business_name: l.business_name,
      city: l.city,
      state: l.state,
      is_primary: l.is_primary ?? false,
    }));

    // Read selected location from cookie, default to primary
    const cookieStore = await cookies();
    const selectedCookie = cookieStore.get('lv_selected_location')?.value;
    const primaryId = locations.find((l) => l.is_primary)?.id ?? null;
    selectedLocationId = selectedCookie && locations.some((l) => l.id === selectedCookie)
      ? selectedCookie
      : primaryId;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const displayName = ctx.fullName ?? ctx.email.split('@')[0];
  const orgName = ctx.orgName ?? 'Your Organization';

  return (
    <DashboardShell
      displayName={displayName}
      orgName={orgName}
      plan={ctx.plan ?? null}
      locations={locations}
      selectedLocationId={selectedLocationId}
    >
      {children}
    </DashboardShell>
  );
}
