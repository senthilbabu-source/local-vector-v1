// ---------------------------------------------------------------------------
// PlanComparisonTable — Sprint B (M3)
//
// Renders the full feature matrix on the billing page.
// Highlights the user's current plan column with a "Your Plan" badge.
// ---------------------------------------------------------------------------

'use client';

import { Fragment } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLAN_FEATURE_MATRIX } from '@/lib/plan-feature-matrix';
import { getPlanDisplayName } from '@/lib/plan-display-names';

interface PlanComparisonTableProps {
  currentPlan: string | null;
}

const PLAN_ORDER = ['trial', 'starter', 'growth', 'agency'] as const;
const PLAN_PRICES: Record<string, string> = {
  trial:   'Free',
  starter: '$29/mo',
  growth:  '$59/mo',
  agency:  'Custom',
};

export default function PlanComparisonTable({ currentPlan }: PlanComparisonTableProps) {
  const categories = [...new Set(PLAN_FEATURE_MATRIX.map((f) => f.category))];

  return (
    <div className="mt-8 overflow-x-auto rounded-xl border border-white/5" data-testid="plan-comparison-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 bg-surface-dark">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-52">
              Feature
            </th>
            {PLAN_ORDER.map((plan) => (
              <th
                key={plan}
                className={cn(
                  'px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider',
                  plan === currentPlan
                    ? 'bg-electric-indigo/10 text-electric-indigo'
                    : 'text-slate-500'
                )}
                data-testid={`plan-column-${plan}`}
              >
                <div>{getPlanDisplayName(plan)}</div>
                <div className="text-[10px] font-normal normal-case tracking-normal mt-0.5 text-slate-500">
                  {PLAN_PRICES[plan]}
                </div>
                {plan === currentPlan && (
                  <div className="mt-1 inline-block rounded-full bg-electric-indigo/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-electric-indigo">
                    Your Plan
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <Fragment key={category}>
              <tr className="border-b border-white/5 bg-midnight-slate/50">
                <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {category}
                </td>
              </tr>
              {PLAN_FEATURE_MATRIX.filter((f) => f.category === category).map((feature) => (
                <tr key={feature.label} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5 text-slate-300">{feature.label}</td>
                  {PLAN_ORDER.map((plan) => {
                    const value = feature[plan];
                    return (
                      <td
                        key={plan}
                        className={cn(
                          'px-4 py-2.5 text-center',
                          plan === currentPlan ? 'bg-electric-indigo/5' : ''
                        )}
                      >
                        {value === true  && <Check className="mx-auto h-4 w-4 text-signal-green" aria-label="Included" />}
                        {value === false && <Minus className="mx-auto h-4 w-4 text-slate-600" aria-label="Not included" />}
                        {typeof value === 'string' && (
                          <span className="text-xs font-medium text-slate-300">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
