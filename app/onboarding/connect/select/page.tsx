import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { GBPLocation } from '@/lib/types/gbp';
import LocationPicker from './LocationPicker';

// ---------------------------------------------------------------------------
// /onboarding/connect/select — Multi-Location Picker (Sprint 89)
//
// Server Component. Reads gbp_import_id cookie → fetches pending_gbp_imports
// row → validates org_id + expires_at → renders location picker.
//
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §5.3
// ---------------------------------------------------------------------------

export default async function SelectLocationPage() {
  // Auth guard
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  // Read the cookie-pointer (not raw JSON — RFC cookie-pointer pattern)
  const cookieStore = await cookies();
  const importId = cookieStore.get('gbp_import_id')?.value;

  if (!importId) redirect('/onboarding/connect');

  // Fetch the pending import row (service role — no authenticated RLS grants)
  const supabase = createServiceRoleClient();
  const { data: pending } = await supabase
    .from('pending_gbp_imports')
    .select('*')
    .eq('id', importId)
    .single();

  // Validate: exists, correct org, not expired
  if (!pending) redirect('/onboarding/connect');
  if (pending.org_id !== ctx.orgId) redirect('/onboarding/connect');
  if (new Date(pending.expires_at) < new Date()) redirect('/onboarding/connect');

  const locations = pending.locations_data as unknown as GBPLocation[];

  return (
    <div className="min-h-screen bg-midnight-slate flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.svg" alt="LocalVector" className="h-9 w-9" />
            <span className="text-lg font-semibold text-white tracking-tight">
              LocalVector<span className="text-signal-green">.ai</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Which location would you like to manage?
          </h1>
          <p className="text-sm text-slate-400">
            We found {locations.length} locations in your Google Business
            Profile. Select one to get started.
          </p>
        </div>

        {/* Location cards */}
        <LocationPicker locations={locations} />

        {/* Manual fallback */}
        <div className="mt-6 text-center">
          <a
            href="/onboarding"
            className="text-sm text-slate-400 transition-colors hover:text-white"
          >
            Skip &mdash; fill in manually &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
