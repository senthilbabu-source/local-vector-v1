import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchSentimentSummary, fetchSentimentTrend } from '@/lib/data/sentiment';
import { PlanGate } from '@/components/plan-gate/PlanGate';
import type { SentimentExtraction } from '@/lib/ai/schemas';
import { FirstVisitTooltip } from '@/components/ui/FirstVisitTooltip';
import { SentimentInterpretationPanel } from './_components/SentimentInterpretationPanel';

// ---------------------------------------------------------------------------
// Engine label mapping (matches AI Says page)
// ---------------------------------------------------------------------------

const ENGINE_LABELS: Record<string, { label: string; color: string }> = {
  perplexity: { label: 'Perplexity', color: 'bg-electric-indigo' },
  openai: { label: 'ChatGPT', color: 'bg-signal-green' },
  google: { label: 'Google AI', color: 'bg-alert-amber' },
  copilot: { label: 'Copilot', color: 'bg-[#00A4EF]' },
};

function sentimentColor(score: number): string {
  if (score > 0.3) return 'text-signal-green';
  if (score > -0.3) return 'text-alert-amber';
  return 'text-alert-crimson';
}

function sentimentBg(score: number): string {
  if (score > 0.3) return 'bg-signal-green';
  if (score > -0.3) return 'bg-alert-amber';
  return 'bg-alert-crimson';
}

