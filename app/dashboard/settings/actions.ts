'use server';

// ---------------------------------------------------------------------------
// app/dashboard/settings/actions.ts — Sprint 24B Settings Server Actions
//
// Two Server Actions for account self-service:
//   updateDisplayName — updates public.users.full_name, revalidates sidebar
//   changePassword    — calls supabase.auth.updateUser() (session-trusted)
//
// All actions:
//   • Derive identity server-side via getSafeAuthContext() (AI_RULES §11)
//   • Zod validation with issues[0].message error pattern (AI_RULES §8)
//   • No client-supplied org_id or user_id
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const DisplayNameSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(80, 'Display name must be 80 characters or fewer')
    .trim(),
});

const ChangePasswordSchema = z
  .object({
    password:        z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  });

// ---------------------------------------------------------------------------
// updateDisplayName — Server Action
// ---------------------------------------------------------------------------

/**
 * Update the display name for the authenticated user.
 *
 * Updates public.users.full_name (matched via auth_provider_id = ctx.userId).
 * revalidatePath('/dashboard') so sidebar and topbar pick up the new name.
 */
export async function updateDisplayName(formData: FormData): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const parsed = DisplayNameSchema.safeParse({
    displayName: formData.get('displayName'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { error } = await supabase
    .from('users')
    .update({ full_name: parsed.data.displayName })
    .eq('auth_provider_id', ctx.userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

// ---------------------------------------------------------------------------
// changePassword — Server Action
// ---------------------------------------------------------------------------

/**
 * Update the password for the authenticated user.
 *
 * Uses supabase.auth.updateUser() which trusts the current session cookie —
 * no "current password" field required (session is the proof of identity).
 * No revalidatePath needed — password change has no UI side-effects.
 */
export async function changePassword(formData: FormData): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const parsed = ChangePasswordSchema.safeParse({
    password:        formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // ── Update password via Supabase Auth ──────────────────────────────────────
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Notification Preferences Schema
// ---------------------------------------------------------------------------

const NotificationPrefsSchema = z.object({
  notify_hallucination_alerts: z.boolean(),
  notify_weekly_digest:        z.boolean(),
  notify_sov_alerts:           z.boolean(),
});

// ---------------------------------------------------------------------------
// updateNotificationPrefs — Server Action (Sprint 62)
// ---------------------------------------------------------------------------

export async function updateNotificationPrefs(formData: FormData): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = NotificationPrefsSchema.safeParse({
    notify_hallucination_alerts: formData.get('notify_hallucination_alerts') === 'true',
    notify_weekly_digest:        formData.get('notify_weekly_digest') === 'true',
    notify_sov_alerts:           formData.get('notify_sov_alerts') === 'true',
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { error } = await supabase
    .from('organizations')
    .update(parsed.data)
    .eq('id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/settings');
  return { success: true };
}

// ---------------------------------------------------------------------------
// softDeleteOrganization — Server Action (Sprint 62)
// ---------------------------------------------------------------------------

export async function softDeleteOrganization(): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  if (ctx.role !== 'owner') {
    return { success: false, error: 'Only the organization owner can delete the organization' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const { error } = await supabase
    .from('organizations')
    .update({ plan_status: 'canceled' })
    .eq('id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Sign out the user
  const sessionClient = await createClient();
  await sessionClient.auth.signOut();

  redirect('/login');
}
