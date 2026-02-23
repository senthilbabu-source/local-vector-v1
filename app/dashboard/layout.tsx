import { redirect } from 'next/navigation';
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any;

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
    if (
      primaryLocation &&
      !primaryLocation.hours_data &&
      !primaryLocation.amenities
    ) {
      redirect('/onboarding');
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
    >
      {children}
    </DashboardShell>
  );
}
