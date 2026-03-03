// ---------------------------------------------------------------------------
// GET /api/cron/apple-bc-sync — Nightly Apple Business Connect Sync
//
// Sprint 130: Pushes changed location data to Apple BC for Agency orgs.
// Schedule: "30 3 * * *" (3:30 AM UTC nightly)
// Kill switch: APPLE_BC_CRON_DISABLED=true
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies } from '@/lib/plan-enforcer';
import { syncOneLocation } from '@/lib/apple-bc/apple-bc-client';
import { buildABCLocation } from '@/lib/apple-bc/apple-bc-mapper';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  // Kill switch
  if (process.env.APPLE_BC_CRON_DISABLED === 'true') {
    return NextResponse.json({ skipped: true, reason: 'kill switch' });
  }

  // Auth guard
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceRoleClient();
  // Cast needed until database.types.ts regenerated with new tables
  const db = supabase as unknown as { from: (t: string) => any };

  // Fetch all active apple_bc_connections for claimed locations (Agency orgs only)
  const { data: connections } = await db.from('apple_bc_connections')
    .select(`
      id, location_id, apple_location_id, org_id,
      locations!inner(name, address_line1, city, state, zip, phone, website_url, hours_data, categories, operational_status),
      organizations!inner(plan)
    `)
    .eq('claim_status', 'claimed')
    .not('apple_location_id', 'is', null);

  let synced = 0, failed = 0, skipped = 0;

  for (const conn of connections ?? []) {
    // Agency plan check
    const orgPlan = (conn.organizations as unknown as { plan: string })?.plan;
    if (!planSatisfies(orgPlan, 'agency')) {
      skipped++;
      continue;
    }

    try {
      const locationData = conn.locations as unknown as Parameters<typeof buildABCLocation>[0];
      const result = await syncOneLocation(locationData, conn.apple_location_id!);

      // Update connection row
      await db.from('apple_bc_connections')
        .update({
          last_synced_at: new Date().toISOString(),
          sync_status: result.status === 'success' ? 'ok' : result.status === 'error' ? 'error' : result.status === 'no_changes' ? 'no_changes' : 'pending',
          sync_error: result.errorMessage ?? null,
        })
        .eq('id', conn.id);

      // Write sync log
      await db.from('apple_bc_sync_log').insert({
        org_id: conn.org_id,
        location_id: conn.location_id,
        fields_updated: result.fieldsUpdated,
        status: result.status,
        error_message: result.errorMessage ?? null,
      });

      result.status === 'error' ? failed++ : synced++;
    } catch (err) {
      failed++;
      Sentry.captureException(err, { tags: { cron: 'apple-bc-sync', locationId: conn.location_id } });
    }
  }

  return NextResponse.json({ synced, failed, skipped, total: (connections ?? []).length });
}
