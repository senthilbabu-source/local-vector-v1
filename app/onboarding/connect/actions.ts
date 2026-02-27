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
import { z } from 'zod';

type ActionResult = { success: true } | { success: false; error: string };

const InputSchema = z.object({
  locationIndex: z.number().int().min(0),
});

/**
 * importGBPLocation — Server Action
 *
 * Called from the /onboarding/connect/select picker page.
 * Reads the gbp_import_id cookie → fetches pending_gbp_imports row →
 * maps the selected GBP location → inserts into locations table.
 *
 * @param input - { locationIndex: number } — index into locations_data array
 * @returns ActionResult
 */
export async function importGBPLocation(
  input: { locationIndex: number }
): Promise<ActionResult> {
  // 1. Auth
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  // 2. Validate input
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  const { locationIndex } = parsed.data;

  // 3. Read cookie
  const cookieStore = await cookies();
  const importId = cookieStore.get('gbp_import_id')?.value;
  if (!importId) return { success: false, error: 'No pending import found' };

  // 4. Fetch pending import (belt-and-suspenders: eq both id AND org_id)
  const supabase = createServiceRoleClient();
  const { data: pending, error: pendingError } = await supabase
    .from('pending_gbp_imports')
    .select('*')
    .eq('id', importId)
    .eq('org_id', ctx.orgId)
    .single();

  if (pendingError || !pending) return { success: false, error: 'Import not found' };

  // 5. Validate org_id match
  if (pending.org_id !== ctx.orgId) return { success: false, error: 'Unauthorized — org mismatch' };

  // 6. Validate not expired
  if (new Date(pending.expires_at) < new Date()) {
    return { success: false, error: 'Import link expired. Please reconnect Google.' };
  }

  // 7. Extract location by index
  const locations = pending.locations_data as unknown as GBPLocation[];
  if (locationIndex < 0 || locationIndex >= locations.length) {
    return { success: false, error: `Invalid location index: ${locationIndex}` };
  }
  const gbpLocation = locations[locationIndex];

  // 8. Check is_primary (same logic as createLocation)
  const { count } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true);
  const isPrimary = (count ?? 0) === 0;

  // 9. Map GBP → LocalVector
  const mapped = mapGBPLocationToRow(gbpLocation, isPrimary);

  // 10. Insert location
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
    return { success: false, error: insertError?.message ?? 'Location insert failed' };
  }

  // 11. Create location_integrations row
  await supabase.from('location_integrations').upsert({
    org_id:       ctx.orgId,
    location_id:  location.id,
    platform:     'google',
    status:       'connected',
    external_id:  gbpLocation.name,
    last_sync_at: new Date().toISOString(),
  }, { onConflict: 'location_id,platform' });

  // 12. Seed SOV queries
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

  // 13. Cleanup: delete pending import + cookie
  await supabase.from('pending_gbp_imports').delete().eq('id', importId);
  cookieStore.delete('gbp_import_id');

  // 14. Revalidate
  revalidatePath('/dashboard');
  revalidatePath('/onboarding');

  return { success: true };
}
