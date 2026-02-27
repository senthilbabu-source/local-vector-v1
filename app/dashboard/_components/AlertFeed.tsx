// Server Component — renders empty state server-side, delegates interactive
// alert cards to AlertFeedClient (Sprint 75: "Fix This" correction panel).
import Link from 'next/link';
import type { HallucinationRow } from '../page';
import AlertFeedInteractive from './AlertFeedClient';

// ---------------------------------------------------------------------------
// AlertFeed
// ---------------------------------------------------------------------------

export default function AlertFeed({
  alerts,
  canCreateDraft = false,
}: {
  alerts: HallucinationRow[];
  canCreateDraft?: boolean;
}) {
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

      <AlertFeedInteractive alerts={alerts} canCreateDraft={canCreateDraft} />

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
