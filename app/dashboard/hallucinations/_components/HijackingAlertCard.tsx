// ---------------------------------------------------------------------------
// HijackingAlertCard — P8-FIX-37: Triage card for a competitive hijack.
//
// Severity badge + engine/competitor headline + evidence + actions.
// AI_RULES §193.
// ---------------------------------------------------------------------------

'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { updateHijackingAlertStatus, type HijackingStatus } from '../../actions';
import HijackingFixModal from './HijackingFixModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HijackType = 'attribute_confusion' | 'competitor_citation' | 'address_mix';

export interface HijackingAlertRow {
  id: string;
  engine: string;
  query_text: string;
  hijack_type: HijackType;
  our_business: string;
  competitor_name: string;
  evidence_text: string;
  severity: 'critical' | 'high' | 'medium';
  status: 'new' | 'acknowledged' | 'resolved';
  detected_at: string;
  resolved_at: string | null;
}

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

const SEVERITY_STYLES = {
  critical: {
    badge: 'bg-alert-crimson/15 text-alert-crimson ring-1 ring-alert-crimson/20',
    border: 'border-l-4 border-l-alert-crimson',
    label: 'Critical',
  },
  high: {
    badge: 'bg-alert-amber/15 text-alert-amber ring-1 ring-alert-amber/20',
    border: 'border-l-4 border-l-alert-amber',
    label: 'High',
  },
  medium: {
    badge: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-600/20',
    border: 'border-l-4 border-l-blue-400',
    label: 'Medium',
  },
} as const;

const ENGINE_LABELS: Record<string, string> = {
  perplexity_sonar: 'Perplexity',
  openai_gpt4o_mini: 'ChatGPT',
  gemini_flash: 'Gemini',
  'openai-gpt4o': 'OpenAI GPT-4o',
  'perplexity-sonar': 'Perplexity Sonar',
  'google-gemini': 'Google Gemini',
  'anthropic-claude': 'Anthropic Claude',
  'microsoft-copilot': 'Microsoft Copilot',
};

const HIJACK_TYPE_LABELS: Record<HijackType, string> = {
  competitor_citation: 'is appearing instead of',
  address_mix: 'is causing address confusion for',
  attribute_confusion: 'is being confused with',
};

function engineLabel(engine: string): string {
  return ENGINE_LABELS[engine] ?? engine;
}

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  alert: HijackingAlertRow;
}

export default function HijackingAlertCard({ alert }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const styles = SEVERITY_STYLES[alert.severity];
  const headline = `${engineLabel(alert.engine)} ${HIJACK_TYPE_LABELS[alert.hijack_type]} ${alert.our_business}`;

  function handleStatusUpdate(status: HijackingStatus) {
    startTransition(async () => {
      await updateHijackingAlertStatus(alert.id, status);
    });
  }

  return (
    <>
      <div
        className={cn('rounded-lg border border-white/5 bg-card p-4', styles.border)}
        data-testid={`hijack-card-${alert.id}`}
      >
        {/* Header: severity badge + engine + time */}
        <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                styles.badge,
              )}
              data-testid={`hijack-severity-${alert.id}`}
            >
              {styles.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {engineLabel(alert.engine)}
            </span>
            {alert.status !== 'new' && (
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                alert.status === 'resolved'
                  ? 'bg-signal-green/15 text-signal-green'
                  : 'bg-blue-500/15 text-blue-400',
              )}>
                {alert.status}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
            {timeAgo(alert.detected_at)}
          </span>
        </div>

        {/* Headline */}
        <p className="text-sm font-medium text-foreground leading-snug">
          {headline}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Competitor: <strong>{alert.competitor_name}</strong>
        </p>

        {/* Evidence (expandable) */}
        <details className="mt-2" data-testid={`hijack-evidence-${alert.id}`}>
          <summary className="cursor-pointer text-xs text-primary hover:text-primary/80">
            View AI response evidence
          </summary>
          <blockquote className="mt-1 rounded-md bg-white/5 p-3 text-xs text-muted-foreground italic border-l-2 border-white/10">
            &ldquo;{alert.evidence_text}&rdquo;
          </blockquote>
        </details>

        {/* Query */}
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          Query: &ldquo;{alert.query_text}&rdquo;
        </p>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {alert.status === 'new' && (
            <>
              <button
                type="button"
                onClick={() => handleStatusUpdate('acknowledged')}
                disabled={isPending}
                className="rounded-md bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                data-testid={`hijack-ack-${alert.id}`}
              >
                {isPending ? 'Updating…' : 'Acknowledge'}
              </button>
              <button
                type="button"
                onClick={() => handleStatusUpdate('resolved')}
                disabled={isPending}
                className="rounded-md bg-signal-green/15 px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/25 transition-colors disabled:opacity-50"
                data-testid={`hijack-resolve-${alert.id}`}
              >
                Mark Resolved
              </button>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-xs text-primary underline hover:text-primary/80"
                data-testid={`hijack-fix-${alert.id}`}
              >
                View Fix Steps
              </button>
            </>
          )}
          {alert.status === 'acknowledged' && (
            <>
              <button
                type="button"
                onClick={() => handleStatusUpdate('resolved')}
                disabled={isPending}
                className="rounded-md bg-signal-green/15 px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/25 transition-colors disabled:opacity-50"
                data-testid={`hijack-resolve-${alert.id}`}
              >
                {isPending ? 'Resolving…' : 'Mark Resolved'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-xs text-primary underline hover:text-primary/80"
                data-testid={`hijack-fix-${alert.id}`}
              >
                View Fix Steps
              </button>
            </>
          )}
          {alert.status === 'resolved' && (
            <span className="text-xs font-medium text-signal-green">
              Resolved — no longer detected
            </span>
          )}
        </div>
      </div>

      {showModal && (
        <HijackingFixModal
          hijackType={alert.hijack_type}
          businessName={alert.our_business}
          competitorName={alert.competitor_name}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
