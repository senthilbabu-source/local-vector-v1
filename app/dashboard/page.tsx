import * as Sentry from '@sentry/nextjs';
import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { fetchDashboardData } from '@/lib/data/dashboard';
import { getActiveLocationId } from '@/lib/location/active-location';
import { createClient } from '@/lib/supabase/server';
import { canRunAutopilot, type PlanTier } from '@/lib/plan-enforcer';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { nextSundayLabel } from './_components/scan-health-utils';
import { isSampleMode } from '@/lib/sample-data/use-sample-mode';
import { resolveDataMode, type DataResolverResult } from '@/lib/data/scan-data-resolver';
import { getOnboardingState } from '@/lib/onboarding/onboarding-service';
import OnboardingChecklist from './_components/OnboardingChecklist';
import OnboardingInterstitial from './_components/OnboardingInterstitial';
import SampleDataBannerSprintB from './_components/SampleDataBanner';
import SampleDashboard from './_components/SampleDashboard';
import {
  SAMPLE_VISIBILITY_SCORE,
  SAMPLE_OPEN_ALERT_COUNT,
} from '@/lib/sample-data/sample-dashboard-data';
import { SampleDataBadge } from '@/components/ui/SampleDataBadge';
import { SampleModeBanner } from '@/components/ui/SampleModeBanner';
import { PositioningBanner } from '@/components/ui/PositioningBanner';
import { ScanCompleteBanner } from '@/components/dashboard/ScanCompleteBanner';
import UpgradeRedirectBanner from './_components/UpgradeRedirectBanner';
import ManualScanTrigger from './_components/ManualScanTrigger';
import TopIssuesPanel from './_components/TopIssuesPanel';
import RecentWinsSection from './_components/RecentWinsSection';
import AIQuoteTicker from './_components/AIQuoteTicker';
import PulseScoreOrb from './_components/PulseScoreOrb';
import CoachBriefCard from './_components/CoachBriefCard';
import WeeklyKPIChips from './_components/WeeklyKPIChips';
import ScoreAttributionPopover from './_components/ScoreAttributionPopover';
import { deriveRealityScore } from '@/lib/services/reality-score.service';
import { getRecentWins, type WinRow } from '@/lib/services/wins.service';
import { computeHealthStreak } from '@/lib/services/health-streak.service';
import { detectScoreMilestone, formatMilestoneMessage } from '@/lib/services/score-milestone.service';
import HealthStreakBadge from './_components/HealthStreakBadge';
import MilestoneCelebration from './_components/MilestoneCelebration';
import FixSpotlightCard, { type SpotlightFix } from './_components/FixSpotlightCard';
import DegradationAlertBanner from './_components/DegradationAlertBanner';
import FirstScanRevealCard from './_components/FirstScanRevealCard';
import ConsistencyScoreCard from './_components/ConsistencyScoreCard';
import GoalTrackerCard from './_components/GoalTrackerCard';
import type { ScoreGoal } from '@/lib/services/goal-tracker';
import { buildSparklineData } from '@/lib/services/kpi-sparkline';
import { fetchConsistencyScore } from '@/lib/services/consistency-score.service';
import AIResponseTeaser from './_components/AIResponseTeaser';
import { getLatestAIResponse, type AIResponseSnippet } from '@/lib/services/ai-response-summary';
import DemandSignalsTeaser from './_components/DemandSignalsTeaser';
import { getTopDemandItems } from '@/lib/menu-intelligence/demand-summary';
import type { MenuDemandResult } from '@/lib/menu-intelligence/demand-analyzer';
import CompetitorTeaser from './_components/CompetitorTeaser';
import { getTopCompetitorMentions, type CompetitorMentionData } from '@/lib/services/competitor-teaser';
import AgentReadinessTeaser from './_components/AgentReadinessTeaser';
import { getAgentReadinessSummary, EMPTY_SUMMARY, type AgentReadinessSummary } from '@/lib/services/agent-readiness-summary';
import QuickWinCard from './_components/QuickWinCard';
import { pickQuickWin, type QuickWinAlert } from '@/lib/services/quick-win';
import ShareSnapshotModal from './_components/ShareSnapshotModal';
import { buildSnapshotData, type SnapshotData } from '@/lib/services/snapshot-builder';
import CompetitorAlertCard from './_components/CompetitorAlertCard';
import { getCompetitorChanges, type CompetitorChange } from '@/lib/services/competitor-watch';
import NotificationBell from './_components/NotificationBell';
import ExportReportButton from './_components/ExportReportButton';
import { getNotificationFeed, type Notification as AppNotification } from '@/lib/services/notification-feed';
import { buildExportableReport, type ExportableReport } from '@/lib/services/report-exporter';

