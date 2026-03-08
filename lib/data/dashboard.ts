// ---------------------------------------------------------------------------
// lib/data/dashboard.ts — Dashboard data fetching layer
//
// Extracted from app/dashboard/page.tsx (Sprint 64).
// All 11 parallel Supabase queries, severity sorting, SOV/revenue-leak
// transformation, and plan resolution.
//
// Uses createClient() from @/lib/supabase/server (AI_RULES §18).
// ---------------------------------------------------------------------------

import { createClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';
import { calculateRevenueLeak, DEFAULT_CONFIG, type RevenueConfig, type RevenueLeak } from '@/lib/services/revenue-leak.service';
import type { PlanTier } from '@/lib/plan-enforcer';
import type { HealthScoreResult } from '@/lib/services/ai-health-score.service';
import type { SOVDataPoint } from '@/app/dashboard/_components/SOVTrendChart';
import type { ModelHallucinationData } from '@/app/dashboard/_components/HallucinationsByModel';
import type { CompetitorComparisonData } from '@/app/dashboard/_components/CompetitorComparison';
import type { LeakSnapshotPoint } from '@/app/dashboard/_components/LeakTrendChart';
import { aggregateByModel, aggregateCompetitors } from '@/lib/utils/dashboard-aggregators';
import { fetchHealthScore } from '@/lib/data/ai-health-score';
import { fetchCrawlerAnalytics, type CrawlerSummary } from '@/lib/data/crawler-analytics';
import { fetchCronHealth, type CronHealthSummary } from '@/lib/data/cron-health';
import { fetchFreshnessAlerts, type FreshnessStatus } from '@/lib/data/freshness-alerts';
import { fetchBenchmark, type BenchmarkData, type OrgLocationContext } from '@/lib/data/benchmarks';
import { getDraftLimit } from '@/lib/autopilot/draft-limits';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Subset of ai_hallucinations columns we actually render.
// Enum values verified against supabase/prod_schema.sql:
//   hallucination_severity : critical | high | medium | low
//   correction_status      : open | verifying | fixed | dismissed | recurring
//   model_provider         : openai-gpt4o | perplexity-sonar | google-gemini |
//                            anthropic-claude | microsoft-copilot
export type HallucinationRow = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string | null;
  model_provider:
  | 'openai-gpt4o'
  | 'perplexity-sonar'
  | 'google-gemini'
  | 'anthropic-claude'
  | 'microsoft-copilot';
  claim_text: string;
  expected_truth: string | null;
  correction_status: 'open' | 'verifying' | 'fixed' | 'dismissed' | 'recurring' | 'corrected';
  first_detected_at: string;
  last_seen_at: string;
  occurrence_count: number;
  follow_up_result: string | null; // Sprint F (N3): 'fixed' | 'recurring' | null
  // S14: Fix tracking — set when user submits correction / cron verifies
  fixed_at: string | null;
  verified_at: string | null;
  revenue_recovered_monthly: number | null;
  fix_guidance_category: string | null;
  root_cause_sources: unknown[] | null; // Sprint 5: RootCauseSource[]
};

