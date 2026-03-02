'use client';

/**
 * TeamPageClient — Sprint 112
 *
 * Client wrapper for the team page's interactive elements:
 * - Invite Member button + modal
 * - Pending invitations table
 * - Seat progress bar
 */

import { useState, useCallback, type ReactNode } from 'react';
import type { OrgInvitationSafe } from '@/lib/invitations/types';
import InviteMemberModal from './InviteMemberModal';
import PendingInvitationsTable from './PendingInvitationsTable';

interface TeamPageClientProps {
  canAdd: boolean;
  isAdminOrOwner: boolean;
  seatCount: number;
  maxSeats: number;
  barColor: string;
  seatPercent: number;
  pendingInvitations: OrgInvitationSafe[];
  children: ReactNode; // The member table or empty state
}

export default function TeamPageClient({
  canAdd,
  isAdminOrOwner,
  seatCount,
  maxSeats,
  barColor,
  seatPercent,
  pendingInvitations,
  children,
}: TeamPageClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [invitations, setInvitations] = useState(pendingInvitations);

  const handleInviteSent = useCallback(() => {
    // Refresh invitations by fetching from API
    fetch('/api/team/invitations')
      .then((res) => res.json())
      .then((data) => {
        if (data.invitations) setInvitations(data.invitations);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Team Members</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Manage team members and roles.
          </p>
        </div>
        {isAdminOrOwner && (
          <button
            data-testid="invite-member-btn"
            onClick={() => setModalOpen(true)}
            disabled={!canAdd}
            className={`inline-flex items-center gap-2 rounded-lg bg-electric-indigo px-4 py-2 text-sm font-medium text-white transition-colors ${
              canAdd
                ? 'hover:bg-electric-indigo/90'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            Invite Member
          </button>
        )}
      </div>

      {/* Seat progress bar */}
      <div data-testid="seat-progress-bar" className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Seats</span>
          <span>
            {seatCount} / {maxSeats}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(seatPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Member table or empty state (passed as children) */}
      {children}

      {/* Pending invitations */}
      {isAdminOrOwner && (
        <PendingInvitationsTable invitations={invitations} />
      )}

      {/* Invite modal */}
      <InviteMemberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onInviteSent={handleInviteSent}
      />
    </>
  );
}
