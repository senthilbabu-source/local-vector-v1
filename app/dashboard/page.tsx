import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { fetchDashboardData } from '@/lib/data/dashboard';
import { fetchProofTimeline } from '@/lib/data/proof-timeline';
import { fetchEntityHealth } from '@/lib/data/entity-health';
import { createClient } from '@/lib/supabase/server';
import type { ProofTimeline } from '@/lib/services/proof-timeline.service';
import type { EntityHealthResult } from '@/lib/services/entity-health.service';
import { canRunAutopilot, type PlanTier } from '@/lib/plan-enforcer';
import { nextSundayLabel } from './_components/scan-health-utils';
import RealityScoreCard from './_components/RealityScoreCard';
import AlertFeed from './_components/AlertFeed';
import SOVTrendChart from './_components/SOVTrendChart';
import HallucinationsByModel from './_components/HallucinationsByModel';
import CompetitorComparison from './_components/CompetitorComparison';
import MetricCard from './_components/MetricCard';
import AIHealthScoreCard from './_components/AIHealthScoreCard';
import RevenueLeakCard from './_components/RevenueLeakCard';
import LeakBreakdownChart from './_components/LeakBreakdownChart';
import LeakTrendChart from './_components/LeakTrendChart';
import BotActivityCard from './_components/BotActivityCard';
import ProofTimelineCard from './_components/ProofTimelineCard';
import CronHealthCard from './_components/CronHealthCard';
import ContentFreshnessCard from './_components/ContentFreshnessCard';
import EntityHealthCard from './_components/EntityHealthCard';

export type { HallucinationRow } from '@/lib/data/dashboard'; // re-export for AlertFeed.tsx

// Reality Score derivation — Formula from Doc 03 §9:
//   reality_score = (Visibility × 0.4) + (Accuracy × 0.4) + (DataHealth × 0.2)
// Visibility: live from visibility_analytics.share_of_voice (Phase 5 SOV cron)
// Accuracy:   100 with 0 open alerts; −15 per open alert, floor 40
// Data Health: 100 — user cleared the onboarding guard (ground truth exists)
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
export default async function DashboardPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  const {
    openAlerts, fixedCount, interceptsThisMonth, visibilityScore, lastAuditAt,
    sovTrend, hallucinationsByModel, competitorComparison,
    currentLeak, previousLeak, revenueConfig, revenueSnapshots, orgPlan,
    healthScore, crawlerSummary, hasPublishedMenu, cronHealth, freshness,
  } = await fetchDashboardData(ctx.orgId ?? '');

  // ── Sprint 77: Proof Timeline summary card ──────────────────────────────
  // Non-blocking — if timeline fetch fails, proofTimeline is null.
  let proofTimeline: ProofTimeline | null = null;
  try {
    if (ctx.orgId) {
      const supabase = await createClient();
      const { data: primaryLoc } = await supabase
        .from('locations')
        .select('id')
        .eq('org_id', ctx.orgId)
        .eq('is_primary', true)
        .maybeSingle();
      if (primaryLoc) {
        proofTimeline = await fetchProofTimeline(supabase, ctx.orgId, primaryLoc.id);
      }
    }
  } catch {
    // Proof timeline is non-critical — dashboard renders without it.
  }

  // ── Sprint 80: Entity Health summary card ──────────────────────────────
  // Non-blocking — if entity health fetch fails, entityHealth is null.
  let entityHealth: EntityHealthResult | null = null;
  try {
    if (ctx.orgId) {
      const supabase = await createClient();
      const { data: primaryLoc } = await supabase
        .from('locations')
        .select('id')
        .eq('org_id', ctx.orgId)
        .eq('is_primary', true)
        .maybeSingle();
      if (primaryLoc) {
        entityHealth = await fetchEntityHealth(supabase, ctx.orgId, primaryLoc.id);
      }
    }
  } catch {
    // Entity health is non-critical — dashboard renders without it.
  }
  const scores = deriveRealityScore(openAlerts.length, visibilityScore);
  const firstName = ctx.fullName?.split(' ')[0] ?? ctx.email.split('@')[0];
  const hasOpenAlerts = openAlerts.length > 0;
  const draftGated = canRunAutopilot((orgPlan ?? 'trial') as PlanTier);
  const sovSparkline = sovTrend.slice(-7).map((d) => d.sov);
  return (
    <div className="space-y-5">
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
      {/* Welcome banner — day-1 tenants only */}
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
      {/* Sprint 72: AI Health Score — top of page, above existing content */}
      {healthScore && <AIHealthScoreCard healthScore={healthScore} />}
      {/* Revenue Leak Scorecard — above Fear First layout */}
      <RevenueLeakCard leak={currentLeak} previousLeak={previousLeak} config={revenueConfig} plan={orgPlan} />
      {/* Fear First layout (Doc 06 §1 Design Principle #1) */}
      {hasOpenAlerts ? (
        <>
          <AlertFeed alerts={openAlerts} canCreateDraft={draftGated} />
          <RealityScoreCard {...scores} openAlertCount={openAlerts.length} lastAuditAt={lastAuditAt} />
        </>
      ) : (
        <>
          <RealityScoreCard {...scores} openAlertCount={0} lastAuditAt={lastAuditAt} />
          <AlertFeed alerts={[]} />
        </>
      )}
      {/* Surgery 4: Quick Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Hallucinations fixed" value={fixedCount} color="green" />
        <MetricCard label="Open alerts" value={openAlerts.length} color={hasOpenAlerts ? 'red' : 'green'} />
        <MetricCard label="Intercept analyses" value={interceptsThisMonth} color="green" />
        <MetricCard
          label="AI Visibility"
          value={scores.visibility != null ? `${scores.visibility}%` : '—'}
          color="green"
          trend={sovSparkline.length > 1 ? sovSparkline : undefined}
        />
      </div>
      {/* Sprint 73: Bot Activity Card */}
      <BotActivityCard crawlerSummary={crawlerSummary} hasPublishedMenu={hasPublishedMenu} />
      {/* Sprint 77: Proof Timeline Card */}
      <ProofTimelineCard timeline={proofTimeline} />
      {/* Sprint 80: Entity Health Card */}
      <EntityHealthCard entityHealth={entityHealth} />
      {/* Sprint 76: Content Freshness + Cron Health Cards */}
      <ContentFreshnessCard freshness={freshness} />
      <CronHealthCard cronHealth={cronHealth} />
      {/* Revenue Leak Charts */}
      {currentLeak && orgPlan !== 'trial' && orgPlan !== 'starter' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LeakBreakdownChart breakdown={currentLeak.breakdown} />
          <LeakTrendChart snapshots={revenueSnapshots} />
        </div>
      )}
      {/* Surgery 4: Data Visualization Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SOVTrendChart data={sovTrend} />
        <HallucinationsByModel data={hallucinationsByModel} />
      </div>
      {/* Surgery 4: Competitor Comparison */}
      {competitorComparison.length > 0 && (
        <CompetitorComparison data={competitorComparison} />
      )}
    </div>
  );
}
