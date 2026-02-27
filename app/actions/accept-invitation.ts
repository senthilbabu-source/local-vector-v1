'use server';

/**
 * Accept invitation — Sprint 98
 *
 * Token-based acceptance. Uses service role client to bypass RLS
 * (the invitee is not yet an org member when accepting).
 *
 * Steps:
 * 1. Look up pending_invitations by token (service role)
 * 2. Validate: pending + not expired
 * 3. Match session user email to invitation email (case-insensitive)
 * 4. Insert into memberships (service role — bypasses RLS)
 * 5. Update pending_invitations: status='accepted', accepted_at=now()
 * 6. Revalidate dashboard path
 */

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function acceptInvitation(input: {
  token: string;
}): Promise<{ success: boolean; error?: string; orgId?: string; orgName?: string }> {
  if (!input.token || typeof input.token !== 'string') {
    return { success: false, error: 'invalid_token' };
  }

  // Get current session user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'not_authenticated' };
  }

  const serviceClient = createServiceRoleClient();

  // Step 1: Look up invitation by token (service role — no RLS)
  const { data: invitation } = await serviceClient
    .from('pending_invitations')
    .select('id, org_id, email, role, status, expires_at, invited_by')
    .eq('token', input.token)
    .maybeSingle();

  if (!invitation) {
    return { success: false, error: 'not_found' };
  }

  // Step 2: Validate status
  if (invitation.status === 'accepted') {
    return { success: false, error: 'already_accepted' };
  }
  if (invitation.status === 'revoked') {
    return { success: false, error: 'revoked' };
  }
  if (invitation.status !== 'pending') {
    return { success: false, error: 'invalid_status' };
  }

  // Check expiry
  if (new Date(invitation.expires_at) < new Date()) {
    return { success: false, error: 'expired' };
  }

  // Step 3: Match emails (case-insensitive)
  const sessionEmail = (user.email ?? '').toLowerCase();
  const inviteEmail = invitation.email.toLowerCase();
  if (sessionEmail !== inviteEmail) {
    return { success: false, error: 'email_mismatch' };
  }

  // Step 4: Resolve public user ID from auth.uid()
  const { data: publicUser } = await serviceClient
    .from('users')
    .select('id')
    .eq('auth_provider_id', user.id)
    .maybeSingle();

  if (!publicUser) {
    return { success: false, error: 'user_not_found' };
  }

  // Check if already a member (idempotency guard)
  const { data: existingMembership } = await serviceClient
    .from('memberships')
    .select('id')
    .eq('org_id', invitation.org_id)
    .eq('user_id', publicUser.id)
    .maybeSingle();

  if (existingMembership) {
    // Already a member — mark invite as accepted and return success
    await serviceClient
      .from('pending_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);
    return { success: false, error: 'already_member' };
  }

  // Step 5: Insert membership (service role — bypasses RLS)
  const { error: memberError } = await serviceClient
    .from('memberships')
    .insert({
      org_id: invitation.org_id,
      user_id: publicUser.id,
      role: invitation.role,
      invited_by: invitation.invited_by,
    });

  if (memberError) {
    return { success: false, error: memberError.message };
  }

  // Step 6: Mark invitation as accepted
  await serviceClient
    .from('pending_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  // Get org name for the success response
  const { data: org } = await serviceClient
    .from('organizations')
    .select('name')
    .eq('id', invitation.org_id)
    .maybeSingle();

  revalidatePath('/dashboard');
  return {
    success: true,
    orgId: invitation.org_id,
    orgName: org?.name ?? undefined,
  };
}
