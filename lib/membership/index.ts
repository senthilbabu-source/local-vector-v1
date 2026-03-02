/**
 * Membership module — Sprint 111
 *
 * Re-exports types and service functions for org membership management.
 */

export type { MemberRole, OrgMember, MembershipContext } from './types';
export {
  ROLE_PERMISSIONS,
  ROLE_ORDER,
  SEAT_LIMITS,
} from './types';

export {
  getOrgMembers,
  getCallerMembership,
  getMemberById,
  removeMember,
  canAddMemberCheck,
  MembershipError,
} from './membership-service';
