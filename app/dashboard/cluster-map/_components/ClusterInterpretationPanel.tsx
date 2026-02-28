// ---------------------------------------------------------------------------
// ClusterInterpretationPanel — Sprint J
//
// Plain-English interpretation of the cluster map scatter plot.
// Answers: "Where does AI place you in local search?"
//
// AI_RULES §103: Cluster Map jargon ban — these terms NEVER appear in UI:
// "semantic", "embedding", "cluster centrality", "vector distance",
// "cosine similarity", "latent space", "NLP cluster", "topic model",
// "brand authority" (→ "how often AI mentions you"),
// "fact accuracy" (→ "how accurate AI's information is").
// ---------------------------------------------------------------------------

import type { ClusterMapResult, ClusterMapPoint } from '@/lib/services/cluster-map.service';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface ClusterInterpretationPanelProps {
  data: ClusterMapResult;
}

export function ClusterInterpretationPanel({ data }: ClusterInterpretationPanelProps) {
  const { selfPoint, stats } = data;

  if (!selfPoint) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark px-5 py-5"
        data-testid="cluster-interpretation-panel"
      >
        <p className="text-sm text-slate-400">
          No data about your business position yet. Run an AI scan to see where AI places you.
        </p>
      </div>
    );
  }

  // Determine position interpretation
  const mentionRate = selfPoint.brandAuthority; // 0-100
  const accuracy = selfPoint.factAccuracy; // 0-100
  const sovPct = Math.round(selfPoint.sov * 100);

  // Find top competitor (highest brand authority)
  const competitors = data.points
    .filter((p) => p.type === 'competitor')
    .sort((a, b) => b.brandAuthority - a.brandAuthority);
  const topCompetitor = competitors[0] ?? null;

  // Position tier
  const mentionTier =
    mentionRate >= 70
      ? 'high'
      : mentionRate >= 40
        ? 'mid'
        : 'low';

  const accuracyTier =
    accuracy >= 70
      ? 'high'
      : accuracy >= 40
        ? 'mid'
        : 'low';

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark px-5 py-5 space-y-4"
      data-testid="cluster-interpretation-panel"
    >
      {/* Where AI places you */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-semibold text-white">
            Your Position in AI Search
          </h2>
          <InfoTooltip
            content="This shows how often AI models mention your business and how accurate their information is. The chart below plots you against competitors in your market."
          />
        </div>

        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            mentionTier === 'high' && accuracyTier === 'high'
              ? 'border-green-400/20 bg-green-400/5 text-green-300'
              : mentionTier === 'low' || accuracyTier === 'low'
                ? 'border-red-400/20 bg-red-400/5 text-red-300'
                : 'border-amber-400/20 bg-amber-400/5 text-amber-300'
          }`}
          data-testid="cluster-interpretation-verdict"
        >
          {/* Main position sentence */}
          <PositionSentence
            mentionRate={mentionRate}
            accuracy={accuracy}
            sovPct={sovPct}
            hallucinationCount={stats.hallucinationCount}
          />
        </div>
      </div>

      {/* Key stats in plain English */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatExplainer
          label="AI mentions you"
          value={`${mentionRate}%`}
          explanation={
            mentionRate >= 70
              ? 'of the time when customers ask relevant questions'
              : mentionRate >= 40
                ? 'of the time — room to improve'
                : 'of the time — most customers don\'t see you'
          }
          color={mentionTier === 'high' ? 'green' : mentionTier === 'mid' ? 'amber' : 'red'}
          testId="cluster-stat-mentions"
        />
        <StatExplainer
          label="Information accuracy"
          value={`${accuracy}%`}
          explanation={
            accuracy >= 70
              ? 'AI mostly gives correct information about you'
              : accuracy >= 40
                ? 'Some AI information about you is wrong'
                : 'AI frequently gives wrong information about you'
          }
          color={accuracyTier === 'high' ? 'green' : accuracyTier === 'mid' ? 'amber' : 'red'}
          testId="cluster-stat-accuracy"
        />
        <StatExplainer
          label="Competitors visible"
          value={String(stats.totalCompetitors)}
          explanation={
            stats.totalCompetitors === 0
              ? 'No competitors found in AI results'
              : `business${stats.totalCompetitors !== 1 ? 'es' : ''} AI also recommends`
          }
          color="slate"
          testId="cluster-stat-competitors"
        />
      </div>

      {/* Top competitor callout */}
      {topCompetitor && (
        <div
          className="rounded-lg border border-electric-indigo/20 bg-electric-indigo/5 px-4 py-3"
          data-testid="cluster-top-competitor"
        >
          <p className="text-xs text-slate-400">Your top competitor in AI search:</p>
          <p className="text-sm font-semibold text-electric-indigo mt-0.5">
            {topCompetitor.name}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Mentioned in {topCompetitor.brandAuthority}% of AI queries
            {topCompetitor.brandAuthority > mentionRate
              ? ` — ${topCompetitor.brandAuthority - mentionRate}% more often than you`
              : mentionRate > topCompetitor.brandAuthority
                ? ` — you're mentioned ${mentionRate - topCompetitor.brandAuthority}% more often`
                : ' — same visibility as you'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Position Sentence ────────────────────────────────────────────────────

