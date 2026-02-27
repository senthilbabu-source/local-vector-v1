// ---------------------------------------------------------------------------
// lib/services/places-refresh.ts — Google Places Detail Refresh
//
// Fetches fresh Place Details from Google Places API for locations
// with stale cached data (>29 days old). Only refreshes active-plan orgs.
//
// SECURITY: Uses createServiceRoleClient(). Never call from client code.
// Spec: Doc 04 §4, Google Maps Platform ToS (30-day cache limit)
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface PlacesRefreshResult {
  total: number;
  refreshed: number;
  failed: number;
  skipped: number;
  errors: string[];
}

interface StaleLocation {
  id: string;
  org_id: string;
  google_place_id: string | null;
}

/**
 * Fetches fresh Place Details from Google Places API for a single location.
 * Updates: address, phone, website_url, place_details_refreshed_at.
 *
 * Uses the Google Places API (New) — Place Details endpoint.
 */
async function refreshSinglePlace(
  location: StaleLocation,
  apiKey: string,
  db: SupabaseClient<Database>,
): Promise<{ success: boolean; error?: string }> {
  if (!location.google_place_id) {
    return { success: false, error: 'No google_place_id' };
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${location.google_place_id}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'displayName,formattedAddress,nationalPhoneNumber,regularOpeningHours,websiteUri,rating,userRatingCount',
      },
    });

    if (!response.ok) {
      return { success: false, error: `Places API error: ${response.status}` };
    }

    const data = await response.json();

    // Build update payload — only update fields that Google returned
    const update: Record<string, unknown> = {
      place_details_refreshed_at: new Date().toISOString(),
    };

    if (data.formattedAddress) {
      update.address_line1 = data.formattedAddress;
    }
    if (data.nationalPhoneNumber) {
      update.phone = data.nationalPhoneNumber;
    }
    if (data.websiteUri) {
      update.website_url = data.websiteUri;
    }

    const { error: updateError } = await db
      .from('locations')
      .update(update)
      .eq('id', location.id);

    if (updateError) {
      return { success: false, error: `DB update failed: ${updateError.message}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Finds all locations with stale Place Details (>29 days old) for
 * active-plan orgs and refreshes them from Google Places API.
 *
 * Zombie filter: Only refreshes locations where the org's plan_status
 * is 'active'. Churned orgs are excluded to prevent unnecessary API costs.
 *
 * @param supabase - Optional: pass a service-role client for testing
 * @returns Summary of refresh results
 */
export async function refreshStalePlaceDetails(
  supabase?: SupabaseClient<Database>,
): Promise<PlacesRefreshResult> {
  const db = supabase ?? createServiceRoleClient();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return { total: 0, refreshed: 0, failed: 0, skipped: 0, errors: ['GOOGLE_PLACES_API_KEY not configured'] };
  }

  // 29 days ago — refresh a day early to avoid hitting the 30-day ToS limit
  const staleBefore = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();

  // Zombie filter: only active-plan orgs
  const { data: staleLocations, error: queryError } = await db
    .from('locations')
    .select('id, org_id, google_place_id, organizations!inner(plan_status)')
    .lt('place_details_refreshed_at', staleBefore)
    .eq('organizations.plan_status' as string, 'active');

  if (queryError) {
    return { total: 0, refreshed: 0, failed: 0, skipped: 0, errors: [`Query failed: ${queryError.message}`] };
  }

  if (!staleLocations?.length) {
    return { total: 0, refreshed: 0, failed: 0, skipped: 0, errors: [] };
  }

  const errors: string[] = [];
  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const loc of staleLocations) {
    if (!loc.google_place_id) {
      skipped++;
      continue;
    }

    const result = await refreshSinglePlace(
      { id: loc.id, org_id: loc.org_id, google_place_id: loc.google_place_id },
      apiKey,
      db,
    );

    if (result.success) {
      refreshed++;
    } else {
      failed++;
      errors.push(`location=${loc.id}: ${result.error}`);
    }
  }

  return { total: staleLocations.length, refreshed, failed, skipped, errors };
}
