import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchSourceIntelligence } from '@/lib/data/source-intelligence';
import { PlanGate } from '@/components/plan-gate/PlanGate';
import type { NormalizedSource, SourceAlert, SourceCategory } from '@/lib/services/source-intelligence.service';
import { SourceHealthSummaryPanel } from './_components/SourceHealthSummaryPanel';
import { SourceHealthBadge, deriveSourceHealth } from './_components/SourceHealthBadge';

// ---------------------------------------------------------------------------
// Engine label mapping (matches Sentiment page)
// ---------------------------------------------------------------------------

const ENGINE_LABELS: Record<string, { label: string; color: string }> = {
  perplexity: { label: 'Perplexity', color: 'bg-electric-indigo' },
  openai: { label: 'ChatGPT', color: 'bg-signal-green' },
  google: { label: 'Google AI', color: 'bg-alert-amber' },
  copilot: { label: 'Copilot', color: 'bg-[#00A4EF]' },
};

const CATEGORY_LABELS: Record<SourceCategory, { label: string; color: string }> = {
  first_party: { label: 'First Party', color: 'bg-signal-green' },
  review_site: { label: 'Review Sites', color: 'bg-electric-indigo' },
  directory: { label: 'Directories', color: 'bg-alert-amber' },
  competitor: { label: 'Competitor', color: 'bg-alert-crimson' },
  news: { label: 'News', color: 'bg-[#00A4EF]' },
  social: { label: 'Social', color: 'bg-[#E1306C]' },
  blog: { label: 'Blogs', color: 'bg-[#8B5CF6]' },
  other: { label: 'Other', color: 'bg-slate-500' },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SourceIntelligencePage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const supabase = await createClient();

  // Get first location + org plan in parallel
  const [locResult, orgResult] = await Promise.all([
    supabase.from('locations').select('id').eq('org_id', ctx.orgId).limit(1),
    supabase.from('organizations').select('plan').eq('id', ctx.orgId).single(),
  ]);

  const locationId = locResult.data?.[0]?.id;
  const plan = (orgResult.data?.plan as string) ?? 'trial';

  if (!locationId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-white">What AI Reads About You</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">The sources AI engines cite when describing your business</p>
        </div>
        <PlanGate requiredPlan="agency" currentPlan={plan} feature="Citation Source Intelligence">
          <EmptyState />
        </PlanGate>
      </div>
    );
  }

  const result = await fetchSourceIntelligence(supabase, ctx.orgId, locationId);

  if (result.evaluationCount === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-white">What AI Reads About You</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">The sources AI engines cite when describing your business</p>
        </div>
        <PlanGate requiredPlan="agency" currentPlan={plan} feature="Citation Source Intelligence">
          <EmptyState />
        </PlanGate>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">What AI Reads About You</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          The sources AI engines cite when describing your business — tracked across {result.evaluationCount} evaluations.
        </p>
      </div>

      {/* ── Plan-gated content (blur teaser for Growth and below) ──── */}
      <PlanGate requiredPlan="agency" currentPlan={plan} feature="Citation Source Intelligence">
        {/* Sprint I: Source health summary */}
        <SourceHealthSummaryPanel result={result} />

        {/* Alerts */}
        {result.alerts.length > 0 && (
          <div className="mt-6">
            <SourceAlertCards alerts={result.alerts} />
          </div>
        )}

        {/* Top Sources Table */}
        <div className="mt-6">
          <TopSourcesTable sources={result.sources} />
        </div>

        {/* Category Breakdown */}
        <div className="mt-6">
          <CategoryBreakdownBars breakdown={result.categoryBreakdown} firstPartyRate={result.firstPartyRate} />
        </div>

        {/* Per-Engine Breakdown */}
        <div className="mt-6">
          <EngineSourceBreakdown byEngine={result.byEngine} />
        </div>
      </PlanGate>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function SourceAlertCards({ alerts }: { alerts: SourceAlert[] }) {
  return (
    <div className="space-y-3" data-testid="source-alerts">
      {alerts.map((alert, i) => {
        const borderColor = alert.severity === 'high' ? 'border-alert-crimson/50' : 'border-alert-amber/50';
        const iconColor = alert.severity === 'high' ? 'text-alert-crimson' : 'text-alert-amber';

        return (
          <div
            key={`${alert.type}-${i}`}
            className={`rounded-xl bg-surface-dark border ${borderColor} p-5`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 text-sm font-bold ${iconColor}`}>
                {alert.severity === 'high' ? '!!' : '!'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{alert.title}</p>
                <p className="mt-1 text-xs text-slate-400">{alert.description}</p>
                <p className="mt-2 text-xs text-electric-indigo">{alert.recommendation}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopSourcesTable({ sources }: { sources: NormalizedSource[] }) {
  const top10 = sources.slice(0, 10);
  if (top10.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-6" data-testid="top-sources-table">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Top Sources</p>
      <div className="mt-4 space-y-2">
        {top10.map((source, i) => (
          <div key={`${source.name}-${i}`} className="flex items-center gap-3 py-1.5">
            <span className="w-6 text-right text-xs font-mono text-slate-600">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-electric-indigo transition truncate"
                  >
                    {source.name}
                  </a>
                ) : (
                  <span className="text-sm text-white truncate">{source.name}</span>
                )}
                <SourceHealthBadge
                  health={deriveSourceHealth(source.category, source.isCompetitorAlert)}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {source.engines.map(engine => {
                const config = ENGINE_LABELS[engine];
                return (
                  <span
                    key={engine}
                    className={`inline-block h-2.5 w-2.5 rounded-full ${config?.color ?? 'bg-slate-500'}`}
                    title={config?.label ?? engine}
                  />
                );
              })}
            </div>
            <span className="w-12 text-right text-xs font-mono text-slate-400 shrink-0">
              {source.citationCount}x
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBreakdownBars({
  breakdown,
  firstPartyRate,
}: {
  breakdown: Array<{ category: SourceCategory; count: number; percentage: number }>;
  firstPartyRate: number;
}) {
  if (breakdown.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-6" data-testid="category-breakdown">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Source Categories</p>
        <span className="text-xs text-slate-500">
          First-party rate: <span className="font-mono text-white">{firstPartyRate}%</span>
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        {breakdown.map(({ category, percentage }) => {
          const config = CATEGORY_LABELS[category] ?? { label: category, color: 'bg-slate-500' };
          return (
            <div key={category} className="flex items-center gap-3">
              <span className="w-24 text-xs text-slate-300 shrink-0">{config.label}</span>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${config.color}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-mono text-slate-400 shrink-0">
                {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EngineSourceBreakdown({
  byEngine,
}: {
  byEngine: Record<string, NormalizedSource[]>;
}) {
  const engines = Object.entries(byEngine);
  if (engines.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-6" data-testid="engine-breakdown">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Per-Engine Breakdown</p>
      <div className="mt-4 space-y-4">
        {engines.map(([engine, sources]) => {
          const config = ENGINE_LABELS[engine] ?? { label: engine, color: 'bg-slate-500' };
          return (
            <div key={engine}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`h-2 w-2 rounded-full ${config.color}`} />
                <span className="text-sm font-medium text-white">{config.label}</span>
                <span className="text-xs text-slate-500">({sources.length} sources)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-4">
                {sources.slice(0, 8).map((source, i) => (
                  <span
                    key={`${source.name}-${i}`}
                    className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-300"
                  >
                    {source.name}
                  </span>
                ))}
                {sources.length > 8 && (
                  <span className="text-xs text-slate-500">+{sources.length - 8} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center border border-white/5">
      <p className="text-sm font-medium text-[#94A3B8]">No source data yet</p>
      <p className="mt-1 text-xs text-slate-400">
        Source intelligence is built from your SOV evaluations.
        Once you have SOV results, you&apos;ll see exactly which websites AI engines use to form opinions about your business.
      </p>
      <a
        href="/dashboard/share-of-voice"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface-dark px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
      >
        Go to Share of Voice →
      </a>
    </div>
  );
}
