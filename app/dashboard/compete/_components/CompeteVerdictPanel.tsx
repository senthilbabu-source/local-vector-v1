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
            AI picks you {winCount} time{winCount !== 1 ? 's' : ''}
          </span>
        )}
        {winCount > 0 && lossCount > 0 && (
          <span className="text-muted-foreground"> · </span>
        )}
        {lossCount > 0 && (
          <span className="font-semibold text-alert-amber">
            AI picks competitors {lossCount} time{lossCount !== 1 ? 's' : ''}
          </span>
        )}
        {lossCount > 0 && (
          <span className="ml-2 text-muted-foreground text-xs">
            — fix AI mistakes and get listed on more platforms to close the gap
          </span>
        )}
        {winCount === totalIntercepts && totalIntercepts > 0 && (
          <span className="ml-2 text-signal-green">
            — AI prefers you every time
          </span>
        )}
      </p>
    </div>
  );
}
