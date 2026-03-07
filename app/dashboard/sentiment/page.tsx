import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchSentimentSummary, fetchSentimentTrend, fetchErrorDetectionDates, annotateTrendWithErrors } from '@/lib/data/sentiment';
import SentimentTrendChart from './_components/SentimentTrendChart';
import { PlanGate } from '@/components/plan-gate/PlanGate';
import type { SentimentExtraction } from '@/lib/ai/schemas';
import { SentimentInterpretationPanel } from './_components/SentimentInterpretationPanel';
import CustomerLoveHero from './_components/CustomerLoveHero';

export const metadata = { title: 'How AI Feels About You | LocalVector.ai' };

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
          <h1 className="text-xl font-semibold text-white">How AI Describes You</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">How AI engines describe your business</p>
        </div>
        <PlanGate requiredPlan="growth" currentPlan={plan} feature="AI Sentiment Tracker">
          <EmptyState />
        </PlanGate>
      </div>
    );
  }

  const [summary, trend, errorDates] = await Promise.all([
    fetchSentimentSummary(supabase, ctx.orgId, locationId),
    fetchSentimentTrend(supabase, ctx.orgId, locationId),
    fetchErrorDetectionDates(supabase, ctx.orgId, locationId),
  ]);
  const annotatedTrend = annotateTrendWithErrors(trend, errorDates);

  if (summary.evaluationCount === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-white">How AI Describes You</h1>
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
      <div>
        <h1 className="text-xl font-semibold text-white">How AI Describes You</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          How AI apps talk about your restaurant — and how to make it warmer.
        </p>
      </div>

      {/* ── Plan-gated content (blur teaser for Starter/Trial) ─────── */}
      <PlanGate requiredPlan="growth" currentPlan={plan} feature="AI Sentiment Tracker">
        {/* S2: Reputation hero — warmth meter with coaching */}
        <CustomerLoveHero summary={summary} trend={trend} />

        {/* Per-model breakdown + actionable callouts */}
        <SentimentInterpretationPanel summary={summary} />

        {/* Descriptors — all positive and negative words */}
        <DescriptorDisplay
          positive={summary.topPositive}
          negative={summary.topNegative}
        />

        {/* Per-Engine Breakdown */}
        <EngineBreakdownCard byEngine={summary.byEngine} />

        {/* Sentiment Trend Chart (S21) */}
        {trend.length >= 2 && (
          <>
            <SentimentTrendChart data={annotatedTrend} />
            <SentimentTrendSummary trend={trend} />
          </>
        )}
      </PlanGate>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

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
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">What AI Says About You</p>

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
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">Per-Engine Breakdown</p>
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
  const latest   = trend[trend.length - 1];
  const earliest = trend[0];

  // Guard: older seed rows may have null/undefined scores → NaN
  const latestScore   = latest?.averageScore   ?? null;
  const earliestScore = earliest?.averageScore ?? null;
  const delta = (latestScore !== null && earliestScore !== null)
    ? latestScore - earliestScore
    : null;

  // Determine current vibe from the latest score
  const currentScore = latestScore ?? 0;
  const currentlyPositive = currentScore > 0.3;
  const currentlyNegative = currentScore < -0.3;

  // Plain-English verdict — coherent with current state, no raw numbers
  const { headline, detail, colorClass } =
    delta === null
      ? { headline: 'Checking your trend…',        detail: 'Not enough data yet to show a weekly direction.',                                                                                                                                          colorClass: 'text-slate-400'      }
      : delta > 0.05
        ? { headline: 'AI is warming up to you',   detail: 'AI apps have started describing your restaurant more positively over the past few weeks. Keep it up.',                                                                                       colorClass: 'text-signal-green'   }
        : delta < -0.05
          ? { headline: 'AI tone is slipping',     detail: 'AI apps have started describing you less favourably recently. Check your AI Mistakes page — fixing wrong facts usually turns this around quickly.',                                           colorClass: 'text-alert-crimson'  }
          : currentlyNegative
            ? { headline: 'Consistently negative', detail: 'AI apps have described you unfavourably for the past few weeks and it hasn\'t improved yet. Fixing wrong hours or facts on your AI Mistakes page is the fastest way to change this.',       colorClass: 'text-alert-crimson'  }
            : currentlyPositive
              ? { headline: 'Consistently positive', detail: 'AI apps have spoken warmly about your restaurant for the past few weeks. Your reputation is solid.',                                                                                       colorClass: 'text-signal-green'   }
              : { headline: 'Holding in the middle', detail: 'AI apps have been neutral about your restaurant for the past few weeks. A few positive updates to your menu or hours description can push this into "Loved" territory.',                   colorClass: 'text-alert-amber'    };

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 p-5" data-testid="sentiment-trend">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3"
         style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>
        Week-over-week trend
      </p>
      <p className={`text-sm font-semibold ${colorClass}`}>{headline}</p>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed">{detail}</p>
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
        Go to AI Mentions →
      </a>
    </div>
  );
}
