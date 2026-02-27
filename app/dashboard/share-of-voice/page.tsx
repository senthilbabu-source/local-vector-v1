import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { nextSundayLabel } from '@/app/dashboard/_components/scan-health-utils';
import { detectQueryGaps } from '@/lib/services/prompt-intelligence.service';
import { computeCategoryBreakdown } from '@/lib/services/prompt-intelligence.service';
import { canRunSovEvaluation, type PlanTier } from '@/lib/plan-enforcer';
import type { QueryGap } from '@/lib/types/prompt-intelligence';
import SovCard, { type QueryWithEvals } from './_components/SovCard';
import SOVScoreRing from './_components/SOVScoreRing';
import SOVTrendChart, { type SOVDataPoint } from '@/app/dashboard/_components/SOVTrendChart';
import FirstMoverCard from './_components/FirstMoverCard';
import GapAlertCard from './_components/GapAlertCard';
import CategoryBreakdownChart from './_components/CategoryBreakdownChart';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LocationRow = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
};

type QueryRow = {
  id: string;
  location_id: string;
  query_text: string;
  query_category: string;
  is_active: boolean;
};

type SovEvalRow = {
  id: string;
  query_id: string;
  engine: string;
  rank_position: number | null;
  mentioned_competitors: string[];
  created_at: string;
};

type VisibilityRow = {
  share_of_voice: number;   // 0.0–1.0 float
  citation_rate: number;     // 0.0–1.0 float
  snapshot_date: string;
};

