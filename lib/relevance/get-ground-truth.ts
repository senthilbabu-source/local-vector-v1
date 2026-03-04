// ---------------------------------------------------------------------------
// lib/relevance/get-ground-truth.ts — Fetch Business Ground Truth from DB
//
// Shared utility for all surfaces that need to score query relevance.
// Used by: revenue calculator, digest emails, SOV page, gap displays.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { HoursData, Amenities, Categories } from '@/lib/types/ground-truth';
import type { BusinessGroundTruth } from './types';

/**
 * Fetch ground truth for a single location from the database.
 * Returns null if the location is not found.
 *
 * @param supabase - Supabase client (user-scoped or service role)
 * @param locationId - The location UUID
 * @param orgId - The org UUID (belt-and-suspenders with RLS)
 */
export async function fetchLocationGroundTruth(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<BusinessGroundTruth | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('hours_data, amenities, categories, operational_status')
    .eq('id', locationId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    hoursData: (data.hours_data as HoursData) ?? null,
    amenities: (data.amenities as Amenities) ?? null,
    categories: (data.categories as Categories) ?? null,
    operationalStatus: (data.operational_status as string) ?? null,
  };
}

/**
 * Fetch ground truth for the primary location of an org.
 * Convenience wrapper — most orgs have a single location.
 */
export async function fetchPrimaryGroundTruth(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<{ groundTruth: BusinessGroundTruth; locationId: string } | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, hours_data, amenities, categories, operational_status')
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    locationId: data.id,
    groundTruth: {
      hoursData: (data.hours_data as HoursData) ?? null,
      amenities: (data.amenities as Amenities) ?? null,
      categories: (data.categories as Categories) ?? null,
      operationalStatus: (data.operational_status as string) ?? null,
    },
  };
}
