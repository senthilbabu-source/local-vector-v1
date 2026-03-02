/**
 * Invitation Service — Sprint 112
 *
 * Pure functions that wrap the `pending_invitations` table.
 * Caller always passes the Supabase client.
 *
 * Token security: crypto.getRandomValues() only. Never Math.random().
 * Token never returned in API responses — only sent via invite email URL.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  OrgInvitationSafe,
  OrgInvitationDisplay,
  InvitePayload,
  AcceptInvitePayload,
  InvitationValidation,
} from './types';
import { INVITATION_EXPIRY_DAYS, INVITATION_TOKEN_BYTES } from './types';
import { MembershipError } from '@/lib/membership/membership-service';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// generateSecureToken — pure, no API calls
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random 64-character hex token.
 * Uses crypto.getRandomValues() — available in Node.js 18+ and Vercel Edge.
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(INVITATION_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// softExpireInvitations — housekeeping
// ---------------------------------------------------------------------------

/**
 * Marks expired pending invitations. Called at the top of reads/validates.
 * No separate cron needed.
 */
async function softExpireInvitations(
  supabase: SupabaseClient<Database>,
  orgId?: string
): Promise<void> {
  const query = supabase
    .from('pending_invitations')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  if (orgId) {
    query.eq('org_id', orgId);
  }

  await query;
}

// ---------------------------------------------------------------------------
// sendInvitation
// ---------------------------------------------------------------------------

/**
 * Creates an invitation and returns a safe version (no token).
 *
 * Guards:
 * 1. Normalize email
 * 2. canAddMember seat check
 * 3. Not already a member
 * 4. No pending invitation for this email
 * 5. Generate token + INSERT
 * 6. Return OrgInvitationSafe
 */
