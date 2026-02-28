// ---------------------------------------------------------------------------
// EntityHealthVerdictPanel — Sprint J
//
// Plain-English verdict panel for Entity Health page.
// Answers: "Does AI know your business correctly?"
//
// AI_RULES §101: No jargon — "entity", "knowledge graph", etc.
// ---------------------------------------------------------------------------

import type { EntityHealthResult } from '@/lib/services/entity-health.service';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface EntityHealthVerdictPanelProps {
  result: EntityHealthResult;
}

export function EntityHealthVerdictPanel({ result }: EntityHealthVerdictPanelProps) {
  const { score, rating, confirmedCount, totalPlatforms } = result;

  if (rating === 'unknown') {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark px-5 py-5"
        data-testid="entity-health-verdict-panel"
      >
        <p className="text-sm text-slate-400">
          We haven&apos;t checked your business listings yet. Complete the checklist
          below to see how accurately AI models know your business.
        </p>
      </div>
    );
  }

  const missingCount = totalPlatforms - confirmedCount;

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark px-5 py-5 space-y-3"
      data-testid="entity-health-verdict-panel"
    >
      {/* Score + label */}
      <div className="flex items-baseline gap-3">
        <span
          className={`text-3xl font-bold tabular-nums ${
            rating === 'strong'
              ? 'text-green-400'
              : rating === 'at_risk'
                ? 'text-amber-400'
                : 'text-red-400'
          }`}
          data-testid="entity-health-overall-score"
        >
          {confirmedCount}/{totalPlatforms}
        </span>
        <span className="text-sm text-slate-400">platforms confirmed</span>
        <InfoTooltip
          content="How many major AI data sources have verified information about your business. More confirmed platforms = more accurate AI answers for your customers."
        />
      </div>

      {/* Verdict sentence */}
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          rating === 'strong'
            ? 'border-green-400/20 bg-green-400/5 text-green-300'
            : rating === 'at_risk'
              ? 'border-amber-400/20 bg-amber-400/5 text-amber-300'
              : 'border-red-400/20 bg-red-400/5 text-red-300'
        }`}
        data-testid="entity-health-verdict-text"
      >
        {rating === 'strong' && (
          <>
            AI models have verified information about your business from{' '}
            {confirmedCount} major sources.
            {confirmedCount === totalPlatforms
              ? ' All core platforms are confirmed — customers get consistent, accurate answers no matter which AI they ask.'
              : ` ${missingCount} platform${missingCount !== 1 ? 's' : ''} still need${missingCount === 1 ? 's' : ''} attention, but you're in great shape.`}
          </>
        )}
        {rating === 'at_risk' && (
          <>
            AI models can find verified information about your business from{' '}
            {confirmedCount} sources, but{' '}
            <span className="font-semibold">
              {missingCount} platform{missingCount !== 1 ? 's are' : ' is'} missing or unclaimed
            </span>
            . Customers asking those AI models about your business may get guesses instead
            of facts.
          </>
        )}
        {rating === 'critical' && (
          <>
            Most AI models don&apos;t have verified information about your business.
            Only {confirmedCount} of {totalPlatforms} platforms{' '}
            {confirmedCount === 1 ? 'is' : 'are'} confirmed.{' '}
            <span className="font-semibold">
              Customers asking AI about your business are likely getting incorrect or
              incomplete answers.
            </span>{' '}
            Claim the platforms below to fix this.
          </>
        )}
      </div>

      {/* Pass/fail summary */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="text-green-400 font-medium">
          {confirmedCount} confirmed
        </span>
        {missingCount > 0 && (
          <span className="text-red-400 font-medium">
            {missingCount} need{missingCount !== 1 ? '' : 's'} action
          </span>
        )}
        <span className="text-slate-600">Score: {score}%</span>
      </div>
    </div>
  );
}
