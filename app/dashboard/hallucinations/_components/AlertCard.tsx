// ---------------------------------------------------------------------------
// AlertCard — Sprint H: Triage card for a single AI hallucination.
//
// CRITICAL: headline comes from describeAlert() in lib/issue-descriptions.ts
// (Sprint G). Never write alert copy directly in this file.
// AI_RULES §93: AlertCard always uses describeAlert(). No exceptions.
// ---------------------------------------------------------------------------

'use client';

import { describeAlert, getModelName, mapSeverity } from '@/lib/issue-descriptions';
import type { HallucinationRow } from '@/lib/data/dashboard';
import type { CorrectionStatus } from '../../actions';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import DismissAlertButton from './DismissAlertButton';
import CorrectButton from './CorrectButton';
import FixGuidancePanel from './FixGuidancePanel';
import { computeUrgency } from '@/lib/hallucinations/urgency';

const SEVERITY_STYLES = {
  critical: {
    badge:  'bg-alert-crimson/15 text-alert-crimson ring-1 ring-alert-crimson/20',
    border: 'border-l-4 border-l-alert-crimson',
    label:  'Critical',
  },
  warning: {
    badge:  'bg-alert-amber/15 text-alert-amber ring-1 ring-alert-amber/20',
    border: 'border-l-4 border-l-alert-amber',
    label:  'Warning',
  },
  info: {
    badge:  'bg-blue-500/15 text-blue-400 ring-1 ring-blue-600/20',
    border: 'border-l-4 border-l-blue-400',
    label:  'Info',
  },
} as const;

interface AlertCardProps {
  alert: HallucinationRow;
  /** When true, renders BeforeAfterCard-style layout (used in Resolved column) */
  isResolved?: boolean;
  /** S21: Revenue config for urgency computation */
  avgTicket?: number;
  monthlyCover?: number;
}

export default function AlertCard({ alert, isResolved = false, avgTicket = 55, monthlyCover = 1800 }: AlertCardProps) {
  void isResolved; // consumed by TriageSwimlane to conditionally render BeforeAfterCard instead
  // Sprint G: all copy comes from here — no hardcoded strings
  const description = describeAlert(alert);

  // S21: Day-of-week urgency for open critical/high alerts
  const urgency = alert.correction_status === 'open'
    ? computeUrgency(alert.severity, alert.first_detected_at, avgTicket, monthlyCover)
    : null;

  // Map DB severity (critical/high/medium/low) → UI severity (critical/warning/info)
  const uiSeverity = mapSeverity(alert.severity);
  const styles = SEVERITY_STYLES[uiSeverity];

  const status = alert.correction_status;

  return (
    <div
      className={cn(
        'rounded-lg border border-white/5 bg-card p-4',
        styles.border,
      )}
      data-testid={`alert-card-${alert.id}`}
    >
      {/* Header row: severity badge + model name + relative time */}
      <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              styles.badge,
            )}
            data-testid={`alert-severity-${alert.id}`}
          >
            {styles.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {getModelName(alert.model_provider)}
          </span>
        </div>
        {alert.first_detected_at && (
          <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
            {timeAgo(alert.first_detected_at)}
          </span>
        )}
      </div>

      {/* S21: Urgency badge — only Tue/Wed/Thu + critical/high + open */}
      {urgency && (
        <div
          className="mb-2 flex items-center gap-1.5 rounded-md bg-alert-crimson/10 border border-alert-crimson/20 px-3 py-1.5 text-xs font-medium text-alert-crimson"
          data-testid="urgency-badge"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Fix before Friday &mdash; ${urgency.revenueAtStake.toLocaleString()} at stake this weekend
        </div>
      )}

      {/* Plain-English headline — from describeAlert() */}
      <p className="text-sm font-medium text-foreground leading-snug">
        {description.headline}
      </p>
      {description.subtext && (
        <p className="mt-1 text-xs text-muted-foreground">{description.subtext}</p>
      )}

      {/* Follow-up status for verifying alerts */}
      {status === 'verifying' && (
        <div className="mt-2 rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs">
          {alert.follow_up_result === 'fixed' && (
            <span className="text-signal-green font-medium">
              Verified — AI models no longer show this incorrect information
            </span>
          )}
          {alert.follow_up_result === 'recurring' && (
            <span className="text-alert-amber">
              Still showing incorrect info after correction — consider resubmitting
            </span>
          )}
          {alert.follow_up_result === null && (
            <span className="text-blue-400">
              Verification in progress — will recheck in ~14 days
            </span>
          )}
        </div>
      )}

      {/* S14: Category-specific fix guidance — expanded by default for open alerts */}
      {(status === 'open' || status === 'verifying') && (
        <FixGuidancePanel category={alert.fix_guidance_category} defaultOpen={status === 'open'} />
      )}

      {/* Actions — one per status */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {status === 'open' && (
          <>
            <CorrectButton hallucinationId={alert.id} claimText={alert.claim_text} />
            <DismissAlertButton alertId={alert.id} />
          </>
        )}
        {status === 'corrected' && (
          <span className="text-xs font-medium text-signal-green">
            Corrected — rescan scheduled to verify
          </span>
        )}
        {status === 'fixed' && (
          <span className="text-xs font-medium text-signal-green">
            Fixed — AI models no longer show this incorrect information
          </span>
        )}
        {status === 'recurring' && (
          <>
            <CorrectButton hallucinationId={alert.id} claimText={alert.claim_text} />
            <DismissAlertButton alertId={alert.id} />
          </>
        )}
      </div>
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
