import Link from 'next/link';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

// ---------------------------------------------------------------------------
// RevenueEstimatePanel — Sprint I
//
// Shows the computed monthly revenue loss estimate prominently above the form.
// The number is the hook — the form below lets users refine it.
//
// Always labels as "estimate" — never "you are losing exactly..."
// ---------------------------------------------------------------------------

interface RevenueEstimatePanelProps {
  monthlyLoss: number;
  annualLoss: number;
  isDefaultConfig: boolean;
  industryLabel: string | null;
  /** Revenue subtotals by category (from RevenueImpactResult) */
  sovGapRevenue: number;
  hallucinationRevenue: number;
  competitorRevenue: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RevenueEstimatePanel({
  monthlyLoss,
  annualLoss,
  isDefaultConfig,
  industryLabel,
  sovGapRevenue,
  hallucinationRevenue,
  competitorRevenue,
}: RevenueEstimatePanelProps) {
  const hasLoss = monthlyLoss > 0;
  const categoryCount =
    (sovGapRevenue > 0 ? 1 : 0) +
    (hallucinationRevenue > 0 ? 1 : 0) +
    (competitorRevenue > 0 ? 1 : 0);

  // Build a human-readable breakdown summary for the tooltip
  const breakdownParts: string[] = [];
  if (sovGapRevenue > 0)
    breakdownParts.push(`${formatCurrency(sovGapRevenue)} from SOV gaps`);
  if (hallucinationRevenue > 0)
    breakdownParts.push(
      `${formatCurrency(hallucinationRevenue)} from hallucinations`,
    );
  if (competitorRevenue > 0)
    breakdownParts.push(
      `${formatCurrency(competitorRevenue)} from competitor advantage`,
    );

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5 space-y-4"
      data-testid="revenue-estimate-panel"
    >
      {/* Smart-defaults disclosure */}
      {isDefaultConfig && (
        <div className="rounded-lg bg-electric-indigo/10 border border-electric-indigo/20 px-3 py-2">
          <p className="text-xs text-electric-indigo">
            <span className="font-semibold">
              Estimated using typical {industryLabel ?? 'business'} figures.
            </span>{' '}
            Update the numbers below with your actual data for a more accurate
            estimate.
          </p>
        </div>
      )}

      {/* Primary number */}
      {hasLoss ? (
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className="text-3xl font-bold tabular-nums text-alert-crimson font-mono"
              data-testid="revenue-monthly-loss"
            >
              {formatCurrency(monthlyLoss)}
            </span>
            <span className="text-sm text-slate-400">
              estimated monthly revenue at risk
            </span>
            <InfoTooltip
              content={
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">How this is estimated</p>
                  <p className="text-xs text-slate-300">
                    Monthly revenue at risk from customers who received incorrect information about your business from AI models.
                  </p>
                  {breakdownParts.length > 0 && (
                    <p className="text-xs text-slate-400">{breakdownParts.join(', ')}.</p>
                  )}
                  <p className="text-xs text-slate-400">
                    Fix hallucination alerts and improve SOV to reduce this number.
                  </p>
                </div>
              }
            />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatCurrency(annualLoss)}/year if left unaddressed
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-400">
            Revenue impact will be calculated from your SOV evaluations,
            hallucination tracking, and competitor analysis.
          </p>
        </div>
      )}

      {/* Interpretation */}
      {hasLoss && (
        <div className="rounded-lg bg-white/[0.03] px-4 py-3">
          <p className="text-xs text-slate-400">
            {monthlyLoss >= 5000 ? (
              <>
                This is a significant loss driven by{' '}
                {categoryCount} source{categoryCount !== 1 ? 's' : ''} of revenue
                leakage.
                {hallucinationRevenue > 0 && (
                  <>
                    {' '}
                    <span className="font-semibold text-alert-crimson">
                      Hallucinations
                    </span>{' '}
                    account for {formatCurrency(hallucinationRevenue)}/mo — AI
                    models are showing wrong information about your business.
                  </>
                )}
                {sovGapRevenue > 0 && (
                  <>
                    {' '}
                    <span className="font-semibold text-electric-indigo">
                      SOV gaps
                    </span>{' '}
                    account for {formatCurrency(sovGapRevenue)}/mo — you&apos;re
                    invisible for searches where customers are looking for
                    businesses like yours.
                  </>
                )}
              </>
            ) : monthlyLoss >= 1000 ? (
              <>
                There&apos;s room to recover revenue by fixing AI visibility gaps.
                {hallucinationRevenue > 0 &&
                  ` Hallucinations are your biggest opportunity — fixing them could recover ${formatCurrency(hallucinationRevenue)}/mo.`}
              </>
            ) : (
              <>
                Your AI visibility is mostly healthy. Small improvements to SOV
                coverage could recover this remaining gap.
              </>
            )}
          </p>
        </div>
      )}

      {/* CTA */}
      {hasLoss && hallucinationRevenue > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Fix hallucination alerts to reduce your estimated revenue loss.
          </p>
          <Link
            href="/dashboard/hallucinations"
            className="shrink-0 text-xs text-electric-indigo hover:text-electric-indigo/80 underline whitespace-nowrap"
            data-testid="revenue-fix-alerts-link"
          >
            Fix alerts →
          </Link>
        </div>
      )}
    </div>
  );
}
