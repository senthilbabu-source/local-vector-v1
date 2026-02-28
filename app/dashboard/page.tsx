import * as Sentry from '@sentry/nextjs';
import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { fetchDashboardData } from '@/lib/data/dashboard';
import { getActiveLocationId } from '@/lib/location/active-location';
import { fetchProofTimeline } from '@/lib/data/proof-timeline';
import { fetchEntityHealth } from '@/lib/data/entity-health';
import { createClient } from '@/lib/supabase/server';
import type { ProofTimeline } from '@/lib/services/proof-timeline.service';
import type { EntityHealthResult } from '@/lib/services/entity-health.service';
import { canRunAutopilot, canConnectGBP, canExportData, type PlanTier } from '@/lib/plan-enforcer';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { nextSundayLabel } from './_components/scan-health-utils';
import GBPImportCard from './_components/GBPImportCard';
import ExportButtons from './_components/ExportButtons';
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
import OccasionAlertFeed from './_components/OccasionAlertFeed';
import { getOccasionAlerts } from '@/lib/occasions/occasion-feed';
import type { DashboardOccasionAlert } from '@/lib/occasions/occasion-feed';

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

  // Sprint 100: resolve active location for location-scoped data
  const supabaseForLocation = await createClient();
  const activeLocationId = ctx.orgId
    ? await getActiveLocationId(supabaseForLocation, ctx.orgId)
    : null;

  const {
    openAlerts, fixedCount, interceptsThisMonth, visibilityScore, lastAuditAt,
    sovTrend, hallucinationsByModel, competitorComparison,
    currentLeak, previousLeak, revenueConfig, revenueSnapshots, orgPlan,
    healthScore, crawlerSummary, hasPublishedMenu, cronHealth, freshness,
  } = await fetchDashboardData(ctx.orgId ?? '', activeLocationId);

  // ── Sprint 77: Proof Timeline summary card (Sprint 100: uses active location)
  // Non-blocking — if timeline fetch fails, proofTimeline is null.
  let proofTimeline: ProofTimeline | null = null;
  try {
    if (ctx.orgId && activeLocationId) {
      const supabase = await createClient();
      proofTimeline = await fetchProofTimeline(supabase, ctx.orgId, activeLocationId);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'proof-timeline', sprint: 'A' }, extra: { orgId: ctx.orgId } });
    // Proof timeline is non-critical — dashboard renders without it.
  }

  // ── Sprint 80: Entity Health summary card (Sprint 100: uses active location)
  // Non-blocking — if entity health fetch fails, entityHealth is null.
  let entityHealth: EntityHealthResult | null = null;
  try {
    if (ctx.orgId && activeLocationId) {
      const supabase = await createClient();
      entityHealth = await fetchEntityHealth(supabase, ctx.orgId, activeLocationId);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'entity-health', sprint: 'A' }, extra: { orgId: ctx.orgId } });
    // Entity health is non-critical — dashboard renders without it.
  }
  // ── Sprint 101: Occasion Alert Feed ──────────────────────────────────────
  let occasionAlerts: DashboardOccasionAlert[] = [];
  try {
    if (ctx.orgId) {
      const occasionSupa = await createClient();
      occasionAlerts = await getOccasionAlerts(occasionSupa, ctx.orgId, ctx.userId, activeLocationId);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'occasion-alerts', sprint: 'A' }, extra: { orgId: ctx.orgId } });
    // Occasion alerts are non-critical — dashboard renders without them.
  }

  // ── Sprint 89: GBP Import Card (Growth+ plan gated) ────────────────────
  let gbpSyncedAt: string | null = null;
  let hasGBPConnection = false;
  const planTier = (orgPlan ?? 'trial') as PlanTier;
  if (ctx.orgId && canConnectGBP(planTier)) {
    try {
      const serviceRole = createServiceRoleClient();
      const { data: tokenRow } = await serviceRole
        .from('google_oauth_tokens')
        .select('id')
        .eq('org_id', ctx.orgId)
        .maybeSingle();
      hasGBPConnection = !!tokenRow;

      if (hasGBPConnection) {
        const supabase2 = await createClient();
        const { data: loc } = await supabase2
          .from('locations')
          .select('gbp_synced_at')
          .eq('org_id', ctx.orgId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        gbpSyncedAt = loc?.gbp_synced_at ?? null;
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'gbp-card', sprint: 'A' }, extra: { orgId: ctx.orgId } });
      // GBP card is non-critical
    }
  }

  const scores = deriveRealityScore(openAlerts.length, visibilityScore);
  const firstName = ctx.fullName?.split(' ')[0] ?? ctx.email.split('@')[0];
  const hasOpenAlerts = openAlerts.length > 0;
  const draftGated = canRunAutopilot(planTier);
  const exportGated = canExportData(planTier);
  const sovSparkline = sovTrend.slice(-7).map((d) => d.sov);
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
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
        <ExportButtons canExport={exportGated} showCSV={false} showPDF />
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
      {/* Sprint 101: Occasion Alert Feed — surfaces upcoming occasions with CTAs */}
      {occasionAlerts.length > 0 && (
        <OccasionAlertFeed alerts={occasionAlerts} canCreateDraft={draftGated} />
      )}
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
        <MetricCard label="Hallucinations fixed" value={fixedCount} color="green" href="/dashboard/hallucinations" />
        <MetricCard label="Open alerts" value={openAlerts.length} color={hasOpenAlerts ? 'red' : 'green'} href="/dashboard/hallucinations" />
        <MetricCard label="Intercept analyses" value={interceptsThisMonth} color="green" href="/dashboard/ai-responses" />
        <MetricCard
          label="AI Visibility"
          value={scores.visibility != null ? `${scores.visibility}%` : '—'}
          color="green"
          trend={sovSparkline.length > 1 ? sovSparkline : undefined}
          href="/dashboard/share-of-voice"
        />
      </div>
      {/* Sprint 73: Bot Activity Card */}
      <BotActivityCard crawlerSummary={crawlerSummary} hasPublishedMenu={hasPublishedMenu} />
      {/* Sprint 77: Proof Timeline Card */}
      <ProofTimelineCard timeline={proofTimeline} />
      {/* Sprint 80: Entity Health Card */}
      <EntityHealthCard entityHealth={entityHealth} />
      {/* Sprint 89: GBP Import Card (Growth+ with GBP connected) */}
      {hasGBPConnection && <GBPImportCard gbpSyncedAt={gbpSyncedAt} />}
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
