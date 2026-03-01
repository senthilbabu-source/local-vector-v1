// ---------------------------------------------------------------------------
// lib/autopilot/triggers/schema-gap-trigger.ts
//
// Detects schema coverage gaps that need a content brief.
// Triggers when locations.schema_health_score < 60 and the location has
// been scanned at least once.
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { DraftTrigger, DraftContext } from '@/lib/types/autopilot';

/** Schema health score threshold — below this triggers a draft. */
const SCHEMA_HEALTH_THRESHOLD = 60;

/** Required page types that every location should have. */
const REQUIRED_PAGE_TYPES = ['homepage', 'faq', 'about'];

/**
 * Detects schema coverage gaps that should generate content drafts.
 *
 * Returns at most 1 DraftTrigger per location.
 */
export async function detectSchemaGapTriggers(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<DraftTrigger[]> {
  // Check location's schema health score
  const { data: location, error: locErr } = await supabase
    .from('locations')
    .select('id, schema_health_score, schema_last_run_at')
    .eq('id', locationId)
    .single();

  if (locErr || !location) return [];

  // Only trigger if schema has been scanned and score is below threshold
  if (!location.schema_last_run_at) return [];
  if (
    location.schema_health_score === null ||
    location.schema_health_score === undefined ||
    location.schema_health_score >= SCHEMA_HEALTH_THRESHOLD
  ) {
    return [];
  }

  // Find which required page types are missing published schemas
  const { data: schemas, error: schemaErr } = await supabase
    .from('page_schemas')
    .select('page_type')
    .eq('location_id', locationId)
    .eq('status', 'published');

  if (schemaErr) return [];

  const publishedTypes = new Set((schemas ?? []).map((s) => s.page_type));
  const missingTypes = REQUIRED_PAGE_TYPES.filter((pt) => !publishedTypes.has(pt));

  // Determine highest-impact missing type
  const impactOrder = ['homepage', 'faq', 'about'];
  const topMissing = impactOrder.find((pt) => missingTypes.includes(pt));

  const context: DraftContext = {
    schemaHealthScore: location.schema_health_score,
    missingPageTypes: missingTypes.length > 0 ? missingTypes : undefined,
    topMissingImpact: topMissing
      ? `${topMissing} schema missing — highest AEO impact`
      : undefined,
    targetQuery: `structured data for ${missingTypes[0] ?? 'business'} page`,
  };

  return [
    {
      triggerType: 'schema_gap',
      triggerId: location.id,
      orgId,
      locationId,
      context,
    },
  ];
}
