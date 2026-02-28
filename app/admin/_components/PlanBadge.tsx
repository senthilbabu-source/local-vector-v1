import { getPlanDisplayName } from '@/lib/plan-display-names';

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-slate-500/15 text-slate-400',
  starter: 'bg-blue-500/15 text-blue-400',
  growth: 'bg-signal-green/15 text-signal-green',
  agency: 'bg-electric-indigo/15 text-electric-indigo',
};

/**
 * PlanBadge — colored plan name badge. Sprint D (L1).
 */
export default function PlanBadge({ plan }: { plan: string | null }) {
  const displayName = getPlanDisplayName(plan);
  const color = PLAN_COLORS[plan ?? 'trial'] ?? PLAN_COLORS.trial;

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`} data-testid="plan-badge">
      {displayName}
    </span>
  );
}
