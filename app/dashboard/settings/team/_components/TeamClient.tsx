'use client';

import { useState, useTransition } from 'react';
import {
  sendInvitation,
  revokeInvitation,
  removeMember,
  updateMemberRole,
} from '@/app/actions/invitations';
import { planSatisfies } from '@/lib/plan-enforcer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Member {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  inviter_name: string | null;
}

interface TeamClientProps {
  members: Member[];
  pendingInvitations: PendingInvitation[];
  canManageInvites: boolean;
  canChangeRoles: boolean;
  canRemoveMembers: boolean;
  currentPlan: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamClient({
  members,
  pendingInvitations: initialInvitations,
  canManageInvites,
  canChangeRoles,
  canRemoveMembers,
  currentPlan,
}: TeamClientProps) {
  const [isPending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'viewer'>('viewer');
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState(initialInvitations);

  const isAgency = planSatisfies(currentPlan, 'agency');

  function handleInvite() {
    setInviteMessage(null);
    startTransition(async () => {
      const result = await sendInvitation({ email: inviteEmail, role: inviteRole });
      if (result.success) {
        setInviteMessage({ type: 'success', text: `Invitation sent to ${inviteEmail}` });
        setInviteEmail('');
        // Refresh will happen via revalidatePath
      } else {
        const messages: Record<string, string> = {
          insufficient_role: 'You do not have permission to invite members.',
          already_member: 'This person is already a team member.',
          already_invited: 'An invitation is already pending for this email.',
          plan_upgrade_required: 'Upgrade to Agency plan to invite team members.',
          seat_limit_reached: 'All seats are in use. Add more seats in Billing to invite new members.',
          email_delivery_failed: 'Failed to send the invitation email. Please try again.',
        };
        setInviteMessage({ type: 'error', text: messages[result.error ?? ''] ?? result.error ?? 'Failed to send invitation' });
      }
    });
  }

  function handleRevoke(invitationId: string) {
    startTransition(async () => {
      const result = await revokeInvitation({ invitationId });
      if (result.success) {
        setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    });
  }

  function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this member from the team?')) return;
    startTransition(async () => {
      await removeMember({ memberId });
    });
  }

  function handleRoleChange(memberId: string, newRole: 'admin' | 'viewer') {
    startTransition(async () => {
      await updateMemberRole({ memberId, newRole });
    });
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  function roleBadgeColor(role: string) {
    switch (role) {
      case 'owner':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'admin':
        return 'bg-electric-indigo/10 text-electric-indigo';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Members Table ────────────────────────────────────────── */}
      <div
        data-testid="team-members-table"
        className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-medium text-white">Members</h3>
        </div>
        <div className="divide-y divide-slate-700/50">
          {members.map((m) => (
            <div
              key={m.id}
              data-testid={`member-row-${m.userId}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* Avatar */}
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 overflow-hidden">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (m.fullName ?? m.email).charAt(0).toUpperCase()
                )}
              </div>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {m.fullName ?? m.email.split('@')[0]}
                </p>
                <p className="text-xs text-slate-400 truncate">{m.email}</p>
              </div>

              {/* Role badge */}
              <span
                data-testid={`member-role-${m.userId}`}
                className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${roleBadgeColor(m.role)}`}
              >
                {m.role}
              </span>

              {/* Joined date */}
              <span className="shrink-0 text-xs text-slate-500 hidden sm:block w-24 text-right">
                {formatDate(m.joinedAt)}
              </span>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-2">
                {canChangeRoles && m.role !== 'owner' && (
                  <select
                    data-testid={`member-role-select-${m.userId}`}
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as 'admin' | 'viewer')}
                    disabled={isPending}
                    className="text-xs bg-slate-700 text-slate-300 border border-slate-600 rounded px-1.5 py-0.5"
                  >
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                )}
                {canRemoveMembers && m.role !== 'owner' && (
                  <button
                    data-testid={`member-remove-btn-${m.userId}`}
                    onClick={() => handleRemoveMember(m.id)}
                    disabled={isPending}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pending Invitations ──────────────────────────────────── */}
      {canManageInvites && pendingInvitations.length > 0 && (
        <div
          data-testid="pending-invitations-table"
          className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-white">Pending Invitations</h3>
          </div>
          <div className="divide-y divide-slate-700/50">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                data-testid={`invitation-row-${inv.id}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{inv.email}</p>
                  <p className="text-xs text-slate-400">
                    Invited by {inv.inviter_name ?? 'team member'} · Expires {formatDate(inv.expires_at)}
                  </p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${roleBadgeColor(inv.role)}`}>
                  {inv.role}
                </span>
                <button
                  data-testid={`invitation-revoke-btn-${inv.id}`}
                  onClick={() => handleRevoke(inv.id)}
                  disabled={isPending}
                  className="shrink-0 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Invite Form (only for Agency plan) ───────────────────── */}
      {canManageInvites && isAgency && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-4">
          <h3 className="text-sm font-medium text-white">Invite New Member</h3>

          <div className="flex gap-3">
            <input
              data-testid="invite-email-input"
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-electric-indigo"
            />
            <select
              data-testid="invite-role-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'viewer')}
              className="w-28 rounded-lg bg-slate-900 border border-slate-600 px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-electric-indigo"
            >
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button
              data-testid="invite-send-btn"
              onClick={handleInvite}
              disabled={isPending || !inviteEmail}
              className="px-4 py-2 rounded-lg bg-electric-indigo text-white text-sm font-medium hover:bg-electric-indigo/90 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isPending ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>

          {inviteMessage?.type === 'success' && (
            <p
              data-testid="invite-success-message"
              className="text-xs text-green-400"
            >
              {inviteMessage.text}
            </p>
          )}
          {inviteMessage?.type === 'error' && (
            <p
              data-testid="invite-error-message"
              className="text-xs text-red-400"
            >
              {inviteMessage.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