export interface DashboardData {
  openAlerts: HallucinationRow[];
  fixedCount: number;
  interceptsThisMonth: number;
  visibilityScore: number | null;
  lastAuditAt: string | null;
  sovTrend: SOVDataPoint[];
  hallucinationsByModel: ModelHallucinationData[];
  competitorComparison: CompetitorComparisonData[];
  currentLeak: RevenueLeak | null;
  previousLeak: { leak_high: number } | null;
  revenueConfig: RevenueConfig | null;
  revenueSnapshots: LeakSnapshotPoint[];
  orgPlan: PlanTier;
  orgCreatedAt: string | null;
  healthScore: HealthScoreResult | null;
  crawlerSummary: CrawlerSummary | null;
  hasPublishedMenu: boolean;
  cronHealth: CronHealthSummary | null;
  freshness: FreshnessStatus | null;
  benchmark: BenchmarkData | null;       // Sprint F (N4)
  locationContext: OrgLocationContext;    // Sprint F (N4)
  // Sprint 86: Autopilot Engine — draft counts for ContentDraftsPanel
  draftsPending: number;
  draftsApproved: number;
  draftsMonthlyUsed: number;
  draftsMonthlyLimit: number;
  // Sprint 110: Sandbox simulation score for Reality Score DataHealth factor
  simulationScore: number | null;
  // Sprint 124: Cached DataHealth score from data-health-refresh cron
  dataHealthScore: number | null;
  // P8-FIX-33: Reality Score trend (last 12 snapshots) + previous score for delta
  realityScoreTrend: RealityScoreTrendPoint[];
  previousRealityScore: number | null;
  // S15: Sum of revenue_recovered_monthly for all fixed hallucinations
  revenueRecoveredMonthly: number;
  // S16: Current + previous visibility_scores snapshots for score attribution popover
  currentScoreSnapshot: ScoreSnapshot | null;
  prevScoreSnapshot: ScoreSnapshot | null;
  // S18: NAP health score for Business Info Accuracy KPI chip
  napScore: number | null;
  // S20: Accuracy snapshots for health streak + S67: sparkline computation
  accuracySnapshots: { accuracy_score: number | null; visibility_score: number | null; snapshot_date: string }[];
  // S22: Recent degradation event for banner
  degradationEvent: { model_provider: string; detected_at: string; affected_org_count: number } | null;
}

// P8-FIX-33: Data shape for RealityScoreTrendChart
export interface RealityScoreTrendPoint {
  date: string;
  score: number;
}

