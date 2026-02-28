/**
 * WrongFactsPanel — "how many things are wrong right now?"
 *
 * Shows:
 * - Count of open hallucination alerts
 * - Color: red when > 0, green when 0
 * - Plain language: "wrong facts" not "open alerts"
 *
 * Sprint G — Human-Readable Dashboard.
 */

import Link from 'next/link';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface WrongFactsPanelProps {
  alertCount: number;
  previousCount: number | null;
}

export default function WrongFactsPanel({
  alertCount,
  previousCount,
}: WrongFactsPanelProps) {
  const hasIssues = alertCount > 0;
  const delta =
    previousCount !== null ? alertCount - previousCount : null;

  return (
    <Link
      href="/dashboard/hallucinations"
      className="block rounded-xl border border-white/5 bg-surface-dark p-5 transition-colors hover:border-white/10"
      data-testid="wrong-facts-panel"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Wrong Facts
        </h3>
        <InfoTooltip content="A 'wrong fact' is when an AI model states something incorrect about your business — wrong hours, wrong address, wrong prices. Each one costs you customers." />
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`text-3xl font-bold font-mono tabular-nums ${hasIssues ? 'text-alert-crimson' : 'text-truth-emerald'}`}
          data-testid="wrong-facts-count"
        >
          {alertCount}
        </span>
        {delta !== null && delta !== 0 && (
          <span
            className={`text-sm font-medium ${delta > 0 ? 'text-alert-crimson' : 'text-truth-emerald'}`}
            data-testid="wrong-facts-delta"
          >
            {delta > 0 ? `+${delta}` : delta} this week
          </span>
        )}
      </div>

      {hasIssues ? (
        <p className="mt-1 text-xs text-slate-500">
          in AI responses across ChatGPT, Perplexity, and Gemini
        </p>
      ) : (
        <p
          className="mt-1 text-xs text-truth-emerald"
          data-testid="wrong-facts-clear"
        >
          No wrong facts detected
        </p>
      )}
    </Link>
  );
}
