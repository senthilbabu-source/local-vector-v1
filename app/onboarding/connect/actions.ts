'use server';

// ---------------------------------------------------------------------------
// app/onboarding/connect/actions.ts — GBP Location Import Action (Sprint 89)
//
// Server action for importing a selected GBP location from pending_gbp_imports.
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §4.4
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { mapGBPLocationToRow } from '@/lib/services/gbp-mapper';
import { seedSOVQueries } from '@/lib/services/sov-seed';
import type { GBPLocation } from '@/lib/types/gbp';
import type { Json } from '@/lib/supabase/database.types';

type ActionResult = { success: true } | { success: false; error: string };

export async function importGBPLocation(
  locationIndex: number,
): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  // ── Read cookie pointer ───────────────────────────────────────────────
  const cookieStore = await cookies();
  const importId = cookieStore.get('gbp_import_id')?.value;
  if (!importId) {
    return { success: false, error: 'Import session expired. Please reconnect.' };
  }

  // ── Fetch pending import (service role — no RLS grants) ───────────────
  const supabase = createServiceRoleClient();
  const { data: pending, error: fetchError } = await supabase
    .from('pending_gbp_imports')
    .select('*')
    .eq('id', importId)
    .single();

  if (fetchError || !pending) {
    return { success: false, error: 'Import session not found. Please reconnect.' };
  }

  // Validate org ownership
  if (pending.org_id !== ctx.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Validate expiry
  if (new Date(pending.expires_at) < new Date()) {
    return { success: false, error: 'Import session expired. Please reconnect.' };
  }

  // ── Extract selected location ─────────────────────────────────────────
  const locations = pending.locations_data as unknown as GBPLocation[];
  if (locationIndex < 0 || locationIndex >= locations.length) {
    return { success: false, error: 'Invalid location selection.' };
  }
  const gbpLocation = locations[locationIndex];

  // ── Check is_primary rule ─────────────────────────────────────────────
  const { count } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true);
  const isPrimary = (count ?? 0) === 0;

  // ── Map + insert location ─────────────────────────────────────────────
  const mapped = mapGBPLocationToRow(gbpLocation, isPrimary);

  const { data: location, error: insertError } = await supabase
    .from('locations')
    .insert({
      ...mapped,
      org_id: ctx.orgId,
      hours_data: mapped.hours_data as unknown as Json,
      amenities: mapped.amenities as unknown as Json,
    })
    .select('id')
    .single();

  if (insertError || !location) {
    console.error('[gbp-import] Location insert failed:', insertError?.message);
    return { success: false, error: 'Failed to import location.' };
  }

  // ── Create location_integrations row ──────────────────────────────────
  await supabase.from('location_integrations').upsert(
    {
      org_id: ctx.orgId,
      location_id: location.id,
      platform: 'google',
      status: 'connected',
      external_id: gbpLocation.name,
      last_sync_at: new Date().toISOString(),
    },
    { onConflict: 'location_id,platform' },
  );

  // ── Seed SOV queries ──────────────────────────────────────────────────
  await seedSOVQueries(
    {
      id: location.id,
      org_id: ctx.orgId,
      business_name: mapped.business_name,
      city: mapped.city,
      state: mapped.state,
      categories: null,
    },
    [],
    supabase,
  );

  // ── Cleanup ───────────────────────────────────────────────────────────
  await supabase
    .from('pending_gbp_imports')
    .delete()
    .eq('id', importId);

  cookieStore.delete('gbp_import_id');

  revalidatePath('/dashboard');
  revalidatePath('/onboarding');

  return { success: true };
}
