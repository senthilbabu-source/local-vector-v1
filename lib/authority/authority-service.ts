// ---------------------------------------------------------------------------
// lib/authority/authority-service.ts — Authority Service Orchestrator
//
// Sprint 108: Runs full semantic authority mapping for a location:
//   detect citations → score → sameAs gaps → velocity → recommendations → persist
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { planSatisfies } from '@/lib/plan-enforcer';
import { detectCitationSources } from './citation-source-detector';
import { computeAuthorityScore, getVelocityLabel, countActivePlatforms, countSameAsUrls } from './entity-authority-scorer';
import { detectSameAsGaps } from './sameas-enricher';
import { computeCitationVelocity, saveAuthoritySnapshot, shouldAlertDecay } from './citation-velocity-monitor';
import { generateRecommendations } from './authority-recommendations';
import type {
  GroundTruth,
  EntityAuthorityProfile,
  AuthorityMappingResult,
} from './types';

/**
 * Builds Ground Truth from a locations table row.
 */
function buildGroundTruth(
  locationRow: {
    id: string;
    org_id: string;
    business_name: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    website_url: string | null;
  },
): GroundTruth {
  return {
    location_id: locationRow.id,
    org_id: locationRow.org_id,
    name: locationRow.business_name ?? '',
    address: locationRow.address_line1 ?? '',
    city: locationRow.city ?? '',
    state: locationRow.state ?? '',
    zip: locationRow.zip ?? '',
    phone: locationRow.phone ?? '',
    website: locationRow.website_url ?? undefined,
  };
}

/**
 * Runs the full semantic authority mapping for a single location.
 * Never throws — returns partial results with errors array.
 */
