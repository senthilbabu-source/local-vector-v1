'use server';

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchHealthScore } from '@/lib/data/ai-health-score';
import type { HealthScoreResult } from '@/lib/services/ai-health-score.service';

/**
 * Server Action: Fetch the AI Health Score for the user's org + primary location.
 * Uses getSafeAuthContext() (not getAuthContext) per AI_RULES §3.
 */
export async function getHealthScore(): Promise<
  { success: true; data: HealthScoreResult } | { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // Fetch primary location
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return { success: false, error: 'No primary location found' };

  const result = await fetchHealthScore(supabase, ctx.orgId, location.id);
  return { success: true, data: result };
}
