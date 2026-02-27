// ---------------------------------------------------------------------------
// components/plan-gate/PlanGate.tsx — Blur-teaser plan enforcement wrapper
//
// RSC-safe. Wraps any dashboard content behind a blur overlay + upgrade card
// when the org's plan doesn't meet the required tier. Children always render
// (real data, not placeholder) — the blur creates urgency to upgrade.
//
// AI_RULES §49: All plan-gated UI uses this component. No ad-hoc inline gates.
// ---------------------------------------------------------------------------

import { Lock } from 'lucide-react';
import { planSatisfies } from '@/lib/plan-enforcer';
import { cn } from '@/lib/utils';

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  'Citation Gap Analysis':
    'See exactly which AI models are missing your business — and the directories you need to claim.',
  'Page Audit':
    'Get a full 5-dimension AI readiness audit of your website with actionable recommendations.',
  'Content Drafts':
    'AI-generated, HITL-reviewed content drafts that close your citation gaps and beat competitors.',
  'AI Sentiment Tracker':
    'Track how AI models describe your business over time — catch reputation drift before it costs you.',
  'Citation Source Intelligence':
    'Identify which directories and data providers AI models trust most for your category.',
};

interface PlanGateProps {
  /** Minimum plan required to see this content unblurred */
  requiredPlan: 'growth' | 'agency';
  /** Org's actual current plan from the database */
  currentPlan: string | null | undefined;
  /** Human-readable feature name shown in upgrade card */
  feature: string;
  /** Override for the upgrade CTA URL. Defaults to '/dashboard/billing' */
  upgradeHref?: string;
  /** Additional className on the outer wrapper */
  className?: string;
  children: React.ReactNode;
}

export function PlanGate({
  requiredPlan,
  currentPlan,
  feature,
  upgradeHref = '/dashboard/billing',
  className,
  children,
}: PlanGateProps) {
  if (planSatisfies(currentPlan, requiredPlan)) {
    return <>{children}</>;
  }

  const planLabel = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1);
  const description =
    FEATURE_DESCRIPTIONS[feature] ??
    `Upgrade to unlock ${feature} and drive more AI visibility.`;

  return (
    <div data-testid="plan-gate-container" className={cn('relative', className)}>
      {/* Blurred content — real data, not placeholder */}
      <div
        data-testid="plan-gate-blurred-content"
        className="blur-sm pointer-events-none select-none"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Upgrade overlay */}
      <div
        data-testid="plan-gate-overlay"
        className="absolute inset-0 flex items-center justify-center"
        role="region"
        aria-label={`Upgrade required to access ${feature}`}
      >
        <div
          data-testid="plan-gate-card"
          className="bg-surface-dark/95 backdrop-blur-md rounded-2xl shadow-xl border border-white/10 p-8 max-w-sm w-full mx-4 text-center"
        >
          {/* Lock icon */}
          <div
            data-testid="plan-gate-icon"
            className="mx-auto mb-4 w-12 h-12 rounded-full bg-electric-indigo/10 flex items-center justify-center"
          >
            <Lock className="w-6 h-6 text-electric-indigo" />
          </div>

          {/* Required plan badge */}
          <span
            data-testid="plan-gate-plan-badge"
            className="inline-block mb-3 px-3 py-1 rounded-full text-xs font-semibold bg-electric-indigo/10 text-electric-indigo uppercase tracking-wide"
          >
            {planLabel} Plan
          </span>

          <h3
            data-testid="plan-gate-title"
            className="text-lg font-semibold text-white mb-2"
          >
            {feature}
          </h3>

          <p
            data-testid="plan-gate-description"
            className="text-sm text-slate-400 mb-6"
          >
            {description}
          </p>

          <a
            data-testid="plan-gate-upgrade-cta"
            href={upgradeHref}
            className="inline-block w-full px-6 py-3 rounded-xl bg-signal-green/10 text-signal-green font-semibold text-sm ring-1 ring-inset ring-signal-green/20 hover:bg-signal-green/20 transition-colors"
          >
            Upgrade to {planLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
