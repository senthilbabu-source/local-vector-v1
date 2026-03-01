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
import { canRunAutopilot, canConnectGBP, canExportData, canRunNAPSync, canRunSchemaExpansion, canRunReviewEngine, type PlanTier } from '@/lib/plan-enforcer';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { nextSundayLabel } from './_components/scan-health-utils';
import { isSampleMode } from '@/lib/sample-data/use-sample-mode';
import {
  SAMPLE_VISIBILITY_SCORE,
  SAMPLE_OPEN_ALERT_COUNT,
  SAMPLE_WRONG_FACTS_COUNT,
  SAMPLE_BOT_DATA,
} from '@/lib/sample-data/sample-dashboard-data';
import { SampleDataBadge } from '@/components/ui/SampleDataBadge';
import { SampleModeBanner } from '@/components/ui/SampleModeBanner';
import { PositioningBanner } from '@/components/ui/PositioningBanner';
import GBPImportCard from './_components/GBPImportCard';
import ExportButtons from './_components/ExportButtons';
import AlertFeed from './_components/AlertFeed';
import RevenueLeakCard from './_components/RevenueLeakCard';
import LeakBreakdownChart from './_components/LeakBreakdownChart';
import LeakTrendChart from './_components/LeakTrendChart';
import BotActivityCard from './_components/BotActivityCard';
import ProofTimelineCard from './_components/ProofTimelineCard';
import CronHealthCard from './_components/CronHealthCard';
import ContentFreshnessCard from './_components/ContentFreshnessCard';
import EntityHealthCard from './_components/EntityHealthCard';
import BenchmarkComparisonCard from './_components/BenchmarkComparisonCard';
import OccasionAlertFeed from './_components/OccasionAlertFeed';
import { getOccasionAlerts } from '@/lib/occasions/occasion-feed';
import type { DashboardOccasionAlert } from '@/lib/occasions/occasion-feed';
// Sprint G: New dashboard panels
import AIVisibilityPanel from './_components/panels/AIVisibilityPanel';
import WrongFactsPanel from './_components/panels/WrongFactsPanel';
import AIBotAccessPanel from './_components/panels/AIBotAccessPanel';
import LastScanPanel from './_components/panels/LastScanPanel';
import TopIssuesPanel from './_components/TopIssuesPanel';
// Sprint 86: Autopilot Engine — Content Drafts Panel
import ContentDraftsPanel from './_components/panels/ContentDraftsPanel';
// Sprint 105: NAP Sync — Listing Health Panel
import ListingHealthPanel from './_components/ListingHealthPanel';
// Sprint 106: Schema Expansion — Schema Health Panel
import SchemaHealthPanel from './_components/SchemaHealthPanel';
// Sprint 107: Review Intelligence Engine — Review Inbox Panel
import ReviewInboxPanel from './_components/ReviewInboxPanel';

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
    currentLeak, previousLeak, revenueConfig, revenueSnapshots, orgPlan, orgCreatedAt,
    healthScore, crawlerSummary, hasPublishedMenu, cronHealth, freshness,
    benchmark, locationContext,
    draftsPending, draftsApproved, draftsMonthlyUsed, draftsMonthlyLimit,
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

  // ── Sprint B: Sample Data Mode ──────────────────────────────────────────
  const sampleMode = isSampleMode(scores.realityScore, orgCreatedAt);
  const displayScores = sampleMode
    ? deriveRealityScore(SAMPLE_OPEN_ALERT_COUNT, SAMPLE_VISIBILITY_SCORE)
    : scores;
  const displayOpenAlertCount = sampleMode ? SAMPLE_OPEN_ALERT_COUNT : openAlerts.length;

  // Sprint D (M6): Positioning Banner — show for new orgs (< 30 days old)
  const isNewOrg = orgCreatedAt
    ? Date.now() - new Date(orgCreatedAt).getTime() < 30 * 24 * 60 * 60 * 1000
    : false;
  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {hasOpenAlerts
              ? `${openAlerts.length} wrong ${openAlerts.length === 1 ? 'fact' : 'facts'} detected — fix them before your customers notice.`
              : 'Your AI visibility is clean. Keep your ground truth up to date.'}
          </p>
        </div>
        <ExportButtons canExport={exportGated} showCSV={false} showPDF />
      </div>

      {/* ── Banners ─────────────────────────────────────────────────────────── */}
      {sampleMode && (
        <SampleModeBanner nextScanDate={`Sunday, ${nextSundayLabel()}`} />
      )}
      {isNewOrg && !sampleMode && <PositioningBanner />}
      {!sampleMode && scores.realityScore === null && openAlerts.length === 0 && (
        <div className="rounded-xl border border-signal-green/20 bg-signal-green/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-signal-green">
            Welcome to LocalVector.ai
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Your AI visibility dashboard is ready. Your first automated scan runs
            Sunday, {nextSundayLabel()} — check back Monday for your scores
            and alerts.
          </p>
        </div>
      )}

      {/* Sprint 101: Occasion Alert Feed */}
      {occasionAlerts.length > 0 && (
        <OccasionAlertFeed alerts={occasionAlerts} canCreateDraft={draftGated} />
      )}

      {/* ── Sprint G: 4 Stat Panels ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <AIVisibilityPanel
            score={displayScores.realityScore}
            previousScore={null}
            benchmark={benchmark}
            orgCity={locationContext.city}
          />
          {sampleMode && <SampleDataBadge />}
        </div>
        <div className="relative">
          <WrongFactsPanel
            alertCount={sampleMode ? SAMPLE_WRONG_FACTS_COUNT : openAlerts.length}
            previousCount={null}
          />
          {sampleMode && <SampleDataBadge />}
        </div>
        <div className="relative">
          <AIBotAccessPanel
            bots={sampleMode ? SAMPLE_BOT_DATA.map(b => ({ ...b })) : (crawlerSummary?.bots ?? [])}
          />
          {sampleMode && <SampleDataBadge />}
        </div>
        <LastScanPanel lastScanAt={lastAuditAt} />
      </div>

      {/* ── Sprint G: Top Issues ─────────────────────────────────────────────── */}
      <TopIssuesPanel
        alerts={openAlerts}
        crawlerSummary={crawlerSummary}
        sampleMode={sampleMode}
      />

      {/* ── Sprint 86: Content Drafts Panel (Growth+ only) ──────────────── */}
      {draftGated && (
        <ContentDraftsPanel
          pendingCount={draftsPending}
          approvedCount={draftsApproved}
          monthlyUsed={draftsMonthlyUsed}
          monthlyLimit={draftsMonthlyLimit}
        />
      )}

      {/* ── Revenue Leak Scorecard ──────────────────────────────────────────── */}
      <RevenueLeakCard leak={currentLeak} previousLeak={previousLeak} config={revenueConfig} plan={orgPlan} />

      {/* ── Alert Feed (detail view — for users who want to see all alerts) ── */}
      {hasOpenAlerts && (
        <AlertFeed alerts={openAlerts} canCreateDraft={draftGated} />
      )}

      {/* ── Benchmark Comparison (hidden in sample mode — Sprint O N4) ───── */}
      {!sampleMode && (
        <BenchmarkComparisonCard
          orgScore={displayScores.realityScore}
          orgCity={locationContext.city}
          orgIndustry={locationContext.industry}
          benchmark={benchmark}
        />
      )}

      {/* ── Sprint 105: Listing Health Panel (Growth+ only) ──────────────── */}
      <ListingHealthPanel isGrowthPlan={canRunNAPSync(planTier)} />

      {/* ── Sprint 106: Schema Health Panel (Growth+ only) ──────────────── */}
      <SchemaHealthPanel isGrowthPlan={canRunSchemaExpansion(planTier)} />

      {/* ── Sprint 107: Review Intelligence Panel (Growth+ only) ────────── */}
      <ReviewInboxPanel isGrowthPlan={canRunReviewEngine(planTier)} />

      {/* ── Detail Cards ────────────────────────────────────────────────────── */}
      <BotActivityCard crawlerSummary={crawlerSummary} hasPublishedMenu={hasPublishedMenu} />
      <ProofTimelineCard timeline={proofTimeline} />
      <EntityHealthCard entityHealth={entityHealth} />

      {/* Sprint 89: GBP Import Card (Growth+ with GBP connected) */}
      {hasGBPConnection && <GBPImportCard gbpSyncedAt={gbpSyncedAt} />}

      <ContentFreshnessCard freshness={freshness} />
      <CronHealthCard cronHealth={cronHealth} />

      {/* Revenue Leak Charts (Growth+ only) */}
      {currentLeak && orgPlan !== 'trial' && orgPlan !== 'starter' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LeakBreakdownChart breakdown={currentLeak.breakdown} />
          <LeakTrendChart snapshots={revenueSnapshots} />
        </div>
      )}
    </div>
  );
}
