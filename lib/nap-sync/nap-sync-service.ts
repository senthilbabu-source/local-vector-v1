// ---------------------------------------------------------------------------
// lib/nap-sync/nap-sync-service.ts — NAP Sync Orchestrator
//
// Sprint 105: Runs full NAP sync for a location:
//   fetch → diff → score → persist → push corrections
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { planSatisfies } from '@/lib/plan-enforcer';
import { GBPNAPAdapter } from './adapters/gbp-adapter';
import { YelpNAPAdapter } from './adapters/yelp-adapter';
import { AppleMapsNAPAdapter } from './adapters/apple-maps-adapter';
import { BingNAPAdapter } from './adapters/bing-adapter';
import { detectDiscrepancies } from './nap-discrepancy-detector';
import { calculateNAPHealthScore } from './nap-health-score';
import { pushNAPCorrections } from './nap-push-corrections';
import type {
  GroundTruth,
  PlatformContext,
  AdapterResult,
  NAPSyncResult,
} from './types';

const adapters = [
  new GBPNAPAdapter(),
  new YelpNAPAdapter(),
  new AppleMapsNAPAdapter(),
  new BingNAPAdapter(),
];

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
    hours_data: unknown;
    operational_status: string | null;
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
    hours_data: locationRow.hours_data as GroundTruth['hours_data'],
    operational_status: locationRow.operational_status,
  };
}

/**
 * Builds PlatformContext from listing_platform_ids rows.
 */
function buildPlatformContext(
  rows: { platform: string; platform_id: string }[],
): PlatformContext {
  const ctx: PlatformContext = {};
  for (const row of rows) {
    switch (row.platform) {
      case 'google':
        ctx.gbp_location_id = row.platform_id;
        break;
      case 'yelp':
        ctx.yelp_business_id = row.platform_id;
        break;
      case 'apple_maps':
        ctx.apple_maps_id = row.platform_id;
        break;
      case 'bing':
        ctx.bing_listing_id = row.platform_id;
        break;
    }
  }
  return ctx;
}

/**
 * Runs a full NAP sync for a single location.
 */
export async function runNAPSync(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<NAPSyncResult> {
  const now = new Date().toISOString();

  // 1. Fetch Ground Truth from locations table
  const { data: locationRow, error: locError } = await supabase
    .from('locations')
    .select(
      'id, org_id, business_name, address_line1, city, state, zip, phone, website_url, hours_data, operational_status',
    )
    .eq('id', locationId)
    .eq('org_id', orgId)
    .single();

  if (locError || !locationRow) {
    throw new Error(`Location not found: ${locationId}`);
  }

  const groundTruth = buildGroundTruth(locationRow);

  // 2. Fetch platform context from listing_platform_ids
  const { data: platformRows } = await supabase
    .from('listing_platform_ids')
    .select('platform, platform_id')
    .eq('location_id', locationId);

  const platformContext = buildPlatformContext(platformRows ?? []);

  // 3. Run all adapters in parallel (Promise.allSettled — never fail due to one platform)
  const adapterPromises = adapters.map((adapter) =>
    adapter.fetchNAP(locationId, orgId, platformContext),
  );
  const settled = await Promise.allSettled(adapterPromises);

  const adapterResults: AdapterResult[] = settled.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      status: 'api_error' as const,
      platform: adapters[i].platformId,
      message: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });

  // 4. Run discrepancy detection
  const discrepancies = detectDiscrepancies(groundTruth, adapterResults);

  // 5. Calculate health score
  const healthScore = calculateNAPHealthScore(discrepancies, adapterResults);

  // 6. Upsert listing_snapshots (one per platform)
  for (const result of adapterResults) {
    await supabase.from('listing_snapshots').insert({
      location_id: locationId,
      org_id: orgId,
      platform: result.platform,
      fetch_status: result.status,
      raw_nap_data: result.status === 'ok' ? (result.data as unknown as Record<string, unknown>) : null,
      fetched_at: now,
    });
  }

  // 7. Upsert nap_discrepancies (one per platform)
  for (const d of discrepancies) {
    await supabase.from('nap_discrepancies').insert({
      location_id: d.location_id,
      org_id: d.org_id,
      platform: d.platform,
      status: d.status,
      discrepant_fields: d.discrepant_fields as unknown as Record<string, unknown>,
      severity: d.severity,
      auto_correctable: d.auto_correctable,
      fix_instructions: d.fix_instructions ?? null,
      detected_at: now,
    });
  }

  // 8. Update locations.nap_health_score + nap_last_checked_at
  await supabase
    .from('locations')
    .update({
      nap_health_score: healthScore.score,
      nap_last_checked_at: now,
    })
    .eq('id', locationId);

  // 9. Push auto-corrections for GBP if discrepancies exist
  const correctionsPushed: string[] = [];
  const correctionsFailed: string[] = [];

  const gbpDiscrepancy = discrepancies.find(
    (d) => d.platform === 'google' && d.auto_correctable && d.discrepant_fields.length > 0,
  );

  if (gbpDiscrepancy && platformContext.gbp_location_id) {
    const pushResult = await pushNAPCorrections(
      supabase,
      locationId,
      orgId,
      gbpDiscrepancy.discrepant_fields,
      groundTruth,
      platformContext.gbp_location_id,
    );

    if (pushResult.ok) {
      correctionsPushed.push('google');
    } else {
      correctionsFailed.push('google');
    }
  }

  return {
    location_id: locationId,
    org_id: orgId,
    health_score: healthScore,
    platform_results: adapterResults,
    discrepancies,
    corrections_pushed: correctionsPushed as NAPSyncResult['corrections_pushed'],
    corrections_failed: correctionsFailed as NAPSyncResult['corrections_failed'],
    run_at: now,
  };
}

/**
 * Runs NAP sync for ALL active locations across all Growth+ orgs.
 * Called by the weekly cron job. Processes sequentially to avoid rate limiting.
 */
export async function runNAPSyncForAllLocations(
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
    console.error('[nap-sync] Failed to fetch orgs:', orgError?.message);
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
        await runNAPSync(supabase, location.id, org.id);
        processed++;
      } catch (err) {
        errors++;
        Sentry.captureException(err, {
          tags: { component: 'nap-sync-cron', sprint: '105' },
          extra: { orgId: org.id, locationId: location.id },
        });
        console.error(
          `[nap-sync] Failed for org=${org.id} location=${location.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  return { processed, errors };
}
