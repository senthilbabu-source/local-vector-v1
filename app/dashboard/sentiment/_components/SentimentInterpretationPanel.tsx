import Link from 'next/link';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { SentimentSummary } from '@/lib/services/sentiment.service';

// ---------------------------------------------------------------------------
// SentimentInterpretationPanel — Sprint I
//
// Plain-English interpretation of AI sentiment data.
// Written for a business owner, not a data analyst.
//
// Design: worst model called out first (most actionable), best acknowledged.
// Uses SentimentSummary.byEngine which has averageScore per engine (-1 to 1).
//
// Score thresholds:
//   > 0.3  = positive (good)
//   -0.3 to 0.3 = mixed
//   < -0.3 = negative (problem)
// ---------------------------------------------------------------------------

const ENGINE_DISPLAY: Record<string, string> = {
  perplexity: 'Perplexity',
  openai: 'ChatGPT',
  google: 'Google AI',
  copilot: 'Microsoft Copilot',
};

function engineName(key: string): string {
  return ENGINE_DISPLAY[key] ?? key;
}

function scoreColor(score: number): string {
  if (score > 0.3) return 'text-signal-green';
  if (score > -0.3) return 'text-alert-amber';
  return 'text-alert-crimson';
}

function scoreBorderColor(score: number): string {
  if (score > 0.3) return 'border-signal-green/30';
  if (score > -0.3) return 'border-alert-amber/30';
  return 'border-alert-crimson/30';
}

interface SentimentInterpretationPanelProps {
  summary: SentimentSummary;
}

export function SentimentInterpretationPanel({
  summary,
}: SentimentInterpretationPanelProps) {
  if (summary.evaluationCount === 0) return null;

  const engines = Object.entries(summary.byEngine);
  if (engines.length === 0) return null;

  // Sort by score ascending (worst first)
  const sorted = [...engines].sort(
    ([, a], [, b]) => a.averageScore - b.averageScore,
  );
  const worstEngine = sorted[0];
  const bestEngine = sorted[sorted.length - 1];

  const avg = summary.averageScore;
  const isPositive = avg > 0.3;
  const isMixed = avg >= -0.3 && avg <= 0.3;
  const isNegative = avg < -0.3;

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5 space-y-4"
      data-testid="sentiment-interpretation-panel"
    >
      {/* Overall verdict */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-semibold text-white">
            What AI models say about you
          </h2>
          <InfoTooltip
            content={
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-white">AI Sentiment</p>
                <p className="text-xs text-slate-300">
                  How positively or negatively AI models describe your business when customers ask about it.
                </p>
                <p className="text-xs text-slate-400">
                  Fix hallucination alerts involving wrong hours, location, or prices — these are the biggest drivers of negative sentiment.
                </p>
              </div>
            }
          />
        </div>
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            isPositive
              ? 'bg-signal-green/5 border-signal-green/20 text-signal-green'
              : isMixed
                ? 'bg-alert-amber/5 border-alert-amber/20 text-alert-amber'
                : 'bg-alert-crimson/5 border-alert-crimson/20 text-alert-crimson'
          }`}
          data-testid="sentiment-overall-verdict"
        >
          {isPositive && (
            <>
              AI models describe your business{' '}
              <span className="font-semibold">positively</span> overall (score:{' '}
              {avg >= 0 ? '+' : ''}
              {avg.toFixed(2)}).
              {avg >= 0.6 &&
                ' This is excellent — your business information is well-represented across AI platforms.'}
            </>
          )}
          {isMixed && (
            <>
              AI models describe your business with{' '}
              <span className="font-semibold">mixed sentiment</span> (score:{' '}
              {avg >= 0 ? '+' : ''}
              {avg.toFixed(2)}). There&apos;s room to improve how AI platforms
              present your business.
            </>
          )}
          {isNegative && (
            <>
              AI models describe your business{' '}
              <span className="font-semibold">negatively</span> (score:{' '}
              {avg.toFixed(2)}). This is hurting how potential customers perceive
              you before they ever visit.
            </>
          )}
        </div>
      </div>

      {/* Per-engine breakdown */}
      {sorted.length > 0 && (
        <div className="space-y-2" data-testid="sentiment-model-breakdown">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            By AI model
          </p>

          {sorted.map(([engine, data]) => {
            const isProblem = data.averageScore < -0.3;
            const isGood = data.averageScore > 0.3;

            return (
              <div
                key={engine}
                className={`flex items-center justify-between gap-4 rounded-lg border px-3 py-2 ${scoreBorderColor(data.averageScore)}`}
                data-testid={`sentiment-model-row-${engine}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-sm font-medium ${scoreColor(data.averageScore)}`}
                  >
                    {engineName(engine)}
                  </span>
                  {isProblem && (
                    <span className="rounded-full bg-alert-crimson/10 px-2 py-0.5 text-[10px] font-medium text-alert-crimson">
                      Needs attention
                    </span>
                  )}
                  {isGood && (
                    <span className="rounded-full bg-signal-green/10 px-2 py-0.5 text-[10px] font-medium text-signal-green">
                      Positive
                    </span>
                  )}
                </div>
                <span
                  className={`tabular-nums text-sm font-semibold font-mono ${scoreColor(data.averageScore)}`}
                >
                  {data.averageScore >= 0 ? '+' : ''}
                  {data.averageScore.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Worst model call-out — actionable */}
      {worstEngine && worstEngine[1].averageScore < -0.3 && (
        <div
          className="rounded-lg bg-alert-amber/5 border border-alert-amber/20 px-4 py-3 text-sm text-alert-amber"
          data-testid="sentiment-worst-model-callout"
        >
          <span className="font-semibold">{engineName(worstEngine[0])}</span>{' '}
          has the most negative description of your business (score:{' '}
          {worstEngine[1].averageScore.toFixed(2)}). This is usually caused by
          hallucination alerts — wrong hours, wrong location, or wrong prices
          that make the business sound unreliable.{' '}
          <Link
            href="/dashboard/hallucinations"
            className="underline hover:text-alert-amber/80"
            data-testid="sentiment-fix-alerts-link"
          >
            Fix these alerts →
          </Link>
        </div>
      )}

      {/* Best model acknowledgment (positive reinforcement) */}
      {bestEngine &&
        bestEngine[1].averageScore > 0.3 &&
        worstEngine &&
        worstEngine[1].averageScore < 0 && (
          <p className="text-xs text-slate-500">
            {engineName(bestEngine[0])} describes you well (+
            {bestEngine[1].averageScore.toFixed(2)}) — focus on bringing the
            other models up to the same level.
          </p>
        )}
    </div>
  );
}
