import { redirect } from 'next/navigation';
import { Swords } from 'lucide-react';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canRunCompetitorIntercept, maxCompetitors } from '@/lib/plan-enforcer';
import AddCompetitorForm from './_components/AddCompetitorForm';
import CompetitorChip from './_components/CompetitorChip';
import RunAnalysisButton from './_components/RunAnalysisButton';
import InterceptCard from './_components/InterceptCard';
import CompeteCoachHero from './_components/CompeteCoachHero';
import VulnerabilityAlertCard from './_components/VulnerabilityAlertCard';

export const metadata = { title: 'Competitors | LocalVector.ai' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompetitorRow = {
  id:                 string;
  competitor_name:    string;
  competitor_address: string | null;
};

type VulnerabilityAlertRow = {
  id: string;
  competitor_name: string;
  vulnerability_type: string;
  evidence_snippet: string | null;
  strategic_suggestion: string | null;
  expires_at: string;
  dismissed_at: string | null;
};

type InterceptRow = {
  id:               string;
  competitor_name:  string;
  query_asked:      string | null;
  winner:           string | null;
  winner_reason:    string | null;
  winning_factor:   string | null;
  gap_analysis:     { competitor_mentions: number; your_mentions: number } | null;
  gap_magnitude:    string | null;
  suggested_action: string | null;
  action_status:    string;
  pre_action_gap:   { competitor_mentions: number; your_mentions: number } | null;
};

// ---------------------------------------------------------------------------
// UpgradeGate — inline (single use, AI_RULES §over-engineering)
// ---------------------------------------------------------------------------

function UpgradeGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <Swords className="h-12 w-12 text-slate-500" />
      <h2 className="text-xl font-semibold text-white">See Why They&apos;re Winning</h2>
      <p className="text-slate-400 max-w-md">
        Competitor Intercept is available on the Growth plan. Upgrade to track up to 3 competitors
        and get weekly AI-powered intercept reports.
      </p>
      <a
        href="/dashboard/billing"
        className="rounded-lg bg-signal-green px-6 py-2.5 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 transition"
      >
        Upgrade to Growth — $59/mo
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPageData(orgId: string, isAgency: boolean): Promise<{
  competitors:  CompetitorRow[];
  intercepts:   InterceptRow[];
  businessName: string;
  vulnerabilities: VulnerabilityAlertRow[];
}> {
  const supabase = await createClient();

  const [compResult, interceptResult, locResult] = await Promise.all([
    supabase
      .from('competitors')
      .select('id, competitor_name, competitor_address')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),

    supabase
      .from('competitor_intercepts')
      .select(
        'id, competitor_name, query_asked, winner, winner_reason, winning_factor, gap_analysis, gap_magnitude, suggested_action, action_status, pre_action_gap'
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('locations')
      .select('business_name')
      .eq('org_id', orgId)
      .eq('is_primary', true)
      .maybeSingle(),
  ]);

  // S26: Fetch vulnerability alerts for agency orgs
  let vulnerabilities: VulnerabilityAlertRow[] = [];
  if (isAgency) {
    const now = new Date().toISOString();
    const { data: vulnData } = await supabase
      .from('competitor_vulnerability_alerts' as 'cron_run_log')
      .select('id, competitor_name, vulnerability_type, evidence_snippet, strategic_suggestion, expires_at, dismissed_at' as 'id')
      .eq('org_id', orgId)
      .gt('expires_at' as 'started_at', now)
      .is('dismissed_at' as 'started_at', null)
      .order('detected_at' as 'started_at', { ascending: false })
      .limit(10);
    vulnerabilities = (vulnData as unknown as VulnerabilityAlertRow[]) ?? [];
  }

  return {
    competitors:  (compResult.data as CompetitorRow[]) ?? [],
    intercepts:   (interceptResult.data as InterceptRow[]) ?? [],
    businessName: (locResult.data?.business_name as string | undefined) ?? 'Your Business',
    vulnerabilities,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CompetePage() {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    redirect('/login');
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const plan = org?.plan ?? 'trial';

  if (!canRunCompetitorIntercept(plan)) {
    return <UpgradeGate />;
  }

  const isAgency = plan === 'agency';
  const { competitors, intercepts, businessName, vulnerabilities } = await fetchPageData(ctx.orgId, isAgency);
  const maxAllowed = maxCompetitors(plan);

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">You vs Competitors</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          See when AI picks your competitors over you — and how to fix it.
        </p>
      </div>

      {/* ── Competitor management ────────────────────────────────────────── */}
      <section id="competitors" className="rounded-xl border border-white/10 bg-surface-dark p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">Competitors</h2>
          <span className="text-xs text-slate-400">{competitors.length}/{maxAllowed} tracked</span>
        </div>

        {competitors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {competitors.map((c) => (
              <CompetitorChip key={c.id} competitor={c} />
            ))}
          </div>
        )}

        <AddCompetitorForm currentCount={competitors.length} maxAllowed={maxAllowed} />
      </section>

      {/* ── S6: Compete coaching hero ──────────────────────────────────── */}
      {(() => {
        const winCount = intercepts.filter(
          (i) => i.winner === businessName,
        ).length;
        const lossCount = intercepts.filter(
          (i) => i.winner !== null && i.winner !== businessName,
        ).length;

        // Find which competitor beats us most
        const lossCounts: Record<string, number> = {};
        for (const i of intercepts) {
          if (i.winner !== null && i.winner !== businessName) {
            lossCounts[i.competitor_name] = (lossCounts[i.competitor_name] ?? 0) + 1;
          }
        }
        const topLosingEntry = Object.entries(lossCounts).sort((a, b) => b[1] - a[1])[0];
        const topLosingCompetitor = topLosingEntry
          ? { name: topLosingEntry[0], lossCount: topLosingEntry[1] }
          : null;

        return (
          <CompeteCoachHero
            winCount={winCount}
            lossCount={lossCount}
            businessName={businessName}
            topLosingCompetitor={topLosingCompetitor}
          />
        );
      })()}

      {/* ── S26: Vulnerability alerts (Agency only) ──────────────────────── */}
      {vulnerabilities.length > 0 && (
        <section className="space-y-3">
          {vulnerabilities.map((v) => (
            <VulnerabilityAlertCard key={v.id} alert={v} />
          ))}
        </section>
      )}

      {/* ── Analyses ─────────────────────────────────────────────────────── */}
      {competitors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Run Analysis</h2>
          <div className="flex flex-wrap gap-3">
            {competitors.map((c) => (
              <RunAnalysisButton
                key={c.id}
                competitorId={c.id}
                competitorName={c.competitor_name}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Intercept results ────────────────────────────────────────────── */}
      <section id="intercepts" className="space-y-4">
        {intercepts.length > 0 ? (
          intercepts.map((i) => (
            <InterceptCard key={i.id} intercept={i} myBusiness={businessName} />
          ))
        ) : (
          <div className="rounded-xl border border-white/5 bg-surface-dark px-6 py-10 text-center">
            <Swords className="mx-auto h-8 w-8 text-slate-500 mb-3" />
            <p className="text-sm text-slate-400">
              {competitors.length === 0
                ? 'Add a competitor above to get started.'
                : 'No intercepts yet. Run your first analysis above.'}
            </p>
          </div>
        )}
      </section>

    </div>
  );
}
