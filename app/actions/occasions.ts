'use server';

// ---------------------------------------------------------------------------
// Occasion alert server actions — Sprint 101
//
// Snooze, dismiss, and create-draft-from-occasion actions.
// All actions derive org_id + user_id from the authenticated session.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveLocationId } from '@/lib/location/active-location';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { canRunAutopilot, type PlanTier } from '@/lib/plan-enforcer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SnoozeDuration = '1_day' | '3_days' | '1_week';

const SNOOZE_DURATIONS: Record<SnoozeDuration, number> = {
  '1_day': 1,
  '3_days': 3,
  '1_week': 7,
};

// ---------------------------------------------------------------------------
// snoozeOccasion
// ---------------------------------------------------------------------------

/**
 * Snoozes an occasion alert for the current user.
 * Per-user snooze — does not affect other users.
 */
export async function snoozeOccasion(input: {
  occasionId: string;
  duration: SnoozeDuration;
}): Promise<{ success: boolean; error?: string; snoozedUntil?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const { occasionId, duration } = input;

  // Validate duration
  const days = SNOOZE_DURATIONS[duration];
  if (!days) {
    return { success: false, error: 'Invalid snooze duration' };
  }

  const supabase = await createClient();

  // Validate occasion exists
  const { data: occasion } = await supabase
    .from('local_occasions')
    .select('id')
    .eq('id', occasionId)
    .maybeSingle();

  if (!occasion) {
    return { success: false, error: 'Occasion not found' };
  }

  // Compute snoozed_until
  const snoozedUntil = new Date();
  snoozedUntil.setDate(snoozedUntil.getDate() + days);
  const snoozedUntilISO = snoozedUntil.toISOString();

  // Upsert snooze — on conflict update snoozed_until and increment count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const { error } = await (supabase as any)
    .from('occasion_snoozes')
    .upsert(
      {
        org_id: ctx.orgId,
        user_id: ctx.userId,
        occasion_id: occasionId,
        snoozed_until: snoozedUntilISO,
        snoozed_at: new Date().toISOString(),
        snooze_count: 1,
      },
      { onConflict: 'org_id,user_id,occasion_id' },
    );

  if (error) {
    console.error('[occasions] snoozeOccasion error:', error);
    return { success: false, error: 'Failed to snooze occasion' };
  }

  // Note: snooze_count increment is handled by the upsert above (set to 1).
  // For V1, re-snoozes simply overwrite the row. Count tracking is deferred.

  revalidatePath('/dashboard');
  return { success: true, snoozedUntil: snoozedUntilISO };
}

// ---------------------------------------------------------------------------
// dismissOccasionPermanently
// ---------------------------------------------------------------------------

/**
 * Permanently dismisses an occasion alert for the current user.
 * Uses far-future snoozed_until (year 9999) — effectively permanent.
 */
export async function dismissOccasionPermanently(input: {
  occasionId: string;
}): Promise<{ success: boolean; error?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // Validate occasion exists
  const { data: occasion } = await supabase
    .from('local_occasions')
    .select('id')
    .eq('id', input.occasionId)
    .maybeSingle();

  if (!occasion) {
    return { success: false, error: 'Occasion not found' };
  }

  const farFuture = '9999-12-31T23:59:59Z';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const { error } = await (supabase as any)
    .from('occasion_snoozes')
    .upsert(
      {
        org_id: ctx.orgId,
        user_id: ctx.userId,
        occasion_id: input.occasionId,
        snoozed_until: farFuture,
        snoozed_at: new Date().toISOString(),
        snooze_count: 1,
      },
      { onConflict: 'org_id,user_id,occasion_id' },
    );

  if (error) {
    console.error('[occasions] dismissOccasionPermanently error:', error);
    return { success: false, error: 'Failed to dismiss occasion' };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

// ---------------------------------------------------------------------------
// createDraftFromOccasion
// ---------------------------------------------------------------------------

/**
 * Creates a new content_draft seeded with occasion context.
 *
 * Validations:
 *   1. orgId + locationId from session (never from input)
 *   2. Admin+ role required
 *   3. Growth+ plan required (canRunAutopilot)
 *   4. Occasion must exist
 */
export async function createDraftFromOccasion(input: {
  occasionId: string;
}): Promise<{ success: boolean; error?: string; draftId?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  // Role check: admin+ required
  if (!roleSatisfies(ctx.role, 'admin')) {
    return { success: false, error: 'Admin role required to create drafts' };
  }

  // Plan check: Growth+ required
  const plan = (ctx.plan ?? 'trial') as PlanTier;
  if (!canRunAutopilot(plan)) {
    return { success: false, error: 'Upgrade to Growth to create content drafts' };
  }

  const supabase = await createClient();

  // Resolve active location
  const locationId = await getActiveLocationId(supabase, ctx.orgId);

  // Fetch occasion details
  const { data: occasion } = await supabase
    .from('local_occasions')
    .select('id, name, occasion_type, peak_query_patterns')
    .eq('id', input.occasionId)
    .maybeSingle();

  if (!occasion) {
    return { success: false, error: 'Occasion not found' };
  }

  // Build draft content
  const title = `${occasion.name} — Content Draft`;
  const patterns = (occasion.peak_query_patterns as Array<{ query: string }>) ?? [];
  const targetPrompt = patterns[0]?.query ?? occasion.name;
  const content = [
    `# ${occasion.name}`,
    '',
    `Create AI-optimized content for ${occasion.name} to capture relevant search intent.`,
    '',
    '## Suggested Topics',
    ...patterns.slice(0, 5).map((p) => `- ${p.query}`),
    '',
    '## Next Steps',
    '1. Customize this draft with your business details',
    '2. Add specific menu items, promotions, or events',
    '3. Approve and publish before the occasion date',
  ].join('\n');

  // Insert draft
  const { data: inserted, error } = await supabase
    .from('content_drafts')
    .insert({
      org_id: ctx.orgId,
      location_id: locationId,
      trigger_type: 'occasion',
      trigger_id: occasion.id,
      draft_title: title,
      draft_content: content,
      target_prompt: targetPrompt,
      content_type: 'occasion_page',
      status: 'draft',
      human_approved: false,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    console.error('[occasions] createDraftFromOccasion error:', error);
    return { success: false, error: 'Failed to create draft' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/content-drafts');
  return { success: true, draftId: inserted.id };
}
