'use server';

// ---------------------------------------------------------------------------
// app/actions/apple-bc.ts — Sprint 130
//
// Server actions for Apple Business Connect connection management.
// All actions require owner role + Agency plan.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { assertOrgRole } from '@/lib/auth/org-roles';
import { planSatisfies } from '@/lib/plan-enforcer';
import { syncOneLocation } from '@/lib/apple-bc/apple-bc-client';
import { buildABCLocation } from '@/lib/apple-bc/apple-bc-mapper';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Connect a location to Apple Business Connect.
 * Owner links an Apple location ID to a LocalVector location.
 */
export async function connectAppleBC(
  locationId: string,
  appleLocationId: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Role check: owner required
  const supabase = await createClient();
  try {
    await assertOrgRole(supabase, ctx.orgId, ctx.userId, 'owner');
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'apple-bc', sprint: '130' } });
    return { success: false, error: 'Owner role required' };
  }

  // Plan check: Agency only
  if (!planSatisfies(ctx.plan, 'agency')) {
    return { success: false, error: 'Agency plan required for Apple Business Connect' };
  }

  // Upsert connection (cast needed until database.types.ts regenerated)
  const { error } = await (supabase as unknown as { from: (t: string) => any }).from('apple_bc_connections')
    .upsert({
      org_id: ctx.orgId,
      location_id: locationId,
      apple_location_id: appleLocationId,
      claim_status: 'claimed',
    }, { onConflict: 'location_id' });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/settings/connections');
  return { success: true };
}

/**
 * Disconnect a location from Apple Business Connect.
 * Deletes the connection row entirely.
 */
export async function disconnectAppleBC(locationId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();
  try {
    await assertOrgRole(supabase, ctx.orgId, ctx.userId, 'owner');
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'apple-bc', sprint: '130' } });
    return { success: false, error: 'Owner role required' };
  }

  const { error } = await (supabase as unknown as { from: (t: string) => any }).from('apple_bc_connections')
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
 * Manual sync — owner triggers immediate sync for one location.
 */
export async function manualSyncAppleBC(locationId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();
  try {
    await assertOrgRole(supabase, ctx.orgId, ctx.userId, 'owner');
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'apple-bc', sprint: '130' } });
    return { success: false, error: 'Owner role required' };
  }

  if (!planSatisfies(ctx.plan, 'agency')) {
    return { success: false, error: 'Agency plan required' };
  }

  // Get connection (cast needed until database.types.ts regenerated)
  const { data: conn } = await (supabase as unknown as { from: (t: string) => any }).from('apple_bc_connections')
    .select('apple_location_id, claim_status')
    .eq('location_id', locationId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!conn?.apple_location_id || conn.claim_status !== 'claimed') {
    return { success: false, error: 'Location not connected or not claimed' };
  }

  // Fetch location data
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
    const locationRow = location as unknown as Parameters<typeof buildABCLocation>[0];
    const result = await syncOneLocation(locationRow, conn.apple_location_id);

    // Update connection status
    await (supabase as unknown as { from: (t: string) => any }).from('apple_bc_connections')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: result.status === 'success' ? 'ok' : result.status === 'error' ? 'error' : 'no_changes',
        sync_error: result.errorMessage ?? null,
      })
      .eq('location_id', locationId)
      .eq('org_id', ctx.orgId);

    // Log sync
    await (supabase as unknown as { from: (t: string) => any }).from('apple_bc_sync_log').insert({
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
