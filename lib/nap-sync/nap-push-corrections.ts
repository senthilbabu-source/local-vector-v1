// ---------------------------------------------------------------------------
// lib/nap-sync/nap-push-corrections.ts — GBP correction push
//
// Sprint 105: Pushes NAP corrections to GBP via PATCH API.
// Only called for auto_correctable === true (GBP only).
// NEVER patches hours or operational_status (flagged for manual review).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { isTokenExpired, refreshGBPAccessToken } from '@/lib/services/gbp-token-refresh';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { NAPField, GroundTruth } from './types';

/** GBP PATCH request body type (subset of GBP Location object). */
export interface GBPUpdatePayload {
  title?: string;
  phoneNumbers?: { primaryPhone: string };
  storefrontAddress?: {
    addressLines: string[];
    locality: string;
    administrativeArea: string;
    postalCode: string;
    regionCode: string;
  };
  websiteUri?: string;
}

/** Fields that must NEVER be auto-patched via GBP API. */
const BLOCKED_FIELDS = new Set(['hours', 'operational_status']);

/** Patchable field → GBP updateMask segment mapping. */
const FIELD_TO_MASK: Record<string, string> = {
  name: 'title',
  phone: 'phoneNumbers',
  address: 'storefrontAddress',
  website: 'websiteUri',
};

/**
 * Builds the GBP PATCH request body and updateMask from corrections.
 * Pure function.
 */
export function buildGBPPatchBody(
  corrections: NAPField[],
  groundTruth: GroundTruth,
): { body: Partial<GBPUpdatePayload>; updateMask: string } {
  const body: Partial<GBPUpdatePayload> = {};
  const maskParts: string[] = [];

  for (const correction of corrections) {
    const fieldName = correction.field as string;
    if (BLOCKED_FIELDS.has(fieldName)) continue;

    const maskSegment = FIELD_TO_MASK[fieldName];
    if (!maskSegment) continue;

    switch (fieldName) {
      case 'name':
        body.title = groundTruth.name;
        break;
      case 'phone':
        body.phoneNumbers = { primaryPhone: groundTruth.phone };
        break;
      case 'address':
        body.storefrontAddress = {
          addressLines: [groundTruth.address],
          locality: groundTruth.city,
          administrativeArea: groundTruth.state,
          postalCode: groundTruth.zip,
          regionCode: 'US',
        };
        break;
      case 'website':
        body.websiteUri = groundTruth.website ?? '';
        break;
    }

    if (!maskParts.includes(maskSegment)) {
      maskParts.push(maskSegment);
    }
  }

  return { body, updateMask: maskParts.join(',') };
}

/**
 * Pushes NAP corrections to Google Business Profile via PATCH API.
 */
export async function pushNAPCorrections(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
  corrections: NAPField[],
  groundTruth: GroundTruth,
  gbpLocationId: string,
): Promise<{ ok: boolean; patched_fields: string[]; error?: string }> {
  try {
    // Filter out blocked fields
    const patchable = corrections.filter(
      (c) => !BLOCKED_FIELDS.has(c.field as string),
    );

    if (patchable.length === 0) {
      return { ok: true, patched_fields: [] };
    }

    // Get GBP token
    const { data: tokenRow, error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('org_id', orgId)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return { ok: false, patched_fields: [], error: 'No GBP connection found' };
    }

    let accessToken = tokenRow.access_token;
    if (isTokenExpired(tokenRow.expires_at)) {
      const refreshResult = await refreshGBPAccessToken(
        orgId,
        tokenRow.refresh_token,
        supabase,
      );
      if (!refreshResult.success || !refreshResult.newAccessToken) {
        return {
          ok: false,
          patched_fields: [],
          error: `Token refresh failed: ${refreshResult.error ?? 'unknown'}`,
        };
      }
      accessToken = refreshResult.newAccessToken;
    }

    const { body, updateMask } = buildGBPPatchBody(patchable, groundTruth);

    if (!updateMask) {
      return { ok: true, patched_fields: [] };
    }

    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpLocationId}?updateMask=${updateMask}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      return {
        ok: false,
        patched_fields: [],
        error: `GBP PATCH failed: ${response.status} — ${errorBody}`,
      };
    }

    const patchedFields = patchable.map((c) => c.field as string);

    // Update listing_snapshots with correction timestamp
    await supabase
      .from('listing_snapshots')
      .update({
        correction_pushed_at: new Date().toISOString(),
        correction_fields: patchedFields,
      })
      .eq('location_id', locationId)
      .eq('platform', 'google')
      .order('fetched_at', { ascending: false })
      .limit(1);

    return { ok: true, patched_fields: patchedFields };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'nap-push-corrections', sprint: '105' },
    });
    return {
      ok: false,
      patched_fields: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
