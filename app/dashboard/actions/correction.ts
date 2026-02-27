'use server';

import { revalidatePath } from 'next/cache';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canRunAutopilot } from '@/lib/plan-enforcer';
import { fetchCorrectionPackage } from '@/lib/data/correction-generator';
import type { CorrectionPackage } from '@/lib/services/correction-generator.service';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GenerateCorrectionSchema = z.object({
  hallucinationId: z.string().uuid(),
});

const CreateCorrectionDraftSchema = z.object({
  hallucinationId: z.string().uuid(),
  contentType: z.enum(['faq_page', 'occasion_page', 'blog_post', 'landing_page', 'gbp_post']),
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(10000),
});

// ---------------------------------------------------------------------------
// generateCorrection — Server Action
// ---------------------------------------------------------------------------

/**
 * Generate correction content for a specific hallucination.
 * Uses getSafeAuthContext() per AI_RULES §3.
 * User-initiated (button click) — not on page load (AI_RULES §5).
 */
export async function generateCorrection(
  formData: FormData,
): Promise<{ success: true; data: CorrectionPackage } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const parsed = GenerateCorrectionSchema.safeParse({
    hallucinationId: formData.get('hallucinationId'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const result = await fetchCorrectionPackage(supabase, parsed.data.hallucinationId, ctx.orgId);

  if (!result) return { success: false, error: 'Hallucination or location not found' };

  return { success: true, data: result };
}

// ---------------------------------------------------------------------------
// createCorrectionDraft — Server Action (plan-gated: Growth/Agency only)
// ---------------------------------------------------------------------------

/**
 * Create a content_draft from a correction action.
 * Converts a CorrectionPackage content piece into a content_draft
 * that enters the Autopilot HITL approval pipeline.
 */
export async function createCorrectionDraft(
  formData: FormData,
): Promise<{ success: true; draftId: string } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const parsed = CreateCorrectionDraftSchema.safeParse({
    hallucinationId: formData.get('hallucinationId'),
    contentType: formData.get('contentType'),
    title: formData.get('title'),
    content: formData.get('content'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Missing required fields' };
  }

  const supabase = await createClient();

  // Plan gating (AI_RULES §5)
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const plan = org?.plan ?? 'trial';
  if (!canRunAutopilot(plan)) {
    return { success: false, error: 'Upgrade to Growth to create content drafts' };
  }

  // Get primary location
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  const { data: draft, error } = await supabase
    .from('content_drafts')
    .insert({
      org_id: ctx.orgId,
      location_id: location?.id ?? null,
      trigger_type: 'hallucination_correction',
      trigger_id: parsed.data.hallucinationId,
      draft_title: parsed.data.title,
      draft_content: parsed.data.content,
      content_type: parsed.data.contentType,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) return { success: false, error: 'Failed to create draft' };

  revalidatePath('/dashboard/content-drafts');
  return { success: true, draftId: draft.id };
}