function formatLabel(label: SentimentExtraction['label']): string {
  return label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTone(tone: SentimentExtraction['tone']): string {
  return tone.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SentimentPage() {
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
          <h1 className="text-xl font-semibold text-white">AI Sentiment Analysis</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">How AI engines describe your business</p>
        </div>
        <PlanGate requiredPlan="growth" currentPlan={plan} feature="AI Sentiment Tracker">
          <EmptyState />
        </PlanGate>
      </div>
    );
  }

  const [summary, trend] = await Promise.all([
    fetchSentimentSummary(supabase, ctx.orgId, locationId),
    fetchSentimentTrend(supabase, ctx.orgId, locationId),
  ]);

  if (summary.evaluationCount === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-white">AI Sentiment Analysis</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">How AI engines describe your business</p>
        </div>
        <PlanGate requiredPlan="growth" currentPlan={plan} feature="AI Sentiment Tracker">
          <EmptyState />
        </PlanGate>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sprint E: First-visit tooltip */}
      <FirstVisitTooltip
        pageKey="ai-sentiment"
        title="What is AI Sentiment?"
        content="Beyond whether AI mentions you, this page tracks how AI describes you. Positive sentiment ('popular,' 'highly rated') boosts conversion. Negative or neutral sentiment can be corrected by updating your citation sources and business description."
      />

      <div>
        <h1 className="text-xl font-semibold text-white">AI Sentiment Analysis</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          How AI engines describe your business — tone, descriptors, and recommendation strength.
        </p>
      </div>

      {/* ── Plan-gated content (blur teaser for Starter/Trial) ─────── */}
      <PlanGate requiredPlan="growth" currentPlan={plan} feature="AI Sentiment Tracker">
        {/* Sprint I: Interpretation panel — before charts */}
        <SentimentInterpretationPanel summary={summary} />

        {/* Overall Sentiment */}
        <SentimentScoreCard
          score={summary.averageScore}
          label={summary.dominantLabel}
          tone={summary.dominantTone}
          evaluationCount={summary.evaluationCount}
        />

        {/* Descriptors */}
        <div className="mt-6">
          <DescriptorDisplay
            positive={summary.topPositive}
            negative={summary.topNegative}
          />
        </div>

        {/* Per-Engine Breakdown */}
        <div className="mt-6">
          <EngineBreakdownCard byEngine={summary.byEngine} />
        </div>

        {/* Sentiment Trend */}
        {trend.length >= 2 && (
          <div className="mt-6">
            <SentimentTrendSummary trend={trend} />
          </div>
        )}
      </PlanGate>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function SentimentScoreCard({
  score,
  label,
  tone,
  evaluationCount,
}: {
  score: number;
  label: SentimentExtraction['label'];
  tone: SentimentExtraction['tone'];
  evaluationCount: number;
}) {
  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-6" data-testid="sentiment-score-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Overall Sentiment</p>
      <div className="mt-3 flex items-baseline gap-3">
        <span className={`text-3xl font-bold font-mono ${sentimentColor(score)}`}>
          {score >= 0 ? '+' : ''}{score.toFixed(2)}
        </span>
        <span className={`text-sm font-medium ${sentimentColor(score)}`}>
          {formatLabel(label)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
        <span>Tone: {formatTone(tone)}</span>
        <span>Based on {evaluationCount} evaluations (30 days)</span>
      </div>
    </div>
  );
}

function DescriptorDisplay({
  positive,
  negative,
}: {
  positive: string[];
  negative: string[];
}) {
  if (positive.length === 0 && negative.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-6" data-testid="descriptor-display">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">What AI Says About You</p>

      {positive.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {positive.map(d => (
              <span
                key={d}
                className="inline-flex items-center rounded-md bg-signal-green/10 px-2.5 py-1 text-xs font-semibold text-signal-green ring-1 ring-inset ring-signal-green/20"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {negative.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {negative.map(d => (
              <span
                key={d}
                className="inline-flex items-center rounded-md bg-alert-crimson/10 px-2.5 py-1 text-xs font-semibold text-alert-crimson ring-1 ring-inset ring-alert-crimson/20"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EngineBreakdownCard({
  byEngine,
}: {
  byEngine: Record<string, {
    averageScore: number;
    label: SentimentExtraction['label'];
    tone: SentimentExtraction['tone'];
    descriptors: { positive: string[]; negative: string[] };
  }>;
}) {
  const engines = Object.entries(byEngine);
  if (engines.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-6" data-testid="engine-breakdown">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Per-Engine Breakdown</p>
      <div className="mt-4 space-y-3">
        {engines
          .sort(([, a], [, b]) => b.averageScore - a.averageScore)
          .map(([engine, data]) => {
            const config = ENGINE_LABELS[engine] ?? { label: engine, color: 'bg-slate-500' };
            // Map score from [-1, 1] to [0, 100] for bar width
            const barWidth = Math.round(((data.averageScore + 1) / 2) * 100);

            return (
              <div key={engine} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-24 shrink-0">
                  <div className={`h-2 w-2 rounded-full ${config.color}`} />
                  <span className="text-sm text-slate-300">{config.label}</span>
                </div>
                <span className="text-sm font-mono text-white w-12 text-right shrink-0">
                  {data.averageScore >= 0 ? '+' : ''}{data.averageScore.toFixed(2)}
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${sentimentBg(data.averageScore)}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className={`text-xs w-20 text-right ${sentimentColor(data.averageScore)}`}>
                  {formatLabel(data.label)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function SentimentTrendSummary({
  trend,
}: {
  trend: Array<{ weekStart: string; averageScore: number; evaluationCount: number }>;
}) {
  const latest = trend[trend.length - 1];
  const earliest = trend[0];
  const delta = latest.averageScore - earliest.averageScore;
  const direction = delta > 0 ? 'improved' : delta < 0 ? 'declined' : 'remained stable';

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-6" data-testid="sentiment-trend">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Sentiment Trend</p>
      <p className="mt-3 text-sm text-slate-300">
        Sentiment has{' '}
        <span className={sentimentColor(delta)}>
          {direction} {delta !== 0 ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}` : ''}
        </span>
        {' '}over the past {trend.length} weeks ({earliest.weekStart} to {latest.weekStart}).
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center border border-white/5">
      <p className="text-sm font-medium text-[#94A3B8]">No sentiment data yet</p>
      <p className="mt-1 text-xs text-slate-400">
        Sentiment analysis runs automatically with your weekly SOV queries.
        Once you have SOV results, you&apos;ll see how each AI engine describes your business.
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
