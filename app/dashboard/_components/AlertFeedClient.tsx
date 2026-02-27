'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { HallucinationRow } from '@/lib/data/dashboard';
import CorrectionPanel from './CorrectionPanel';

// ---------------------------------------------------------------------------
// Helpers (duplicated from AlertFeed.tsx to keep server component pure)
// ---------------------------------------------------------------------------

const ENGINE_LABELS: Record<string, string> = {
  'openai-gpt4o':       'ChatGPT',
  'perplexity-sonar':   'Perplexity',
  'google-gemini':      'Google AI',
  'anthropic-claude':   'Claude',
  'microsoft-copilot':  'Copilot',
};

const SEVERITY_STYLES: Record<
  HallucinationRow['severity'],
  { badge: string; border: string; dot: string; label: string }
> = {
  critical: {
    badge:  'bg-alert-crimson/15 text-alert-crimson',
    border: 'border-l-alert-crimson',
    dot:    'bg-alert-crimson',
    label:  'CRITICAL',
  },
  high: {
    badge:  'bg-amber-400/15 text-amber-400',
    border: 'border-l-amber-400',
    dot:    'bg-amber-400',
    label:  'HIGH',
  },
  medium: {
    badge:  'bg-yellow-400/15 text-yellow-400',
    border: 'border-l-yellow-400',
    dot:    'bg-yellow-400',
    label:  'MEDIUM',
  },
  low: {
    badge:  'bg-slate-400/15 text-slate-400',
    border: 'border-l-slate-400',
    dot:    'bg-slate-400',
    label:  'LOW',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  status:  'Business Status',
  hours:   'Business Hours',
  amenity: 'Amenities',
  menu:    'Menu',
  address: 'Address',
  phone:   'Phone Number',
};

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days    = Math.floor(diffMs / 86_400_000);
  const hours   = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor(diffMs / 60_000);
  if (days > 0)    return `${days} day${days === 1 ? '' : 's'} ago`;
  if (hours > 0)   return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  return 'just now';
}

// ---------------------------------------------------------------------------
// AlertCardInteractive — Client version of AlertCard with "Fix This" button
// ---------------------------------------------------------------------------

function AlertCardInteractive({
  alert,
  isSelected,
  canCreateDraft,
  onFixThis,
  onClose,
}: {
  alert: HallucinationRow;
  isSelected: boolean;
  canCreateDraft: boolean;
  onFixThis: () => void;
  onClose: () => void;
}) {
  const style    = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low;
  const engine   = ENGINE_LABELS[alert.model_provider] ?? alert.model_provider;
  const category = CATEGORY_LABELS[alert.category ?? ''] ?? alert.category ?? 'Unknown';
  const isCritical = alert.severity === 'critical';

  return (
    <article
      className={[
        'rounded-xl bg-surface-dark border border-white/5 border-l-4 overflow-hidden',
        style.border,
      ].join(' ')}
    >
      <div className="px-4 py-4">
        {/* ── Top row: severity badge + engine + time ────────────── */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {isCritical && (
            <span
              aria-hidden
              className={[
                'inline-block h-2 w-2 rounded-full shrink-0 animate-pulse',
                style.dot,
              ].join(' ')}
            />
          )}
          <span
            className={[
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
              style.badge,
            ].join(' ')}
          >
            {style.label}
          </span>
          <span className="text-xs text-slate-500">
            {engine} · {category}
          </span>
          {alert.occurrence_count > 1 && (
            <span className="ml-auto text-xs text-slate-600 tabular-nums">
              Seen {alert.occurrence_count}×
            </span>
          )}
        </div>

        {/* ── The Lie ───────────────────────────────────────────── */}
        <p className="text-sm font-medium text-white leading-snug">
          &ldquo;{alert.claim_text}&rdquo;
        </p>

        {/* ── The Truth ─────────────────────────────────────────── */}
        {alert.expected_truth && (
          <div className="mt-2 flex items-start gap-2">
            <span className="text-xs font-semibold text-signal-green shrink-0 mt-px">
              Truth:
            </span>
            <p className="text-xs text-slate-400 leading-snug">
              {alert.expected_truth}
            </p>
          </div>
        )}

        {/* ── Footer: timestamp + CTAs ─────────────────────────── */}
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-slate-600">
            Detected {timeAgo(alert.first_detected_at)}
            {alert.last_seen_at !== alert.first_detected_at &&
              ` · last seen ${timeAgo(alert.last_seen_at)}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onFixThis}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition font-medium"
            >
              Fix This →
            </button>
            <Link
              href="/dashboard/magic-menus"
              className="inline-flex items-center rounded-lg bg-signal-green/10 border border-signal-green/30 px-3 py-1.5 text-xs font-semibold text-signal-green hover:bg-signal-green/20 transition"
            >
              Fix with Magic Menu →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Correction Panel (expanded inline) ─────────────────── */}
      {isSelected && (
        <div className="border-t border-white/5 px-4 py-4">
          <CorrectionPanel
            hallucinationId={alert.id}
            canCreateDraft={canCreateDraft}
            onClose={onClose}
          />
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// AlertFeedInteractive — Client wrapper for interactive alert feed
// ---------------------------------------------------------------------------

export default function AlertFeedInteractive({
  alerts,
  canCreateDraft,
}: {
  alerts: HallucinationRow[];
  canCreateDraft: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertCardInteractive
          key={alert.id}
          alert={alert}
          isSelected={selectedId === alert.id}
          canCreateDraft={canCreateDraft}
          onFixThis={() => setSelectedId(selectedId === alert.id ? null : alert.id)}
          onClose={() => setSelectedId(null)}
        />
      ))}
    </div>
  );
}
