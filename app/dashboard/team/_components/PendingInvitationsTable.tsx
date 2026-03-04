'use client';

/**
 * PendingInvitationsTable — Sprint 112
 *
 * Shows pending invitations below the team members table.
 * Only visible to owner/admin. Hidden when no pending invitations.
 */

import { useState } from 'react';
import type { OrgInvitationSafe } from '@/lib/invitations/types';
import * as Sentry from '@sentry/nextjs';

interface PendingInvitationsTableProps {
  invitations: OrgInvitationSafe[];
}

function formatExpiry(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'PendingInvitationsTable.tsx', sprint: '112' } });
    return '—';
  }
}

function capitalizeRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function PendingInvitationsTable({ invitations: initialInvitations }: PendingInvitationsTableProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [revoking, setRevoking] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function handleRevoke(invitationId: string) {
    setRevoking(invitationId);

    try {
      const res = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Optimistic update — remove row
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { action: 'revokeInvitation', sprint: '112' } });
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-400">Pending Invitations</h3>

      <div
        data-testid="pending-invitations-table"
        className="rounded-xl border border-white/5 bg-surface-dark overflow-x-auto"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-xs font-medium uppercase tracking-wider text-slate-400">
              <th scope="col" className="px-5 py-3 text-left">Email</th>
              <th scope="col" className="px-3 py-3 text-left">Role</th>
              <th scope="col" className="hidden sm:table-cell px-3 py-3 text-left">Invited By</th>
              <th scope="col" className="hidden sm:table-cell px-3 py-3 text-left">Expires</th>
              <th scope="col" className="w-16 px-3 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {invitations.map((inv) => (
              <tr
                key={inv.id}
                data-testid={`pending-invite-row-${inv.id}`}
              >
                <td className="px-5 py-3 text-sm text-slate-300 truncate">{inv.email}</td>
                <td className="px-3 py-3 text-xs text-slate-400">{capitalizeRole(inv.role)}</td>
                <td className="hidden sm:table-cell px-3 py-3 text-xs text-slate-400 truncate max-w-[120px]">
                  {inv.invited_by}
                </td>
                <td className="hidden sm:table-cell px-3 py-3 text-xs text-slate-400">
                  {formatExpiry(inv.expires_at)}
                </td>
                <td className="w-16 px-3 py-3 text-right">
                  <button
                    data-testid={`revoke-invite-${inv.id}`}
                    onClick={() => handleRevoke(inv.id)}
                    disabled={revoking === inv.id}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {revoking === inv.id ? 'Revoking...' : 'Revoke'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
