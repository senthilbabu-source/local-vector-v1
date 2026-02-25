// ---------------------------------------------------------------------------
// lib/autopilot/create-draft.ts — Master Draft Creator
//
// The single entry point all triggers call to create content drafts.
// Pure service — caller passes Supabase client (service-role for crons,
// RLS-scoped for user-initiated actions).
//
// Steps (Doc 19 §3.1):
//   1. Idempotency check (trigger_id lookup)
//   2. Pending draft cap (5 per org)
//   3. Load location context
//   4. Determine content type
//   5. Generate brief via GPT-4o-mini
//   6. Score content via heuristic
//   7. Insert to content_drafts
//
// Spec: docs/19-AUTOPILOT-ENGINE.md §3.1, §8.1, §8.2
// ---------------------------------------------------------------------------

import type {
  DraftTrigger,
  DraftContentType,
  ContentDraftRow,
  AutopilotLocationContext,
} from '@/lib/types/autopilot';
import { generateDraftBrief } from './generate-brief';
import { scoreContentHeuristic } from './score-content';

/** Maximum pending (status='draft') drafts per org. Doc 19 §8.1. */
export const PENDING_DRAFT_CAP = 5;

// ---------------------------------------------------------------------------
// Content Type Determination
// ---------------------------------------------------------------------------

/**
 * Determines the content type from the trigger.
 */
export function determineContentType(trigger: DraftTrigger): DraftContentType {
  switch (trigger.triggerType) {
    case 'competitor_gap':
      return 'faq_page';
    case 'occasion':
      return 'occasion_page';
    case 'prompt_missing':
      return 'faq_page';
    case 'first_mover':
      return 'faq_page';
    case 'manual':
      return trigger.context.contentType ?? 'blog_post';
    default:
      return 'blog_post';
  }
}

// ---------------------------------------------------------------------------
// Master Draft Creator
// ---------------------------------------------------------------------------

/**
 * Master entry point for all draft creation.
 * Returns the created draft row, or null if suppressed (idempotency/cap/error).
 */
export async function createDraft(
  trigger: DraftTrigger,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<ContentDraftRow | null> {
  // ── 1. Idempotency check ─────────────────────────────────────────────────
  if (trigger.triggerId) {
    const { data: existing } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('trigger_type', trigger.triggerType)
      .eq('trigger_id', trigger.triggerId)
      .neq('status', 'archived')
      .maybeSingle();

    if (existing) {
      return existing as ContentDraftRow;
    }
  }

  // ── 2. Pending draft cap ─────────────────────────────────────────────────
  const { count: pendingCount } = await supabase
    .from('content_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', trigger.orgId)
    .eq('status', 'draft');

  if (pendingCount != null && pendingCount >= PENDING_DRAFT_CAP) {
    console.warn(
      `[autopilot/create-draft] Org ${trigger.orgId} has ${pendingCount} pending drafts (cap: ${PENDING_DRAFT_CAP}). Suppressing new draft.`,
    );
    return null;
  }

  // ── 3. Load location context ─────────────────────────────────────────────
  const { data: loc } = await supabase
    .from('locations')
    .select(
      'business_name, city, state, categories, amenities, phone, website_url, address_line1, google_location_name',
    )
    .eq('id', trigger.locationId)
    .single();

  const location: AutopilotLocationContext = {
    business_name: loc?.business_name ?? 'Local Business',
    city: loc?.city ?? null,
    state: loc?.state ?? null,
    categories: loc?.categories ?? null,
    amenities: loc?.amenities ?? null,
    phone: loc?.phone ?? null,
    website_url: loc?.website_url ?? null,
    address_line1: loc?.address_line1 ?? null,
    google_location_name: loc?.google_location_name ?? null,
  };

  // ── 4. Determine content type ────────────────────────────────────────────
  const contentType = determineContentType(trigger);

  // ── 5. Generate brief via GPT-4o-mini ────────────────────────────────────
  const brief = await generateDraftBrief(trigger, location, contentType);

  // Guard: never insert a draft with empty content
  if (!brief.content || brief.content.trim().length === 0) {
    console.warn('[autopilot/create-draft] AI returned empty content. Skipping insert.');
    return null;
  }

  // ── 6. Score content ─────────────────────────────────────────────────────
  const aeoScore = scoreContentHeuristic(brief.content, brief.title, {
    businessName: location.business_name,
    city: location.city,
    categories: location.categories,
  });

  // ── 7. Insert to content_drafts ──────────────────────────────────────────
  const insertPayload = {
    org_id: trigger.orgId,
    location_id: trigger.locationId,
    trigger_type: trigger.triggerType,
    trigger_id: trigger.triggerId,
    draft_title: brief.title,
    draft_content: brief.content,
    target_prompt: trigger.context.targetQuery ?? null,
    content_type: contentType,
    aeo_score: aeoScore,
    status: 'draft' as const,
    human_approved: false,
  };

  const { data: inserted, error } = await supabase
    .from('content_drafts')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    // DB-level idempotency: unique violation on (trigger_type, trigger_id)
    if (error.code === '23505' && trigger.triggerId) {
      const { data: existing } = await supabase
        .from('content_drafts')
        .select('*')
        .eq('trigger_type', trigger.triggerType)
        .eq('trigger_id', trigger.triggerId)
        .maybeSingle();
      return (existing as ContentDraftRow) ?? null;
    }
    console.error('[autopilot/create-draft] Insert failed:', error.message);
    return null;
  }

  return inserted as ContentDraftRow;
}

