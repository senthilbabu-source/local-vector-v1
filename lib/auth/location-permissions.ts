// ---------------------------------------------------------------------------
// lib/auth/location-permissions.ts — Location-level permission resolution
//
// Permission hierarchy:
//   1. Owner → full access to all locations (no location_permissions row needed)
//   2. If location_permissions row exists → use location-specific role
//   3. If no row → fall back to org-level role from memberships
//
// Location permissions CANNOT elevate above org role:
//   resolved role = min(org_role, location_role)
//
// Sprint 99 — Per-Location Permissions
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { MembershipRole } from '@/lib/auth';
import { ROLE_HIERARCHY, roleSatisfies } from './org-roles';

export class InsufficientLocationRoleError extends Error {
  code = 'INSUFFICIENT_LOCATION_ROLE' as const;
  locationId: string;
  required: string;
  actual: string | null;

  constructor(locationId: string, required: string, actual: string | null) {
    super(
      `Insufficient location role on ${locationId}: required ${required}, actual ${actual ?? 'none'}`
    );
    this.name = 'InsufficientLocationRoleError';
    this.locationId = locationId;
    this.required = required;
    this.actual = actual;
  }
}

/**
 * Returns the minimum of two roles (most restrictive).
 */
function minRole(
  a: MembershipRole,
  b: MembershipRole
): MembershipRole {
  const aLevel = ROLE_HIERARCHY[a] ?? 0;
  const bLevel = ROLE_HIERARCHY[b] ?? 0;
  return aLevel <= bLevel ? a : b;
}

/**
 * Resolves the effective role for a user on a specific location.
 * Returns null if user is not an org member.
 */
export async function resolveLocationRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string,
  locationId: string
): Promise<MembershipRole | null> {
  // 1. Get org-level membership
  const { data: membership, error: memberError } = await supabase
    .from('memberships')
    .select('id, role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberError || !membership) return null;

  const orgRole = (membership.role ?? 'viewer') as MembershipRole;

  // 2. Owner always gets owner on all locations
  if (orgRole === 'owner') return 'owner';

  // 3. Check for location-specific override
  const { data: locPerm, error: locError } = await supabase
    .from('location_permissions')
    .select('role')
    .eq('membership_id', membership.id)
    .eq('location_id', locationId)
    .maybeSingle();

  if (locError || !locPerm) {
    // No override → fall back to org role
    return orgRole;
  }

  // 4. Resolved = min(org_role, location_role) — cannot elevate
  return minRole(orgRole, locPerm.role as MembershipRole);
}

/**
 * Returns all locations a user can access, with their effective role per location.
 */
export async function getUserLocationAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string
): Promise<{ locationId: string; effectiveRole: MembershipRole }[]> {
  // 1. Get org membership
  const { data: membership, error: memberError } = await supabase
    .from('memberships')
    .select('id, role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberError || !membership) return [];

  const orgRole = (membership.role ?? 'viewer') as MembershipRole;

  // 2. Get all org locations
  const { data: locations, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', orgId);

  if (locError || !locations || locations.length === 0) return [];

  // 3. Owner → all locations with owner role
  if (orgRole === 'owner') {
    return locations.map((loc) => ({
      locationId: loc.id,
      effectiveRole: 'owner' as MembershipRole,
    }));
  }

  // 4. Get location-specific overrides for this member
  const { data: overrides } = await supabase
    .from('location_permissions')
    .select('location_id, role')
    .eq('membership_id', membership.id);

  const overrideMap = new Map<string, MembershipRole>();
  (overrides ?? []).forEach((o) => {
    overrideMap.set(o.location_id, o.role as MembershipRole);
  });

  // 5. Resolve effective role per location
  return locations.map((loc) => {
    const locRole = overrideMap.get(loc.id);
    const effectiveRole = locRole ? minRole(orgRole, locRole) : orgRole;
    return { locationId: loc.id, effectiveRole };
  });
}

/**
 * Asserts a user has at least requiredRole on a specific location.
 * Throws InsufficientLocationRoleError if not.
 */
export async function assertLocationRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string,
  locationId: string,
  requiredRole: MembershipRole
): Promise<void> {
  const effective = await resolveLocationRole(supabase, userId, orgId, locationId);

  if (effective === null || !roleSatisfies(effective, requiredRole)) {
    throw new InsufficientLocationRoleError(locationId, requiredRole, effective);
  }
}

/**
 * Grants or updates a location-level permission for an org member.
 * Owner only. Cannot elevate above org-level role.
 */
export async function setLocationPermission(
  supabase: SupabaseClient<Database>,
  grantedByUserId: string,
  orgId: string,
  membershipId: string,
  locationId: string,
  role: MembershipRole
): Promise<{ success: boolean; error?: string }> {
  // 1. Verify caller is owner
  const { data: callerMembership } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', grantedByUserId)
    .maybeSingle();

  if (!callerMembership || callerMembership.role !== 'owner') {
    return { success: false, error: 'Only owner can set location permissions' };
  }

  // 2. Verify target membership belongs to org
  const { data: targetMembership } = await supabase
    .from('memberships')
    .select('role, org_id')
    .eq('id', membershipId)
    .maybeSingle();

  if (!targetMembership || targetMembership.org_id !== orgId) {
    return { success: false, error: 'Member not found in org' };
  }

  // 3. Cannot elevate above org role
  const orgRole = targetMembership.role as MembershipRole;
  if ((ROLE_HIERARCHY[role] ?? 0) > (ROLE_HIERARCHY[orgRole] ?? 0)) {
    return {
      success: false,
      error: `Cannot elevate above org role (${orgRole})`,
    };
  }

  // 4. Upsert location permission
  const { error } = await supabase
    .from('location_permissions')
    .upsert(
      {
        membership_id: membershipId,
        location_id: locationId,
        role,
        granted_by: grantedByUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'membership_id,location_id' }
    );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Revokes a location-level permission (falls back to org-level role).
 */
export async function revokeLocationPermission(
  supabase: SupabaseClient<Database>,
  revokedByUserId: string,
  orgId: string,
  membershipId: string,
  locationId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Verify caller is owner
  const { data: callerMembership } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', revokedByUserId)
    .maybeSingle();

  if (!callerMembership || callerMembership.role !== 'owner') {
    return { success: false, error: 'Only owner can revoke location permissions' };
  }

  // 2. Verify target membership belongs to org
  const { data: targetMembership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('id', membershipId)
    .maybeSingle();

  if (!targetMembership || targetMembership.org_id !== orgId) {
    return { success: false, error: 'Member not found in org' };
  }

  // 3. Delete (idempotent — no error if row doesn't exist)
  await supabase
    .from('location_permissions')
    .delete()
    .eq('membership_id', membershipId)
    .eq('location_id', locationId);

  return { success: true };
}
