'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { canRunAutopilot } from '@/lib/plan-enforcer';
import { scoreContentHeuristic } from '@/lib/autopilot/score-content';
import { publishAsDownload } from '@/lib/autopilot/publish-download';
import { publishToGBP } from '@/lib/autopilot/publish-gbp';
import { publishToWordPress } from '@/lib/autopilot/publish-wordpress';
import { schedulePostPublishRecheck } from '@/lib/autopilot/post-publish';
import type { AutopilotLocationContext } from '@/lib/types/autopilot';
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
  trigger_type: z.enum(['manual', 'occasion', 'first_mover', 'prompt_missing']).optional(),
  trigger_id: z.string().uuid().optional(),
});

const EditDraftSchema = z.object({
  draft_id: z.string().uuid(),
  draft_title: z.string().min(3, 'Title must be at least 3 characters').max(200).optional(),
  draft_content: z.string().min(10, 'Content must be at least 10 characters').max(10000).optional(),
  target_prompt: z.string().max(500).optional(),
});

const PublishDraftSchema = z.object({
  draft_id: z.string().uuid(),
  publish_target: z.enum(['download', 'gbp_post', 'wordpress']),
});

export type PublishActionResult =
  | { success: true; publishedUrl: string | null; downloadPayload?: string }
  | { success: false; error: string };

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

  // Doc 19 §4.2: rejection returns draft to editable state (not terminal)
  const { error } = await supabase
    .from('content_drafts')
    .update({ status: 'draft', human_approved: false })
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
    trigger_type: formData.get('trigger_type') || undefined,
    trigger_id: formData.get('trigger_id') || undefined,
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
    trigger_type: parsed.data.trigger_type ?? 'manual',
    trigger_id: parsed.data.trigger_id ?? null,
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

// ---------------------------------------------------------------------------
// archiveDraft — Server Action
// ---------------------------------------------------------------------------

export async function archiveDraft(formData: FormData): Promise<ActionResult> {
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
    .update({ status: 'archived' })
    .eq('id', parsed.data.draft_id)
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/content-drafts');
  return { success: true };
}

// ---------------------------------------------------------------------------
// editDraft — Server Action (Doc 19 §4.3)
// ---------------------------------------------------------------------------