// S16: Component-level snapshot for score attribution
export interface ScoreSnapshot {
  accuracy_score: number | null;
  visibility_score: number | null;
  data_health_score: number | null;
  reality_score: number | null;
  snapshot_date: string;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Fetches all data needed for the Reality Score Dashboard in parallel.
 * RLS (org_isolation_select on ai_hallucinations) automatically scopes every
 * query to the logged-in user's org via the JWT — no manual org_id filter needed.
 * visibility_analytics and ai_audits require explicit org_id filters.
 *
 * Returns:
 *   openAlerts      — correction_status = 'open', sorted critical-first.
 *   fixedCount      — count of correction_status = 'fixed' rows (Quick Stats).
 *   visibilityScore — live integer 0–100 from share_of_voice; null if no snapshot yet.
 *   lastAuditAt     — ISO timestamp of most recent AI scan; null if never run.
 */
export async function fetchDashboardData(orgId: string, locationId?: string | null): Promise<DashboardData> {
  const supabase = await createClient();

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Build location-scoped queries (Sprint 100: data isolation)
  let openQuery = supabase
    .from('ai_hallucinations')
    // Cast: follow_up_result, fixed_at, verified_at, revenue_recovered_monthly,
    // fix_guidance_category are Sprint F/S14 columns not yet in database.types.ts
    // root_cause_sources is Sprint 5 column
    .select(
      'id, severity, category, model_provider, claim_text, expected_truth, correction_status, first_detected_at, last_seen_at, occurrence_count, follow_up_result, fixed_at, verified_at, revenue_recovered_monthly, fix_guidance_category, root_cause_sources' as 'id, severity, category, model_provider, claim_text, expected_truth, correction_status, first_detected_at, last_seen_at, occurrence_count, root_cause_sources'
    )
    .eq('correction_status', 'open')
    .order('last_seen_at', { ascending: false })
    .limit(20);
  if (locationId) openQuery = openQuery.eq('location_id', locationId);

  let fixedQuery = supabase
    .from('ai_hallucinations')
    .select('*', { count: 'exact', head: true })
    .eq('correction_status', 'fixed');
  if (locationId) fixedQuery = fixedQuery.eq('location_id', locationId);

  let interceptQuery = supabase
    .from('competitor_intercepts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart);
  if (locationId) interceptQuery = interceptQuery.eq('location_id', locationId);

  let visQuery = supabase
    .from('visibility_analytics')
    .select('share_of_voice')
    .eq('org_id', orgId)
    .order('snapshot_date', { ascending: false })
    .limit(1);
  if (locationId) visQuery = visQuery.eq('location_id', locationId);

  let auditQuery = supabase
    .from('ai_audits')
    .select('audit_date')
    .eq('org_id', orgId)
    .order('audit_date', { ascending: false })
    .limit(1);
  if (locationId) auditQuery = auditQuery.eq('location_id', locationId);

  const [openResult, fixedResult, interceptResult, visibilityResult, lastAuditResult] = await Promise.all([
    openQuery,
    fixedQuery,
    interceptQuery,
    visQuery.maybeSingle(),
    auditQuery.maybeSingle(),
  ]);

  // ── Surgery 4: Fetch chart data in parallel ─────────────────────────────
  // Sprint 100: location-scoped chart data queries
  let sovTrendQuery = supabase
    .from('visibility_analytics')
    .select('snapshot_date, share_of_voice')
    .eq('org_id', orgId)
    .order('snapshot_date', { ascending: true })
    .limit(12);
  if (locationId) sovTrendQuery = sovTrendQuery.eq('location_id', locationId);

  let modelCountQuery = supabase
    .from('ai_hallucinations')
    .select('model_provider')
    .eq('correction_status', 'open');
  if (locationId) modelCountQuery = modelCountQuery.eq('location_id', locationId);

  let interceptCompQuery = supabase
    .from('competitor_intercepts')
    .select('competitor_name, gap_analysis')
    .gte('created_at', monthStart)
    .limit(50);
  if (locationId) interceptCompQuery = interceptCompQuery.eq('location_id', locationId);

  const [sovTrendResult, modelCountResult, interceptCompResult, revenueConfigResult, revenueSnapshotsResult, orgPlanResult] = await Promise.all([
    sovTrendQuery,
    modelCountQuery,
    interceptCompQuery,

    // Revenue config for the org
    supabase
      .from('revenue_config')
      .select('avg_ticket, monthly_searches, local_conversion_rate, walk_away_rate')
      .eq('org_id', orgId)
      .limit(1)
      .maybeSingle(),

    // Revenue snapshots (last 12 for trend chart)
    supabase
      .from('revenue_snapshots')
      .select('snapshot_date, leak_low, leak_high, breakdown')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: true })
      .limit(12),

    // Org plan + created_at for plan-gating and sample data mode (Sprint B)
    supabase
      .from('organizations')
      .select('plan, created_at')
      .eq('id', orgId)
      .single(),
  ]);

  const rawOpen = (openResult.data ?? []) as HallucinationRow[];

  // Sort open alerts by severity priority (critical first).
  // Postgres enum sort is definition-order, not semantic — sort client-side.
  const openAlerts = [...rawOpen].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  // share_of_voice is 0.0–1.0 float; multiply by 100 for display integer.
  // Null when the SOV cron (Phase 5) has not yet produced any snapshot.
  const visRow = visibilityResult.data;
  const visibilityScore: number | null =
    visRow?.share_of_voice != null
      ? Math.round(visRow.share_of_voice * 100)
      : null;

  // ISO timestamp of most recent AI audit; null if no audit has ever run.
  const lastAuditAt: string | null = lastAuditResult.data?.audit_date ?? null;

  // Revenue leak: use org config (or defaults) to compute live leak from current data
  const revenueConfig: RevenueConfig | null = (revenueConfigResult.data ?? null) as RevenueConfig | null;
  const config = revenueConfig ?? DEFAULT_CONFIG;
  const currentSOV = visRow?.share_of_voice ?? 0;

  // Build intercept inputs for competitor steal calculation
  const interceptRows = (interceptCompResult.data ?? []) as { competitor_name: string; gap_analysis: { competitor_mentions: number; your_mentions: number } }[];
  const competitorInputs = interceptRows.map((r) => ({
    winner: r.competitor_name,
    business_name: '', // all intercepts are losses (competitor_name is the winner)
  }));

