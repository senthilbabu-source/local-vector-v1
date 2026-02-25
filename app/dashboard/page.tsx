import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { nextSundayLabel } from './_components/scan-health-utils';
import RealityScoreCard from './_components/RealityScoreCard';
import AlertFeed from './_components/AlertFeed';
import SOVTrendChart, { type SOVDataPoint } from './_components/SOVTrendChart';
import HallucinationsByModel, { type ModelHallucinationData } from './_components/HallucinationsByModel';
import CompetitorComparison, { type CompetitorComparisonData } from './_components/CompetitorComparison';
import MetricCard from './_components/MetricCard';

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

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

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
async function fetchDashboardData(orgId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

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
      .limit(20) as Promise<{ data: HallucinationRow[] | null; error: unknown }>,

    // Count of fixed hallucinations for Quick Stats.
    supabase
      .from('ai_hallucinations')
      .select('*', { count: 'exact', head: true })
      .eq('correction_status', 'fixed') as Promise<{ count: number | null; error: unknown }>,

    // Count of competitor intercept analyses run this calendar month.
    supabase
      .from('competitor_intercepts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart) as Promise<{ count: number | null; error: unknown }>,

    // Most recent visibility snapshot — share_of_voice is float 0.0–1.0.
    // Returns null when the SOV cron (Phase 5) has not yet run.
    supabase
      .from('visibility_analytics')
      .select('share_of_voice')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle() as Promise<{ data: { share_of_voice: number } | null; error: unknown }>,

    // Most recent AI audit — audit_date is the canonical scan timestamp.
    // Returns null for new customers who have not had their first cron run.
    supabase
      .from('ai_audits')
      .select('audit_date')
      .eq('org_id', orgId)
      .order('audit_date', { ascending: false })
      .limit(1)
      .maybeSingle() as Promise<{ data: { audit_date: string } | null; error: unknown }>,
  ]);

  // ── Surgery 4: Fetch chart data in parallel ─────────────────────────────
  const [sovTrendResult, modelCountResult, interceptCompResult] = await Promise.all([
    // SOV trend: last 12 snapshots for the trend chart
    supabase
      .from('visibility_analytics')
      .select('snapshot_date, share_of_voice')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: true })
      .limit(12) as Promise<{ data: { snapshot_date: string; share_of_voice: number }[] | null; error: unknown }>,

    // Hallucinations grouped by model (all time)
    supabase
      .from('ai_hallucinations')
      .select('model_provider')
      .eq('correction_status', 'open') as Promise<{ data: { model_provider: string }[] | null; error: unknown }>,

    // Competitor intercepts for comparison chart (this month)
    supabase
      .from('competitor_intercepts')
      .select('competitor_name, gap_analysis')
      .gte('created_at', monthStart)
      .limit(50) as Promise<{ data: { competitor_name: string; gap_analysis: { competitor_mentions: number; your_mentions: number } }[] | null; error: unknown }>,
  ]);

  const rawOpen = openResult.data ?? [];

  // Sort open alerts by severity priority (critical first).
  // Postgres enum sort is definition-order, not semantic — sort client-side.
  const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
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
    competitorComparison: aggregateCompetitors(interceptCompResult.data ?? []),
  };
}

// ---------------------------------------------------------------------------
// Surgery 4: Aggregation helpers for chart data
// ---------------------------------------------------------------------------

function aggregateByModel(rows: { model_provider: string }[]): ModelHallucinationData[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.model_provider] = (counts[row.model_provider] ?? 0) + 1;
  }
  return Object.entries(counts).map(([model, count]) => ({ model, count }));
}

function aggregateCompetitors(
  rows: { competitor_name: string; gap_analysis: { competitor_mentions: number; your_mentions: number } }[],
): CompetitorComparisonData[] {
  const agg: Record<string, { theirMentions: number; yourMentions: number }> = {};
  for (const row of rows) {
    if (!agg[row.competitor_name]) {
      agg[row.competitor_name] = { theirMentions: 0, yourMentions: 0 };
    }
    agg[row.competitor_name].theirMentions += row.gap_analysis?.competitor_mentions ?? 0;
    agg[row.competitor_name].yourMentions += row.gap_analysis?.your_mentions ?? 0;
  }
  return Object.entries(agg).map(([competitor, data]) => ({
    competitor,
    ...data,
  }));
}

