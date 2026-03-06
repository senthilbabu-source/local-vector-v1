import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsistencyScoreResult {
  consistencyScore: number;
  nameScore: number;
  addressScore: number;
  phoneScore: number;
  hoursScore: number;
  menuScore: number;
}

// Weights (must sum to 100)
const WEIGHTS = {
  name: 30,
  address: 25,
  phone: 20,
  hours: 15,
  menu: 10,
} as const;

// ---------------------------------------------------------------------------
// Pure: computeConsistencyFromDiscrepancies
// ---------------------------------------------------------------------------

/**
 * Given a list of discrepancy fields, compute the consistency score.
 * Each field starts at max weight and loses all weight if any discrepancy exists.
 * Pure function — no I/O.
 */
export function computeConsistencyFromDiscrepancies(
  discrepantFields: string[],
  hasPlatforms: boolean,
): ConsistencyScoreResult {
  if (!hasPlatforms) {
    return {
      consistencyScore: 0,
      nameScore: 0,
      addressScore: 0,
      phoneScore: 0,
      hoursScore: 0,
      menuScore: 0,
    };
  }

  const fieldSet = new Set(discrepantFields.map((f) => f.toLowerCase()));

  const nameScore = fieldSet.has('name') || fieldSet.has('business_name') ? 0 : WEIGHTS.name;
  const addressScore = fieldSet.has('address') ? 0 : WEIGHTS.address;
  const phoneScore = fieldSet.has('phone') || fieldSet.has('telephone') ? 0 : WEIGHTS.phone;
  const hoursScore = fieldSet.has('hours') || fieldSet.has('opening_hours') ? 0 : WEIGHTS.hours;
  const menuScore = fieldSet.has('menu') ? 0 : WEIGHTS.menu;

  return {
    consistencyScore: nameScore + addressScore + phoneScore + hoursScore + menuScore,
    nameScore,
    addressScore,
    phoneScore,
    hoursScore,
    menuScore,
  };
}

// ---------------------------------------------------------------------------
// I/O: computeConsistencyScore
// ---------------------------------------------------------------------------

/**
 * Computes the cross-platform consistency score for a location.
 * Reads from nap_discrepancies and entity_checks.
 * Never throws.
 */
export async function computeConsistencyScore(
  supabase: SupabaseClient,
  orgId: string,
  locationId: string,
): Promise<ConsistencyScoreResult> {
  try {
    const [discrepancyResult, entityResult] = await Promise.all([
      // Active NAP discrepancies
      supabase
        .from('nap_discrepancies')
        .select('discrepant_fields' as 'id')
        .eq('location_id', locationId)
        .is('resolved_at' as 'id', null),

      // Entity checks (confirmed platforms)
      supabase
        .from('entity_checks')
        .select('google_knowledge_panel, google_business_profile, yelp, tripadvisor, apple_maps, bing_places' as 'id')
        .eq('location_id', locationId)
        .maybeSingle(),
    ]);

    const discrepancies = discrepancyResult.data ?? [];
    const entity = entityResult.data as unknown as Record<string, string> | null;

    // Determine if any platforms are connected
    const hasPlatforms = entity
      ? Object.values(entity).some((v) => v === 'confirmed')
      : false;

    // Collect all discrepant field names
    const allFields: string[] = [];
    for (const d of discrepancies) {
      const row = d as unknown as { discrepant_fields: string[] | null };
      if (Array.isArray(row.discrepant_fields)) {
        allFields.push(...row.discrepant_fields);
      }
    }

    return computeConsistencyFromDiscrepancies(allFields, hasPlatforms);
  } catch (err) {
    Sentry.captureException(err);
    return {
      consistencyScore: 0,
      nameScore: 0,
      addressScore: 0,
      phoneScore: 0,
      hoursScore: 0,
      menuScore: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// I/O: writeConsistencySnapshot
// ---------------------------------------------------------------------------

export async function writeConsistencySnapshot(
  supabase: SupabaseClient,
  orgId: string,
  locationId: string,
  result: ConsistencyScoreResult,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await supabase
    .from('consistency_scores' as 'cron_run_log')
    .upsert(
      {
        org_id: orgId,
        location_id: locationId,
        consistency_score: result.consistencyScore,
        name_score: result.nameScore,
        address_score: result.addressScore,
        phone_score: result.phoneScore,
        hours_score: result.hoursScore,
        menu_score: result.menuScore,
        snapshot_date: today,
      } as unknown as Record<string, unknown>,
      { onConflict: 'org_id,location_id,snapshot_date' },
    );
}

// ---------------------------------------------------------------------------
// I/O: fetchConsistencyScore (latest for dashboard)
// ---------------------------------------------------------------------------

export interface ConsistencyScoreWithTrend extends ConsistencyScoreResult {
  previousScore: number | null;
}

export async function fetchConsistencyScore(
  supabase: SupabaseClient,
  orgId: string,
  locationId: string,
): Promise<ConsistencyScoreWithTrend | null> {
  try {
    const { data } = await supabase
      .from('consistency_scores' as 'cron_run_log')
      .select('consistency_score, name_score, address_score, phone_score, hours_score, menu_score' as 'id')
      .eq('org_id', orgId)
      .eq('location_id' as 'cron_name', locationId)
      .order('snapshot_date' as 'started_at', { ascending: false })
      .limit(2);

    if (!data || data.length === 0) return null;

    const latest = data[0] as unknown as ConsistencyScoreResult;
    const prev = data.length > 1 ? (data[1] as unknown as { consistencyScore: number }) : null;

    return {
      ...latest,
      previousScore: prev?.consistencyScore ?? null,
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}
