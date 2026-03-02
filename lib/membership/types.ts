/**
 * Org Membership Types — Sprint 111
 *
 * Central type definitions for the membership system.
 * The 'member' role from the legacy enum is intentionally excluded here;
 * it remains in the DB enum for backwards compatibility and is treated as 'viewer'.
 */

// ---------------------------------------------------------------------------
// Role type
// ---------------------------------------------------------------------------

/**
 * The four active roles available in an org.
 * Ordered from most to least privileged.
 * Legacy 'member' role (in DB enum) is treated as 'viewer'.
 */
export type MemberRole = 'owner' | 'admin' | 'analyst' | 'viewer';

// ---------------------------------------------------------------------------
// Permissions matrix
// ---------------------------------------------------------------------------

/**
 * What each role can do.
 * Used by API route guards and the team page UI.
 */
export const ROLE_PERMISSIONS = {
  owner: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: true,
    canManageBilling: true,
    canDeleteOrg: true,
    canViewAllData: true,
    canEditContent: true,
    canApproveContent: true,
  },
  admin: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: true,
    canManageBilling: false,
    canDeleteOrg: false,
    canViewAllData: true,
    canEditContent: true,
    canApproveContent: true,
  },
  analyst: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    canManageBilling: false,
    canDeleteOrg: false,
    canViewAllData: true,
    canEditContent: false,
    canApproveContent: false,
  },
  viewer: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    canManageBilling: false,
    canDeleteOrg: false,
    canViewAllData: true,
    canEditContent: false,
    canApproveContent: false,
  },
} as const satisfies Record<MemberRole, Record<string, boolean>>;

// ---------------------------------------------------------------------------
// Role sorting
// ---------------------------------------------------------------------------

/** Sort order for display: owner first, then admin, analyst, viewer. */
export const ROLE_ORDER: Record<string, number> = {
  owner: 0,
  admin: 1,
  analyst: 2,
  viewer: 3,
  member: 3, // legacy — same as viewer
};

// ---------------------------------------------------------------------------
// Seat limits
// ---------------------------------------------------------------------------

/**
 * Seat limits per plan tier.
 * Multi-seat is Agency-exclusive. Sprint 113 will wire Stripe metering.
 */
export const SEAT_LIMITS: Record<string, number | null> = {
  trial: 1,
  starter: 1,
  growth: 1,
  agency: 10,
};

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

/**
 * A member of an organization, as returned by the membership service.
 */
export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email: string;
  full_name: string | null;
}

/**
 * The calling user's membership context.
 * Used in API routes to authorize actions.
 */
export interface MembershipContext {
  member_id: string;
  user_id: string;
  org_id: string;
  role: MemberRole;
  permissions: (typeof ROLE_PERMISSIONS)[MemberRole];
}
