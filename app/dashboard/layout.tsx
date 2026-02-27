import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/layout/DashboardShell';
import { resolveActiveLocation } from '@/lib/location/active-location';
import { getSidebarBadgeCounts, formatBadgeCount } from '@/lib/badges/badge-counts';

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

  // ── Resolve active location (Sprint 100 — centralized utility) ────────────
  let locations: { id: string; business_name: string; display_name: string | null; city: string | null; state: string | null; is_primary: boolean }[] = [];
  let selectedLocationId: string | null = null;

  if (ctx.orgId) {
    const locSupa = await createClient();
    const result = await resolveActiveLocation(locSupa, ctx.orgId);
    locations = result.allLocations;
    selectedLocationId = result.location?.id ?? null;
  }

  // ── Sprint 101: Sidebar badge counts ──────────────────────────────────────
  let badgeCounts: Record<string, string | null> = {};
  if (ctx.orgId) {
    try {
      const badgeSupa = await createClient();
      const counts = await getSidebarBadgeCounts(badgeSupa, ctx.orgId, ctx.userId, selectedLocationId);
      badgeCounts = {
        'content-drafts': formatBadgeCount(counts.contentDrafts),
        visibility: formatBadgeCount(counts.visibility),
      };
    } catch {
      // Badge fetch failure is non-critical — sidebar renders without badges
    }
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
      badgeCounts={badgeCounts}
    >
      {children}
    </DashboardShell>
  );
}
