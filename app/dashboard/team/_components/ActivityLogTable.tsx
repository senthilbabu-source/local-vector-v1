'use client';

/**
 * ActivityLogTable — Sprint 113
 *
 * Paginated audit log table for /dashboard/billing and /dashboard/team.
 * Fetches from GET /api/team/activity.
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import type { ActivityLogPage, ActivityLogEntry } from '@/lib/billing/types';

const EVENT_LABELS: Record<string, string> = {
  member_invited: 'Invitation sent',
  member_joined: 'Member joined',
  member_removed: 'Member removed',
  invitation_revoked: 'Invitation revoked',
  role_changed: 'Role changed',
  seat_sync: 'Seat sync',
  member_left: 'Member left',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SyncBadge({ entry }: { entry: ActivityLogEntry }) {
  if (entry.event_type !== 'seat_sync') return null;
  const success = (entry.metadata as Record<string, unknown>).success;
  if (success) {
    return <span className="ml-1 rounded bg-truth-emerald/15 px-1.5 py-0.5 text-truth-emerald">OK</span>;
  }
  return <span className="ml-1 rounded bg-alert-crimson/15 px-1.5 py-0.5 text-alert-crimson">Failed</span>;
}

export default function ActivityLogTable() {
  const [data, setData] = useState<ActivityLogPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/activity?page=${p}&per_page=20`);
      if (res.status === 403) {
        setError(true);
        setLoading(false);
        return;
      }
      const json: ActivityLogPage = await res.json();
      setData(json);
      setPage(p);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'ActivityLogTable', sprint: '113' } });
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  // Insufficient role or plan gate
  if (error) {
    return (
      <div data-testid="activity-log-table" className="rounded-2xl border border-white/5 bg-surface-dark p-6">
        <p className="text-sm text-slate-400 text-center">
          Activity log is available to Agency plan owners and admins.
        </p>
      </div>
    );
  }

  // Loading skeleton
  if (loading && !data) {
    return (
      <div data-testid="activity-log-table" className="rounded-2xl border border-white/5 bg-surface-dark p-6 animate-pulse">
        <div className="h-5 w-32 rounded bg-slate-700 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Empty state
  if (data.entries.length === 0 && data.total === 0) {
    return (
      <div data-testid="activity-log-table" className="rounded-2xl border border-white/5 bg-surface-dark p-6">
        <h3 className="text-sm font-semibold text-white mb-3">Activity Log</h3>
        <p data-testid="activity-log-empty" className="text-sm text-slate-400 text-center py-4">
          No membership activity yet.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / data.per_page);

  return (
    <div data-testid="activity-log-table" className="rounded-2xl border border-white/5 bg-surface-dark p-6 space-y-4">
      <h3 className="text-sm font-semibold text-white">Activity Log</h3>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-white/5 text-slate-500">
              <th className="pb-2 pr-4 font-medium">Date</th>
              <th className="pb-2 pr-4 font-medium">Event</th>
              <th className="pb-2 pr-4 font-medium">Actor</th>
              <th className="pb-2 pr-4 font-medium">Target</th>
              <th className="pb-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry) => (
              <tr
                key={entry.id}
                data-testid={`activity-log-row-${entry.id}`}
                className="border-b border-white/5"
              >
                <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">
                  {formatDate(entry.created_at)}
                </td>
                <td className="py-2 pr-4 text-slate-300">
                  {EVENT_LABELS[entry.event_type] ?? entry.event_type}
                  <SyncBadge entry={entry} />
                </td>
                <td className="py-2 pr-4 text-slate-400">
                  {entry.actor_email ?? 'System'}
                </td>
                <td className="py-2 pr-4 text-slate-300">
                  {entry.target_email}
                </td>
                <td className="py-2 text-slate-400">
                  {entry.target_role ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
        <button
          data-testid="activity-log-prev-btn"
          onClick={() => fetchPage(page - 1)}
          disabled={page <= 1 || loading}
          className="flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:text-white transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </button>

        <span>
          Page {page} of {totalPages}
        </span>

        <button
          data-testid="activity-log-next-btn"
          onClick={() => fetchPage(page + 1)}
          disabled={!data.has_more || loading}
          className="flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:text-white transition"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