function PositionSentence({
  mentionRate,
  accuracy,
  sovPct,
  hallucinationCount,
}: {
  mentionRate: number;
  accuracy: number;
  sovPct: number;
  hallucinationCount: number;
}) {
  // High mention + high accuracy = great position
  if (mentionRate >= 70 && accuracy >= 70) {
    return (
      <>
        AI models mention your business frequently and the information they share is mostly accurate.
        {hallucinationCount > 0 && (
          <>
            {' '}However, there {hallucinationCount === 1 ? 'is' : 'are'}{' '}
            <span className="font-semibold">{hallucinationCount} incorrect fact{hallucinationCount !== 1 ? 's' : ''}</span>{' '}
            that AI is still getting wrong — fix those to protect your strong position.
          </>
        )}
      </>
    );
  }

  // High mention + low accuracy = visible but inaccurate (dangerous)
  if (mentionRate >= 50 && accuracy < 50) {
    return (
      <>
        AI models mention your business often, but{' '}
        <span className="font-semibold">much of what they say is wrong</span>.
        This is the most dangerous position — customers are hearing about you, but getting
        incorrect information.{' '}
        {hallucinationCount > 0 && (
          <>Fix the {hallucinationCount} hallucination{hallucinationCount !== 1 ? 's' : ''} immediately.</>
        )}
      </>
    );
  }

  // Low mention + high accuracy = invisible but accurate
  if (mentionRate < 40 && accuracy >= 70) {
    return (
      <>
        When AI does mention your business, the information is accurate — but{' '}
        <span className="font-semibold">
          AI only mentions you in {mentionRate}% of relevant queries
        </span>.
        Most customers asking AI about businesses like yours don&apos;t see you at all.
        Improve your citations and listings to increase visibility.
      </>
    );
  }

  // Low mention + low accuracy = worst case
  if (mentionRate < 40 && accuracy < 50) {
    return (
      <>
        AI models rarely mention your business, and when they do, the information is often wrong.
        This means customers almost never find you through AI — and those who do may get incorrect
        information. Start by fixing hallucinations, then work on increasing your visibility.
      </>
    );
  }

  // Middle ground
  return (
    <>
      AI models mention your business in about {mentionRate}% of relevant customer queries,
      with {accuracy}% accuracy.
      {hallucinationCount > 0 && (
        <>
          {' '}There {hallucinationCount === 1 ? 'is' : 'are'}{' '}
          <span className="font-semibold">
            {hallucinationCount} incorrect fact{hallucinationCount !== 1 ? 's' : ''}
          </span>{' '}
          being shared with customers — fixing those will improve both your accuracy and visibility.
        </>
      )}
    </>
  );
}

// ── Stat Explainer ───────────────────────────────────────────────────────

function StatExplainer({
  label,
  value,
  explanation,
  color,
  testId,
}: {
  label: string;
  value: string;
  explanation: string;
  color: 'green' | 'amber' | 'red' | 'slate';
  testId: string;
}) {
  const valueColor =
    color === 'green'
      ? 'text-green-400'
      : color === 'amber'
        ? 'text-amber-400'
        : color === 'red'
          ? 'text-red-400'
          : 'text-white';

  return (
    <div
      className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5"
      data-testid={testId}
    >
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{explanation}</p>
    </div>
  );
}
