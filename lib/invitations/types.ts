/**
 * Org Invitation Types — Sprint 112
 *
 * Types for the invitation lifecycle: send → accept → decline → expire.
 * Uses the existing `pending_invitations` table in the DB.
 */

import type { MemberRole } from '@/lib/membership/types';

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

// ---------------------------------------------------------------------------
// DB row shape (matches pending_invitations table)
// ---------------------------------------------------------------------------

export interface OrgInvitation {
  id: string;
  org_id: string;
  email: string;              // lowercase, trimmed
  role: Exclude<MemberRole, 'owner'>; // cannot invite as owner
  token: string;              // 64-char hex — NEVER exposed to clients
  invited_by: string;         // public.users.id of inviter
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Safe version — token NEVER sent to clients
// ---------------------------------------------------------------------------

export type OrgInvitationSafe = Omit<OrgInvitation, 'token'>;

// ---------------------------------------------------------------------------
// Denormalized invitation (for email and UI display)
// ---------------------------------------------------------------------------

export interface OrgInvitationDisplay extends OrgInvitationSafe {
  org_name: string;
  invited_by_name: string;
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export interface InvitePayload {
  email: string;
  role: Exclude<MemberRole, 'owner'>;
}

export interface AcceptInvitePayload {
  full_name?: string;
  password?: string;
}

// ---------------------------------------------------------------------------
// Validation result (returned by validateToken)
// ---------------------------------------------------------------------------

export interface InvitationValidation {
  valid: boolean;
  invitation: OrgInvitationDisplay | null;
  error: 'not_found' | 'expired' | 'already_accepted' | 'revoked' | null;
  existing_user: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INVITATION_EXPIRY_DAYS = 7;
export const INVITATION_TOKEN_BYTES = 32; // 32 bytes → 64 hex chars