export async function sendInvitation(
  supabase: SupabaseClient<Database>,
  orgId: string,
  invitedByUserId: string,
  payload: InvitePayload
): Promise<{ invitation: OrgInvitationSafe; token: string }> {
  // 1. Normalize
  const email = payload.email.toLowerCase().trim();

  // 2. Seat limit check
  const { data: org } = await supabase
    .from('organizations')
    .select('plan, seat_count, name')
    .eq('id', orgId)
    .single();

  if (!org) {
    throw new MembershipError('org_not_found', 'Organization not found.');
  }

  const { SEAT_LIMITS } = await import('@/lib/membership/types');
  const max = SEAT_LIMITS[org.plan ?? 'trial'] ?? 1;
  const current = org.seat_count ?? 1;
  if (max !== null && current >= max) {
    throw new MembershipError('seat_limit_reached', 'Seat limit reached for this plan.');
  }

  // 3. Check if already a member (two-step: find user → check membership)
  const { data: usersByEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', email);

  const userIds = (usersByEmail ?? []).map((u) => u.id);

  if (userIds.length > 0) {
    const { data: existingMember } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userIds[0])
      .maybeSingle();

    if (existingMember) {
      throw new MembershipError('already_member', `${email} is already a member of this organization.`);
    }
  }

  // 4. Check for existing pending invitation
  const { data: existingInvite } = await supabase
    .from('pending_invitations')
    .select('id, expires_at')
    .eq('org_id', orgId)
    .eq('email', email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingInvite) {
    throw new MembershipError(
      'invitation_already_pending',
      `An invitation is already pending for ${email}.`
    );
  }

  // 5. Generate token and INSERT
  const token = generateSecureToken();
  const expiresAt = new Date(
    Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: invitation, error: insertError } = await supabase
    .from('pending_invitations')
    .insert({
      org_id: orgId,
      email,
      role: payload.role,
      token,
      invited_by: invitedByUserId,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError || !invitation) {
    // Handle unique constraint violation (race condition)
    if (insertError?.code === '23505') {
      throw new MembershipError(
        'invitation_already_pending',
        `An invitation is already pending for ${email}.`
      );
    }
    throw new MembershipError('insert_failed', insertError?.message ?? 'Failed to create invitation.');
  }

  // Return safe version (no token in the invitation object) + token separately for email URL
  const safe: OrgInvitationSafe = {
    id: invitation.id,
    org_id: invitation.org_id,
    email: invitation.email,
    role: invitation.role as OrgInvitationSafe['role'],
    invited_by: invitation.invited_by,
    status: invitation.status as OrgInvitationSafe['status'],
    expires_at: invitation.expires_at,
    accepted_at: invitation.accepted_at,
    created_at: invitation.created_at,
  };

  return { invitation: safe, token };
}

// ---------------------------------------------------------------------------
// getOrgInvitations
// ---------------------------------------------------------------------------

/**
 * Returns all pending invitations for an org.
 * Soft-expires stale invitations first.
 */
export async function getOrgInvitations(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<OrgInvitationSafe[]> {
  // Soft-expire stale invitations
  await softExpireInvitations(supabase, orgId);

  const { data, error } = await supabase
    .from('pending_invitations')
    .select('id, org_id, email, role, invited_by, status, expires_at, accepted_at, created_at')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    org_id: row.org_id,
    email: row.email,
    role: row.role as OrgInvitationSafe['role'],
    invited_by: row.invited_by,
    status: row.status as OrgInvitationSafe['status'],
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    created_at: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// revokeInvitation
// ---------------------------------------------------------------------------

/**
 * Revokes a pending invitation.
 */
export async function revokeInvitation(
  supabase: SupabaseClient<Database>,
  invitationId: string,
  orgId: string
): Promise<{ success: true }> {
  const { data: invitation, error: fetchError } = await supabase
    .from('pending_invitations')
    .select('id, status')
    .eq('id', invitationId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (fetchError || !invitation) {
    throw new MembershipError('invitation_not_found', 'Invitation not found.');
  }

  if (invitation.status !== 'pending') {
    throw new MembershipError(
      'invitation_not_revocable',
      `Cannot revoke an invitation with status "${invitation.status}".`
    );
  }

  const { error: updateError } = await supabase
    .from('pending_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);

  if (updateError) {
    throw new MembershipError('update_failed', updateError.message);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// validateToken
// ---------------------------------------------------------------------------

/**
 * Validates an invitation token. Uses service role client (public route).
 * Token is the authentication mechanism — never expose in responses.
 */
export async function validateToken(
  supabase: SupabaseClient<Database>,
  token: string
): Promise<InvitationValidation> {
  // Soft-expire stale invitations
  await softExpireInvitations(supabase);

  const { data: invitation, error } = await supabase
    .from('pending_invitations')
    .select('id, org_id, email, role, invited_by, status, expires_at, accepted_at, created_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !invitation) {
    return { valid: false, invitation: null, error: 'not_found', existing_user: false };
  }

  if (invitation.status === 'expired') {
    return { valid: false, invitation: null, error: 'expired', existing_user: false };
  }

  if (invitation.status === 'accepted') {
    return { valid: false, invitation: null, error: 'already_accepted', existing_user: false };
  }

  if (invitation.status === 'revoked') {
    return { valid: false, invitation: null, error: 'revoked', existing_user: false };
  }

  // Check if expires_at has passed (safety check beyond soft-expire)
  if (new Date(invitation.expires_at) < new Date()) {
    // Mark as expired
    await supabase
      .from('pending_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id);
    return { valid: false, invitation: null, error: 'expired', existing_user: false };
  }

  // Fetch org name and inviter name for display
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', invitation.org_id)
    .single();

  const { data: inviter } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', invitation.invited_by)
    .single();

  // Check if invitee already has a LocalVector account
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', invitation.email)
    .maybeSingle();

  const display: OrgInvitationDisplay = {
    id: invitation.id,
    org_id: invitation.org_id,
    email: invitation.email,
    role: invitation.role as OrgInvitationDisplay['role'],
    invited_by: invitation.invited_by,
    status: invitation.status as OrgInvitationDisplay['status'],
    expires_at: invitation.expires_at,
    accepted_at: invitation.accepted_at,
    created_at: invitation.created_at,
    org_name: org?.name ?? 'Unknown Organization',
    invited_by_name: inviter?.full_name ?? inviter?.email ?? 'A team member',
  };

  return {
    valid: true,
    invitation: display,
    error: null,
    existing_user: !!existingUser,
  };
}

// ---------------------------------------------------------------------------
// acceptInvitation
// ---------------------------------------------------------------------------

/**
 * Accepts an invitation. Uses service role client (public route, new users have no session).
 *
 * For new users: creates a Supabase auth user + public.users row, then enrolls.
 * For existing users: just enrolls in the org.
 */
export async function acceptInvitation(
  supabase: SupabaseClient<Database>,
  token: string,
  payload: AcceptInvitePayload
): Promise<{ success: true; org_name: string; role: string }> {
  // 1. Validate token
  const validation = await validateToken(supabase, token);
  if (!validation.valid || !validation.invitation) {
    throw new MembershipError(
      validation.error ?? 'not_found',
      `Invitation is ${validation.error ?? 'invalid'}.`
    );
  }

  const invitation = validation.invitation;

  // 2. Handle new user creation
  let userId: string;

  if (!validation.existing_user) {
    // New user — require password
    if (!payload.password) {
      throw new MembershipError('password_required', 'Password is required for new accounts.');
    }
    if (payload.password.length < 8) {
      throw new MembershipError('password_too_short', 'Password must be at least 8 characters.');
    }

    // Create auth user (auto-confirmed — they clicked the invite link)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password: payload.password,
      user_metadata: { full_name: payload.full_name ?? '' },
      email_confirm: true,
    });

    if (authError || !authData.user) {
      Sentry.captureException(authError, { tags: { sprint: '112', action: 'createUser' } });
      throw new MembershipError(
        'user_creation_failed',
        authError?.message ?? 'Failed to create user account.'
      );
    }

    // The on_auth_user_created trigger creates public.users + org + membership automatically.
    // We need to find the public.users.id that was created.
    // Poll briefly for the trigger to fire.
    let publicUserId: string | null = null;
    for (let i = 0; i < 10; i++) {
      const { data: publicUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_provider_id', authData.user.id)
        .maybeSingle();

      if (publicUser) {
        publicUserId = publicUser.id;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!publicUserId) {
      throw new MembershipError('user_creation_failed', 'User trigger did not complete in time.');
    }

    userId = publicUserId;

    // Delete the auto-created membership and org from the trigger
    // (user should join the invited org, not a new one)
    const { data: autoMembership } = await supabase
      .from('memberships')
      .select('id, org_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (autoMembership && autoMembership.org_id !== invitation.org_id) {
      // Delete auto-created org and membership
      await supabase.from('memberships').delete().eq('id', autoMembership.id);
      await supabase.from('organizations').delete().eq('id', autoMembership.org_id);
    }
  } else {
    // Existing user — find their public.users.id
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', invitation.email)
      .single();

    if (!existingUser) {
      throw new MembershipError('user_not_found', 'Could not find user account.');
    }

    userId = existingUser.id;
  }

  // 3. Race condition guard — check if already a member
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('org_id', invitation.org_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existingMembership) {
    // 4. Enroll in org
    const { error: enrollError } = await supabase.from('memberships').insert({
      org_id: invitation.org_id,
      user_id: userId,
      role: invitation.role,
      invited_by: invitation.invited_by,
    });

    if (enrollError) {
      Sentry.captureException(enrollError, { tags: { sprint: '112', action: 'enrollMember' } });
      throw new MembershipError('enroll_failed', enrollError.message);
    }
  }

  // 5. Mark invitation as accepted
  await supabase
    .from('pending_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('token', token);

  return {
    success: true,
    org_name: invitation.org_name,
    role: invitation.role,
  };
}
