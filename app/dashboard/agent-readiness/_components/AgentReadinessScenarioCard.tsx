// ---------------------------------------------------------------------------
// AgentReadinessScenarioCard — Sprint J
//
// Displays a single agent readiness capability as a customer-interaction
// scenario instead of a technical checklist item.
//
// AI_RULES §102: No jargon in scenario text.
// ---------------------------------------------------------------------------

import type { AgentCapability } from '@/lib/services/agent-readiness.service';
import {
  SCENARIO_DESCRIPTIONS,
  type CapabilityId,
} from '@/lib/agent-readiness/scenario-descriptions';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface AgentReadinessScenarioCardProps {
  capability: AgentCapability;
}

export function AgentReadinessScenarioCard({ capability }: AgentReadinessScenarioCardProps) {
  const scenario = SCENARIO_DESCRIPTIONS[capability.id as CapabilityId];

  return (
    <div
      className={`rounded-xl border bg-surface-dark px-4 py-3 ${
        capability.status === 'active'
          ? 'border-green-400/10'
          : capability.status === 'partial'
            ? 'border-amber-400/10'
            : 'border-red-400/10'
      }`}
      data-testid={`scenario-card-${capability.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {capability.status === 'active' ? (
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          ) : capability.status === 'partial' ? (
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          ) : (
            <XCircle className="h-5 w-5 text-red-400" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Scenario question (jargon-free) */}
          <p
            className={`text-sm font-semibold ${
              capability.status === 'active'
                ? 'text-green-300'
                : capability.status === 'partial'
                  ? 'text-amber-300'
                  : 'text-red-300'
            }`}
          >
            {scenario?.scenario ?? capability.name}
          </p>

          {/* Customer-consequence text */}
          <p
            className={`mt-0.5 text-xs ${
              capability.status === 'active'
                ? 'text-green-400/70'
                : capability.status === 'partial'
                  ? 'text-amber-400/70'
                  : 'text-red-400/70'
            }`}
          >
            {scenario
              ? capability.status === 'active'
                ? scenario.whenActive
                : capability.status === 'partial'
                  ? scenario.whenPartial
                  : scenario.whenMissing
              : capability.statusDetail}
          </p>

          {/* Fix guide for non-active capabilities */}
          {capability.status !== 'active' && capability.fixGuide && (
            <div className="mt-2 border-t border-white/5 pt-2">
              <p className="text-xs text-slate-500">{capability.fixGuide}</p>
              {capability.schemaAction && (
                <button
                  className="mt-2 inline-flex items-center text-xs font-semibold text-electric-indigo hover:text-electric-indigo/80 transition-colors"
                  data-testid={`generate-${capability.schemaAction}`}
                >
                  Fix this &rarr;
                </button>
              )}
            </div>
          )}

          {/* Points badge */}
          <div className="mt-1.5">
            <span
              className={`text-xs font-bold tabular-nums ${
                capability.status === 'active'
                  ? 'text-green-400'
                  : capability.status === 'partial'
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {capability.earnedPoints}/{capability.maxPoints} pts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
