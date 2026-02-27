'use client';

// ---------------------------------------------------------------------------
// OccasionAlertCard — Dismissible occasion alert for dashboard home
//
// Each card shows an upcoming occasion with:
//   - Create Draft CTA (Growth+ only)
//   - Snooze dropdown (Remind me tomorrow / 3 days / next week / Don't show again)
//   - Dismiss button [×]
//
// Optimistic UI: dismiss/snooze removes card immediately, restores on failure.
//
// Sprint 101
// ---------------------------------------------------------------------------

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, X, ChevronDown, Loader2 } from 'lucide-react';
import { snoozeOccasion, dismissOccasionPermanently, createDraftFromOccasion } from '@/app/actions/occasions';
import type { DashboardOccasionAlert } from '@/lib/occasions/occasion-feed';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OccasionAlertCardProps {
  alert: DashboardOccasionAlert;
  canCreateDraft: boolean; // Growth+ plan check
  onDismiss: (id: string) => void; // Optimistic removal callback
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDaysUntil(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OccasionAlertCard({
  alert,
  canCreateDraft,
  onDismiss,
}: OccasionAlertCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!snoozeOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSnoozeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [snoozeOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!snoozeOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setSnoozeOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [snoozeOpen]);

  function handleSnooze(duration: '1_day' | '3_days' | '1_week') {
    setSnoozeOpen(false);
    onDismiss(alert.id); // Optimistic removal
    startTransition(async () => {
      const result = await snoozeOccasion({ occasionId: alert.id, duration });
      if (!result.success) {
        // Restore card on failure — parent will re-render
        router.refresh();
      }
    });
  }

  function handleDismiss() {
    onDismiss(alert.id); // Optimistic removal
    startTransition(async () => {
      const result = await dismissOccasionPermanently({ occasionId: alert.id });
      if (!result.success) {
        router.refresh();
      }
    });
  }

  function handleDismissPermanently() {
    setSnoozeOpen(false);
    handleDismiss();
  }

  function handleCreateDraft() {
    startTransition(async () => {
      const result = await createDraftFromOccasion({ occasionId: alert.id });
      if (result.success) {
        router.push(`/dashboard/content-drafts${result.draftId ? `?new=${result.draftId}` : ''}`);
      }
    });
  }

  return (
    <div
      data-testid={`occasion-alert-card-${alert.id}`}
      className={[
        'relative rounded-xl px-5 py-4 ring-1 transition-all',
        alert.isUrgent
          ? 'border-l-4 border-amber-500 bg-amber-500/5 ring-amber-500/20'
          : 'bg-surface-dark ring-white/5',
      ].join(' ')}
      aria-live="polite"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarDays className="h-4 w-4 shrink-0 text-amber-400" />
          <span
            data-testid={`occasion-alert-name-${alert.id}`}
            className="text-sm font-semibold text-white truncate"
          >
            {alert.name}
          </span>
          <span className="text-xs text-slate-500">·</span>
          <span
            data-testid={`occasion-alert-days-until-${alert.id}`}
            className={[
              'text-xs font-medium',
              alert.isUrgent ? 'text-amber-400' : 'text-slate-400',
            ].join(' ')}
          >
            {formatDaysUntil(alert.daysUntil)}
          </span>
        </div>

        {/* Dismiss button */}
        <button
          data-testid={`occasion-alert-dismiss-btn-${alert.id}`}
          onClick={handleDismiss}
          disabled={isPending}
          aria-label={`Dismiss ${alert.name} alert`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Description */}
      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
        Create AI-optimized content before {alert.name} to capture search intent.
      </p>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {/* Create Draft button */}
        <button
          data-testid={`occasion-alert-create-draft-btn-${alert.id}`}
          onClick={handleCreateDraft}
          disabled={isPending || !canCreateDraft}
          title={!canCreateDraft ? 'Upgrade to Growth to create drafts' : undefined}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
            canCreateDraft
              ? 'bg-signal-green/15 text-signal-green hover:bg-signal-green/25'
              : 'bg-slate-700/50 text-slate-500 cursor-not-allowed',
          ].join(' ')}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : null}
          Create Draft
        </button>

        {/* Snooze dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            data-testid={`occasion-alert-snooze-trigger-${alert.id}`}
            onClick={() => setSnoozeOpen(!snoozeOpen)}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
          >
            Remind me
            <ChevronDown className="h-3 w-3" />
          </button>

          {snoozeOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-10 mt-1 w-44 rounded-lg bg-surface-dark ring-1 ring-white/10 shadow-lg py-1"
            >
              <button
                data-testid={`occasion-alert-snooze-1day-${alert.id}`}
                role="menuitem"
                onClick={() => handleSnooze('1_day')}
                className="block w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5 hover:text-white transition"
              >
                Remind me tomorrow
              </button>
              <button
                data-testid={`occasion-alert-snooze-3days-${alert.id}`}
                role="menuitem"
                onClick={() => handleSnooze('3_days')}
                className="block w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5 hover:text-white transition"
              >
                Remind me in 3 days
              </button>
              <button
                data-testid={`occasion-alert-snooze-1week-${alert.id}`}
                role="menuitem"
                onClick={() => handleSnooze('1_week')}
                className="block w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5 hover:text-white transition"
              >
                Remind me next week
              </button>
              <div className="my-1 border-t border-white/5" />
              <button
                data-testid={`occasion-alert-dismiss-permanent-${alert.id}`}
                role="menuitem"
                onClick={handleDismissPermanently}
                className="block w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-white/5 hover:text-slate-300 transition"
              >
                Don&apos;t show again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
