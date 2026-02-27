'use server';

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchClusterMapData } from '@/lib/data/cluster-map';
import type { EngineFilter, ClusterMapResult } from '@/lib/services/cluster-map.service';

export async function getClusterMapData(
  engineFilter: EngineFilter = 'all',
): Promise<{ success: true; data: ClusterMapResult } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return { success: false, error: 'No primary location found' };

  const data = await fetchClusterMapData(supabase, ctx.orgId, location.id, engineFilter);
  return { success: true, data };
}