type FirstMoverRow = {
  id: string;
  target_prompt: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPageData(orgId: string) {
  const supabase = await createClient();

  const [locResult, queryResult, evalResult, visResult, firstMoverResult, orgResult, briefDraftResult, pausedCountResult] =
    await Promise.all([
      supabase
        .from('locations')
        .select('id, business_name, city, state')
        .order('created_at', { ascending: true }),

      supabase
        .from('target_queries')
        .select('id, location_id, query_text, query_category, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),

      // Ordered newest-first so the first match per (query, engine) is the latest
      supabase
        .from('sov_evaluations')
        .select('id, query_id, engine, rank_position, mentioned_competitors, created_at')
        .order('created_at', { ascending: false })
        .limit(200),

      // Last 12 snapshots for trend chart + score ring
      supabase
        .from('visibility_analytics')
        .select('share_of_voice, citation_rate, snapshot_date')
        .eq('org_id', orgId)
        .order('snapshot_date', { ascending: false })
        .limit(12),

      // First Mover opportunities
      supabase
        .from('content_drafts')
        .select('id, target_prompt, created_at')
        .eq('trigger_type', 'first_mover')
        .eq('status', 'draft')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5),

      // Org plan for feature gating
      supabase
        .from('organizations')
        .select('plan')
        .eq('id', orgId)
        .single(),

      // Sprint 86: Existing brief drafts (trigger_type=prompt_missing) for button state
      supabase
        .from('content_drafts')
        .select('trigger_id')
        .eq('trigger_type', 'prompt_missing')
        .eq('org_id', orgId)
        .in('status', ['draft', 'approved']),

      // Sprint 88: Count paused queries
      supabase
        .from('target_queries')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('is_active', false),
    ]);

  // Collect trigger_ids that already have briefs
  const briefDraftTriggerIds = new Set(
    (briefDraftResult.data ?? [])
      .map((d: { trigger_id: string | null }) => d.trigger_id)
      .filter(Boolean) as string[],
  );

  return {
    locations: (locResult.data as LocationRow[]) ?? [],
    queries: (queryResult.data as QueryRow[]) ?? [],
    evaluations: (evalResult.data as SovEvalRow[]) ?? [],
    visibilitySnapshots: (visResult.data as VisibilityRow[]) ?? [],
    firstMoverOpps: (firstMoverResult.data as FirstMoverRow[]) ?? [],
    plan: (orgResult.data?.plan as string) ?? 'trial',
    briefDraftTriggerIds,
    pausedCount: pausedCountResult.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ShareOfVoicePage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    redirect('/login');
  }

  const { locations, queries, evaluations, visibilitySnapshots, firstMoverOpps, plan, briefDraftTriggerIds, pausedCount } =
    await fetchPageData(ctx.orgId);

  // ── Derive SOV metrics from visibility_analytics ─────────────────────────
  // Snapshots are ordered newest-first. Index 0 = latest, index 1 = previous.
  const latest = visibilitySnapshots[0] ?? null;
  const previous = visibilitySnapshots[1] ?? null;

  const shareOfVoice = latest ? latest.share_of_voice * 100 : null;
  const citationRate = latest ? latest.citation_rate * 100 : null;
  const weekOverWeekDelta =
    latest && previous
      ? latest.share_of_voice - previous.share_of_voice
      : null;

  // ── Trend chart data (oldest → newest for left-to-right rendering) ───────
  const trendData: SOVDataPoint[] = [...visibilitySnapshots]
    .reverse()
    .map((s) => ({
      date: s.snapshot_date,
      sov: Math.round(s.share_of_voice * 1000) / 10, // 0.333 → 33.3
    }));

  // ── Prompt Intelligence gap detection (Growth/Agency only) ────────────────
  let gaps: QueryGap[] = [];
  const isGrowthPlus = canRunSovEvaluation(plan as PlanTier);
  if (isGrowthPlus && locations.length > 0) {
    const gapSupabase = await createClient();
    gaps = await detectQueryGaps(ctx.orgId, locations[0].id, gapSupabase);
  }

  // ── Category breakdown (pure — no DB calls) ──────────────────────────────
  const categoryBreakdown = computeCategoryBreakdown(
    queries.map((q) => ({ id: q.id, query_category: q.query_category })),
    evaluations.map((e) => ({
      query_id: e.query_id,
      rank_position: e.rank_position,
      created_at: e.created_at,
    })),
  );

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white">AI Share of Voice</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          Track how often AI engines mention your business vs. competitors when
          answering relevant local search queries.
        </p>
      </div>

      {/* ── Aggregate SOV Score Ring ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SOVScoreRing
          shareOfVoice={shareOfVoice}
          citationRate={citationRate}
          weekOverWeekDelta={weekOverWeekDelta}
        />
        <div className="rounded-2xl bg-surface-dark border border-white/5 p-5">
          <h2 className="text-sm font-semibold text-white tracking-tight mb-4">
            Quick Stats
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Queries Tracked</span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {queries.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Locations</span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {locations.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Last Scan</span>
              <span className="text-sm font-medium text-slate-300 tabular-nums">
                {latest
                  ? new Date(latest.snapshot_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : `Runs Sunday, ${nextSundayLabel()}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">First Mover Opps</span>
              <span className="text-sm font-semibold text-amber-400 tabular-nums">
                {firstMoverOpps.length}
              </span>
            </div>
            {pausedCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Paused Queries</span>
                <span className="text-sm font-medium text-slate-400 tabular-nums">
                  {pausedCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SOV Trend Chart ──────────────────────────────────────────────── */}
      <SOVTrendChart data={trendData} title="SOV Trend (Last 12 Weeks)" />

      {/* ── First Mover Opportunities ────────────────────────────────────── */}
      {firstMoverOpps.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white tracking-tight mb-3">
            First Mover Opportunities
            <span className="ml-2 text-xs font-medium text-amber-400">
              {firstMoverOpps.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {firstMoverOpps.map((opp) => (
              <FirstMoverCard
                key={opp.id}
                id={opp.id}
                queryText={opp.target_prompt}
                createdAt={opp.created_at}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Prompt Intelligence: Category Breakdown + Gap Alerts ────────── */}
      {isGrowthPlus && queries.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white tracking-tight mb-3">
            Prompt Intelligence
            {gaps.length > 0 && (
              <span className="ml-2 text-xs font-medium text-alert-crimson">
                {gaps.length} gap{gaps.length !== 1 ? 's' : ''} detected
              </span>
            )}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <CategoryBreakdownChart breakdown={categoryBreakdown} />

            {gaps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Query Gaps
                </h3>
                {gaps.slice(0, 5).map((gap, i) => (
                  <GapAlertCard
                    key={`${gap.gapType}-${i}`}
                    gapType={gap.gapType}
                    queryText={gap.queryText}
                    queryCategory={gap.queryCategory}
                    estimatedImpact={gap.estimatedImpact}
                    suggestedAction={gap.suggestedAction}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Query Library (existing per-location SovCards) ─────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-white tracking-tight mb-3">
          Query Library
        </h2>

        {locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-12 text-center border border-white/5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-10 w-10 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-[#94A3B8]">No locations yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Add a location first to start tracking AI share of voice.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {locations.map((location) => {
              const locationLabel = [location.business_name, location.city, location.state]
                .filter(Boolean)
                .join(', ');

              // Queries for this location, preserving insertion order
              const locationQueries = queries.filter((q) => q.location_id === location.id);

              // For each query, find the latest eval per engine (evaluations is
              // already ordered newest-first so find() always returns the latest).
              const queriesWithEvals: QueryWithEvals[] = locationQueries.map((q) => ({
                id: q.id,
                query_text: q.query_text,
                is_active: q.is_active,
                openaiEval:
                  (evaluations.find(
                    (e) => e.query_id === q.id && e.engine === 'openai'
                  ) as QueryWithEvals['openaiEval']) ?? null,
                perplexityEval:
                  (evaluations.find(
                    (e) => e.query_id === q.id && e.engine === 'perplexity'
                  ) as QueryWithEvals['perplexityEval']) ?? null,
              }));

              return (
                <SovCard
                  key={location.id}
                  locationId={location.id}
                  locationLabel={locationLabel}
                  queries={queriesWithEvals}
                  plan={plan}
                  briefDraftQueryIds={[...briefDraftTriggerIds]}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
