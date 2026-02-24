'use client';

import { useTransition } from 'react';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { markInterceptActionComplete } from '@/app/dashboard/compete/actions';
import type { GapAnalysis } from '@/lib/types/ground-truth';

interface Intercept {
  id:               string;
  competitor_name:  string;
  query_asked:      string | null;
  winner:           string | null;
  winner_reason:    string | null;
  winning_factor:   string | null;
  gap_analysis:     GapAnalysis | null;
  gap_magnitude:    string | null;
  suggested_action: string | null;
  action_status:    string;
}

interface InterceptCardProps {
  intercept:    Intercept;
  myBusiness:   string;
}

const GAP_COLORS: Record<string, string> = {
  high:   'text-red-400 bg-red-950/30 border-red-500/30',
  medium: 'text-yellow-400 bg-yellow-950/30 border-yellow-500/30',
  low:    'text-signal-green bg-emerald-950/30 border-emerald-500/30',
};

export default function InterceptCard({ intercept, myBusiness }: InterceptCardProps) {
  const [isPending, startTransition] = useTransition();

  const myBizWon    = intercept.winner === myBusiness;
  const isDone      = intercept.action_status === 'completed' || intercept.action_status === 'dismissed';
  const gapColor    = GAP_COLORS[intercept.gap_magnitude ?? 'medium'] ?? GAP_COLORS.medium;

  function handleMark(status: 'completed' | 'dismissed') {
    startTransition(async () => {
      await markInterceptActionComplete(intercept.id, status);
    });
  }

  return (
    <div
      data-testid="intercept-card"
      className={[
        'rounded-xl border bg-surface-dark p-5 space-y-4',
        isDone ? 'border-white/5 opacity-60' : 'border-white/10',
      ].join(' ')}
    >
      {/* Query + winner */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 mb-1">Query asked</p>
          <p className="text-sm font-medium text-white">
            &ldquo;{intercept.query_asked ?? 'Unknown query'}&rdquo;
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {myBizWon ? (
            <CheckCircle2 className="h-4 w-4 text-signal-green" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400" />
          )}
          <span className={['text-sm font-semibold', myBizWon ? 'text-signal-green' : 'text-red-400'].join(' ')}>
            {intercept.winner ?? intercept.competitor_name} wins
          </span>
        </div>
      </div>

      {/* Why they won */}
      {intercept.winner_reason && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Why they won</p>
          <p className="text-sm text-slate-300">{intercept.winner_reason}</p>
        </div>
      )}

      {/* Winning factor + gap */}
      {intercept.winning_factor && (
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1">Winning factor</p>
            <p className="text-sm text-slate-300">{intercept.winning_factor}</p>
          </div>
          {intercept.gap_magnitude && (
            <span className={['text-xs font-semibold px-2 py-0.5 rounded-full border', gapColor].join(' ')}>
              {intercept.gap_magnitude.toUpperCase()} gap
            </span>
          )}
        </div>
      )}

      {/* Gap bar */}
      {intercept.gap_analysis && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{myBusiness}: {intercept.gap_analysis.your_mentions} mentions</span>
            <span>{intercept.competitor_name}: {intercept.gap_analysis.competitor_mentions} mentions</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-signal-green"
              style={{
                width: `${Math.min(
                  100,
                  (intercept.gap_analysis.your_mentions /
                    Math.max(intercept.gap_analysis.competitor_mentions, 1)) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Suggested action */}
      {intercept.suggested_action && (
        <div className="rounded-lg border border-signal-green/20 bg-signal-green/5 px-4 py-3">
          <p className="text-xs font-semibold text-signal-green mb-1">Your action this week</p>
          <p className="text-sm text-slate-300">{intercept.suggested_action}</p>
        </div>
      )}

      {/* Action buttons */}
      {!isDone ? (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => handleMark('completed')}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-signal-green/10 border border-signal-green/30 px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/20 disabled:opacity-50 transition"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isPending ? '…' : 'Mark Complete'}
          </button>
          <button
            onClick={() => handleMark('dismissed')}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-white/20 disabled:opacity-50 transition"
          >
            <MinusCircle className="h-3.5 w-3.5" />
            Dismiss
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {intercept.action_status === 'completed' ? 'Completed' : 'Dismissed'}
        </div>
      )}
    </div>
  );
}
