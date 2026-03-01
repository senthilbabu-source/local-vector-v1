// ---------------------------------------------------------------------------
// lib/autopilot/triggers/competitor-gap-trigger.ts
//
// Detects competitor gaps that should generate content drafts.
// Reads competitor_intercepts with gap_magnitude='high' from the last 14 days.
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { DraftTrigger, DraftContext } from '@/lib/types/autopilot';

/** How far back to look for competitor intercepts (days). */
const LOOKBACK_DAYS = 14;

/**
 * Detects high-magnitude competitor gaps that should generate content drafts.
 *
 * Returns one DraftTrigger per qualifying gap. Does NOT create drafts —
 * the orchestrator decides when to call createDraft().
 */
export async function detectCompetitorGapTriggers(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
  businessName: string,
): Promise<DraftTrigger[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  const { data: intercepts, error } = await supabase
    .from('competitor_intercepts')
    .select('id, query_asked, competitor_name, winning_factor, suggested_action')
    .eq('org_id', orgId)
    .eq('gap_magnitude', 'high')
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !intercepts || intercepts.length === 0) {
    return [];
  }

  // Deduplicate by query_asked (case-insensitive) — keep the most recent
  const seen = new Set<string>();
  const unique = intercepts.filter((row) => {
    const key = (row.query_asked ?? '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.map((row) => {
    const context: DraftContext = {
      targetQuery: row.query_asked ?? undefined,
      competitorName: row.competitor_name ?? undefined,
      winningFactor: row.winning_factor ?? undefined,
    };

    return {
      triggerType: 'competitor_gap' as const,
      triggerId: row.id,
      orgId,
      locationId,
      context,
    };
  });
}
