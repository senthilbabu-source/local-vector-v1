'use server';

/**
 * Invitation server actions — Sprint 98
 *
 * All actions derive orgId from the authenticated session (AI_RULES §18).
 * Role enforcement uses assertOrgRole() from lib/auth/org-roles.ts.
 * Public user ID (public.users.id) is resolved from auth.uid() via auth_provider_id.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { roleSatisfies, ROLE_PERMISSIONS } from '@/lib/auth/org-roles';
import { planSatisfies } from '@/lib/plan-enforcer';
import { sendInvitationEmail } from '@/lib/email/send-invitation';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SendInvitationSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  role: z.enum(['admin', 'viewer']),
});

const RevokeInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

const RemoveMemberSchema = z.object({
  memberId: z.string().uuid(),
});

const UpdateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  newRole: z.enum(['admin', 'viewer']),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolvePublicUserId(authUid: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('auth_provider_id', authUid)
    .maybeSingle();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// sendInvitation
// ---------------------------------------------------------------------------

export async function sendInvitation(input: {
  email: string;
  role: 'admin' | 'viewer';
}): Promise<{ success: boolean; error?: string; invitationId?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  // Validate input
  const parsed = SendInvitationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const { email, role } = parsed.data;

  // Check caller has admin+ role
  if (!roleSatisfies(ctx.role, ROLE_PERMISSIONS.inviteMembers)) {
    return { success: false, error: 'insufficient_role' };
  }

  // Resolve public user ID for invited_by
  const publicUserId = await resolvePublicUserId(ctx.userId);
  if (!publicUserId) return { success: false, error: 'User not found' };

  const supabase = await createClient();

  // Plan gate: Agency required to have > 1 member
  const { count: memberCount } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId);

  if ((memberCount ?? 0) >= 1 && !planSatisfies(ctx.plan, 'agency')) {
    return { success: false, error: 'plan_upgrade_required' };
  }

  // Check if invitee is already a member
  const { data: existingMembers } = await supabase
    .from('memberships')
    .select('id, users!inner(email)')
    .eq('org_id', ctx.orgId);

  const alreadyMember = existingMembers?.some(
    (m: Record<string, unknown>) => {
      const users = m.users as { email: string } | null;
      return users?.email?.toLowerCase() === email;
    }
  );
  if (alreadyMember) {
    return { success: false, error: 'already_member' };
  }

  // Upsert invitation: allow re-invite if previous was revoked or expired
  const { data: existing } = await supabase
    .from('pending_invitations')
    .select('id, status')
    .eq('org_id', ctx.orgId)
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'pending') {
      return { success: false, error: 'already_invited' };
    }
    if (existing.status === 'accepted') {
      return { success: false, error: 'already_member' };
    }
    // Revoked or expired — delete old row and insert fresh (new token)
    await supabase
      .from('pending_invitations')
      .delete()
      .eq('id', existing.id);

    const { data: reinvite, error: reinsertErr } = await supabase
      .from('pending_invitations')
      .insert({
        org_id: ctx.orgId,
        email,
        role,
        invited_by: publicUserId,
      })
      .select('id, token')
      .single();

    if (reinsertErr) return { success: false, error: reinsertErr.message };

    // Send email
    try {
      await sendInvitationEmail({
        inviterName: ctx.fullName ?? ctx.email.split('@')[0],
        orgName: ctx.orgName ?? 'your team',
        role,
        email,
        token: reinvite.token,
      });
    } catch {
      await supabase
        .from('pending_invitations')
        .delete()
        .eq('id', reinvite.id);
      return { success: false, error: 'email_delivery_failed' };
    }

    revalidatePath('/dashboard/settings/team');
    return { success: true, invitationId: reinvite.id };
  }

  // New invitation
  const { data: invitation, error: insertErr } = await supabase
    .from('pending_invitations')
    .insert({
      org_id: ctx.orgId,
      email,
      role,
      invited_by: publicUserId,
    })
    .select('id, token')
    .single();

  if (insertErr) return { success: false, error: insertErr.message };

  // Send email with token for invite URL
  try {
    await sendInvitationEmail({
      inviterName: ctx.fullName ?? ctx.email.split('@')[0],
      orgName: ctx.orgName ?? 'your team',
      role,
      email,
      token: invitation.token,
    });
  } catch {
    // Clean up — delete the invitation since email failed
    await supabase
      .from('pending_invitations')
      .delete()
      .eq('id', invitation.id);
    return { success: false, error: 'email_delivery_failed' };
  }

  revalidatePath('/dashboard/settings/team');
  return { success: true, invitationId: invitation.id };
}

// ---------------------------------------------------------------------------
// revokeInvitation
// ---------------------------------------------------------------------------

export async function revokeInvitation(input: {
  invitationId: string;
}): Promise<{ success: boolean; error?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const parsed = RevokeInvitationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  if (!roleSatisfies(ctx.role, ROLE_PERMISSIONS.revokeInvite)) {
    return { success: false, error: 'insufficient_role' };
  }

  const supabase = await createClient();

  // Verify invite belongs to caller's org + is pending
  const { data: invite } = await supabase
    .from('pending_invitations')
    .select('id, status, org_id')
    .eq('id', parsed.data.invitationId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!invite) return { success: false, error: 'not_found' };
  if (invite.status !== 'pending') return { success: false, error: `cannot_revoke_${invite.status}` };

  const { error } = await supabase
    .from('pending_invitations')
    .update({ status: 'revoked' })
    .eq('id', invite.id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard/settings/team');
  return { success: true };
}

// ---------------------------------------------------------------------------
// removeMember
// ---------------------------------------------------------------------------

export async function removeMember(input: {
  memberId: string;
}): Promise<{ success: boolean; error?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const parsed = RemoveMemberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  if (!roleSatisfies(ctx.role, ROLE_PERMISSIONS.removeMember)) {
    return { success: false, error: 'insufficient_role' };
  }

  const supabase = await createClient();

  // Load the member to remove
  const { data: member } = await supabase
    .from('memberships')
    .select('id, user_id, role, org_id')
    .eq('id', parsed.data.memberId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!member) return { success: false, error: 'not_found' };

  // Cannot remove an owner (must transfer ownership first)
  if (member.role === 'owner') {
    return { success: false, error: 'cannot_remove_owner' };
  }

  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('id', member.id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard/settings/team');
  return { success: true };
}

// ---------------------------------------------------------------------------
// updateMemberRole
// ---------------------------------------------------------------------------

export async function updateMemberRole(input: {
  memberId: string;
  newRole: 'admin' | 'viewer';
}): Promise<{ success: boolean; error?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const parsed = UpdateMemberRoleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  if (!roleSatisfies(ctx.role, ROLE_PERMISSIONS.changeRole)) {
    return { success: false, error: 'insufficient_role' };
  }

  const supabase = await createClient();

  // Load the member to update
  const { data: member } = await supabase
    .from('memberships')
    .select('id, user_id, role, org_id')
    .eq('id', parsed.data.memberId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!member) return { success: false, error: 'not_found' };

  // Cannot demote an owner via this action
  if (member.role === 'owner') {
    return { success: false, error: 'cannot_demote_owner' };
  }

  const { error } = await supabase
    .from('memberships')
    .update({ role: parsed.data.newRole })
    .eq('id', member.id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard/settings/team');
  return { success: true };
}
