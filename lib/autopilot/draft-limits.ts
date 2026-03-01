// ---------------------------------------------------------------------------
// lib/autopilot/draft-limits.ts — Per-Plan Monthly Draft Creation Limits
//
// Prevents runaway GPT-4o-mini costs by capping draft creation per org.
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Monthly draft creation limits per plan tier.
 */
export const DRAFT_CREATION_LIMITS: Record<string, number> = {
  trial: 2,
  starter: 5,
  growth: 20,
  agency: 100,
};

/**
 * Returns the draft creation limit for a plan tier.
 * Unknown plans default to 2 (trial-level).
 */
export function getDraftLimit(plan: string): number {
  return DRAFT_CREATION_LIMITS[plan] ?? 2;
}

/**
 * Checks if the org has hit its monthly draft creation limit.
 * Counts content_drafts rows created in the current calendar month.
 */
export async function checkDraftLimit(
  supabase: SupabaseClient<Database>,
  orgId: string,
  plan: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limit = getDraftLimit(plan);

  // Start of current month (UTC)
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { count, error } = await supabase
    .from('content_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', monthStart.toISOString());

  if (error) {
    // Fail-open: allow if we can't count
    return { allowed: true, current: 0, limit };
  }

  const current = count ?? 0;
  return { allowed: current < limit, current, limit };
}
