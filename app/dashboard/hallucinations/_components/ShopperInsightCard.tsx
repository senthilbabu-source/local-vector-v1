'use client';

import { useState } from 'react';
import { ShoppingCart, ChevronDown, ChevronUp, Check, X as XIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// S25: Shopper Insight Card — failure turn timeline
// ---------------------------------------------------------------------------

interface TurnData {
  turn: number;
  passed: boolean;
  accuracy_issues: string[];
}

interface ShopperInsightCardProps {
  overallPass: boolean;
  failureTurn: number | null;
  failureReason: string | null;
  turns: TurnData[];
  scenarioLabel: string;
}

export default function ShopperInsightCard({
  overallPass,
  failureTurn,
  failureReason,
  turns,
  scenarioLabel,
}: ShopperInsightCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (overallPass) return null;

  return (
    <div
      className="rounded-xl border border-alert-crimson/20 bg-alert-crimson/5 p-4 space-y-3"
      data-testid="shopper-insight-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShoppingCart className="h-5 w-5 text-alert-crimson shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-alert-crimson">
              AI loses your customer at turn {failureTurn}
            </p>
            <p className="mt-0.5 text-sm text-slate-400">
              Scenario: {scenarioLabel} — {failureReason}
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition"
          aria-label={expanded ? 'Collapse conversation' : 'Expand conversation'}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 pl-8">
          {turns.map((turn) => (
            <div key={turn.turn} className="flex items-start gap-2">
              {turn.passed ? (
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-signal-green/20">
                  <Check className="h-3 w-3 text-signal-green" />
                </span>
              ) : (
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-alert-crimson/20">
                  <XIcon className="h-3 w-3 text-alert-crimson" />
                </span>
              )}
              <div>
                <span className="text-xs font-medium text-slate-300">Turn {turn.turn}</span>
                {!turn.passed && turn.accuracy_issues.length > 0 && (
                  <p className="text-xs text-alert-crimson/80">{turn.accuracy_issues[0]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
