// Server Component — all CTAs are <Link> elements, no useState needed.
import Link from 'next/link';
import type { HallucinationRow } from '../page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Friendly display name for model_provider enum values (prod_schema.sql). */
const ENGINE_LABELS: Record<string, string> = {
  'openai-gpt4o':       'ChatGPT',
  'perplexity-sonar':   'Perplexity',
  'google-gemini':      'Google AI',
  'anthropic-claude':   'Claude',
  'microsoft-copilot':  'Copilot',
};

/** Severity badge styles — color mapped to Deep Night palette. */
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

/** Friendly category labels. */
const CATEGORY_LABELS: Record<string, string> = {
  status:  'Business Status',
  hours:   'Business Hours',
  amenity: 'Amenities',
  menu:    'Menu',
  address: 'Address',
  phone:   'Phone Number',
};

/** Server-side time-ago formatter — no client-side date lib needed. */
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
// AlertCard — single hallucination row
// ---------------------------------------------------------------------------

function AlertCard({ alert }: { alert: HallucinationRow }) {
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
          {/* Pulsing dot for critical (Doc 06 §10: "red pulsing border") */}
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

        {/* ── Footer: timestamp + CTA ───────────────────────────── */}
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-slate-600">
            Detected {timeAgo(alert.first_detected_at)}
            {alert.last_seen_at !== alert.first_detected_at &&
              ` · last seen ${timeAgo(alert.last_seen_at)}`}
          </span>
          {/* Doc 06 §4 — "Fix with Magic Menu" links to magic-menus */}
          <Link
            href="/dashboard/magic-menus"
            className="inline-flex items-center rounded-lg bg-signal-green/10 border border-signal-green/30 px-3 py-1.5 text-xs font-semibold text-signal-green hover:bg-signal-green/20 transition"
          >
            Fix with Magic Menu →
          </Link>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// AlertFeed
// ---------------------------------------------------------------------------

export default function AlertFeed({ alerts }: { alerts: HallucinationRow[] }) {
  // ── Empty state (Doc 06 §10: "All clear! No AI lies detected.") ──────────
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-signal-green/25 bg-signal-green/8 px-5 py-4">
        {/* Checkmark icon — inline SVG, no lucide import needed for one icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 shrink-0 text-signal-green"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm font-medium text-signal-green">
          All clear! No AI lies detected.
        </p>
      </div>
    );
  }

  // ── Active alerts ─────────────────────────────────────────────────────────
  return (
    <section aria-label="Active AI alerts">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white tracking-tight">
          Active Alerts
        </h2>
        <span
          className="inline-flex items-center rounded-full bg-alert-crimson/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-alert-crimson"
          aria-label={`${alerts.length} active alerts`}
        >
          {alerts.length}
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>

      {/* Link to full alert history */}
      <div className="mt-3 text-right">
        <Link
          href="/dashboard/hallucinations"
          className="text-xs text-slate-500 hover:text-slate-300 transition"
        >
          View all alert history →
        </Link>
      </div>
    </section>
  );
}
