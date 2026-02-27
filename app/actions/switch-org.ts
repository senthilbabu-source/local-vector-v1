'use server';

// ---------------------------------------------------------------------------
// Switch Org server action — Sprint 100
//
// Sets the active org cookie for the current user.
// Validates that the user is a member of the target org.
// userId derived from session (never from args — AI_RULES §18).
// ---------------------------------------------------------------------------

import { cookies } from 'next/headers';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ORG_COOKIE } from '@/lib/auth/active-org';
import { LOCATION_COOKIE } from '@/lib/location/active-location';

export async function switchActiveOrg(
  orgId: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // Resolve public user ID from auth UID
  const { data: publicUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_provider_id', ctx.userId)
    .maybeSingle();

  if (!publicUser) return { success: false, error: 'User not found' };

  // Validate that user is a member of the target org
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', publicUser.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!membership) return { success: false, error: 'Not a member of this organization' };

  // Set org cookie
  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, orgId, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  // Clear location cookie when switching orgs (location belongs to old org)
  cookieStore.delete(LOCATION_COOKIE);

  return { success: true };
}
