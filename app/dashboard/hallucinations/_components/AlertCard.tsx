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
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import DismissAlertButton from './DismissAlertButton';

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
}

export default function AlertCard({ alert }: AlertCardProps) {
  // Sprint G: all copy comes from here — no hardcoded strings
  const description = describeAlert(alert);

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

      {/* Actions — one per status */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {status === 'open' && (
          <>
            <Link
              href={`/dashboard/hallucinations`}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              data-testid={`alert-fix-${alert.id}`}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Fix with AI
            </Link>
            <DismissAlertButton alertId={alert.id} />
          </>
        )}
        {status === 'fixed' && (
          <span className="text-xs font-medium text-signal-green">
            Fixed — AI models no longer show this incorrect information
          </span>
        )}
        {status === 'recurring' && (
          <Link
            href="/dashboard/hallucinations"
            className="text-xs text-primary underline hover:text-primary/80"
          >
            Try again →
          </Link>
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