// ---------------------------------------------------------------------------
// Occasion Draft Expiry (Doc 19 §8.2)
// ---------------------------------------------------------------------------

/**
 * Archives occasion drafts whose peak date has passed (with 7-day grace period).
 * Called as a sub-step in the SOV cron.
 * Returns the count of archived drafts.
 */
export async function archiveExpiredOccasionDrafts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<number> {
  // Fetch occasion drafts that are still active (draft or approved)
  const { data: candidateDrafts } = await supabase
    .from('content_drafts')
    .select('id, trigger_id')
    .eq('trigger_type', 'occasion')
    .in('status', ['draft', 'approved']);

  if (!candidateDrafts || candidateDrafts.length === 0) return 0;

  // Get trigger_ids to look up occasion dates
  const triggerIds = candidateDrafts
    .map((d: { trigger_id: string | null }) => d.trigger_id)
    .filter(Boolean);

  if (triggerIds.length === 0) return 0;

  const { data: occasions } = await supabase
    .from('local_occasions')
    .select('id, annual_date')
    .in('id', triggerIds);

  if (!occasions || occasions.length === 0) return 0;

  // Determine which occasions have passed (with 7-day grace period)
  const now = new Date();
  const currentYear = now.getFullYear();
  const expiredOccasionIds: string[] = [];

  for (const occ of occasions) {
    if (!occ.annual_date) continue; // Evergreen occasions don't expire

    // Parse MM-DD format
    const [monthStr, dayStr] = occ.annual_date.split('-');
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    // Build this year's peak date
    const peakDate = new Date(currentYear, month, day);

    // Handle year boundary: if peak is in the future by > 6 months, it was last year
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    if (peakDate > sixMonthsFromNow) {
      peakDate.setFullYear(currentYear - 1);
    }

    // 7-day grace period
    const graceEnd = new Date(peakDate);
    graceEnd.setDate(graceEnd.getDate() + 7);

    if (now > graceEnd) {
      expiredOccasionIds.push(occ.id);
    }
  }

  if (expiredOccasionIds.length === 0) return 0;

  // Archive matching drafts
  const draftIdsToArchive = candidateDrafts
    .filter((d: { trigger_id: string | null }) => expiredOccasionIds.includes(d.trigger_id!))
    .map((d: { id: string }) => d.id);

  if (draftIdsToArchive.length === 0) return 0;

  const { error } = await supabase
    .from('content_drafts')
    .update({ status: 'archived' })
    .in('id', draftIdsToArchive);

  if (error) {
    console.error('[autopilot/create-draft] Failed to archive expired occasion drafts:', error.message);
    return 0;
  }

  return draftIdsToArchive.length;
}
