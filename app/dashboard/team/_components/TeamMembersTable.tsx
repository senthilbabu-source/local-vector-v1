'use client';

/**
 * TeamMembersTable — Sprint 111
 *
 * Displays org members in a table with role badges and action buttons.
 * Remove button renders but is disabled in Sprint 111 — Sprint 112 activates.
 */

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
    Sentry.captureException(err, { tags: { file: 'TeamMembersTable.tsx', sprint: '111' } });
    return '—';
  }
}

export default function TeamMembersTable({
  members,
  canRemove,
  currentUserId,
}: TeamMembersTableProps) {
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
                      onClick={() => alert('Remove member coming in next update')}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
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
