// ---------------------------------------------------------------------------
// lib/data/agent-readiness.ts — Data fetcher for Agent Readiness Score
//
// Sprint 84: Assembles AgentReadinessInput from 3 parallel Supabase queries
// (locations, magic_menus, page_audits) and delegates to the pure service.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  computeAgentReadiness,
  type AgentReadinessInput,
  type AgentReadinessResult,
} from '@/lib/services/agent-readiness.service';

/**
 * Fetch agent readiness data and compute the score.
 */
export async function fetchAgentReadiness(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
): Promise<AgentReadinessResult> {
  const [locationResult, menuResult, pageAuditResult] = await Promise.all([
    // Location details
    supabase
      .from('locations')
      .select('business_name, website_url, hours_data, phone, attributes')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .single(),

    // Latest published Magic Menu
    supabase
      .from('magic_menus')
      .select('id, is_published, json_ld_schema')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Most recent homepage page audit
    supabase
      .from('page_audits')
      .select(
        'schema_completeness_score, faq_schema_present, entity_clarity_score, recommendations',
      )
      .eq('org_id', orgId)
      .eq('page_type', 'homepage')
      .order('last_audited_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const location = locationResult.data;
  const menu = menuResult.data;
  const audit = pageAuditResult.data;

  // Extract detected schema types from page audit recommendations
  const recommendations = (audit?.recommendations as Array<{
    title?: string;
    dimensionKey?: string;
    schemaType?: string;
  }>) ?? [];

  // Infer detected schema types from schema_completeness_score and recommendations
  const detectedSchemaTypes = extractDetectedSchemaTypes(
    audit?.schema_completeness_score ?? null,
    recommendations,
    (location?.attributes ?? null) as Record<string, unknown> | null,
  );

  // Check for booking/ordering URLs in location attributes
  const attributes = ((location?.attributes ?? {}) as Record<string, unknown>);
  const hasBookingUrl = !!(
    attributes.reservation_url ||
    attributes.booking_url ||
    attributes.opentable_url
  );
  const hasOrderingUrl = !!(
    attributes.ordering_url ||
    attributes.order_url ||
    attributes.doordash_url ||
    attributes.uber_eats_url
  );

  const input: AgentReadinessInput = {
    location: {
      businessName: location?.business_name ?? 'Unknown',
      websiteUrl: location?.website_url ?? null,
      hoursData: (location?.hours_data ?? null) as Record<string, unknown> | null,
      phone: location?.phone ?? null,
    },
    hasPublishedMenu: menu?.is_published === true,
    hasMenuJsonLd: menu?.json_ld_schema !== null && menu?.json_ld_schema !== undefined,
    pageAudit: audit
      ? {
          schemaCompletenessScore: audit.schema_completeness_score,
          faqSchemaPresent: audit.faq_schema_present,
          entityClarityScore: audit.entity_clarity_score,
          recommendations,
        }
      : null,
    hasBookingUrl,
    hasOrderingUrl,
    detectedSchemaTypes,
  };

  return computeAgentReadiness(input);
}

/**
 * Infer which schema types are present from audit data.
 * In V1 this is heuristic-based. Future: live schema crawl.
 */
function extractDetectedSchemaTypes(
  schemaScore: number | null,
  recommendations: Array<{ schemaType?: string }>,
  attributes: Record<string, unknown> | null,
): string[] {
  const types: string[] = [];

  // If schema score is high, likely has basic schemas
  if (schemaScore !== null && schemaScore >= 60) {
    types.push('LocalBusiness');
  }

  // Schema types mentioned in recommendations as "missing" → NOT present
  const missingSchemaTypes = recommendations
    .filter((r) => r.schemaType)
    .map((r) => r.schemaType!.toLowerCase());

  // If hours recommendations not flagged AND hours data exists → likely has OpeningHours
  if (
    !missingSchemaTypes.includes('openinghoursspecification') &&
    schemaScore !== null &&
    schemaScore >= 50
  ) {
    types.push('OpeningHoursSpecification');
  }

  // Check attributes for booking/ordering schema signals
  if (attributes?.has_reserve_action === true) types.push('ReserveAction');
  if (attributes?.has_order_action === true) types.push('OrderAction');

  return types;
}