export async function editDraft(formData: FormData): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = EditDraftSchema.safeParse({
    draft_id: formData.get('draft_id'),
    draft_title: formData.get('draft_title') || undefined,
    draft_content: formData.get('draft_content') || undefined,
    target_prompt: formData.get('target_prompt') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Fetch current draft to verify status
  const { data: draft } = await supabase
    .from('content_drafts')
    .select('id, status, draft_content, location_id')
    .eq('id', parsed.data.draft_id)
    .eq('org_id', ctx.orgId)
    .single();

  if (!draft) {
    return { success: false, error: 'Draft not found' };
  }

  // Doc 19 §4.2: Approved → Edit requires rejection first
  if (draft.status === 'approved') {
    return { success: false, error: 'Reject the draft before editing' };
  }
  if (draft.status === 'published') {
    return { success: false, error: 'Published drafts cannot be edited' };
  }
  if (draft.status === 'archived') {
    return { success: false, error: 'Archived drafts cannot be edited' };
  }

  // Build update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {};
  if (parsed.data.draft_title) updatePayload.draft_title = parsed.data.draft_title;
  if (parsed.data.draft_content) updatePayload.draft_content = parsed.data.draft_content;
  if (parsed.data.target_prompt !== undefined) updatePayload.target_prompt = parsed.data.target_prompt;

  // Recalculate AEO score if content changed
  if (parsed.data.draft_content && parsed.data.draft_content !== draft.draft_content) {
    let scoreCtx = { businessName: 'Business', city: null as string | null, categories: null as string[] | null };
    if (draft.location_id) {
      const { data: loc } = await supabase
        .from('locations')
        .select('business_name, city, categories')
        .eq('id', draft.location_id)
        .single();
      if (loc) {
        scoreCtx = {
          businessName: loc.business_name ?? 'Business',
          city: loc.city ?? null,
          categories: loc.categories ?? null,
        };
      }
    }
    updatePayload.aeo_score = scoreContentHeuristic(
      parsed.data.draft_content,
      parsed.data.draft_title ?? '',
      scoreCtx,
    );
  }

  if (Object.keys(updatePayload).length === 0) {
    return { success: false, error: 'No changes provided' };
  }

  const { error } = await supabase
    .from('content_drafts')
    .update(updatePayload)
    .eq('id', parsed.data.draft_id)
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/content-drafts');
  return { success: true };
}

// ---------------------------------------------------------------------------
// publishDraft — Server Action (Doc 19 §4.1, §5)
// ---------------------------------------------------------------------------

export async function publishDraft(formData: FormData): Promise<PublishActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = PublishDraftSchema.safeParse({
    draft_id: formData.get('draft_id'),
    publish_target: formData.get('publish_target'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // ── Plan gating ──────────────────────────────────────────────────────────
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const plan = org?.plan ?? 'trial';
  if (!canRunAutopilot(plan)) {
    return { success: false, error: 'Upgrade to Growth to publish content drafts' };
  }

  // ── Fetch draft ──────────────────────────────────────────────────────────
  const { data: draft } = await supabase
    .from('content_drafts')
    .select('*')
    .eq('id', parsed.data.draft_id)
    .eq('org_id', ctx.orgId)
    .single();

  if (!draft) {
    return { success: false, error: 'Draft not found' };
  }

  // ── NON-NEGOTIABLE SERVER-SIDE HITL VALIDATION (Doc 19 §4.1) ────────────
  if (draft.human_approved !== true || draft.status !== 'approved') {
    return { success: false, error: 'Draft must be approved before publishing' };
  }

  // ── Load location context for publishers ─────────────────────────────────
  let location: AutopilotLocationContext = {
    business_name: 'Local Business',
    city: null,
    state: null,
    categories: null,
    amenities: null,
    phone: null,
    website_url: null,
    address_line1: null,
    google_location_name: null,
  };

  if (draft.location_id) {
    const { data: loc } = await supabase
      .from('locations')
      .select('business_name, city, state, categories, amenities, phone, website_url, address_line1, google_location_name')
      .eq('id', draft.location_id)
      .single();

    if (loc) {
      location = {
        business_name: loc.business_name ?? 'Local Business',
        city: loc.city ?? null,
        state: loc.state ?? null,
        categories: loc.categories ?? null,
        amenities: loc.amenities ?? null,
        phone: loc.phone ?? null,
        website_url: loc.website_url ?? null,
        address_line1: loc.address_line1 ?? null,
        google_location_name: loc.google_location_name ?? null,
      };
    }
  }

  // ── Dispatch to publish target ───────────────────────────────────────────
  const { publish_target } = parsed.data;

  try {
    if (publish_target === 'download') {
      const result = await publishAsDownload(draft, location);

      // Update draft status
      await supabase
        .from('content_drafts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', draft.id)
        .eq('org_id', ctx.orgId);

      // Schedule post-publish re-check
      if (draft.target_prompt) {
        await schedulePostPublishRecheck(draft.id, draft.location_id, draft.target_prompt);
      }

      revalidatePath('/dashboard/content-drafts');
      return { success: true, publishedUrl: null, downloadPayload: result.downloadPayload };
    }

    if (publish_target === 'gbp_post') {
      const serviceSupabase = createServiceRoleClient();
      const result = await publishToGBP(draft, ctx.orgId, serviceSupabase);

      await supabase
        .from('content_drafts')
        .update({
          status: 'published',
          published_url: result.publishedUrl,
          published_at: new Date().toISOString(),
        })
        .eq('id', draft.id)
        .eq('org_id', ctx.orgId);

      if (draft.target_prompt) {
        await schedulePostPublishRecheck(draft.id, draft.location_id, draft.target_prompt);
      }

      revalidatePath('/dashboard/content-drafts');
      return { success: true, publishedUrl: result.publishedUrl };
    }

    if (publish_target === 'wordpress') {
      // Fetch WordPress config from location_integrations
      const { data: integration } = await supabase
        .from('location_integrations')
        .select('listing_url, wp_username, wp_app_password')
        .eq('location_id', draft.location_id)
        .eq('platform', 'wordpress')
        .single();

      if (!integration?.listing_url || !integration?.wp_username || !integration?.wp_app_password) {
        return {
          success: false,
          error: 'WordPress not connected. Go to Settings → Integrations to connect.',
        };
      }

      const result = await publishToWordPress(draft, {
        siteUrl: integration.listing_url,
        username: integration.wp_username,
        appPassword: integration.wp_app_password,
      });

      await supabase
        .from('content_drafts')
        .update({
          status: 'published',
          published_url: result.publishedUrl,
          published_at: new Date().toISOString(),
        })
        .eq('id', draft.id)
        .eq('org_id', ctx.orgId);

      if (draft.target_prompt) {
        await schedulePostPublishRecheck(draft.id, draft.location_id, draft.target_prompt);
      }

      revalidatePath('/dashboard/content-drafts');
      return { success: true, publishedUrl: result.publishedUrl };
    }

    return { success: false, error: 'Unknown publish target' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Publish failed';
    return { success: false, error: msg };
  }
}
