'use client';

/**
 * TeamMembersTable — Sprint 111 → Sprint 112
 *
 * Displays org members in a table with role badges and action buttons.
 * Sprint 112: Remove button activated with confirmation + API call.
 */

import { useState } from 'react';
import type { OrgMember } from '@/lib/membership/types';
import RoleBadge from './RoleBadge';
import * as Sentry from '@sentry/nextjs';

interface TeamMembersTableProps {
  members: OrgMember[];
  canRemove: boolean;
  currentUserId: string;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'TeamMembersTable.tsx', sprint: '112' } });
    return '—';
  }
}

export default function TeamMembersTable({
  members: initialMembers,
  canRemove,
  currentUserId,
}: TeamMembersTableProps) {
  const [members, setMembers] = useState(initialMembers);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(member: OrgMember) {
    const displayName = member.full_name ?? member.email;
    const confirmed = window.confirm(
      `Remove ${displayName} from the organization? They will lose access immediately.`
    );
    if (!confirmed) return;

    setRemoving(member.id);
    try {
      const res = await fetch(`/api/team/members/${member.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Optimistic update — remove row
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { action: 'removeMember', sprint: '112' } });
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div
      data-testid="team-members-table"
      className="rounded-xl border border-white/5 bg-surface-dark overflow-hidden"
    >
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-5 py-3 border-b border-white/5 text-xs font-medium uppercase tracking-wider text-slate-500">
        <span>Name</span>
        <span>Email</span>
        <span>Role</span>
        <span className="hidden sm:block">Joined</span>
        {canRemove && <span className="w-16" />}
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {members.map((m) => {
          const isOwner = m.role === 'owner';
          const isSelf = m.user_id === currentUserId;
          const showRemove = canRemove && !isOwner && !isSelf;

          return (
            <div
              key={m.id}
              data-testid={`member-row-${m.user_id}`}
              className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center px-5 py-3"
            >
              {/* Name */}
              <span className="text-sm font-medium text-white truncate">
                {m.full_name ?? m.email.split('@')[0]}
                {isSelf && (
                  <span className="ml-1.5 text-xs text-slate-500">(you)</span>
                )}
              </span>

              {/* Email */}
              <span className="text-sm text-slate-400 truncate">{m.email}</span>

              {/* Role */}
              <RoleBadge role={m.role} data-testid={`role-badge-${m.user_id}`} />

              {/* Joined */}
              <span className="hidden sm:block text-xs text-slate-500 w-20 text-right">
                {formatDate(m.joined_at)}
              </span>

              {/* Actions */}
              {canRemove && (
                <div className="w-16 text-right">
                  {showRemove && (
                    <button
                      data-testid={`remove-member-${m.user_id}`}
                      onClick={() => handleRemove(m)}
                      disabled={removing === m.id}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      {removing === m.id ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
