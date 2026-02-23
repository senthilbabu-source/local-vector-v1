'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import {
  ToggleIntegrationSchema,
  SyncIntegrationSchema,
  SavePlatformUrlSchema,
  type ToggleIntegrationInput,
  type SyncIntegrationInput,
} from '@/lib/schemas/integrations';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// toggleIntegration
// ---------------------------------------------------------------------------

/**
 * Server Action: connect or disconnect a platform integration for a location.
 *
 * connect = true  → Upserts a row with status 'connected'. Uses ON CONFLICT
 *                   on (location_id, platform) so repeated connects are safe.
 * connect = false → Deletes the integration row entirely (clean disconnect).
 *
 * SECURITY: `org_id` is NEVER accepted from the client. It is derived
 * exclusively from the server-side session via `getSafeAuthContext()`.
 * The `org_isolation_insert` / `org_isolation_delete` RLS policies on
 * `location_integrations` provide a second enforcement layer.
 */
export async function toggleIntegration(
  input: ToggleIntegrationInput
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = ToggleIntegrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { location_id, platform, connect } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  if (connect) {
    // Upsert: insert if no row exists for this (location_id, platform) pair,
    // or set status back to 'connected' if the row already exists.
    // org_id is always sourced from the server-side session — never the client.
    const { error } = await supabase.from('location_integrations').upsert(
      {
        org_id: ctx.orgId,   // ALWAYS server-derived — never from client
        location_id,
        platform,
        status: 'connected',
        last_sync_at: null,  // reset on reconnect
      },
      { onConflict: 'location_id,platform' }
    );

    if (error) {
      return { success: false, error: error.message };
    }
  } else {
    // Delete the integration row. RLS org_isolation_delete ensures the row
    // belongs to the authenticated user's org before deletion proceeds.
    const { error } = await supabase
      .from('location_integrations')
      .delete()
      .eq('location_id', location_id)
      .eq('platform', platform);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath('/dashboard/integrations');
  return { success: true };
}

// ---------------------------------------------------------------------------
// mockSyncIntegration
// ---------------------------------------------------------------------------

/**
 * Server Action: simulate a sync to a third-party platform.
 *
 * Phase 8 uses a mock implementation to establish the architecture:
 *   1. Set status → 'syncing'   (DB update — visible to anyone refreshing
 *                                the page during the delay)
 *   2. Await 2 000 ms           (simulates a real API round-trip)
 *   3. Set status → 'connected' and record `last_sync_at = NOW()`
 *
 * The calling Client Component uses `useTransition` so the user sees a
 * loading state for the full duration of this action. Real API logic
 * (GBP, Apple Business Connect, Bing Places API calls) drops in at step 2
 * in Phase 8b without any structural changes to this action.
 *
 * SECURITY: `org_id` constraint is enforced by RLS `org_isolation_update`
 * on `location_integrations`. `getSafeAuthContext()` rejects unauthenticated
 * callers before any DB interaction.
 */
export async function mockSyncIntegration(
  input: SyncIntegrationInput
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = SyncIntegrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { location_id, platform } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // ── Step 1: Mark as syncing ──────────────────────────────────────────────
  // This intermediate state is visible to anyone who refreshes the page
  // during the delay — a useful real-world signal even in the mock phase.
  const { error: syncingError } = await supabase
    .from('location_integrations')
    .update({ status: 'syncing' })
    .eq('location_id', location_id)
    .eq('platform', platform);
  // RLS org_isolation_update ensures only the user's own rows are touched

  if (syncingError) {
    return { success: false, error: syncingError.message };
  }

  // ── Step 2: Simulate network latency ────────────────────────────────────
  // Replace this with real API calls (GBP, Apple, Bing) in Phase 8b.
  await new Promise((r) => setTimeout(r, 2000));

  // ── Step 3: Mark as connected and record timestamp ───────────────────────
  const { error: connectedError } = await supabase
    .from('location_integrations')
    .update({
      status: 'connected',
      last_sync_at: new Date().toISOString(),
    })
    .eq('location_id', location_id)
    .eq('platform', platform);

  if (connectedError) {
    return { success: false, error: connectedError.message };
  }

  revalidatePath('/dashboard/integrations');
  return { success: true };
}

// ---------------------------------------------------------------------------
// savePlatformUrl
// ---------------------------------------------------------------------------

/**
 * Server Action: save (upsert) a listing URL for a specific platform + location.
 *
 * Called on-blur from the URL input field in the Listings Big 6 table.
 * Phase 8b will populate listing_url automatically after OAuth connection;
 * this action gives users an immediately actionable workflow before OAuth is wired.
 *
 * SECURITY: `org_id` is NEVER accepted from the client. It is derived
 * exclusively from the server-side session via `getSafeAuthContext()`.
 * RLS `org_isolation_insert` on `location_integrations` provides a second
 * enforcement layer.
 */
export async function savePlatformUrl(
  platform: string,
  url: string,
  locationId: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = SavePlatformUrlSchema.safeParse({ platform, url, locationId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { error } = await supabase.from('location_integrations').upsert(
    {
      org_id: ctx.orgId,                      // ALWAYS server-derived — never from client
      location_id: parsed.data.locationId,
      platform: parsed.data.platform,
      listing_url: parsed.data.url,
    },
    { onConflict: 'location_id,platform' },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/integrations');
  return { success: true };
}
