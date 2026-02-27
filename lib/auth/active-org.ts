// ---------------------------------------------------------------------------
// lib/auth/active-org.ts — Server-side active org resolution (Sprint 100)
//
// For users who belong to multiple orgs (accepted invitations from Sprint 98),
// resolves which org is currently active via cookie.
//
// Resolution order:
//   1. Cookie: lv_active_org → validate against user's memberships
//   2. First membership (oldest, sorted by created_at ASC)
//   3. null (user has no org memberships — shouldn't happen post-onboarding)
//
// NEVER reads from URL params or query strings (AI_RULES §18).
// ---------------------------------------------------------------------------

import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export const ORG_COOKIE = 'lv_active_org';

export interface OrgInfo {
  id: string;
  name: string;
  plan: string;
  role: string;
}

/**
 * Returns the active org ID for the given user.
 * Validates the cookie value against the user's actual memberships.
 */
export async function getActiveOrgId(
  supabase: SupabaseClient<Database>,
  publicUserId: string,
): Promise<string | null> {
  // Fetch all orgs this user belongs to
  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, role, organizations (id, name, plan)')
    .eq('user_id', publicUserId)
    .order('created_at', { ascending: true });

  if (!memberships || memberships.length === 0) return null;

  const orgIds = memberships.map((m) => m.org_id);

  // Check cookie
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ORG_COOKIE)?.value;

  if (cookieValue && orgIds.includes(cookieValue)) {
    return cookieValue;
  }

  // Fallback to first membership
  return orgIds[0] ?? null;
}

/**
 * Returns all orgs the user belongs to, with their role in each.
 */
export async function getUserOrgs(
  supabase: SupabaseClient<Database>,
  publicUserId: string,
): Promise<OrgInfo[]> {
  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, role, organizations (id, name, plan)')
    .eq('user_id', publicUserId)
    .order('created_at', { ascending: true });

  if (!memberships) return [];

  return memberships
    .filter((m) => m.organizations)
    .map((m) => {
      const org = m.organizations as unknown as { id: string; name: string; plan: string };
      return {
        id: org.id,
        name: org.name,
        plan: org.plan ?? 'trial',
        role: m.role,
      };
    });
}