// ---------------------------------------------------------------------------
// Reality Score derivation
//
// Formula from Doc 03 §9:
//   reality_score = (Visibility × 0.4) + (Accuracy × 0.4) + (DataHealth × 0.2)
//
// Visibility  : live from visibility_analytics.share_of_voice (Phase 5 SOV cron);
//               null until the first snapshot runs — realityScore is also null then.
// Accuracy    : 100 with 0 open alerts; −15 per open alert, floor 40
// Data Health : 100  — user cleared the onboarding guard (ground truth exists)
// ---------------------------------------------------------------------------

export function deriveRealityScore(
  openAlertCount: number,
  visibilityScore: number | null,
) {
  const accuracy = openAlertCount === 0 ? 100 : Math.max(40, 100 - openAlertCount * 15);
  const dataHealth = 100;

  if (visibilityScore === null) {
    return { visibility: null, accuracy, dataHealth, realityScore: null };
  }

  const realityScore = Math.round(
    visibilityScore * 0.4 + accuracy * 0.4 + dataHealth * 0.2
  );
  return { visibility: visibilityScore, accuracy, dataHealth, realityScore };
}

// ---------------------------------------------------------------------------
// DashboardPage — Server Component
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const {
    openAlerts, fixedCount, interceptsThisMonth, visibilityScore, lastAuditAt,
    sovTrend, hallucinationsByModel, competitorComparison,
  } = await fetchDashboardData(ctx.orgId ?? '');
  const scores = deriveRealityScore(openAlerts.length, visibilityScore);
  const firstName = ctx.fullName?.split(' ')[0] ?? ctx.email.split('@')[0];
  const hasOpenAlerts = openAlerts.length > 0;

  // Build sparkline data from SOV trend (last 7 points)
  const sovSparkline = sovTrend.slice(-7).map((d) => d.sov);

  return (
    <div className="space-y-5">

      {/* ── Page header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          {hasOpenAlerts
            ? `${openAlerts.length} AI ${openAlerts.length === 1 ? 'lie' : 'lies'} detected — fix them before your customers notice.`
            : 'Your AI visibility is clean. Keep your ground truth up to date.'}
        </p>
      </div>

      {/* ── Welcome banner — day-1 tenants only ─────────────────── */}
      {scores.realityScore === null && openAlerts.length === 0 && (
        <div className="rounded-xl border border-signal-green/20 bg-signal-green/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-signal-green">
            Welcome to LocalVector.ai
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Your AI visibility dashboard is ready. Your first automated scan runs
            Sunday, {nextSundayLabel()} — check back Monday for your Reality Score,
            SOV trend, and hallucination alerts.
          </p>
        </div>
      )}

      {/*
        ── Fear First layout (Doc 06 §1 Design Principle #1) ────────────────
        When open alerts exist, AlertFeed leads. When the board is clean,
        the Reality Score Card leads instead.
      */}
      {hasOpenAlerts ? (
        <>
          <AlertFeed alerts={openAlerts} />
          <RealityScoreCard {...scores} openAlertCount={openAlerts.length} lastAuditAt={lastAuditAt} />
        </>
      ) : (
        <>
          <RealityScoreCard {...scores} openAlertCount={0} lastAuditAt={lastAuditAt} />
          <AlertFeed alerts={[]} />
        </>
      )}

      {/* ── Quick Stats Row — Surgery 4: Enhanced MetricCard with sparklines ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Hallucinations fixed"
          value={fixedCount}
          color="green"
        />
        <MetricCard
          label="Open alerts"
          value={openAlerts.length}
          color={hasOpenAlerts ? 'red' : 'green'}
        />
        <MetricCard
          label="Intercept analyses"
          value={interceptsThisMonth}
          color="green"
        />
        <MetricCard
          label="AI Visibility"
          value={scores.visibility != null ? `${scores.visibility}%` : '—'}
          color="green"
          trend={sovSparkline.length > 1 ? sovSparkline : undefined}
        />
      </div>

      {/* ── Surgery 4: Data Visualization Row ────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SOVTrendChart data={sovTrend} />
        <HallucinationsByModel data={hallucinationsByModel} />
      </div>

      {/* ── Surgery 4: Competitor Comparison ──────────────────────── */}
      {competitorComparison.length > 0 && (
        <CompetitorComparison data={competitorComparison} />
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickStat — inline sub-component
// ---------------------------------------------------------------------------

function QuickStat({
  label,
  value,
  color,
  className = '',
}: {
  label: string;
  value: number | string;
  color: string;
  className?: string;
}) {
  return (
    <div
      className={[
        'rounded-xl bg-surface-dark border border-white/5 px-4 py-4',
        className,
      ].join(' ')}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className={['mt-1.5 text-2xl font-bold tabular-nums', color].join(' ')}>
        {value}
      </p>
    </div>
  );
}
