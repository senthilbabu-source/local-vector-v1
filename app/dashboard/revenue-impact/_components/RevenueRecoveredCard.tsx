// ---------------------------------------------------------------------------
// RevenueRecoveredCard — S15 (Wave 1, AI_RULES §215)
//
// Displays the running total of monthly revenue recovered by fixing
// AI hallucinations. Rendered on the Lost Sales page above the detail table.
//
// Revenue is snapshotted at fix time via getRevenueImpactBySeverity() in
// correction-service.ts — this counter never drifts after a fix is marked.
// ---------------------------------------------------------------------------

import { TrendingUp } from 'lucide-react';

interface RevenueRecoveredCardProps {
  recoveredMonthly: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RevenueRecoveredCard({ recoveredMonthly }: RevenueRecoveredCardProps) {
  if (recoveredMonthly <= 0) return null;

  return (
    <div
      className="rounded-xl border border-signal-green/25 bg-signal-green/5 px-5 py-4"
      data-testid="revenue-recovered-card"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-signal-green/15">
            <TrendingUp className="h-4 w-4 text-signal-green" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold text-signal-green uppercase tracking-wide">
              Revenue Recovered
            </p>
            <p className="text-[11px] text-muted-foreground">
              From AI corrections you&apos;ve submitted
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className="text-xl font-bold text-signal-green tabular-nums"
            data-testid="revenue-recovered-amount"
          >
            {formatCurrency(recoveredMonthly)}
          </p>
          <p className="text-[10px] text-muted-foreground">/month</p>
        </div>
      </div>
    </div>
  );
}
