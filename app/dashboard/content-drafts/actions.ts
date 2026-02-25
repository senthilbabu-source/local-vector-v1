'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { canRunAutopilot } from '@/lib/plan-enforcer';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const DraftIdSchema = z.object({
  draft_id: z.string().uuid(),
});

const CreateDraftSchema = z.object({
  draft_title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  draft_content: z.string().min(10, 'Content must be at least 10 characters').max(10000),
  content_type: z.enum(['faq_page', 'occasion_page', 'blog_post', 'landing_page', 'gbp_post']),
});

// ---------------------------------------------------------------------------
// approveDraft — Server Action
// ---------------------------------------------------------------------------

export async function approveDraft(formData: FormData): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = DraftIdSchema.safeParse({ draft_id: formData.get('draft_id') });
  if (!parsed.success) {
    return { success: false, error: 'Invalid draft ID' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // RLS org_isolation ensures only this org's drafts are updatable
  const { error } = await supabase
    .from('content_drafts')
    .update({
      status: 'approved',
      human_approved: true,
      approved_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.draft_id)
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/content-drafts');
  return { success: true };
}

// ---------------------------------------------------------------------------
// rejectDraft — Server Action
// ---------------------------------------------------------------------------

export async function rejectDraft(formData: FormData): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = DraftIdSchema.safeParse({ draft_id: formData.get('draft_id') });
  if (!parsed.success) {
    return { success: false, error: 'Invalid draft ID' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { error } = await supabase
    .from('content_drafts')
    .update({ status: 'rejected' })
    .eq('id', parsed.data.draft_id)
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/content-drafts');
  return { success: true };
}

// ---------------------------------------------------------------------------
// createManualDraft — Server Action (plan-gated: Growth/Agency only)
// ---------------------------------------------------------------------------

export async function createManualDraft(formData: FormData): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Plan gating ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const plan = org?.plan ?? 'trial';
  if (!canRunAutopilot(plan)) {
    return { success: false, error: 'Upgrade to Growth to create content drafts' };
  }

  // ── Input validation ───────────────────────────────────────────────────────
  const parsed = CreateDraftSchema.safeParse({
    draft_title: formData.get('draft_title'),
    draft_content: formData.get('draft_content'),
    content_type: formData.get('content_type'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  // ── Insert ─────────────────────────────────────────────────────────────────
  const { error } = await supabase.from('content_drafts').insert({
    org_id: ctx.orgId,
    trigger_type: 'manual',
    draft_title: parsed.data.draft_title,
    draft_content: parsed.data.draft_content,
    content_type: parsed.data.content_type,
    status: 'draft',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/content-drafts');
  return { success: true };
}
