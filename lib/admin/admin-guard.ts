// ---------------------------------------------------------------------------
// lib/admin/admin-guard.ts — Sprint §204 (Admin Write Operations)
//
// Reusable admin auth guard for server actions. Verifies the caller is in
// ADMIN_EMAILS and resolves their public user id for membership operations.
//
// Also provides logAdminAction() for the admin_audit_log table.
// ---------------------------------------------------------------------------

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminContext {
  email: string;
  authUserId: string;
  publicUserId: string;
}

// ---------------------------------------------------------------------------
// assertAdmin
// ---------------------------------------------------------------------------

/**
 * Verifies the current user is an admin (email in ADMIN_EMAILS env var).
 * Returns the admin's email, auth user ID, and public user ID.
 * Throws if unauthenticated or not an admin.
 */
export async function assertAdmin(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    throw new Error('Unauthorized');
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(user.email.toLowerCase())) {
    throw new Error('Forbidden: not an admin');
  }

  // Resolve public user id (auth.uid() ≠ public.users.id)
  const { data: publicUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_provider_id', user.id)
    .maybeSingle();

  if (!publicUser) {
    throw new Error('Admin user profile not found');
  }

  return {
    email: user.email,
    authUserId: user.id,
    publicUserId: publicUser.id,
  };
}

// ---------------------------------------------------------------------------
// logAdminAction
// ---------------------------------------------------------------------------

/**
 * Logs an admin action to the admin_audit_log table.
 * Never throws — failures are captured in Sentry.
 */
export async function logAdminAction(
  adminEmail: string,
  action: string,
  targetOrgId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    // admin_audit_log not yet in generated types — cast through unknown
    await (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)('admin_audit_log').insert({
      admin_email: adminEmail,
      action,
      target_org_id: targetOrgId,
      details,
    } as Record<string, unknown>);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'admin-guard', function: 'logAdminAction', sprint: '203' },
      extra: { adminEmail, action, targetOrgId },
    });
  }
}
