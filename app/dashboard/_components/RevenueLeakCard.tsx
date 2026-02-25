'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Lock, Settings } from 'lucide-react';
import type { RevenueLeak, RevenueConfig } from '@/lib/services/revenue-leak.service';
import type { PlanTier } from '@/lib/plan-enforcer';

interface RevenueLeakCardProps {
  leak: RevenueLeak | null;
  previousLeak: { leak_high: number } | null;
  config: RevenueConfig | null;
  plan: PlanTier;
}

function formatDollar(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function RevenueLeakCard({
  leak,
  previousLeak,
  config,
  plan,
}: RevenueLeakCardProps) {
  const isLocked = plan === 'trial' || plan === 'starter';

  // Compute delta from previous week
  const delta =
    leak && previousLeak
      ? Math.round(leak.leak_high - previousLeak.leak_high)
      : null;

  const trendUp = delta !== null && delta > 0;

  return (
    <div
      className="relative rounded-2xl bg-surface-dark border border-white/5 px-6 py-5"
      data-testid="revenue-leak-card"
    >
      {/* Lock overlay for trial/starter */}
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-surface-dark/80 backdrop-blur-sm">
          <Lock className="mb-2 h-6 w-6 text-slate-500" />
          <p className="text-sm font-medium text-slate-400">
            Upgrade to Growth to unlock Revenue Leak Scorecard
          </p>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-widest text-slate-500"
            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          >
            Revenue Leak Scorecard
          </p>
        </div>
        <span className="rounded-full bg-signal-green/10 px-2.5 py-0.5 text-xs font-semibold text-signal-green">
          Growth+
        </span>
      </div>

      {/* Main dollar range */}
      <div className="mt-3">
        <p className="text-sm text-slate-400">AI is costing you</p>
        {leak && !isLocked ? (
          <>
            <p
              className="mt-1 text-3xl font-bold tabular-nums text-alert-crimson"
              style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              data-testid="leak-range"
            >
              {formatDollar(leak.leak_low)} – {formatDollar(leak.leak_high)}
              <span className="ml-1 text-base font-medium text-slate-500">
                /month
              </span>
            </p>

            {/* Trend delta */}
            {delta !== null && delta !== 0 && (
              <p
                className={`mt-1 flex items-center gap-1 text-sm ${
                  trendUp ? 'text-alert-crimson' : 'text-truth-emerald'
                }`}
              >
                {trendUp ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {trendUp ? '+' : ''}
                {formatDollar(delta)} from last week
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-2xl font-bold text-slate-600">—</p>
        )}
      </div>

      {/* Breakdown cards */}
      {leak && !isLocked && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <BreakdownChip
            label="Inaccuracies"
            low={leak.breakdown.hallucination_cost.low}
            high={leak.breakdown.hallucination_cost.high}
          />
          <BreakdownChip
            label="SOV Gap"
            low={leak.breakdown.sov_gap_cost.low}
            high={leak.breakdown.sov_gap_cost.high}
          />
          <BreakdownChip
            label="Competitor Steal"
            low={leak.breakdown.competitor_steal_cost.low}
            high={leak.breakdown.competitor_steal_cost.high}
          />
        </div>
      )}

      {/* Configure link */}
      {!isLocked && (
        <div className="mt-4">
          <Link
            href="/dashboard/settings/revenue"
            className="inline-flex items-center gap-1 text-sm text-electric-indigo hover:underline"
          >
            <Settings className="h-3.5 w-3.5" />
            Configure Revenue Inputs
          </Link>
        </div>
      )}
    </div>
  );
}

function BreakdownChip({
  label,
  low,
  high,
}: {
  label: string;
  low: number;
  high: number;
}) {
  return (
    <div className="rounded-xl bg-midnight-slate px-4 py-3" data-testid="breakdown-chip">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className="mt-1 text-sm font-semibold tabular-nums text-slate-200"
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        {formatDollar(low)}–{formatDollar(high)}
      </p>
    </div>
  );
}
