import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type MembershipRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface OrgContext {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_status: string;
  audit_frequency: string;
  max_locations: number;
  onboarding_completed: boolean;
}

/**
 * Full auth context returned by `getAuthContext()`.
 * Guaranteed non-null — throws if user is unauthenticated or org does not exist.
 */
export interface AuthContext {
  userId: string;
  fullName: string | null;
  orgId: string;
  role: MembershipRole;
  org: OrgContext;
}

/**
 * Safe auth context returned by `getSafeAuthContext()`.
 * org fields are nullable to support the Onboarding Guard polling pattern
 * (Doc 05 §1.1, Doc 06 §3) — the DB trigger that creates the org runs
 * asynchronously and may not have completed yet when the client first calls
 * GET /api/v1/auth/context.
 */
export interface SafeAuthContext {
  userId: string;
  email: string;
  fullName: string | null;
  orgId: string | null;
  orgName: string | null;
  role: MembershipRole | null;
  plan: string | null;
  onboarding_completed: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the `public.users` row for the currently authenticated auth user.
 *
 * WHY: `public.users.id` (internal PK) and `auth.users.id` (`auth.uid()`) are
 * DIFFERENT UUIDs. `memberships.user_id` references `public.users.id`, so
 * any membership lookup must first map `auth.uid() → public.users.id` via
 * `auth_provider_id`.
 */
async function resolvePublicUser(
  supabase: SupabaseClient<Database>,
  authUid: string
): Promise<{ id: string; full_name: string | null } | null> {
  const { data } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('auth_provider_id', authUid)
    .maybeSingle() as { data: { id: string; full_name: string | null } | null };

  return data ?? null;
}

// ---------------------------------------------------------------------------
// getAuthContext — throwing variant for API routes
// ---------------------------------------------------------------------------

/**
 * Resolves the authenticated user's full tenant context.
 *
 * Use in API routes that require a valid org. Throws `Error('Unauthorized')`
 * if the session is missing and `Error('No organization found')` if the
 * DB trigger has not yet created the org.
 *
 * @example
 * ```ts
 * // app/api/v1/hallucinations/route.ts
 * export async function GET() {
 *   const auth = await getAuthContext();
 *   // auth.orgId is always a non-null string here
 * }
 * ```
 */
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    throw new Error('Unauthorized');
  }

  // Step 1: map auth.uid() → public.users.id
  const publicUser = await resolvePublicUser(supabase, user.id);
  if (!publicUser) {
    throw new Error('No organization found');
  }

  // Step 2: resolve membership + org using public.users.id (not auth.uid())
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select(
      `org_id,
       role,
       organizations (
         id,
         name,
         slug,
         plan,
         plan_status,
         audit_frequency,
         max_locations,
         onboarding_completed
       )`
    )
    .eq('user_id', publicUser.id)
    .single() as { data: { org_id: string; role: string; organizations: OrgContext } | null; error: unknown };

  if (!membership || membershipError) {
    throw new Error('No organization found');
  }

  const org = membership.organizations as OrgContext;

  return {
    userId: user.id,
    fullName: publicUser.full_name,
    orgId: membership.org_id,
    role: membership.role as MembershipRole,
    org,
  };
}

// ---------------------------------------------------------------------------
// getSafeAuthContext — non-throwing variant for Onboarding Guard polling
// ---------------------------------------------------------------------------

/**
 * Resolves the authenticated user's context without throwing when the org
 * does not yet exist (e.g. right after signup, before the DB trigger fires).
 *
 * Returns org fields as `null` in that case. The frontend's Onboarding Guard
 * polls GET /api/v1/auth/context every second until `org_id` is non-null.
 *
 * Returns `null` for the entire context if the user is not authenticated.
 */
export async function getSafeAuthContext(): Promise<SafeAuthContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    return null;
  }

  // Step 1: map auth.uid() → public.users.id + full_name
  const publicUser = await resolvePublicUser(supabase, user.id);

  if (!publicUser) {
    // Auth user exists but the public profile trigger hasn't fired yet.
    return {
      userId: user.id,
      email: user.email ?? '',
      fullName: null,
      orgId: null,
      orgName: null,
      role: null,
      plan: null,
      onboarding_completed: false,
    };
  }

  type SafeMembership = {
    org_id: string;
    role: string;
    organizations: { id: string; name: string; plan: string; onboarding_completed: boolean } | null;
  };

  // Step 2: resolve membership + org using public.users.id (not auth.uid())
  const { data: membership } = await supabase
    .from('memberships')
    .select(
      `org_id,
       role,
       organizations (
         id,
         name,
         plan,
         onboarding_completed
       )`
    )
    .eq('user_id', publicUser.id)
    .maybeSingle() as { data: SafeMembership | null; error: unknown };

  if (!membership) {
    return {
      userId: user.id,
      email: user.email ?? '',
      fullName: publicUser.full_name,
      orgId: null,
      orgName: null,
      role: null,
      plan: null,
      onboarding_completed: false,
    };
  }

  const org = membership.organizations;

  return {
    userId: user.id,
    email: user.email ?? '',
    fullName: publicUser.full_name,
    orgId: org ? membership.org_id : null,
    orgName: org ? org.name : null,
    role: org ? (membership.role as MembershipRole) : null,
    plan: org ? org.plan : null,
    onboarding_completed: org?.onboarding_completed ?? false,
  };
}
