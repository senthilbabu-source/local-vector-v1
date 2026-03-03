'use server';

// ---------------------------------------------------------------------------
// app/actions/bing-places.ts — Sprint 131
//
// Server actions for Bing Places connection management.
// All actions require owner role + Agency plan.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { assertOrgRole } from '@/lib/auth/org-roles';
import { planSatisfies } from '@/lib/plan-enforcer';
import { syncOneBingLocation } from '@/lib/bing-places/bing-places-client';
import { buildBingLocation } from '@/lib/bing-places/bing-places-mapper';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Connect a location to Bing Places.
 * Owner links a Bing listing ID to a LocalVector location.
 */
export async function connectBingPlaces(
  locationId: string,
  bingListingId: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();
  try {
    await assertOrgRole(supabase, ctx.orgId, ctx.userId, 'owner');
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'bing-places', sprint: '131' } });
    return { success: false, error: 'Owner role required' };
  }

  if (!planSatisfies(ctx.plan, 'agency')) {
    return { success: false, error: 'Agency plan required for Bing Places sync' };
  }

  // Cast needed until database.types.ts regenerated
  const { error } = await (supabase as unknown as { from: (t: string) => any }).from('bing_places_connections')
    .upsert({
      org_id: ctx.orgId,
      location_id: locationId,
      bing_listing_id: bingListingId,
      claim_status: 'claimed',
    }, { onConflict: 'location_id' });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/settings/connections');
  return { success: true };
}

/**
 * Disconnect a location from Bing Places.
 * Deletes the connection row entirely.
 */
export async function disconnectBingPlaces(locationId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();
  try {
    await assertOrgRole(supabase, ctx.orgId, ctx.userId, 'owner');
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'bing-places', sprint: '131' } });
    return { success: false, error: 'Owner role required' };
  }

  const { error } = await (supabase as unknown as { from: (t: string) => any }).from('bing_places_connections')
    .delete()
    .eq('location_id', locationId)
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/settings/connections');
  return { success: true };
}

/**
 * Manual sync — owner triggers immediate Bing sync for one location.
 */
export async function manualSyncBingPlaces(locationId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();
  try {
    await assertOrgRole(supabase, ctx.orgId, ctx.userId, 'owner');
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'bing-places', sprint: '131' } });
    return { success: false, error: 'Owner role required' };
  }

  if (!planSatisfies(ctx.plan, 'agency')) {
    return { success: false, error: 'Agency plan required' };
  }

  // Cast needed until database.types.ts regenerated
  const { data: conn } = await (supabase as unknown as { from: (t: string) => any }).from('bing_places_connections')
    .select('bing_listing_id, claim_status')
    .eq('location_id', locationId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!conn?.bing_listing_id || conn.claim_status !== 'claimed') {
    return { success: false, error: 'Location not connected or not claimed' };
  }

  const { data: location } = await supabase
    .from('locations')
    .select('name, address_line1, city, state, zip, phone, website_url, hours_data, categories, operational_status')
    .eq('id', locationId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!location) {
    return { success: false, error: 'Location not found' };
  }

  try {
    const locationRow = location as unknown as Parameters<typeof buildBingLocation>[0];
    const result = await syncOneBingLocation(locationRow, conn.bing_listing_id);

    await (supabase as unknown as { from: (t: string) => any }).from('bing_places_connections')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: result.status === 'success' ? 'ok' : result.status === 'error' ? 'error' : 'no_changes',
        sync_error: result.errorMessage ?? null,
      })
      .eq('location_id', locationId)
      .eq('org_id', ctx.orgId);

    await (supabase as unknown as { from: (t: string) => any }).from('bing_places_sync_log').insert({
      org_id: ctx.orgId,
      location_id: locationId,
      fields_updated: result.fieldsUpdated,
      status: result.status,
      error_message: result.errorMessage ?? null,
    });

    if (result.status === 'error') {
      return { success: false, error: result.errorMessage ?? 'Sync failed' };
    }

    revalidatePath('/dashboard/settings/connections');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Sync failed' };
  }
}