export async function runAuthorityMapping(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<AuthorityMappingResult> {
  const now = new Date().toISOString();
  const errors: string[] = [];

  // 1. Fetch Ground Truth
  const { data: locationRow, error: locError } = await supabase
    .from('locations')
    .select(
      'id, org_id, business_name, address_line1, city, state, zip, phone, website_url',
    )
    .eq('id', locationId)
    .eq('org_id', orgId)
    .single();

  if (locError || !locationRow) {
    return {
      location_id: locationId,
      org_id: orgId,
      entity_authority_score: 0,
      citations_detected: 0,
      sameas_gaps_found: 0,
      velocity: null,
      autopilot_drafts_triggered: 0,
      errors: [`Location not found: ${locationId}`],
      run_at: now,
    };
  }

  const groundTruth = buildGroundTruth(locationRow);

  // 2. Detect citation sources
  let citations = await detectCitationSources(groundTruth);

  // 3. Count active platforms
  let platformCount = 0;
  try {
    platformCount = await countActivePlatforms(supabase, locationId);
  } catch (err) {
    errors.push('Failed to count active platforms');
    Sentry.captureException(err, {
      tags: { file: 'authority-service.ts', sprint: '108' },
    });
  }

  // 4. Count existing sameAs URLs
  let sameAsCount = 0;
  try {
    sameAsCount = await countSameAsUrls(supabase, locationId);
  } catch (err) {
    errors.push('Failed to count sameAs URLs');
    Sentry.captureException(err, {
      tags: { file: 'authority-service.ts', sprint: '108' },
    });
  }

  // 5. Compute velocity
  const tierBreakdown = {
    tier1: citations.filter(c => c.tier === 'tier1').length,
    tier2: citations.filter(c => c.tier === 'tier2').length,
    tier3: citations.filter(c => c.tier === 'tier3').length,
    unknown: citations.filter(c => c.tier === 'unknown').length,
  };

  let velocity: number | null = null;
  try {
    velocity = await computeCitationVelocity(supabase, locationId, tierBreakdown);
  } catch (err) {
    errors.push('Failed to compute velocity');
    Sentry.captureException(err, {
      tags: { file: 'authority-service.ts', sprint: '108' },
    });
  }

  // 6. Compute authority score
  const { score, dimensions } = computeAuthorityScore(
    citations,
    platformCount,
    sameAsCount,
    velocity,
  );

  // 7. Detect sameAs gaps
  let sameAsGaps = await detectSameAsGaps(supabase, groundTruth, locationId, citations);

  // 8. Build partial profile (without recommendations)
  const partialProfile: Omit<EntityAuthorityProfile, 'recommendations'> = {
    location_id: locationId,
    org_id: orgId,
    entity_authority_score: score,
    dimensions,
    tier_breakdown: tierBreakdown,
    top_citations: citations.slice(0, 5),
    sameas_gaps: sameAsGaps,
    citation_velocity: velocity,
    velocity_label: getVelocityLabel(velocity),
    snapshot_at: now,
  };

  // 9. Generate recommendations
  const recommendations = generateRecommendations(partialProfile, sameAsGaps, groundTruth);

  // 10. Build full profile
  const profile: EntityAuthorityProfile = {
    ...partialProfile,
    recommendations,
  };

  // 11. Upsert citations to entity_authority_citations
  const runMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  for (const citation of citations) {
    try {
      await supabase
        .from('entity_authority_citations')
        .upsert(
          {
            location_id: locationId,
            org_id: orgId,
            url: citation.url,
            domain: citation.domain,
            tier: citation.tier,
            source_type: citation.source_type,
            snippet: citation.snippet,
            sentiment: citation.sentiment,
            is_sameas_candidate: citation.is_sameas_candidate,
            detected_at: citation.detected_at,
            run_month: runMonth,
          },
          { onConflict: 'location_id,url,run_month' },
        );
    } catch (err) {
      errors.push(`Failed to upsert citation: ${citation.url}`);
    }
  }

  // 12. Upsert to entity_authority_profiles
  try {
    await supabase
      .from('entity_authority_profiles')
      .upsert(
        {
          location_id: locationId,
          org_id: orgId,
          entity_authority_score: score,
          tier1_citation_score: dimensions.tier1_citation_score,
          tier2_coverage_score: dimensions.tier2_coverage_score,
          platform_breadth_score: dimensions.platform_breadth_score,
          sameas_score: dimensions.sameas_score,
          velocity_score: dimensions.velocity_score,
          tier1_count: tierBreakdown.tier1,
          tier2_count: tierBreakdown.tier2,
          tier3_count: tierBreakdown.tier3,
          sameas_gaps: sameAsGaps as unknown as Record<string, unknown>,
          sameas_count: sameAsCount,
          citation_velocity: velocity,
          velocity_label: getVelocityLabel(velocity),
          recommendations: recommendations as unknown as Record<string, unknown>,
          snapshot_at: now,
          last_run_at: now,
        },
        { onConflict: 'location_id' },
      );
  } catch (err) {
    errors.push('Failed to upsert authority profile');
    Sentry.captureException(err, {
      tags: { file: 'authority-service.ts', sprint: '108' },
    });
  }

  // 13. Save snapshot
  try {
    await saveAuthoritySnapshot(supabase, locationId, orgId, profile);
  } catch (err) {
    errors.push('Failed to save authority snapshot');
    Sentry.captureException(err, {
      tags: { file: 'authority-service.ts', sprint: '108' },
    });
  }

  // 14. Update locations.authority_score + authority_last_run_at
  try {
    await supabase
      .from('locations')
      .update({
        authority_score: score,
        authority_last_run_at: now,
      })
      .eq('id', locationId);
  } catch (err) {
    errors.push('Failed to update location authority_score');
  }

  // 15. Check for decay and trigger Autopilot if needed
  let autopilotDrafts = 0;
  if (shouldAlertDecay(velocity)) {
    // In a future iteration, this could trigger an Autopilot content draft
    // For now, we log the decay alert
    Sentry.captureMessage(`[authority] Citation decay alert for location ${locationId}: ${velocity}%`, {
      level: 'warning',
      tags: { sprint: '108', component: 'authority-decay-alert' },
    });
    autopilotDrafts = 0;
  }

  return {
    location_id: locationId,
    org_id: orgId,
    entity_authority_score: score,
    citations_detected: citations.length,
    sameas_gaps_found: sameAsGaps.length,
    velocity,
    autopilot_drafts_triggered: autopilotDrafts,
    errors,
    run_at: now,
  };
}

/**
 * Runs authority mapping for ALL active Growth+ locations.
 * Sequential processing with 1-second delay between locations.
 */
export async function runAuthorityMappingForAllLocations(
  supabase: SupabaseClient<Database>,
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  // Fetch all Growth+ orgs with active subscriptions
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, plan')
    .eq('plan_status', 'active');

  if (orgError || !orgs) {
    console.error('[authority-mapping] Failed to fetch orgs:', orgError?.message);
    return { processed: 0, errors: 1 };
  }

  const eligibleOrgs = orgs.filter((org) => planSatisfies(org.plan, 'growth'));

  for (const org of eligibleOrgs) {
    // Fetch all locations for this org
    const { data: locations } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', org.id);

    if (!locations?.length) continue;

    for (const location of locations) {
      try {
        const result = await runAuthorityMapping(supabase, location.id, org.id);
        if (result.errors.length > 0) {
          errors++;
        } else {
          processed++;
        }
      } catch (err) {
        errors++;
        Sentry.captureException(err, {
          tags: { component: 'authority-mapping-cron', sprint: '108' },
          extra: { orgId: org.id, locationId: location.id },
        });
        console.error(
          `[authority-mapping] Failed for org=${org.id} location=${location.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }

      // 1-second delay between locations to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { processed, errors };
}
