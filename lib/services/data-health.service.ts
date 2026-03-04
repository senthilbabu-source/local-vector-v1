// ---------------------------------------------------------------------------
// lib/services/data-health.service.ts — Data Health Scoring Engine
//
// Sprint 124: Replaces hardcoded dataHealth=100 in deriveRealityScore() with
// a real 5-dimension completeness score computed from actual location data.
//
// Dimensions (100 points total):
//   Core Identity   (30pts) — name, address, phone, website all non-null
//   Hours           (20pts) — hours_data has all 7 days, no null slots
//   Amenities       (20pts) — >50% of boolean amenities set (not null)
//                              SKIP if gbp_import_source=true (per RFC §4.3)
//   Category/Desc   (15pts) — primary_category non-null, description ≥ 50 chars
//   Menu/Services   (15pts) — ≥1 magic_menu exists with ≥1 published item
//
// AI_RULES §158: computeDataHealth() is the ONLY place DataHealth is
// calculated. Never inline the formula. Cron refreshes nightly; dashboard
// reads from cache during day.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataHealthBreakdown {
  coreIdentity: number;    // 0–30
  hoursComplete: number;   // 0–20
  amenities: number;       // 0–20
  categoryDesc: number;    // 0–15
  menuServices: number;    // 0–15
  total: number;           // 0–100
  gbpImportSource: boolean;
}

/** Minimal location data needed for scoring. */
export interface LocationDataForHealth {
  business_name: string | null;
  address_line1: string | null;
  phone: string | null;
  website_url: string | null;
  hours_data: Record<string, unknown> | null;
  amenities: Record<string, boolean | null | undefined> | null;
  categories: string[] | null;
  gbp_import_source?: boolean | null;
  // Description comes from the org or location extended data
  description?: string | null;
}

// ---------------------------------------------------------------------------
// Day names for hours validation
// ---------------------------------------------------------------------------

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ---------------------------------------------------------------------------
// Scoring Functions
// ---------------------------------------------------------------------------

/**
 * Core Identity (30pts): name, address, phone, website all non-null.
 * Each field is worth 7.5pts (30 / 4).
 */
export function scoreCoreIdentity(location: LocationDataForHealth): number {
  let score = 0;
  if (location.business_name) score += 7.5;
  if (location.address_line1) score += 7.5;
  if (location.phone) score += 7.5;
  if (location.website_url) score += 7.5;
  return score;
}

/**
 * Hours Completeness (20pts): hours_data has all 7 days with non-null values.
 * Each day with a valid entry is worth ~2.86pts (20 / 7).
 */
export function scoreHoursCompleteness(hoursData: Record<string, unknown> | null): number {
  if (!hoursData || typeof hoursData !== 'object') return 0;

  let daysWithHours = 0;
  for (const day of WEEK_DAYS) {
    const entry = hoursData[day];
    if (entry != null && entry !== '' && entry !== 'closed') {
      daysWithHours++;
    }
  }

  return Math.round((daysWithHours / 7) * 20 * 100) / 100;
}

/**
 * Amenities Coverage (20pts): >50% of boolean amenities set (not null).
 * SKIP (return 20) if gbp_import_source=true — GBP-imported locations
 * intentionally have null amenities (per RFC §4.3).
 */
export function scoreAmenities(
  amenities: Record<string, boolean | null | undefined> | null,
  gbpImportSource: boolean,
): number {
  // GBP imports: null amenities expected — no penalty
  if (gbpImportSource) return 20;

  if (!amenities || typeof amenities !== 'object') return 0;

  const keys = Object.keys(amenities);
  if (keys.length === 0) return 0;

  const setCount = keys.filter((k) => amenities[k] != null).length;
  const ratio = setCount / keys.length;

  return Math.round(ratio * 20 * 100) / 100;
}

/**
 * Category/Description (15pts):
 *   - primary_category non-null: 7.5pts
 *   - description ≥ 50 chars:    7.5pts
 */
export function scoreCategoryDescription(
  categories: string[] | null,
  description: string | null | undefined,
): number {
  let score = 0;
  if (categories && categories.length > 0) score += 7.5;
  if (description && description.length >= 50) score += 7.5;
  return score;
}

/**
 * Menu/Services (15pts): ≥1 magic_menu exists with is_published=true.
 * Binary: 0 or 15.
 */
export function scoreMenuServices(hasPublishedMenu: boolean): number {
  return hasPublishedMenu ? 15 : 0;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Compute the DataHealth score for a location.
 * Returns breakdown + total (0–100).
 *
 * @param supabase - Client instance (RLS-scoped or service role)
 * @param locationId - The location to score
 */
export async function computeDataHealth(
  supabase: SupabaseClient<Database>,
  locationId: string,
): Promise<DataHealthBreakdown> {
  // Fetch location data
  const { data: location } = await supabase
    .from('locations')
    .select('business_name, address_line1, phone, website_url, hours_data, amenities, categories')
    .eq('id', locationId)
    .single();

  if (!location) {
    return {
      coreIdentity: 0,
      hoursComplete: 0,
      amenities: 0,
      categoryDesc: 0,
      menuServices: 0,
      total: 0,
      gbpImportSource: false,
    };
  }

  // Check for published menu
  const { count } = await supabase
    .from('magic_menus')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('is_published', true);

  const hasPublishedMenu = (count ?? 0) > 0;

  // gbp_import_source: check if location was imported from GBP
  // We detect this by checking if gbp_synced_at is set (meaning GBP integration active)
  const { data: gbpCheck } = await supabase
    .from('locations')
    .select('gbp_synced_at')
    .eq('id', locationId)
    .single();

  const gbpImportSource = gbpCheck?.gbp_synced_at != null;

  // Description: check ground_truth_submissions for a description field
  // Table may not yet exist in generated types — cast to bypass strict checking
  const { data: gtSub } = await (supabase
    .from('ground_truth_submissions' as never)
    .select('fields')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as Promise<{ data: { fields: Record<string, string> } | null }>);

  const description = gtSub?.fields?.description ?? null;

  const locationData: LocationDataForHealth = {
    business_name: location.business_name,
    address_line1: location.address_line1,
    phone: location.phone,
    website_url: location.website_url,
    hours_data: location.hours_data as Record<string, unknown> | null,
    amenities: location.amenities as Record<string, boolean | null | undefined> | null,
    categories: location.categories as string[] | null,
    gbp_import_source: gbpImportSource,
    description,
  };

  return computeDataHealthFromData(locationData, hasPublishedMenu);
}

/**
 * Pure scoring function — no DB access. Useful for testing.
 */
export function computeDataHealthFromData(
  location: LocationDataForHealth,
  hasPublishedMenu: boolean,
): DataHealthBreakdown {
  const gbpImportSource = location.gbp_import_source ?? false;

  const coreIdentity = scoreCoreIdentity(location);
  const hoursComplete = scoreHoursCompleteness(location.hours_data);
  const amenitiesScore = scoreAmenities(location.amenities, gbpImportSource);
  const categoryDesc = scoreCategoryDescription(location.categories, location.description);
  const menuServices = scoreMenuServices(hasPublishedMenu);

  const total = Math.round(coreIdentity + hoursComplete + amenitiesScore + categoryDesc + menuServices);

  return {
    coreIdentity,
    hoursComplete,
    amenities: amenitiesScore,
    categoryDesc,
    menuServices,
    total,
    gbpImportSource,
  };
}
