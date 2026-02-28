// ---------------------------------------------------------------------------
// AgentReadinessVerdictPanel — Sprint J
//
// Plain-English verdict panel for Agent Readiness page.
// Answers: "Can AI take action for your customers?"
//
// AI_RULES §102: No jargon — "JSON-LD", "schema", "agentic", etc.
// ---------------------------------------------------------------------------

import type { AgentReadinessResult } from '@/lib/services/agent-readiness.service';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface AgentReadinessVerdictPanelProps {
  result: AgentReadinessResult;
}

export function AgentReadinessVerdictPanel({ result }: AgentReadinessVerdictPanelProps) {
  const { score, level, activeCount, totalCount } = result;
  const failingCount = totalCount - activeCount;

  // Score ring SVG
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (score / 100) * circ;

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark px-5 py-5 space-y-4"
      data-testid="agent-readiness-verdict-panel"
    >
      <div className="flex items-center gap-6">
        {/* Score ring */}
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="8"
              className="stroke-white/5"
            />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              className={
                score >= 70
                  ? 'stroke-signal-green'
                  : score >= 40
                    ? 'stroke-amber-400'
                    : 'stroke-alert-crimson'
              }
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="relative text-center">
            <span
              className={`text-3xl font-bold tabular-nums leading-none ${
                score >= 70
                  ? 'text-signal-green'
                  : score >= 40
                    ? 'text-amber-400'
                    : 'text-alert-crimson'
              }`}
              data-testid="agent-readiness-score"
            >
              {score}
            </span>
          </div>
        </div>

        {/* Verdict text */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                score >= 70
                  ? 'bg-green-400/15 text-green-400'
                  : score >= 40
                    ? 'bg-amber-400/15 text-amber-400'
                    : 'bg-red-400/15 text-red-400'
              }`}
              data-testid="agent-readiness-level"
            >
              {activeCount}/{totalCount} ready
            </span>
            <InfoTooltip
              content="How many common customer interactions AI assistants can handle for your business — answering questions, showing your menu, booking reservations, and placing orders."
            />
          </div>

          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              level === 'agent_ready'
                ? 'border-green-400/20 bg-green-400/5 text-green-300'
                : level === 'partially_ready'
                  ? 'border-amber-400/20 bg-amber-400/5 text-amber-300'
                  : 'border-red-400/20 bg-red-400/5 text-red-300'
            }`}
            data-testid="agent-readiness-verdict-text"
          >
            {level === 'agent_ready' && (
              <>
                AI assistants can handle most customer interactions for your business.
                {failingCount > 0 && (
                  <>
                    {' '}Fix the{' '}
                    <span className="font-semibold">
                      {failingCount} remaining item{failingCount !== 1 ? 's' : ''}
                    </span>{' '}
                    to reach full readiness.
                  </>
                )}
              </>
            )}
            {level === 'partially_ready' && (
              <>
                AI assistants can answer some customer questions, but there are{' '}
                <span className="font-semibold">
                  {failingCount} gap{failingCount !== 1 ? 's' : ''}
                </span>
                . Customers asking about those topics may get wrong or incomplete answers.
              </>
            )}
            {level === 'not_ready' && (
              <>
                AI assistants can only handle{' '}
                <span className="font-semibold">
                  {activeCount} of {totalCount}
                </span>{' '}
                customer interactions reliably. Customers asking AI about your business
                frequently get incomplete or incorrect answers.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
