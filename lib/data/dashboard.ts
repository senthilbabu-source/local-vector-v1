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
import { calculateRevenueLeak, DEFAULT_CONFIG, type RevenueConfig, type RevenueLeak } from '@/lib/services/revenue-leak.service';
import type { PlanTier } from '@/lib/plan-enforcer';
import type { HealthScoreResult } from '@/lib/services/ai-health-score.service';
import type { SOVDataPoint } from '@/app/dashboard/_components/SOVTrendChart';
import type { ModelHallucinationData } from '@/app/dashboard/_components/HallucinationsByModel';
import type { CompetitorComparisonData } from '@/app/dashboard/_components/CompetitorComparison';
import type { LeakSnapshotPoint } from '@/app/dashboard/_components/LeakTrendChart';
import { aggregateByModel, aggregateCompetitors } from '@/lib/utils/dashboard-aggregators';
import { fetchHealthScore } from '@/lib/data/ai-health-score';

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
  correction_status: 'open' | 'verifying' | 'fixed' | 'dismissed' | 'recurring';
  first_detected_at: string;
  last_seen_at: string;
  occurrence_count: number;
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
  healthScore: HealthScoreResult | null;
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
export async function fetchDashboardData(orgId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [openResult, fixedResult, interceptResult, visibilityResult, lastAuditResult] = await Promise.all([
    // Open alerts — columns AlertFeed and RealityScoreCard need.
    supabase
      .from('ai_hallucinations')
      .select(
        'id, severity, category, model_provider, claim_text, expected_truth, correction_status, first_detected_at, last_seen_at, occurrence_count'
      )
      .eq('correction_status', 'open')
      .order('last_seen_at', { ascending: false })
      .limit(20),

    // Count of fixed hallucinations for Quick Stats.
    supabase
      .from('ai_hallucinations')
      .select('*', { count: 'exact', head: true })
      .eq('correction_status', 'fixed'),

    // Count of competitor intercept analyses run this calendar month.
    supabase
      .from('competitor_intercepts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart),

    // Most recent visibility snapshot — share_of_voice is float 0.0–1.0.
    // Returns null when the SOV cron (Phase 5) has not yet run.
    supabase
      .from('visibility_analytics')
      .select('share_of_voice')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Most recent AI audit — audit_date is the canonical scan timestamp.
    // Returns null for new customers who have not had their first cron run.
    supabase
      .from('ai_audits')
      .select('audit_date')
      .eq('org_id', orgId)
      .order('audit_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ── Surgery 4: Fetch chart data in parallel ─────────────────────────────
  const [sovTrendResult, modelCountResult, interceptCompResult, revenueConfigResult, revenueSnapshotsResult, orgPlanResult] = await Promise.all([
    // SOV trend: last 12 snapshots for the trend chart
    supabase
      .from('visibility_analytics')
      .select('snapshot_date, share_of_voice')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: true })
      .limit(12),

    // Hallucinations grouped by model (all time)
    supabase
      .from('ai_hallucinations')
      .select('model_provider')
      .eq('correction_status', 'open'),

    // Competitor intercepts for comparison chart (this month)
    supabase
      .from('competitor_intercepts')
      .select('competitor_name, gap_analysis')
      .gte('created_at', monthStart)
      .limit(50),

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

    // Org plan for plan-gating
    supabase
      .from('organizations')
      .select('plan')
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

  // Org plan
  const orgPlan = (orgPlanResult.data?.plan ?? 'trial') as PlanTier;

  // ── Sprint 72: AI Health Score ──────────────────────────────────────────
  // Fetch primary location for health score computation.
  // Non-blocking — if location lookup fails, healthScore is null.
  let healthScore: HealthScoreResult | null = null;
  try {
    const { data: primaryLocation } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', orgId)
      .eq('is_primary', true)
      .maybeSingle();

    if (primaryLocation) {
      healthScore = await fetchHealthScore(supabase, orgId, primaryLocation.id);
    }
  } catch {
    // Health score is non-critical — dashboard renders without it.
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
    healthScore,
  };
}