export const metadata = { title: 'Dashboard | LocalVector.ai' };

export type { HallucinationRow } from '@/lib/data/dashboard';

// Re-export for backwards compatibility with existing consumers.
export { deriveRealityScore } from '@/lib/services/reality-score.service';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const params = await searchParams;
  const upgradeFeature = params.upgrade ?? null;

  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  const supabaseForLocation = await createClient();
  const activeLocationId = ctx.orgId
    ? await getActiveLocationId(supabaseForLocation, ctx.orgId)
    : null;

  const {
    openAlerts, visibilityScore,
    orgPlan, orgCreatedAt,
    crawlerSummary,
    draftsPending,
    simulationScore, dataHealthScore,
    realityScoreTrend, previousRealityScore,
    benchmark, locationContext,
    revenueRecoveredMonthly,
    currentScoreSnapshot,
    prevScoreSnapshot,
    napScore,
    accuracySnapshots,
    degradationEvent,
  } = await fetchDashboardData(ctx.orgId ?? '', activeLocationId);

  const scores    = deriveRealityScore(openAlerts.length, visibilityScore, dataHealthScore, simulationScore);
  const firstName = ctx.fullName?.split(' ')[0] ?? ctx.email.split('@')[0];
  const planTier  = (orgPlan ?? 'trial') as PlanTier;
  const draftGated = canRunAutopilot(planTier);

  // Sample Data Mode
  const sampleMode = isSampleMode(scores.realityScore, orgCreatedAt);
  const displayScores = sampleMode
    ? deriveRealityScore(SAMPLE_OPEN_ALERT_COUNT, SAMPLE_VISIBILITY_SCORE)
    : scores;
  const displayOpenAlertCount = sampleMode ? SAMPLE_OPEN_ALERT_COUNT : openAlerts.length;

  // New org banner gate (< 30 days)
  const isNewOrg = orgCreatedAt
    ? Date.now() - new Date(orgCreatedAt).getTime() < 30 * 24 * 60 * 60 * 1000
    : false;

  // S20: Health Streak — clean weeks with accuracy_score >= 85
  const healthStreak = sampleMode
    ? { currentStreak: 0, longestStreak: 0, isOnStreak: false }
    : computeHealthStreak(accuracySnapshots);

  // S67: Build sparkline data for KPI chips
  const sparklineData = sampleMode ? null : buildSparklineData(accuracySnapshots);
  const kpiSparklines = sparklineData ? {
    'AI Accuracy': sparklineData.accuracy,
    'AI Visibility': sparklineData.visibility,
  } : undefined;

  // S20: Score Milestone — detect threshold crossings (50/60/70/80/90)
  const milestone = sampleMode
    ? null
    : detectScoreMilestone(displayScores.realityScore, previousRealityScore);
  const milestoneMessage = milestone
    ? formatMilestoneMessage(milestone, locationContext.city)
    : '';

  // S20: Fix Spotlight — high-value fix in the last 7 days
  let spotlightFix: SpotlightFix | null = null;
  if (!sampleMode && ctx.orgId) {
    try {
      const supabaseForSpotlight = await createClient();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: spotlightRows } = await supabaseForSpotlight
        .from('ai_hallucinations')
        .select('id, category, model_provider, revenue_recovered_monthly, fixed_at' as 'id, category, model_provider')
        .in('correction_status', ['fixed', 'corrected'])
        .gte('fixed_at' as 'first_detected_at', sevenDaysAgo)
        .gte('revenue_recovered_monthly' as 'occurrence_count', 100)
        .order('revenue_recovered_monthly' as 'occurrence_count', { ascending: false })
        .limit(1);
      if (spotlightRows && spotlightRows.length > 0) {
        const row = spotlightRows[0] as unknown as SpotlightFix;
        spotlightFix = row;
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'fix-spotlight', sprint: 'S20' } });
    }
  }

  // S20: Wins feed (non-critical — fail silently)
  let recentWins: WinRow[] = [];
  if (ctx.orgId && !sampleMode) {
    try {
      const supabaseForWins = await createClient();
      recentWins = await getRecentWins(supabaseForWins, ctx.orgId, 5);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'wins-feed', sprint: 'S20' } });
    }
  }

  // S28: Consistency Score
  let consistencyData: Awaited<ReturnType<typeof fetchConsistencyScore>> = null;
  if (ctx.orgId && activeLocationId && !sampleMode) {
    try {
      const supabaseForConsistency = await createClient();
      consistencyData = await fetchConsistencyScore(supabaseForConsistency, ctx.orgId, activeLocationId);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'consistency-score', sprint: 'S28' } });
    }
  }

  // S71: Score goal from org_settings
  let scoreGoal: ScoreGoal | null = null;
  if (ctx.orgId && !sampleMode) {
    try {
      const supabaseForGoal = await createClient();
      const { data: goalRow } = await supabaseForGoal
        .from('org_settings' as never)
        .select('score_goal' as never)
        .eq('org_id' as never, ctx.orgId as never)
        .maybeSingle();
      const goalData = (goalRow as { score_goal?: unknown } | null)?.score_goal;
      if (goalData && typeof goalData === 'object' && 'targetScore' in goalData && 'deadline' in goalData) {
        scoreGoal = goalData as ScoreGoal;
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'goal-tracker', sprint: 'S71' } });
    }
  }

  // S30: Latest AI response snippet for teaser
  let latestAIResponse: AIResponseSnippet | null = null;
  if (ctx.orgId && !sampleMode) {
    try {
      const supabaseForTeaser = await createClient();
      latestAIResponse = await getLatestAIResponse(supabaseForTeaser, ctx.orgId);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'ai-response-teaser', sprint: 'S30' } });
    }
  }

  // S36: Menu demand signals for dashboard teaser
  let demandItems: MenuDemandResult[] = [];
  if (ctx.orgId && activeLocationId && !sampleMode) {
    try {
      const supabaseForDemand = await createClient();
      demandItems = await getTopDemandItems(supabaseForDemand, activeLocationId, ctx.orgId, 3);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'demand-signals-teaser', sprint: 'S36' } });
    }
  }

  // S37: Competitor teaser for dashboard
  let competitorData: CompetitorMentionData | null = null;
  if (ctx.orgId && !sampleMode) {
    try {
      const supabaseForCompetitor = await createClient();
      competitorData = await getTopCompetitorMentions(supabaseForCompetitor, ctx.orgId, 7);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'competitor-teaser', sprint: 'S37' } });
    }
  }

  // S38: Agent readiness summary for dashboard teaser
  let agentReadiness: AgentReadinessSummary = EMPTY_SUMMARY;
  if (ctx.orgId && activeLocationId && !sampleMode) {
    try {
      const supabaseForReadiness = await createClient();
      agentReadiness = await getAgentReadinessSummary(supabaseForReadiness, ctx.orgId, activeLocationId);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'agent-readiness-teaser', sprint: 'S38' } });
    }
  }

  // S39: Quick Win — pick the single highest-impact action
  const quickWinAlerts: QuickWinAlert[] = sampleMode
    ? []
    : openAlerts.map((a) => ({
        severity: a.severity,
        category: a.category,
        model_provider: a.model_provider,
        claim_text: a.claim_text,
        revenue_recovered_monthly: a.revenue_recovered_monthly,
      }));
  const quickWin = sampleMode
    ? null
    : pickQuickWin(quickWinAlerts, {
        menuPublished: agentReadiness.canSeeMenu,
        napScore: napScore,
        sovPercent: visibilityScore,
      });

  // S44: Shareable snapshot data
  let snapshotData: SnapshotData | null = null;
  if (ctx.orgId && !sampleMode) {
    try {
      const supabaseForSnapshot = await createClient();
      snapshotData = await buildSnapshotData(supabaseForSnapshot, ctx.orgId);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'share-snapshot', sprint: 'S44' } });
    }
  }

  // S46: Competitor watch alerts (significant week-over-week changes)
  let competitorChanges: CompetitorChange[] = [];
  if (ctx.orgId && !sampleMode) {
    try {
      const supabaseForWatch = await createClient();
      competitorChanges = await getCompetitorChanges(supabaseForWatch, ctx.orgId);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'competitor-watch', sprint: 'S46' } });
    }
  }

  // S48: Notification feed
  let notifications: AppNotification[] = [];
  if (ctx.orgId && !sampleMode) {
    try {
      const supabaseForNotifications = await createClient();
      notifications = await getNotificationFeed(supabaseForNotifications, ctx.orgId, 15);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'notification-bell', sprint: 'S48' } });
    }
  }

  // S49: Exportable report (built from current dashboard data)
  const exportReport: ExportableReport | null = sampleMode
    ? null
    : buildExportableReport(
        {
          score: displayScores.realityScore,
          scoreDelta: previousRealityScore !== null && displayScores.realityScore !== null
            ? displayScores.realityScore - previousRealityScore
            : null,
          topWin: null,
          topIssue: openAlerts[0]?.claim_text ?? null,
          competitorHighlight: null,
          nextAction: null,
          errorsFixed: 0,
          newErrors: openAlerts.length,
          sovPercent: visibilityScore,
        },
        locationContext.city ?? 'Your Restaurant',
        { napScore: napScore, consistencyScore: consistencyData?.consistencyScore ?? null },
      );

  const isGrowthPlus = planTier === 'growth' || planTier === 'agency';

  // Onboarding + data resolver
  let onboardingState = null;
  let dataResolverResult: DataResolverResult | null = null;
  try {
    if (ctx.orgId) {
      const serviceClient = createServiceRoleClient();
      const [onboarding, dataMode] = await Promise.all([
        getOnboardingState(serviceClient, ctx.orgId, orgCreatedAt, planTier),
        resolveDataMode({ supabase: serviceClient, orgId: ctx.orgId }),
      ]);
      onboardingState = onboarding;
      dataResolverResult = dataMode;
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'onboarding', sprint: '117' }, extra: { orgId: ctx.orgId } });
  }

  // First-run: no real data yet → show sample + checklist only
  if (onboardingState && !onboardingState.has_real_data) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Welcome, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Complete setup and your dashboard fills in after your first AI scan.
          </p>
        </div>
        <SampleDataBannerSprintB />
        <OnboardingChecklist initialState={onboardingState} />
        <SampleDashboard />
        <OnboardingInterstitial show={onboardingState.show_interstitial} />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── S27: First scan reveal overlay (shown once for new orgs) ────── */}
      {dataResolverResult?.isFirstScanRecent && !sampleMode && (
        <FirstScanRevealCard
          sovPercent={visibilityScore}
          errorCount={openAlerts.length}
          monthlyImpact={revenueRecoveredMonthly ?? 0}
          criticalClaimText={openAlerts[0]?.claim_text ?? null}
        />
      )}

      {/* ── S20: Milestone celebration overlay (auto-dismiss 3s) ────────── */}
      {milestone && (
        <MilestoneCelebration milestone={milestone.threshold} message={milestoneMessage} />
      )}

      {/* ── S39: Quick Win — highest-impact action ────────────────────────── */}
      <QuickWinCard quickWin={quickWin} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {openAlerts.length > 0
              ? `${openAlerts.length} AI ${openAlerts.length === 1 ? 'error' : 'errors'} need your attention today.`
              : 'AI is representing your restaurant accurately right now.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportReportButton report={exportReport} />
          <NotificationBell notifications={notifications} />
          <ShareSnapshotModal snapshot={snapshotData} sampleMode={sampleMode} />
          <HealthStreakBadge streak={healthStreak.currentStreak} />
        </div>
      </div>

      {/* ── S22: AI model degradation alert (cross-org spike detection) ── */}
      <DegradationAlertBanner event={degradationEvent} />

      {/* ── Situational banners (each only appears in one specific context) ── */}
      {dataResolverResult?.isFirstScanRecent && <ScanCompleteBanner isFirstScanRecent />}
      {upgradeFeature && <UpgradeRedirectBanner upgradeKey={upgradeFeature} />}
      {onboardingState && <OnboardingChecklist initialState={onboardingState} />}
      {sampleMode && <SampleModeBanner nextScanDate={`Sunday, ${nextSundayLabel()}`} />}
      {isNewOrg && !sampleMode && <PositioningBanner />}
      {!sampleMode && scores.realityScore === null && openAlerts.length === 0 && (
        <div className="rounded-xl border border-signal-green/20 bg-signal-green/5 px-5 py-4">
          <p className="text-sm font-semibold text-signal-green">Your dashboard is ready.</p>
          <p className="mt-1 text-sm text-slate-400">
            First automated scan runs Sunday, {nextSundayLabel()} — check back Monday for your score.
          </p>
        </div>
      )}

      {/* ── On-demand scan trigger (Growth/Agency) ───────────────────────── */}
      <ManualScanTrigger plan={planTier} />

      {/* ════════════════════════════════════════════════════════════════════
          1. TICKER — What AI is saying about you right now
          One strip. Scrolls. Instantly shows what's at stake.
          ════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        <AIQuoteTicker alerts={sampleMode ? [] : openAlerts} orgName={firstName} />
        {sampleMode && <SampleDataBadge />}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          1.5 AI RESPONSE TEASER — latest AI quote, links to full page
          ════════════════════════════════════════════════════════════════════ */}
      <AIResponseTeaser response={latestAIResponse} sampleMode={sampleMode} />

      {/* ════════════════════════════════════════════════════════════════════
          2. HERO — Your score + your coach side by side
          Left: animated score orb with streak + benchmark context
          Right: 1–2 specific missions with time estimates
          ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="relative">
          <PulseScoreOrb
            score={displayScores.realityScore}
            previousScore={sampleMode ? null : previousRealityScore}
            trend={sampleMode ? null : realityScoreTrend}
            orgCity={locationContext.city}
            benchmark={benchmark}
          />
          {!sampleMode && currentScoreSnapshot && prevScoreSnapshot && (
            <div className="mt-2 flex justify-end px-1">
              <ScoreAttributionPopover
                current={currentScoreSnapshot}
                previous={prevScoreSnapshot}
              />
            </div>
          )}
          {sampleMode && <SampleDataBadge />}
        </div>
        <CoachBriefCard
          alerts={sampleMode ? [] : openAlerts}
          draftsPending={draftGated ? draftsPending : 0}
          score={displayScores.realityScore}
          firstName={firstName}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          3. KPI CHIPS — Three numbers, three seconds, no explanation needed
          ════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        <WeeklyKPIChips
          openAlertCount={displayOpenAlertCount}
          visibilityScore={sampleMode ? SAMPLE_VISIBILITY_SCORE : visibilityScore}
          crawlerSummary={sampleMode ? null : crawlerSummary}
          revenueRecoveredMonthly={sampleMode ? 0 : revenueRecoveredMonthly}
          napScore={sampleMode ? null : napScore}
          sparklines={kpiSparklines}
        />
        {sampleMode && <SampleDataBadge />}
      </div>

      {/* ── S55: Goal Tracker (shown when user sets a score goal) ────────── */}
      <GoalTrackerCard
        currentScore={displayScores.realityScore}
        goal={scoreGoal}
        sampleMode={sampleMode}
      />

      {/* ── S36: Menu Demand Signals teaser ─────────────────────────────── */}
      <DemandSignalsTeaser items={demandItems} sampleMode={sampleMode} />

      {/* ── S37: Competitor Teaser ────────────────────────────────────────── */}
      <CompetitorTeaser data={competitorData} sampleMode={sampleMode} planTier={planTier} />

      {/* ── S46: Competitor Watch Alerts (significant week-over-week) ───── */}
      <CompetitorAlertCard changes={competitorChanges} isGrowthPlus={isGrowthPlus} />

      {/* ── S28: Consistency Score Card ─────────────────────────────────── */}
      {consistencyData && !sampleMode && (
        <ConsistencyScoreCard
          score={consistencyData.consistencyScore}
          nameScore={consistencyData.nameScore}
          addressScore={consistencyData.addressScore}
          phoneScore={consistencyData.phoneScore}
          hoursScore={consistencyData.hoursScore}
          menuScore={consistencyData.menuScore}
          previousScore={consistencyData.previousScore}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          4. FIXES — What to do about it (max 5, "See all →" link to /hallucinations)
          ════════════════════════════════════════════════════════════════════ */}
      <TopIssuesPanel
        alerts={openAlerts}
        crawlerSummary={crawlerSummary}
        sampleMode={sampleMode}
      />

      {/* ── S38: Agent Readiness Yes/No teaser ───────────────────────────── */}
      <AgentReadinessTeaser summary={agentReadiness} sampleMode={sampleMode} />

      {/* ════════════════════════════════════════════════════════════════════
          5. SPOTLIGHT + WINS — celebrate every fix
          ════════════════════════════════════════════════════════════════════ */}
      {spotlightFix && <FixSpotlightCard fix={spotlightFix} />}
      <RecentWinsSection wins={recentWins} />

    </div>
  );
}
