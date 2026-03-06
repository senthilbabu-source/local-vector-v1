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
import AIQuoteTicker from './_components/AIQuoteTicker';
import PulseScoreOrb from './_components/PulseScoreOrb';
import CoachBriefCard from './_components/CoachBriefCard';
import WeeklyKPIChips from './_components/WeeklyKPIChips';
import ScoreAttributionPopover from './_components/ScoreAttributionPopover';
import { deriveRealityScore } from '@/lib/services/reality-score.service';

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

      {/* ── Header ───────────────────────────────────────────────────────── */}
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
        />
        {sampleMode && <SampleDataBadge />}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          4. FIXES — What to do about it (max 5, "See all →" link to /hallucinations)
          ════════════════════════════════════════════════════════════════════ */}
      <TopIssuesPanel
        alerts={openAlerts}
        crawlerSummary={crawlerSummary}
        sampleMode={sampleMode}
      />

    </div>
  );
}
