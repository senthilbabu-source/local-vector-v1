// ---------------------------------------------------------------------------
// lib/autopilot/draft-deduplicator.ts — Semantic Draft Deduplication
//
// Runs BEFORE createDraft() to filter out triggers that would create
// redundant drafts. Complements the trigger_id-based idempotency check
// in create-draft.ts with semantic dedup (same query, per-type cooldowns).
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { DraftTrigger, DraftTriggerType } from '@/lib/types/autopilot';

/** Per-trigger-type cooldown periods (days). */
const COOLDOWN_DAYS: Partial<Record<DraftTriggerType, number>> = {
  competitor_gap: 14,
  prompt_missing: 30,
  review_gap: 60,
  schema_gap: 30,
};

/** Default cooldown for types not explicitly configured. */
const DEFAULT_COOLDOWN_DAYS = 14;

interface ExistingDraft {
  trigger_type: string;
  trigger_id: string | null;
  target_prompt: string | null;
  location_id: string | null;
  created_at: string;
}

/**
 * Filters a list of trigger candidates to remove those that would create
 * duplicate drafts. Returns only the triggers that should proceed.
 */
export async function deduplicateTriggers(
  triggers: DraftTrigger[],
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<DraftTrigger[]> {
  if (triggers.length === 0) return [];

  // Fetch recent non-archived drafts for this org (last 60 days max)
  const lookback = new Date();
  lookback.setDate(lookback.getDate() - 60);

  const { data: existingDrafts, error } = await supabase
    .from('content_drafts')
    .select('trigger_type, trigger_id, target_prompt, location_id, created_at')
    .eq('org_id', orgId)
    .neq('status', 'archived')
    .gte('created_at', lookback.toISOString())
    .order('created_at', { ascending: false });

  if (error || !existingDrafts) {
    // On error, allow all triggers through (fail-open)
    return triggers;
  }

  return triggers.filter((trigger) =>
    !isDuplicate(trigger, existingDrafts),
  );
}

/**
 * Checks if a trigger would create a duplicate draft.
 */
function isDuplicate(
  trigger: DraftTrigger,
  existingDrafts: ExistingDraft[],
): boolean {
  const now = new Date();

  // 1. Exact trigger_id match (any non-archived draft)
  if (trigger.triggerId) {
    const exactMatch = existingDrafts.find(
      (d) =>
        d.trigger_type === trigger.triggerType &&
        d.trigger_id === trigger.triggerId,
    );
    if (exactMatch) return true;
  }

  // 2. Same target query within cooldown period (case-insensitive)
  const targetQuery = trigger.context.targetQuery?.toLowerCase().trim();
  if (targetQuery) {
    const cooldownDays =
      COOLDOWN_DAYS[trigger.triggerType] ?? DEFAULT_COOLDOWN_DAYS;
    const cooldownDate = new Date(now);
    cooldownDate.setDate(cooldownDate.getDate() - cooldownDays);

    const queryMatch = existingDrafts.find(
      (d) =>
        d.trigger_type === trigger.triggerType &&
        d.location_id === trigger.locationId &&
        d.target_prompt?.toLowerCase().trim() === targetQuery &&
        new Date(d.created_at) >= cooldownDate,
    );
    if (queryMatch) return true;
  }

  // 3. Same trigger_type + location within type-specific cooldown
  const cooldownDays =
    COOLDOWN_DAYS[trigger.triggerType] ?? DEFAULT_COOLDOWN_DAYS;
  const cooldownDate = new Date(now);
  cooldownDate.setDate(cooldownDate.getDate() - cooldownDays);

  // For review_gap and schema_gap: at most 1 per location per cooldown period
  if (trigger.triggerType === 'review_gap' || trigger.triggerType === 'schema_gap') {
    const recentSameType = existingDrafts.find(
      (d) =>
        d.trigger_type === trigger.triggerType &&
        d.location_id === trigger.locationId &&
        new Date(d.created_at) >= cooldownDate,
    );
    if (recentSameType) return true;
  }

  return false;
}
