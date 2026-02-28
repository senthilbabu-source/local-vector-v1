// ---------------------------------------------------------------------------
// CompeteVerdictPanel — Sprint H: Win/Loss verdict for Competitor Intercept.
//
// Shows an explicit "Ahead of X, behind Y" verdict before individual cards.
// ---------------------------------------------------------------------------

interface CompeteVerdictPanelProps {
  winCount: number;
  lossCount: number;
  totalIntercepts: number;
}

export default function CompeteVerdictPanel({
  winCount,
  lossCount,
  totalIntercepts,
}: CompeteVerdictPanelProps) {
  if (totalIntercepts === 0) {
    return null; // No intercepts — existing empty state handles this
  }

  return (
    <div
      className="rounded-xl border border-white/10 bg-surface-dark p-5"
      data-testid="compete-verdict-panel"
    >
      <p className="text-sm text-foreground">
        {winCount > 0 && (
          <span className="font-semibold text-signal-green">
            Winning {winCount} matchup{winCount !== 1 ? 's' : ''}
          </span>
        )}
        {winCount > 0 && lossCount > 0 && (
          <span className="text-muted-foreground"> · </span>
        )}
        {lossCount > 0 && (
          <span className="font-semibold text-alert-amber">
            Losing {lossCount} matchup{lossCount !== 1 ? 's' : ''}
          </span>
        )}
        {lossCount > 0 && (
          <span className="ml-2 text-muted-foreground text-xs">
            — fix your hallucination alerts and add more citations to close the gap
          </span>
        )}
        {winCount === totalIntercepts && totalIntercepts > 0 && (
          <span className="ml-2 text-signal-green">
            — you&apos;re leading across the board
          </span>
        )}
      </p>
    </div>
  );
}
