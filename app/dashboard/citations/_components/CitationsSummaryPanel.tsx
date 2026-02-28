// ---------------------------------------------------------------------------
// CitationsSummaryPanel — Sprint H: Verdict-first summary for Citation Health.
//
// Shows how many platforms the business covers vs. gaps, with a plain-English
// verdict about citation health.
// ---------------------------------------------------------------------------

import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface CitationsSummaryPanelProps {
  totalPlatforms: number;
  coveredCount: number;
  gapCount: number;
  gapScore: number;
}

export default function CitationsSummaryPanel({
  totalPlatforms,
  coveredCount,
  gapCount,
  gapScore,
}: CitationsSummaryPanelProps) {
  return (
    <div
      className="rounded-2xl border border-white/5 bg-surface-dark p-5"
      data-testid="citations-summary-panel"
    >
      {/* Total + tooltip */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {totalPlatforms}
        </span>
        <span className="text-sm text-muted-foreground">platforms AI cites</span>
        <InfoTooltip content="Citation sources are websites that AI models reference when answering questions about your business category. Being listed on more cited platforms increases your AI visibility." />
      </div>

      {/* Coverage grid */}
      <div className="grid grid-cols-3 gap-3 text-center mb-4">
        <div
          className="rounded-md bg-signal-green/10 px-3 py-2"
          data-testid="citations-count-covered"
        >
          <p className="text-lg font-bold text-signal-green">{coveredCount}</p>
          <p className="text-[10px] text-signal-green/80">Listed</p>
        </div>
        <div
          className={cn(
            'rounded-md px-3 py-2',
            gapCount > 0 ? 'bg-alert-crimson/10' : 'bg-white/5',
          )}
          data-testid="citations-count-gaps"
        >
          <p
            className={cn(
              'text-lg font-bold',
              gapCount > 0 ? 'text-alert-crimson' : 'text-muted-foreground',
            )}
          >
            {gapCount}
          </p>
          <p
            className={cn(
              'text-[10px]',
              gapCount > 0 ? 'text-alert-crimson/80' : 'text-muted-foreground',
            )}
          >
            Not Listed
          </p>
        </div>
        <div className="rounded-md bg-electric-indigo/10 px-3 py-2" data-testid="citations-gap-score">
          <p className="text-lg font-bold text-electric-indigo">{gapScore}</p>
          <p className="text-[10px] text-electric-indigo/80">Gap Score</p>
        </div>
      </div>

      {/* Plain-English verdict */}
      {gapCount === 0 ? (
        <p className="text-sm font-medium text-signal-green" data-testid="citations-verdict-healthy">
          You&apos;re listed on every platform AI frequently cites — your citation coverage is strong.
        </p>
      ) : (
        <p className="text-sm text-foreground" data-testid="citations-verdict-gaps">
          <span className="font-semibold text-alert-crimson">
            {gapCount} platform{gapCount !== 1 ? 's' : ''} where you&apos;re not listed
          </span>{' '}
          <span className="text-muted-foreground">
            — add listings on these platforms to improve how AI models discover your business.
          </span>
        </p>
      )}
    </div>
  );
}
