// ---------------------------------------------------------------------------
// app/dashboard/citations/page.tsx — Sprint 58A: Citation Gap Dashboard
//
// Server component. Fetches citation source intelligence for the tenant's
// primary category+city and calculates the gap score.
// Plan gate: Growth/Agency only.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { calculateCitationGapScore } from '@/lib/services/citation-engine.service';
import { canViewCitationGap, type PlanTier } from '@/lib/plan-enforcer';
import type { CitationSourceIntelligence, TenantListing } from '@/lib/types/citations';
import CitationGapScore from './_components/CitationGapScore';
import PlatformCitationBar from './_components/PlatformCitationBar';
import TopGapCard from './_components/TopGapCard';

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchCitationData(orgId: string) {
  const supabase = await createClient();

  // Get primary location
  const { data: locations } = await supabase
    .from('locations')
    .select('id, business_name, city, state, categories')
    .order('created_at', { ascending: true })
    .limit(1);

  const location = locations?.[0] ?? null;
  if (!location) {
    return { location: null, platforms: [], listings: [], plan: 'trial' as string };
  }

  const categories = location.categories as string[] | null;
  const primaryCategory = categories?.[0] ?? 'restaurant';
  const city = (location.city ?? '') as string;
  const state = (location.state ?? '') as string;

  const [citationResult, listingResult, orgResult] = await Promise.all([
    // Citation source intelligence — aggregate market data for category+city
    supabase
      .from('citation_source_intelligence')
      .select(
        'id, business_category, city, state, platform, citation_frequency, sample_query, sample_size, model_provider, measured_at',
      )
      .ilike('business_category', primaryCategory)
      .ilike('city', city)
      .ilike('state', state),

    // Tenant listings joined with directory names
    supabase
      .from('listings')
      .select('sync_status, directories!inner(name)')
      .eq('org_id', orgId)
      .eq('location_id', location.id),

    // Org plan
    supabase.from('organizations').select('plan').eq('id', orgId).single(),
  ]);

  const platforms: CitationSourceIntelligence[] = citationResult.data ?? [];

  // Map listings to TenantListing shape
  const listings: TenantListing[] = (listingResult.data ?? []).map((row) => ({
    directory: row.directories?.name ?? '',
    sync_status: row.sync_status ?? 'not_linked',
  }));

  return {
    location,
    platforms,
    listings,
    plan: (orgResult.data?.plan as string) ?? 'trial',
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CitationsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const { location, platforms, listings, plan } = await fetchCitationData(ctx.orgId);

  // ── Plan gate — Growth/Agency only ────────────────────────────────────────
  if (!canViewCitationGap(plan as PlanTier)) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Citation Intelligence</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            See which platforms AI actually cites — and where you&apos;re missing.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-dark border border-white/5 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric-indigo/10 text-electric-indigo mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-white">Upgrade to Growth</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
            Citation Intelligence shows which platforms AI engines cite for your category and city — and highlights where you&apos;re not listed. Available on Growth and Agency plans.
          </p>
          <Link
            href="/dashboard/billing"
            className="mt-5 inline-flex items-center rounded-lg bg-signal-green/10 px-4 py-2 text-sm font-semibold text-signal-green ring-1 ring-inset ring-signal-green/20 transition hover:bg-signal-green/20"
          >
            View Plans
          </Link>
        </div>
      </div>
    );
  }

  // ── Empty state — no location or no citation data ─────────────────────────
  if (!location || platforms.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Citation Intelligence</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            See which platforms AI actually cites — and where you&apos;re missing.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-dark border border-white/5 px-6 py-16 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-10 w-10 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 6v6l4 2" />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-300">
            {!location ? 'Add a location first' : 'Citation data is being collected'}
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {!location
              ? 'Create a location to start tracking which platforms AI cites in your category.'
              : 'The citation engine runs weekly. Your first results will appear after the next scan.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Calculate gap score ───────────────────────────────────────────────────
  const gapSummary = calculateCitationGapScore(platforms, listings);
  const coveredSet = new Set(
    listings
      .filter((l) => l.sync_status !== 'not_linked')
      .map((l) => l.directory.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white">Citation Intelligence</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          See which platforms AI actually cites — and where you&apos;re missing.
        </p>
      </div>

      {/* ── Top Gap Card — #1 uncovered platform ─────────────────────── */}
      {gapSummary.topGap && (
        <TopGapCard
          platform={gapSummary.topGap.platform}
          citationFrequency={gapSummary.topGap.citationFrequency}
          action={gapSummary.topGap.action}
        />
      )}

      {/* ── Score Ring + Platform Bars ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CitationGapScore
          gapScore={gapSummary.gapScore}
          platformsCovered={gapSummary.platformsCovered}
          platformsThatMatter={gapSummary.platformsThatMatter}
        />
        <PlatformCitationBar
          platforms={platforms}
          coveredPlatforms={coveredSet}
        />
      </div>
    </div>
  );
}
