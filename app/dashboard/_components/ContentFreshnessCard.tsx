import Link from 'next/link';
import { TrendingDown, TrendingUp, ArrowRight, Minus } from 'lucide-react';
import type { FreshnessStatus } from '@/lib/data/freshness-alerts';

interface ContentFreshnessCardProps {
  freshness: FreshnessStatus | null;
}

export default function ContentFreshnessCard({ freshness }: ContentFreshnessCardProps) {
  // No data or insufficient data
  if (!freshness || freshness.trend === 'insufficient_data') {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="h-4 w-4 text-electric-indigo" />
          <h3 className="text-sm font-semibold text-white">Citation Freshness</h3>
        </div>
        <p className="text-xs text-slate-400">
          Citation trend data will appear after your second SOV scan.
        </p>
      </div>
    );
  }

  const ratePct = freshness.currentCitationRate != null
    ? `${Math.round(freshness.currentCitationRate * 100)}%`
    : '—';

  // Declining — show alert
  if (freshness.trend === 'declining') {
    const topAlert = freshness.alerts[0];
    const hasCritical = freshness.alerts.some((a) => a.severity === 'critical');

    return (
      <div className={`rounded-xl border px-4 py-3 ${hasCritical ? 'border-alert-crimson/20 bg-alert-crimson/5' : 'border-alert-amber/20 bg-alert-amber/5'}`}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className={`h-4 w-4 ${hasCritical ? 'text-alert-crimson' : 'text-alert-amber'}`} />
          <h3 className="text-sm font-semibold text-white">Citation Freshness</h3>
        </div>
        <p className="text-sm text-slate-300">
          <span className={`font-mono font-bold ${hasCritical ? 'text-alert-crimson' : 'text-alert-amber'}`}>
            {ratePct}
          </span>
          {' citation rate'}
          {topAlert && (
            <>
              {' · '}
              <span className={hasCritical ? 'text-alert-crimson' : 'text-alert-amber'}>
                {topAlert.dropPercentage}% drop
              </span>
            </>
          )}
        </p>
        <Link
          href="/dashboard/share-of-voice"
          className={`mt-2 inline-flex items-center gap-1 text-xs font-medium transition ${hasCritical ? 'text-alert-crimson hover:text-alert-crimson/80' : 'text-alert-amber hover:text-alert-amber/80'}`}
        >
          View SOV Details <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  // Stable or improving
  const isImproving = freshness.trend === 'improving';
  const TrendIcon = isImproving ? TrendingUp : Minus;

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <TrendIcon className="h-4 w-4 text-truth-emerald" />
        <h3 className="text-sm font-semibold text-white">Citation Freshness</h3>
      </div>
      <p className="text-sm text-slate-300">
        <span className="font-mono font-bold text-truth-emerald">{ratePct}</span>
        {' citation rate · '}
        <span className="inline-flex items-center rounded-md bg-truth-emerald/10 px-2 py-0.5 text-xs font-medium text-truth-emerald">
          {isImproving ? 'Improving' : 'Stable'}
        </span>
      </p>
      <Link
        href="/dashboard/share-of-voice"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
      >
        View SOV Details <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
