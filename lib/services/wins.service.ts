// ---------------------------------------------------------------------------
// lib/services/wins.service.ts — S20: Wins Feed (AI_RULES §220)
//
// Lightweight win-log service. Two public functions:
//   createHallucinationWin — records a fix as a win (fire-and-forget safe)
//   getRecentWins          — fetches the most recent wins for an org
//
// The `wins` table is NOT yet in database.types.ts; we use the same
// `as never` cast pattern established for S14/S15 new columns.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WinRow {
  id:             string;
  org_id:         string;
  win_type:       string;
  title:          string;
  detail:         string | null;
  revenue_impact: number | null;
  created_at:     string;
}

// ---------------------------------------------------------------------------
// createHallucinationWin
// ---------------------------------------------------------------------------

/**
 * Record an AI-mistake correction as a win.
 *
 * Fire-and-forget safe:
 *   void createHallucinationWin(supabase, orgId, claimText, revenue)
 *     .catch(Sentry.captureException);
 */
export async function createHallucinationWin(
  supabase: SupabaseClient<Database>,
  orgId: string,
  claimText: string,
  revenueImpact?: number | null,
): Promise<void> {
  const detail = claimText.length > 120
    ? claimText.slice(0, 117) + '…'
    : claimText;

  const { error } = await supabase
    .from('wins' as never)
    .insert({
      org_id:         orgId,
      win_type:       'hallucination_fixed',
      title:          'Fixed an AI mistake',
      detail,
      revenue_impact: revenueImpact && revenueImpact > 0 ? revenueImpact : null,
    } as never);

  if (error) throw new Error(`wins_insert_failed: ${(error as { message: string }).message}`);
}

// ---------------------------------------------------------------------------
// getRecentWins
// ---------------------------------------------------------------------------

/**
 * Fetch the most recent wins for an org. Returns [] on error.
 */
export async function getRecentWins(
  supabase: SupabaseClient<Database>,
  orgId: string,
  limit = 5,
): Promise<WinRow[]> {
  const { data } = await supabase
    .from('wins' as never)
    .select('id, org_id, win_type, title, detail, revenue_impact, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit) as unknown as { data: WinRow[] | null };

  return data ?? [];
}
