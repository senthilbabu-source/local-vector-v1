import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import TruthCalibrationForm from './_components/TruthCalibrationForm';
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

export default async function OnboardingPage() {
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

  return (
    <div className="min-h-screen bg-midnight-slate flex items-center justify-center p-4">
      <div className="w-full max-w-xl">

        {/* ── Header — Doc 06 §7 headline ─────────────────────────────── */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.svg" alt="LocalVector" className="h-9 w-9" />
            <span className="text-lg font-semibold text-white tracking-tight">
              LocalVector<span className="text-signal-green">.ai</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Teach AI the Truth About Your Business
          </h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            This sets the baseline the Fear Engine uses to catch hallucinations.
            If you skip &quot;Alcohol,&quot; we can&apos;t detect &quot;No Alcohol&quot; lies.
          </p>
        </div>

        {/* ── Wizard ──────────────────────────────────────────────────── */}
        <TruthCalibrationForm location={location} />

      </div>
    </div>
  );
}
