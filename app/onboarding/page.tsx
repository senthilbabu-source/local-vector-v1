import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import TruthCalibrationForm from './_components/TruthCalibrationForm';
import GBPImportInterstitial from './_components/GBPImportInterstitial';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';

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
// OnboardingPage — Server Component
//
// Responsibilities:
//   • Authenticate via getSafeAuthContext()
//   • Redirect unauthenticated visitors to /login
//   • Fetch the org's primary location (RLS-scoped — no org_id needed in query)
//   • If location is already fully configured, skip ahead to /dashboard
//   • Pass location data to TruthCalibrationForm (client component)
//
// Headline matches Doc 06 §7: "Teach AI the Truth About Your Business"
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

  const supabase = await createClient();

  // ── Fetch primary location ─────────────────────────────────────────────────
  // Scope by org_id explicitly (belt-and-suspenders alongside RLS) so the
  // query is unambiguous when multiple orgs share the same DB instance and
  // current_user_org_id() is unreliable for newly-seeded test users.
  const orgId = ctx.orgId;
  const baseQuery = supabase
    .from('locations')
    .select('id, business_name, hours_data, amenities')
    .eq('is_primary', true);

  // Each Supabase filter call returns a NEW query builder instance, so we must
  // chain conditionally without discarding the returned reference.
  const { data: location } = (await (orgId
    ? baseQuery.eq('org_id', orgId)
    : baseQuery
  ).maybeSingle()) as { data: PrimaryLocation | null };

  // No primary location — nothing to configure yet. Let the user reach the
  // dashboard; the empty-state UI will guide them from there.
  if (!location) {
    redirect('/dashboard');
  }

  // Already fully onboarded — skip the wizard.
  if (location.hours_data && location.amenities) {
    redirect('/dashboard');
  }

  // ── Sprint 89: Check GBP connection for import interstitial ──────────────
  // Show the import interstitial when:
  //   1. User has GBP connected (google_oauth_tokens row exists)
  //   2. Location doesn't have hours_data yet (hasn't imported)
  //   3. User didn't explicitly skip (source !== 'gbp_skip')
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

  return (
    <div className="min-h-screen bg-midnight-slate flex items-center justify-center p-4">
      <div className="w-full max-w-xl">

        {/* ── Fallback toast — GBP flow error (Sprint 89) ──────────────── */}
        {toastMessage && (
          <div className="mb-6 rounded-lg border border-alert-amber/30 bg-alert-amber/10 px-4 py-3 text-sm text-alert-amber">
            {toastMessage}
          </div>
        )}

        {/* ── Header — Doc 06 §7 headline ─────────────────────────────── */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.svg" alt="LocalVector" className="h-9 w-9" />
            <span className="text-lg font-semibold text-white tracking-tight">
              LocalVector<span className="text-signal-green">.ai</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            {hasGBPConnection
              ? 'Import Your Business Data'
              : 'Teach AI the Truth About Your Business'}
          </h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            {hasGBPConnection
              ? 'Your Google Business Profile is connected. Import your hours, address, and amenities automatically.'
              : 'This sets the baseline the Fear Engine uses to catch hallucinations. If you skip "Alcohol," we can\u2019t detect "No Alcohol" lies.'}
          </p>
        </div>

        {/* ── Sprint 89: GBP import interstitial or manual wizard ────── */}
        {hasGBPConnection ? (
          <GBPImportInterstitial />
        ) : (
          <TruthCalibrationForm location={location} />
        )}

      </div>
    </div>
  );
}
