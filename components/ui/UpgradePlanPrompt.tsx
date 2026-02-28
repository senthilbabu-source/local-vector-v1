// ---------------------------------------------------------------------------
// UpgradePlanPrompt — Sprint B (H2)
//
// Shown inline in settings sections that require a higher-tier plan.
// Links to the billing page for upgrade.
// ---------------------------------------------------------------------------

import Link from 'next/link';

interface UpgradePlanPromptProps {
  feature: string;
  requiredPlan: string;
}

export function UpgradePlanPrompt({ feature, requiredPlan }: UpgradePlanPromptProps) {
  return (
    <div className="rounded-xl border border-dashed border-electric-indigo/30 bg-electric-indigo/5 px-4 py-3 text-sm">
      <p className="text-slate-300">
        <span className="font-medium text-white">{feature}</span> is available on the{' '}
        <span className="font-medium text-electric-indigo">{requiredPlan}</span> plan.
      </p>
      <Link href="/dashboard/billing" className="mt-1 inline-block text-xs text-electric-indigo hover:underline">
        View upgrade options &rarr;
      </Link>
    </div>
  );
}
