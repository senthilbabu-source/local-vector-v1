/**
 * Org role system — LocalVector V1 (Sprint 98)
 *
 * Architecture notes (from pre-implementation diagnosis):
 *   - memberships table already exists: id, user_id (→ public.users.id), org_id, role, created_at
 *   - membership_role ENUM: 'owner' | 'admin' | 'member' | 'viewer'
 *   - organizations.owner_user_id → public.users.id
 *   - current_user_org_id() SECURITY DEFINER function drives all RLS
 *   - handle_new_user() trigger creates org + owner membership on signup
 *   - public.users.id ≠ auth.uid() — mapped via auth_provider_id
 *
 * Roles (lowest → highest privilege):
 *   viewer  — read-only. Can see dashboards, reports, download CSV/PDF.
 *             Cannot create, edit, delete, or invite.
 *   member  — same as viewer (legacy role from initial schema, treated as viewer).
 *   admin   — all viewer permissions + can invite new members (viewer/admin role),
 *             edit business info, trigger audits, publish content drafts.
 *             Cannot delete the org, remove the owner, or change billing.
 *   owner   — full control. Can do everything including billing, org deletion,
 *             removing any member, and promoting/demoting admins.
 *
 * One owner per org minimum. Owner cannot be removed if they are the last member.
 */

import type { MembershipRole } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Role hierarchy
// ---------------------------------------------------------------------------

export const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  member: 0, // legacy — treated as viewer
  admin: 1,
  owner: 2,
};

/**
 * True if currentRole meets or exceeds requiredRole in the hierarchy.
 * Unknown roles are treated as viewer (level 0) — never crashes.
 */
export function roleSatisfies(
  currentRole: string | null | undefined,
  requiredRole: string
): boolean {
  const current = ROLE_HIERARCHY[currentRole ?? ''] ?? 0;
  const required = ROLE_HIERARCHY[requiredRole] ?? 0;
  return current >= required;
}

// ---------------------------------------------------------------------------
// Role assertion
// ---------------------------------------------------------------------------

export class InsufficientRoleError extends Error {
  code = 'INSUFFICIENT_ROLE' as const;
  required: string;
  actual: string | null;

  constructor(required: string, actual: string | null) {
    super(
      `Insufficient role: required ${required}, actual ${actual ?? 'none (not a member)'}`
    );
    this.name = 'InsufficientRoleError';
    this.required = required;
    this.actual = actual;
  }
}

/**
 * Gets the current user's role in a given org.
 * Returns null if not a member.
 *
 * Uses public.users.id (not auth.uid()) since memberships reference public.users.
 */
export async function getOrgRole(
  supabase: SupabaseClient<Database>,
  orgId: string,
  publicUserId: string
): Promise<MembershipRole | null> {
  const { data } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', publicUserId)
    .maybeSingle();

  return (data?.role as MembershipRole) ?? null;
}

/**
 * Asserts the current user has at least requiredRole in the org.
 * Throws InsufficientRoleError if not.
 *
 * @param publicUserId — public.users.id (NOT auth.uid())
 */
export async function assertOrgRole(
  supabase: SupabaseClient<Database>,
  orgId: string,
  publicUserId: string,
  requiredRole: MembershipRole
): Promise<void> {
  const actual = await getOrgRole(supabase, orgId, publicUserId);

  // Non-member (null) always fails — even for viewer-level checks
  if (actual === null || !roleSatisfies(actual, requiredRole)) {
    throw new InsufficientRoleError(requiredRole, actual);
  }
}

// ---------------------------------------------------------------------------
// Permission matrix — what each action requires
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS = {
  viewDashboard: 'viewer',
  editBusinessInfo: 'admin',
  triggerAudit: 'admin',
  publishContent: 'admin',
  inviteMembers: 'admin',
  revokeInvite: 'admin',
  removeMember: 'owner',
  changeRole: 'owner',
  manageBilling: 'owner',
  deleteOrg: 'owner',
} as const satisfies Record<string, MembershipRole>;
