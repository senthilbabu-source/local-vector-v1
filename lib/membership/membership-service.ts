/**
 * Membership Service — Sprint 111
 *
 * Pure functions that wrap the existing `memberships` table.
 * Caller always passes the Supabase client — never creates its own.
 * This allows the same functions to work with:
 *   - RLS-scoped client (dashboard server components)
 *   - Service role client (cron routes, API routes that need auth.users JOIN)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  ROLE_ORDER,
  ROLE_PERMISSIONS,
  SEAT_LIMITS,
  type MemberRole,
  type OrgMember,
  type MembershipContext,
} from './types';
import { logMemberRemoved } from '@/lib/billing/activity-log-service';
import { syncSeatsToStripe } from '@/lib/billing/seat-billing-service';

// ---------------------------------------------------------------------------
// getOrgMembers
// ---------------------------------------------------------------------------

/**
 * Returns all members of an org, sorted: owner first, then admin, analyst, viewer.
 * Within each role group, sorted by joined_at ascending.
 *
 * Uses service role client to JOIN users table for email/full_name.
 */
export async function getOrgMembers(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select(`
      id,
      org_id,
      user_id,
      role,
      joined_at,
      created_at,
      users!user_id (
        id,
        email,
        full_name
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  const members: OrgMember[] = data.map((row) => {
    const user = row.users as { id: string; email: string; full_name: string | null } | null;
    return {
      id: row.id,
      org_id: row.org_id,
      user_id: user?.id ?? row.user_id,
      role: row.role ?? 'viewer',
      joined_at: row.joined_at ?? row.created_at ?? '',
      email: user?.email ?? '',
      full_name: user?.full_name ?? null,
    };
  });

  // Sort by role order, then by joined_at within each role
  members.sort((a, b) => {
    const roleA = ROLE_ORDER[a.role] ?? 99;
    const roleB = ROLE_ORDER[b.role] ?? 99;
    if (roleA !== roleB) return roleA - roleB;
    return a.joined_at.localeCompare(b.joined_at);
  });

  return members;
}

// ---------------------------------------------------------------------------
// getCallerMembership
// ---------------------------------------------------------------------------

/**
 * Returns the calling user's membership context.
 * Returns null if the user has no membership (should not happen post-backfill).
 *
 * @param publicUserId — public.users.id (NOT auth.uid())
 */
export async function getCallerMembership(
  supabase: SupabaseClient<Database>,
  publicUserId: string
): Promise<MembershipContext | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, org_id, user_id, role')
    .eq('user_id', publicUserId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const role = (data.role ?? 'viewer') as MemberRole;
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer;

  return {
    member_id: data.id,
    user_id: data.user_id,
    org_id: data.org_id,
    role,
    permissions,
  };
}

// ---------------------------------------------------------------------------
// getMemberById
// ---------------------------------------------------------------------------

/**
 * Returns a single member by their membership ID.
 * RLS already enforces org isolation via current_user_org_id().
 */
export async function getMemberById(
  supabase: SupabaseClient<Database>,
  memberId: string
): Promise<OrgMember | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select(`
      id,
      org_id,
      user_id,
      role,
      joined_at,
      created_at,
      users!user_id (
        id,
        email,
        full_name
      )
    `)
    .eq('id', memberId)
    .maybeSingle();

  if (error || !data) return null;

  const user = data.users as { id: string; email: string; full_name: string | null } | null;
  return {
    id: data.id,
    org_id: data.org_id,
    user_id: user?.id ?? data.user_id,
    role: data.role ?? 'viewer',
    joined_at: data.joined_at ?? data.created_at ?? '',
    email: user?.email ?? '',
    full_name: user?.full_name ?? null,
  };
}

// ---------------------------------------------------------------------------
// removeMember
// ---------------------------------------------------------------------------

export class MembershipError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'MembershipError';
    this.code = code;
  }
}

/**
 * Removes a member from the org.
 *
 * Application-level guards:
 * 1. Member must exist → throws 'member_not_found'
 * 2. Cannot remove an owner → throws 'cannot_remove_owner'
 * 3. Deletes the membership row
 */
export async function removeMember(
  supabase: SupabaseClient<Database>,
  memberId: string,
  callerOrgId: string,
  callerContext?: { userId: string; email: string }
): Promise<{ success: true }> {
  // 1. Fetch the target member (including user info for audit log)
  const { data: member, error: fetchError } = await supabase
    .from('memberships')
    .select('id, role, org_id, user_id, users!user_id ( email )')
    .eq('id', memberId)
    .eq('org_id', callerOrgId)
    .maybeSingle();

  if (fetchError || !member) {
    throw new MembershipError('member_not_found', 'Member not found in this organization.');
  }

  // 2. Cannot remove owner
  if (member.role === 'owner') {
    throw new MembershipError('cannot_remove_owner', 'Cannot remove the organization owner.');
  }

  // 3. Delete the membership
  const { error: deleteError } = await supabase
    .from('memberships')
    .delete()
    .eq('id', member.id);

  if (deleteError) {
    throw new MembershipError('delete_failed', deleteError.message);
  }

  // Sprint 113: fire-and-forget audit log + seat sync
  const targetUser = member.users as { email: string } | null;
  const { data: updatedOrg } = await supabase
    .from('organizations')
    .select('seat_count')
    .eq('id', callerOrgId)
    .single();

  void syncSeatsToStripe(supabase, callerOrgId, updatedOrg?.seat_count ?? 1);
  void logMemberRemoved(supabase, {
    orgId: callerOrgId,
    actorUserId: callerContext?.userId ?? '',
    actorEmail: callerContext?.email ?? '',
    targetUserId: member.user_id,
    targetEmail: targetUser?.email ?? '',
    targetRole: (member.role ?? 'viewer') as MemberRole,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// canAddMemberCheck
// ---------------------------------------------------------------------------

/**
 * Checks whether the org can add another member, based on current count and plan limits.
 *
 * @returns { allowed, current, max }
 */
export async function canAddMemberCheck(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<{ allowed: boolean; current: number; max: number | null }> {
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('plan, seat_count')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    return { allowed: false, current: 0, max: 1 };
  }

  const planTier = org.plan ?? 'trial';
  const current = org.seat_count ?? 1;
  const max = SEAT_LIMITS[planTier] ?? 1;

  if (max === null) {
    return { allowed: true, current, max: null };
  }

  return { allowed: current < max, current, max };
}
