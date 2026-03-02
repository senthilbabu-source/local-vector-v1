'use client';

// ---------------------------------------------------------------------------
// CorrectionStatusBadge — Sprint 121: Shows correction follow-up state
// ---------------------------------------------------------------------------

import type { CorrectionFollowUp } from '@/lib/corrections/types';

interface CorrectionStatusBadgeProps {
  followUp?: CorrectionFollowUp | null;
}

export default function CorrectionStatusBadge({ followUp }: CorrectionStatusBadgeProps) {
  if (!followUp) return null;

  const status = followUp.rescan_status;

  if (status === 'pending') {
    const dueDate = new Date(followUp.rescan_due_at);
    const daysLeft = Math.max(
      0,
      Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000),
    );

    return (
      <span
        className="inline-flex items-center rounded-full bg-alert-amber/15 px-2.5 py-0.5 text-[10px] font-semibold text-alert-amber ring-1 ring-inset ring-alert-amber/20"
        data-testid="correction-status-badge"
      >
        Rescan pending in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
      </span>
    );
  }

  if (status === 'cleared') {
    return (
      <span
        className="inline-flex items-center rounded-full bg-signal-green/15 px-2.5 py-0.5 text-[10px] font-semibold text-signal-green ring-1 ring-inset ring-signal-green/20"
        data-testid="correction-status-badge"
      >
        Cleared — hallucination no longer detected
      </span>
    );
  }

  if (status === 'persists') {
    return (
      <span
        className="inline-flex items-center rounded-full bg-alert-crimson/15 px-2.5 py-0.5 text-[10px] font-semibold text-alert-crimson ring-1 ring-inset ring-alert-crimson/20"
        data-testid="correction-status-badge"
      >
        Still appearing — consider stronger correction content
      </span>
    );
  }

  // inconclusive
  return (
    <span
      className="inline-flex items-center rounded-full bg-slate-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400 ring-1 ring-inset ring-slate-500/20"
      data-testid="correction-status-badge"
    >
      Rescan inconclusive
    </span>
  );
}
