// ---------------------------------------------------------------------------
// BeforeAfterCard — S15 (Wave 1, AI_RULES §215)
//
// Shows a side-by-side "What AI said" vs "Correct info" panel for resolved
// hallucinations. Rendered in the Resolved column of TriageSwimlane instead
// of AlertCard.
//
// Rules:
//   - Always shows claim_text (what was wrong)
//   - Shows expected_truth when available (the correction)
//   - Shows revenue_recovered_monthly when > 0 (snapshotted at fix time)
//   - Timestamp: fixed_at if set, else verified_at, else first_detected_at
//   - data-testid="before-after-card"
// ---------------------------------------------------------------------------

import type { HallucinationRow } from '@/lib/data/dashboard';
import { CheckCircle2, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeAfterCardProps {
  alert: HallucinationRow;
}

export default function BeforeAfterCard({ alert }: BeforeAfterCardProps) {
  const resolvedAt = alert.fixed_at ?? alert.verified_at ?? alert.first_detected_at;
  const revenue = alert.revenue_recovered_monthly ?? 0;

  return (
    <div
      className="rounded-lg border border-signal-green/20 bg-signal-green/5 p-4"
      data-testid={`before-after-card-${alert.id}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-signal-green" aria-hidden="true" />
          <span className="text-xs font-semibold text-signal-green">Fixed</span>
        </div>
        {resolvedAt && (
          <span className="text-[10px] text-muted-foreground/60">
            {timeAgo(resolvedAt)}
          </span>
        )}
      </div>

      {/* Before */}
      <div className="space-y-2">
        <div className="rounded-md bg-alert-crimson/10 border border-alert-crimson/20 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-alert-crimson">
            What AI was saying
          </p>
          <p className="text-xs text-foreground leading-snug line-clamp-3">
            {alert.claim_text}
          </p>
        </div>

        {/* After */}
        {alert.expected_truth && (
          <div className="rounded-md bg-signal-green/10 border border-signal-green/20 px-3 py-2">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-green">
              Correct information
            </p>
            <p className="text-xs text-foreground leading-snug line-clamp-3">
              {alert.expected_truth}
            </p>
          </div>
        )}
      </div>

      {/* Revenue recovered badge */}
      {revenue > 0 && (
        <div
          className={cn(
            'mt-3 flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5',
          )}
          data-testid="revenue-recovered-badge"
        >
          <DollarSign className="h-3 w-3 text-signal-green shrink-0" aria-hidden="true" />
          <span className="text-xs text-signal-green font-medium">
            ~${revenue}/mo recovered
          </span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000,
  );
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
