import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ConnectGBPButton from './_components/ConnectGBPButton';

// ---------------------------------------------------------------------------
// /onboarding/connect — GBP Connect Interstitial (Sprint 89)
//
// Server Component. Two paths:
//   1. "Connect Google Business Profile" → /api/auth/google?source=onboarding
//   2. "I'll fill in manually →" → /onboarding
//
// Guards:
//   • Unauthenticated → /login
//   • GOOGLE_CLIENT_ID not set → /onboarding (skip connect)
//   • Primary location already has hours_data → /dashboard (already onboarded)
//
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §5.2
// ---------------------------------------------------------------------------

export default async function ConnectPage() {
  // Auth guard
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  // GBP not configured — fall through to manual wizard
  if (!process.env.GOOGLE_CLIENT_ID) redirect('/onboarding');

  // If primary location already has hours_data, skip to dashboard
  if (ctx.orgId) {
    const supabase = await createClient();
    const { data: location } = await supabase
      .from('locations')
      .select('hours_data')
      .eq('org_id', ctx.orgId)
      .eq('is_primary', true)
      .maybeSingle();

    if (location?.hours_data) redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-midnight-slate flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.svg" alt="LocalVector" className="h-9 w-9" />
            <span className="text-lg font-semibold text-white tracking-tight">
              LocalVector<span className="text-signal-green">.ai</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Connect Your Google Business Profile
          </h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Import your hours, address, and contact info automatically.
            Takes 10 seconds.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-card-dark/60 p-8">
          <div className="flex flex-col items-center gap-6">
            <ConnectGBPButton />

            <div className="flex items-center gap-3 w-full">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                or
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <a
              href="/onboarding"
              className="text-sm text-slate-400 transition-colors hover:text-white"
            >
              I&apos;ll fill in manually &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
