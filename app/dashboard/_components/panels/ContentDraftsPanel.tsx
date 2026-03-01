/**
 * ContentDraftsPanel — "how many drafts need attention?"
 *
 * Compact dashboard panel showing content draft status.
 * Links to /dashboard/content-drafts for full management.
 *
 * Sprint 86 — Autopilot Engine.
 */

import Link from 'next/link';
import { FileText } from 'lucide-react';

interface ContentDraftsPanelProps {
  pendingCount: number;
  approvedCount: number;
  monthlyUsed: number;
  monthlyLimit: number;
}

export default function ContentDraftsPanel({
  pendingCount,
  approvedCount,
  monthlyUsed,
  monthlyLimit,
}: ContentDraftsPanelProps) {
  const hasPending = pendingCount > 0;
  const hasApproved = approvedCount > 0;

  return (
    <Link
      href="/dashboard/content-drafts"
      className="block rounded-xl border border-white/5 bg-surface-dark p-5 transition-colors hover:border-white/10"
      data-testid="content-drafts-panel"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <FileText className="h-4 w-4 text-slate-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Content Drafts
        </h3>
      </div>

      <div className="flex items-baseline gap-3">
        <span
          className={`text-3xl font-bold font-mono tabular-nums ${
            hasPending ? 'text-amber-400' : 'text-truth-emerald'
          }`}
          data-testid="drafts-pending-count"
        >
          {pendingCount}
        </span>
        <span className="text-sm text-slate-500">pending review</span>
      </div>

      {hasApproved && (
        <p
          className="mt-1 text-xs text-truth-emerald"
          data-testid="drafts-approved-count"
        >
          {approvedCount} approved &amp; ready to publish
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-white/5">
          <div
            className="h-1.5 rounded-full bg-slate-500 transition-all"
            style={{
              width: `${Math.min(100, (monthlyUsed / monthlyLimit) * 100)}%`,
            }}
            data-testid="drafts-usage-bar"
          />
        </div>
        <span className="text-[10px] tabular-nums text-slate-500" data-testid="drafts-usage-text">
          {monthlyUsed}/{monthlyLimit}
        </span>
      </div>
    </Link>
  );
}
