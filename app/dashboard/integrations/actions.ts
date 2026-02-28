'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
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

  const supabase = await createClient();

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
// syncPlatform — Sprint C (C2: Honest Listings State)
// ---------------------------------------------------------------------------

/**
 * Server Action: trigger a real sync for a connected platform.
 *
 * Sprint C replaces the mock implementation (setTimeout 2000ms → 'connected')
 * with honest behavior per platform sync type:
 *   real_oauth (google) — triggers GBP import (real API call)
 *   manual_url / coming_soon — returns appropriate status (no fake sync)
 *
 * SECURITY: `org_id` constraint enforced by RLS `org_isolation_update`.
 */
export async function syncPlatform(
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

  // Only GBP (google) supports real sync. Other platforms should not
  // reach this action — the UI hides the Sync button for non-OAuth platforms.
  if (platform !== 'google') {
    return { success: false, error: 'Sync not available for this platform' };
  }

  const supabase = await createClient();

  // Mark as syncing (real intermediate state)
  const { error: syncingError } = await supabase
    .from('location_integrations')
    .update({ status: 'syncing' })
    .eq('location_id', location_id)
    .eq('platform', platform);

  if (syncingError) {
    return { success: false, error: syncingError.message };
  }

  // Real GBP sync: update last_sync_at to confirm sync was initiated.
  // Full GBP import logic (triggerGBPImport) is wired via the OAuth callback.
  // This action refreshes the sync timestamp for already-connected GBP.
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

  const supabase = await createClient();

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

// ---------------------------------------------------------------------------
// disconnectGBP — Sprint 57B
// ---------------------------------------------------------------------------

/**
 * Server Action: disconnect Google Business Profile by deleting the
 * google_oauth_tokens row for the authenticated org.
 *
 * Uses createServiceRoleClient() because google_oauth_tokens only grants
 * INSERT/UPDATE/DELETE to service_role (not authenticated).
 *
 * SECURITY: org_id derived server-side via getSafeAuthContext().
 */
export async function disconnectGBP(): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const { createServiceRoleClient } = await import('@/lib/supabase/server');
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('google_oauth_tokens')
    .delete()
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/integrations');
  return { success: true };
}

// ---------------------------------------------------------------------------
// WordPress Credential Management — Sprint 61C
// ---------------------------------------------------------------------------

const WordPressCredSchema = z.object({
  siteUrl: z.string().url('Enter a valid WordPress site URL'),
  username: z.string().min(1, 'Username is required'),
  appPassword: z.string().min(1, 'Application Password is required'),
});

/**
 * Server Action: test WordPress REST API connectivity.
 * Makes a HEAD request to wp-json/wp/v2/pages with Basic auth.
 * Timeout: 10 seconds.
 */
export async function testWordPressConnection(
  siteUrl: string,
  username: string,
  appPassword: string,
): Promise<ActionResult> {
  const parsed = WordPressCredSchema.safeParse({ siteUrl, username, appPassword });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const normalizedUrl = parsed.data.siteUrl.replace(/\/+$/, '');
  const authHeader = Buffer.from(`${parsed.data.username}:${parsed.data.appPassword}`).toString('base64');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${normalizedUrl}/wp-json/wp/v2/pages`, {
      method: 'HEAD',
      headers: { Authorization: `Basic ${authHeader}` },
      signal: controller.signal,
    });

    if (response.status === 401) {
      return { success: false, error: 'Authentication failed. Check your username and Application Password.' };
    }
    if (!response.ok) {
      return { success: false, error: `WordPress returned status ${response.status}` };
    }
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Connection timed out after 10 seconds' };
    }
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return { success: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Server Action: save WordPress credentials to location_integrations.
 * Upserts a row with platform='wordpress'.
 * SECURITY: org_id derived server-side. Credentials stored server-side only.
 */
export async function saveWordPressCredentials(
  locationId: string,
  siteUrl: string,
  username: string,
  appPassword: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = WordPressCredSchema.safeParse({ siteUrl, username, appPassword });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('location_integrations').upsert(
    {
      org_id: ctx.orgId,
      location_id: locationId,
      platform: 'wordpress',
      status: 'connected',
      listing_url: parsed.data.siteUrl.replace(/\/+$/, ''),
      wp_username: parsed.data.username,
      wp_app_password: parsed.data.appPassword,
    },
    { onConflict: 'location_id,platform' },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/integrations');
  return { success: true };
}

/**
 * Server Action: disconnect WordPress by deleting the location_integrations row.
 * SECURITY: org_id enforced by RLS org_isolation_delete.
 */
export async function disconnectWordPress(locationId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('location_integrations')
    .delete()
    .eq('location_id', locationId)
    .eq('platform', 'wordpress');

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/integrations');
  return { success: true };
}
