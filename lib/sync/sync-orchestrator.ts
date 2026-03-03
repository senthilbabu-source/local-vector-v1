// lib/sync/sync-orchestrator.ts — Sprint 131
//
// Triggers all connected platform syncs for a location when business info changes.
// Called from Business Info Editor after successful location update.
//
// CRITICAL RULES (AI_RULES §163):
// - syncLocationToAll() is the ONLY entry point for multi-platform sync
// - Never call apple-bc-client or bing-places-client directly from action files
// - Partial failure isolation: Apple failure does NOT block Bing
// - All errors are logged to Sentry independently

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { syncOneLocation } from '@/lib/apple-bc/apple-bc-client';
import { syncOneBingLocation } from '@/lib/bing-places/bing-places-client';
import { buildABCLocation } from '@/lib/apple-bc/apple-bc-mapper';

export interface OrchestratorResult {
  locationId: string;
  platforms: Record<string, { status: string; fieldsUpdated?: string[]; error?: string }>;
}

/**
 * Sync a location to all connected platforms.
 * Fire-and-forget friendly — never throws.
 * Logs failures to Sentry without blocking the caller.
 */
export async function syncLocationToAll(
  locationId: string,
  supabase: SupabaseClient,
): Promise<OrchestratorResult> {
  const result: OrchestratorResult = { locationId, platforms: {} };

  try {
    // Fetch location data once
    const { data: location } = await supabase
      .from('locations')
      .select('name,address_line1,city,state,zip,phone,website_url,hours_data,categories,operational_status')
      .eq('id', locationId)
      .maybeSingle();

    if (!location) {
      return { ...result, platforms: { error: { status: 'location_not_found' } } };
    }

    const locationRow = location as unknown as Parameters<typeof buildABCLocation>[0];
    // Cast needed until database.types.ts regenerated with new tables
    const db = supabase as unknown as { from: (t: string) => any };

    // Apple BC
    try {
      const { data: abcConn } = await db.from('apple_bc_connections')
        .select('apple_location_id')
        .eq('location_id', locationId)
        .eq('claim_status', 'claimed')
        .maybeSingle();

      if (abcConn?.apple_location_id) {
        const abcResult = await syncOneLocation(locationRow, abcConn.apple_location_id);
        result.platforms.apple_bc = { status: abcResult.status, fieldsUpdated: abcResult.fieldsUpdated };
      } else {
        result.platforms.apple_bc = { status: 'not_connected' };
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { orchestrator: 'apple_bc', locationId } });
      result.platforms.apple_bc = { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
      // Continue to Bing regardless
    }

    // Bing Places
    try {
      const { data: bingConn } = await db.from('bing_places_connections')
        .select('bing_listing_id')
        .eq('location_id', locationId)
        .eq('claim_status', 'claimed')
        .maybeSingle();

      if (bingConn?.bing_listing_id) {
        const bingResult = await syncOneBingLocation(locationRow, bingConn.bing_listing_id);
        result.platforms.bing = { status: bingResult.status, fieldsUpdated: bingResult.fieldsUpdated };
      } else {
        result.platforms.bing = { status: 'not_connected' };
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { orchestrator: 'bing', locationId } });
      result.platforms.bing = { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
    }
  } catch (err) {
    // Top-level catch — truly never throws. Critical for fire-and-forget usage.
    Sentry.captureException(err, { tags: { orchestrator: 'top_level', locationId } });
    result.platforms.error = { status: 'internal_error', error: err instanceof Error ? err.message : 'unknown' };
  }

  return result;
}
