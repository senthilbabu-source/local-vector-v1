// ---------------------------------------------------------------------------
// lib/data/entity-health.ts — Entity Health data fetcher
//
// Sprint 80: Fetches or lazy-initializes entity_checks row, runs auto-detection,
// and computes entity health.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  computeEntityHealth,
  type EntityHealthResult,
  type EntityCheckRow,
} from '@/lib/services/entity-health.service';
import { autoDetectEntityPresence } from '@/lib/services/entity-auto-detect';

/**
 * Fetch or initialize entity health for a location.
 * If no entity_checks row exists, creates one with auto-detected values.
 */
export async function fetchEntityHealth(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
): Promise<EntityHealthResult> {
  // 1. Try to fetch existing entity_checks row
  const { data: check } = await supabase
    .from('entity_checks')
    .select('*')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (check) {
    return computeEntityHealth(check as unknown as EntityCheckRow);
  }

  // 2. No row — auto-detect from existing data
  const [locationResult, integrationsResult] = await Promise.all([
    supabase
      .from('locations')
      .select('google_place_id, gbp_integration_id')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .single(),
    supabase
      .from('location_integrations')
      .select('platform, status, external_id')
      .eq('org_id', orgId)
      .eq('location_id', locationId),
  ]);

  const autoDetected = autoDetectEntityPresence(
    locationResult.data ?? { google_place_id: null, gbp_integration_id: null },
    integrationsResult.data ?? [],
  );

  // 3. Create entity_checks row with auto-detected values
  const insertData = {
    org_id: orgId,
    location_id: locationId,
    ...autoDetected,
  };

  const { data: newCheck } = await supabase
    .from('entity_checks')
    .insert(insertData)
    .select('*')
    .single();

  if (newCheck) {
    const health = computeEntityHealth(newCheck as unknown as EntityCheckRow);
    // Persist computed entity_score
    await supabase
      .from('entity_checks')
      .update({ entity_score: health.score })
      .eq('id', newCheck.id);

    return health;
  }

  // Fallback: return all-unchecked
  return computeEntityHealth({
    google_knowledge_panel: 'unchecked',
    google_business_profile: 'unchecked',
    yelp: 'unchecked',
    tripadvisor: 'unchecked',
    apple_maps: 'unchecked',
    bing_places: 'unchecked',
    wikidata: 'unchecked',
    platform_metadata: {},
  });
}
