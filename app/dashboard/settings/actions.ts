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
  const supabase = await createClient();
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
  notify_score_drop_alert:     z.boolean(),
  notify_new_competitor:       z.boolean(),
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
    notify_score_drop_alert:     formData.get('notify_score_drop_alert') === 'true',
    notify_new_competitor:       formData.get('notify_new_competitor') === 'true',
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('organizations')
    .update(parsed.data as never)
    .eq('id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/settings');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Sprint B: AI Monitoring Preferences — Server Action
// ---------------------------------------------------------------------------

const VALID_AI_MODELS = ['openai', 'perplexity', 'gemini', 'copilot', 'claude'] as const;

const AIMonitoringSchema = z.object({
  monitored_ai_models: z.array(z.enum(VALID_AI_MODELS)).min(1, 'Select at least one AI model'),
  scan_day_of_week: z.number().int().min(0).max(6),
});

export async function updateAIMonitoringPrefs(formData: FormData): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const models = formData.get('monitored_ai_models');
  const parsed = AIMonitoringSchema.safeParse({
    monitored_ai_models: typeof models === 'string' ? JSON.parse(models) : [],
    scan_day_of_week: Number(formData.get('scan_day_of_week') ?? 0),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('organizations')
    .update({
      monitored_ai_models: parsed.data.monitored_ai_models,
      scan_day_of_week: parsed.data.scan_day_of_week,
    } as never)
    .eq('id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/settings');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Sprint B: Score Drop Threshold + Webhook URL — Server Action
// ---------------------------------------------------------------------------

const AdvancedPrefsSchema = z.object({
  score_drop_threshold: z.number().int().min(0).max(50),
  webhook_url: z.string().url('Must be a valid URL').or(z.literal('')).nullable(),
});

export async function updateAdvancedPrefs(formData: FormData): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = AdvancedPrefsSchema.safeParse({
    score_drop_threshold: Number(formData.get('score_drop_threshold') ?? 10),
    webhook_url: formData.get('webhook_url') || null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const updateData: Record<string, unknown> = {
    score_drop_threshold: parsed.data.score_drop_threshold,
  };
  // Only write webhook_url if the plan allows it (agency) — server-side enforcement
  if (ctx.plan === 'agency') {
    updateData.webhook_url = parsed.data.webhook_url;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('organizations')
    .update(updateData)
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

  const supabase = createServiceRoleClient();
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
