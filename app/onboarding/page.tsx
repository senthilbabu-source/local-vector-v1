import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';
import type { TargetQueryRow } from './actions';
import OnboardingWizard from './_components/OnboardingWizard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Subset of the locations row passed to the form.
// Uses canonical JSONB shapes from lib/types/ground-truth.ts (Doc 03 §15).
export type PrimaryLocation = {
  id: string;
  business_name: string;
  hours_data: HoursData | null;
  amenities: Partial<Amenities> | null;
};

// ---------------------------------------------------------------------------
// OnboardingPage — Server Component (Sprint 91: Full 5-step wizard)
//
// Responsibilities:
//   • Authenticate via getSafeAuthContext()
//   • Redirect unauthenticated visitors to /login
//   • Redirect already-onboarded users to /dashboard
//   • Fetch the org's primary location, GBP connection, and seeded queries
//   • Pass all data to OnboardingWizard (client component)
// ---------------------------------------------------------------------------

// Fallback toast messages for GBP flow failures
const TOAST_MESSAGES: Record<string, string> = {
  gbp_failed: 'Google connection failed. Let\u2019s fill in your info manually.',
  gbp_denied: 'Google connection was cancelled. No worries \u2014 fill in manually below.',
  gbp_no_accounts: 'No Google Business Profile found for this account. Fill in manually.',
  gbp_no_locations: 'No business locations found in your Google account. Fill in manually.',
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const source = typeof params?.source === 'string' ? params.source : null;
  const toastMessage = source ? TOAST_MESSAGES[source] ?? null : null;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  // ── Already completed onboarding — skip to dashboard ──────────────────
  if (ctx.onboarding_completed) {
    redirect('/dashboard');
  }

  const supabase = await createClient();
  const orgId = ctx.orgId;

  // ── Fetch primary location ─────────────────────────────────────────────
  const baseQuery = supabase
    .from('locations')
    .select('id, business_name, hours_data, amenities')
    .eq('is_primary', true);

  const { data: location } = (await (orgId
    ? baseQuery.eq('org_id', orgId)
    : baseQuery
  ).maybeSingle()) as { data: PrimaryLocation | null };

  // No primary location — nothing to configure yet.
  if (!location) {
    redirect('/dashboard');
  }

  // Already fully onboarded (hours + amenities set) — skip the wizard.
  if (location.hours_data && location.amenities) {
    redirect('/dashboard');
  }

  // ── Check GBP connection for import interstitial ───────────────────────
  let hasGBPConnection = false;
  if (orgId && source !== 'gbp_skip' && !location.hours_data) {
    const serviceRole = createServiceRoleClient();
    const { data: tokenRow } = await serviceRole
      .from('google_oauth_tokens')
      .select('id')
      .eq('org_id', orgId)
      .maybeSingle();
    hasGBPConnection = !!tokenRow;
  }

  // ── Fetch seeded SOV queries for Step 4 ────────────────────────────────
  let initialQueries: TargetQueryRow[] = [];
  if (orgId) {
    const { data: queries } = await supabase
      .from('target_queries')
      .select('id, query_text, query_category')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('created_at');

    initialQueries = (queries ?? []) as TargetQueryRow[];
  }

  // ── Render wizard ──────────────────────────────────────────────────────
  return (
    <OnboardingWizard
      location={location}
      hasGBPConnection={hasGBPConnection}
      initialQueries={initialQueries}
      toastMessage={toastMessage}
    />
  );
}
