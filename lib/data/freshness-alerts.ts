// ---------------------------------------------------------------------------
// lib/data/freshness-alerts.ts — Content Freshness Data Layer (Sprint 76)
//
// Fetches recent visibility_analytics snapshots and delegates decay detection
// to the pure freshness-alert.service.ts module.
//
// Uses injected SupabaseClient (standard data layer pattern).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { detectFreshnessDecay, type FreshnessStatus } from '@/lib/services/freshness-alert.service';

export type { FreshnessStatus } from '@/lib/services/freshness-alert.service';

/**
 * Fetch the last 5 visibility_analytics snapshots for an org and detect
 * citation rate declines.
 */
export async function fetchFreshnessAlerts(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId?: string | null,
): Promise<FreshnessStatus> {
  let query = supabase
    .from('visibility_analytics')
    .select('snapshot_date, citation_rate, share_of_voice')
    .eq('org_id', orgId)
    .order('snapshot_date', { ascending: true })
    .limit(5);
  if (locationId) query = query.eq('location_id', locationId);

  const { data: snapshots, error } = await query;

  if (error) {
    console.error('[freshness-alerts] Failed to fetch visibility_analytics:', error.message);
    return detectFreshnessDecay([]);
  }

  return detectFreshnessDecay(
    (snapshots ?? []) as import('@/lib/services/freshness-alert.service').VisibilitySnapshot[],
  );
}
