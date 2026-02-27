// ---------------------------------------------------------------------------
// lib/services/entity-auto-detect.ts — Entity Auto-Detection
//
// Sprint 80: Pure function — detects entity presence from existing
// LocalVector data. No I/O, no Supabase (AI_RULES §39).
// ---------------------------------------------------------------------------

/**
 * Auto-detect entity presence from existing LocalVector data.
 * Returns partial entity_checks updates for auto-detectable platforms.
 * Pure function — caller passes data in.
 */
export function autoDetectEntityPresence(
  location: {
    google_place_id: string | null;
    gbp_integration_id: string | null;
  },
  integrations: Array<{
    platform: string;
    status: string;
    external_id: string | null;
  }>,
): Partial<Record<string, string>> {
  const updates: Record<string, string> = {};

  // Google Knowledge Panel: if google_place_id exists, entity is in Google's graph
  if (location.google_place_id) {
    updates.google_knowledge_panel = 'confirmed';
  }

  // Google Business Profile: if integration exists and is connected
  const gbpIntegration = integrations.find(
    (i) => i.platform === 'google' && i.status === 'connected',
  );
  if (gbpIntegration || location.gbp_integration_id) {
    updates.google_business_profile = 'confirmed';
  }

  // Yelp: if integration exists and is connected
  const yelpIntegration = integrations.find(
    (i) => i.platform === 'yelp' && i.status === 'connected',
  );
  if (yelpIntegration) {
    updates.yelp = 'confirmed';
  }

  return updates;
}