  const currentLeak = rawOpen.length > 0 || currentSOV < 0.25 || competitorInputs.length > 0
    ? calculateRevenueLeak(
        rawOpen.map((h) => ({ severity: h.severity, correction_status: h.correction_status })),
        currentSOV,
        competitorInputs,
        interceptRows.length || 1,
        config,
      )
    : null;

  // Revenue snapshots for trend chart; previous snapshot for delta
  const revenueSnapshots = (revenueSnapshotsResult.data ?? []).map((s) => ({
    snapshot_date: s.snapshot_date,
    leak_high: Number(s.leak_high),
  })) as LeakSnapshotPoint[];

  const previousLeak = revenueSnapshots.length >= 2
    ? { leak_high: revenueSnapshots[revenueSnapshots.length - 2].leak_high }
    : null;

  // Org plan + created_at (Sprint B: sample data mode)
  const orgPlan = (orgPlanResult.data?.plan ?? 'trial') as PlanTier;
  const orgCreatedAt: string | null = orgPlanResult.data?.created_at ?? null;

  // ── Sprint 72: AI Health Score (Sprint 100: uses active location) ────────
  // Non-blocking — if location lookup fails, healthScore is null.
  let healthScore: HealthScoreResult | null = null;
  try {
    // Prefer active location; fall back to primary
    let healthLocationId = locationId;
    if (!healthLocationId) {
      const { data: primaryLocation } = await supabase
        .from('locations')
        .select('id')
        .eq('org_id', orgId)
        .eq('is_primary', true)
        .maybeSingle();
      healthLocationId = primaryLocation?.id ?? null;
    }

    if (healthLocationId) {
      healthScore = await fetchHealthScore(supabase, orgId, healthLocationId);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'A' } });
    // Health score is non-critical — dashboard renders without it.
  }

  // ── Sprint 73: Crawler Analytics Summary ──────────────────────────────────
  // Non-blocking — if crawler data fetch fails, summary is null.
  let crawlerSummary: CrawlerSummary | null = null;
  let hasPublishedMenu = false;
  try {
    const { count } = await supabase
      .from('magic_menus')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_published', true);
    hasPublishedMenu = (count ?? 0) > 0;
    crawlerSummary = await fetchCrawlerAnalytics(supabase, orgId, locationId);
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'A' } });
    // Crawler analytics is non-critical — dashboard renders without it.
  }

  // ── Sprint 76: Cron Health Summary ──────────────────────────────────────
  // Non-blocking — if cron health fetch fails, cronHealth is null.
  let cronHealth: CronHealthSummary | null = null;
  try {
    cronHealth = await fetchCronHealth();
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'A' } });
    // Cron health is non-critical — dashboard renders without it.
  }

  // ── Sprint 76: Content Freshness Alerts ───────────────────────────────
  // Non-blocking — if freshness fetch fails, freshness is null.
  let freshness: FreshnessStatus | null = null;
  try {
    freshness = await fetchFreshnessAlerts(supabase, orgId, locationId);
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'A' } });
    // Freshness alerts are non-critical — dashboard renders without them.
  }

  // ── Sprint F (N4): Benchmark Comparison ─────────────────────────────────
  // Non-blocking — if benchmark fetch fails, benchmark is null.
  let benchmark: BenchmarkData | null = null;
  let locationContext: OrgLocationContext = { city: null, industry: null };
  try {
    const benchResult = await fetchBenchmark(supabase, orgId, locationId);
    benchmark = benchResult.benchmark;
    locationContext = benchResult.locationContext;
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'F' } });
    // Benchmark is non-critical — dashboard renders without it.
  }

  // ── Sprint 86: Autopilot Engine — Draft counts for ContentDraftsPanel ──
  let draftsPending = 0;
  let draftsApproved = 0;
  let draftsMonthlyUsed = 0;
  try {
    const { data: draftRows } = await supabase
      .from('content_drafts')
      .select('id, status, created_at')
      .eq('org_id', orgId)
      .in('status', ['draft', 'approved'])
      .limit(200);

    const drafts = draftRows ?? [];
    draftsPending = drafts.filter((d) => d.status === 'draft').length;
    draftsApproved = drafts.filter((d) => d.status === 'approved').length;

    // Monthly usage: count all drafts created this month (any status)
    const { count: monthlyCount } = await supabase
      .from('content_drafts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', monthStart);
    draftsMonthlyUsed = monthlyCount ?? 0;
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: '86' } });
    // Draft counts are non-critical — dashboard renders without them.
  }
  const draftsMonthlyLimit = getDraftLimit(orgPlan);

  // Sprint 110 + 124: Fetch simulation score + cached DataHealth for Reality Score
  // S18: NAP health score for Business Info Accuracy KPI chip
  let simulationScore: number | null = null;
  let dataHealthScore: number | null = null;
  let napScore: number | null = null;
  try {
    if (locationId) {
      const { data: simLoc } = await supabase
        .from('locations')
        .select('last_simulation_score, data_health_score, nap_health_score' as 'last_simulation_score, data_health_score')
        .eq('id', locationId)
        .maybeSingle();
      simulationScore = simLoc?.last_simulation_score ?? null;
      dataHealthScore = simLoc?.data_health_score ?? null;
      napScore = (simLoc as unknown as { nap_health_score: number | null } | null)?.nap_health_score ?? null;
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: '124' } });
  }

  // P8-FIX-33: Reality Score trend (last 12 snapshots) + previous score for delta
  let realityScoreTrend: RealityScoreTrendPoint[] = [];
  let previousRealityScore: number | null = null;
  try {
    let trendQuery = supabase
      .from('visibility_scores')
      .select('reality_score, snapshot_date')
      .eq('org_id', orgId)
      .not('reality_score', 'is', null)
      .order('snapshot_date', { ascending: true })
      .limit(12);
    if (locationId) trendQuery = trendQuery.eq('location_id', locationId);

    const { data: trendRows } = await trendQuery;
    if (trendRows && trendRows.length > 0) {
      realityScoreTrend = trendRows.map((r) => ({
        date: r.snapshot_date,
        score: Math.round(r.reality_score!),
      }));
      // Previous score = second-to-last for AIVisibilityPanel delta
      if (trendRows.length >= 2) {
        previousRealityScore = Math.round(trendRows[trendRows.length - 2].reality_score!);
      }
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'P8-FIX-33' } });
    // Trend data is non-critical — dashboard renders without it.
  }

  // ── S15: Revenue Recovered — sum of snapshotted revenue for corrected/fixed alerts ──
  let revenueRecoveredMonthly = 0;
  try {
    let recoveryQuery = supabase
      .from('ai_hallucinations')
      .select('revenue_recovered_monthly' as 'id')
      .in('correction_status', ['corrected', 'fixed', 'verifying'])
      .not('revenue_recovered_monthly' as 'id', 'is', null);
    if (locationId) recoveryQuery = recoveryQuery.eq('location_id', locationId);

    const { data: recoveryRows } = await recoveryQuery;
    if (recoveryRows) {
      revenueRecoveredMonthly = (recoveryRows as unknown as { revenue_recovered_monthly: number | null }[])
        .reduce((sum, r) => sum + (r.revenue_recovered_monthly ?? 0), 0);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'S15' } });
    // Revenue recovery is non-critical — dashboard renders without it.
  }

  // ── S20: Health Streak — accuracy_score snapshots for clean-week computation ──
  let accuracySnapshots: { accuracy_score: number | null; visibility_score: number | null; snapshot_date: string }[] = [];
  try {
    let accuracyQuery = supabase
      .from('visibility_scores')
      .select('accuracy_score, visibility_score, snapshot_date' as 'snapshot_date, reality_score')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: true })
      .limit(52);
    if (locationId) accuracyQuery = accuracyQuery.eq('location_id', locationId);

    const { data: accRows } = await accuracyQuery;
    if (accRows) {
      accuracySnapshots = accRows as unknown as { accuracy_score: number | null; visibility_score: number | null; snapshot_date: string }[];
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'S20' } });
  }

  // ── S22: Recent AI model degradation event for banner ──
  let degradationEvent: { model_provider: string; detected_at: string; affected_org_count: number } | null = null;
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: degRows } = await supabase
      .from('ai_model_degradation_events' as 'cron_run_log')
      .select('model_provider, detected_at, affected_org_count' as 'cron_name, created_at, duration_ms')
      .gte('detected_at' as 'created_at', sevenDaysAgo)
      .order('detected_at' as 'created_at', { ascending: false })
      .limit(1);
    if (degRows && degRows.length > 0) {
      const row = degRows[0] as unknown as { model_provider: string; detected_at: string; affected_org_count: number };
      degradationEvent = {
        model_provider: row.model_provider,
        detected_at: row.detected_at,
        affected_org_count: row.affected_org_count,
      };
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'S22' } });
    // Degradation event is non-critical — dashboard renders without it.
  }

  // ── S16: Current + previous visibility_scores snapshots for score attribution ──
  let currentScoreSnapshot: ScoreSnapshot | null = null;
  let prevScoreSnapshot: ScoreSnapshot | null = null;
  try {
    let scoreQuery = supabase
      .from('visibility_scores')
      .select('accuracy_score, visibility_score, data_health_score, reality_score, snapshot_date' as 'snapshot_date, reality_score')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(2);
    if (locationId) scoreQuery = scoreQuery.eq('location_id', locationId);

    const { data: scoreRows } = await scoreQuery;
    if (scoreRows && scoreRows.length >= 1) {
      const curr = scoreRows[0] as unknown as ScoreSnapshot;
      currentScoreSnapshot = {
        accuracy_score: curr.accuracy_score,
        visibility_score: curr.visibility_score,
        data_health_score: curr.data_health_score,
        reality_score: curr.reality_score,
        snapshot_date: curr.snapshot_date,
      };
    }
    if (scoreRows && scoreRows.length >= 2) {
      const prev = scoreRows[1] as unknown as ScoreSnapshot;
      prevScoreSnapshot = {
        accuracy_score: prev.accuracy_score,
        visibility_score: prev.visibility_score,
        data_health_score: prev.data_health_score,
        reality_score: prev.reality_score,
        snapshot_date: prev.snapshot_date,
      };
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'dashboard.ts', sprint: 'S16' } });
    // Score snapshot is non-critical — dashboard renders without it.
  }

  return {
    openAlerts,
    fixedCount: fixedResult.count ?? 0,
    interceptsThisMonth: interceptResult.count ?? 0,
    visibilityScore,
    lastAuditAt,
    // Surgery 4: Chart data
    sovTrend: (sovTrendResult.data ?? []).map((row) => ({
      date: row.snapshot_date,
      sov: Math.round((row.share_of_voice ?? 0) * 100),
    })) as SOVDataPoint[],
    hallucinationsByModel: aggregateByModel(modelCountResult.data ?? []),
    competitorComparison: aggregateCompetitors(interceptRows),
    // Revenue leak data
    currentLeak,
    previousLeak,
    revenueConfig,
    revenueSnapshots,
    orgPlan,
    orgCreatedAt,
    healthScore,
    crawlerSummary,
    hasPublishedMenu,
    cronHealth,
    freshness,
    benchmark,
    locationContext,
    draftsPending,
    draftsApproved,
    draftsMonthlyUsed,
    draftsMonthlyLimit,
    simulationScore,
    dataHealthScore,
    realityScoreTrend,
    previousRealityScore,
    // S15: Revenue recovered counter
    revenueRecoveredMonthly,
    // S16: Score snapshots for attribution popover
    currentScoreSnapshot,
    prevScoreSnapshot,
    // S18: Business Info Accuracy KPI chip
    napScore,
    // S20: Health streak accuracy snapshots
    accuracySnapshots,
    // S22: Recent degradation event for banner
    degradationEvent,
  };
}
