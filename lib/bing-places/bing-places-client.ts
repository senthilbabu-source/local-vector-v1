// lib/bing-places/bing-places-client.ts — Sprint 131
//
// Thin API client for Bing Places Partner API.
// Authentication: API key in Authorization header.
//
// SECURITY RULES (AI_RULES §163):
// - Log only: listing_id, status codes, field names
// - Rate limit: 100 req/day (log warning at 80)

import * as Sentry from '@sentry/nextjs';
import type { BingLocation, BingSyncResult } from './bing-places-types';
import { buildBingLocation } from './bing-places-mapper';

const BING_BASE_URL = 'https://api.bingplaces.com/v1';

// Track daily request count (resets on cold start)
let dailyRequestCount = 0;

async function bingFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = process.env.BING_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('BING_PLACES_API_KEY not configured');
  }

  dailyRequestCount++;
  if (dailyRequestCount >= 80) {
    console.warn(`[bing-places] Approaching daily rate limit: ${dailyRequestCount}/100 requests`);
  }

  return fetch(`${BING_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `BingPlaces-ApiKey ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });
}

/**
 * Search for Bing business listings by name + city.
 * May return multiple matches — caller must rank and choose.
 * Returns ALL matches so cron can detect conflicts.
 */
export async function searchBingBusiness(
  name: string,
  city: string,
): Promise<BingLocation[]> {
  try {
    const params = new URLSearchParams({ q: `${name} ${city}`, limit: '10' });
    const res = await bingFetch(`/listings?${params}`);
    if (!res.ok) return [];

    const data = await res.json() as { listings?: BingLocation[] };
    return data.listings ?? [];
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'bing-places', action: 'search' } });
    return [];
  }
}

/** Get a location by Bing listing ID. */
export async function getBingLocation(listingId: string): Promise<BingLocation | null> {
  try {
    const res = await bingFetch(`/listings/${listingId}`);
    if (!res.ok) return null;
    return res.json() as Promise<BingLocation>;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'bing-places', action: 'get' } });
    return null;
  }
}

/** Update a Bing listing — partial fields only. */
export async function updateBingLocation(
  listingId: string,
  fields: Partial<BingLocation>,
): Promise<boolean> {
  try {
    const res = await bingFetch(`/listings/${listingId}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    return res.ok;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'bing-places', action: 'update' } });
    return false;
  }
}

/** Close a Bing listing permanently. */
export async function closeBingLocation(listingId: string): Promise<boolean> {
  try {
    const res = await bingFetch(`/listings/${listingId}/close`, { method: 'POST' });
    return res.ok;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'bing-places', action: 'close' } });
    return false;
  }
}

/**
 * Compute field-level diff between local location and Bing data.
 * Returns only changed fields to prevent overwriting.
 */
function computeBingDiff(
  local: Partial<BingLocation>,
  bing: Partial<BingLocation> | null,
): { hasChanges: boolean; changedFields: string[]; updates: Partial<BingLocation> } {
  if (!bing) {
    return {
      hasChanges: true,
      changedFields: Object.keys(local),
      updates: local,
    };
  }

  const changedFields: string[] = [];
  const updates: Partial<BingLocation> = {};

  if (local.businessName && local.businessName !== bing.businessName) {
    changedFields.push('businessName');
    updates.businessName = local.businessName;
  }

  if (local.phone && local.phone !== bing.phone) {
    changedFields.push('phone');
    updates.phone = local.phone;
  }

  if (local.website && local.website !== bing.website) {
    changedFields.push('website');
    updates.website = local.website;
  }

  if (local.status && local.status !== bing.status) {
    changedFields.push('status');
    updates.status = local.status;
  }

  if (local.address) {
    const localAddr = JSON.stringify(local.address);
    const bingAddr = JSON.stringify(bing.address ?? {});
    if (localAddr !== bingAddr) {
      changedFields.push('address');
      updates.address = local.address;
    }
  }

  if (local.hours && local.hours.length > 0) {
    const localHours = JSON.stringify(local.hours);
    const bingHours = JSON.stringify(bing.hours ?? []);
    if (localHours !== bingHours) {
      changedFields.push('hours');
      updates.hours = local.hours;
    }
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields,
    updates,
  };
}

/**
 * Full sync for one location: fetch current Bing data, diff, update if changed.
 * Same pattern as syncOneLocation in apple-bc-client.ts.
 */
export async function syncOneBingLocation(
  locationRow: Parameters<typeof buildBingLocation>[0],
  bingListingId: string,
): Promise<BingSyncResult> {
  // Handle permanent close separately
  if (locationRow.operational_status?.toUpperCase() === 'CLOSED_PERMANENTLY') {
    const closed = await closeBingLocation(bingListingId);
    return {
      locationId: locationRow.name,
      bingListingId,
      fieldsUpdated: closed ? ['operational_status'] : [],
      status: closed ? 'success' : 'error',
      errorMessage: closed ? undefined : 'closeListing API call failed',
    };
  }

  const currentBing = await getBingLocation(bingListingId);
  const localMapped = buildBingLocation(locationRow);
  const diff = computeBingDiff(localMapped, currentBing);

  if (!diff.hasChanges) {
    return { locationId: locationRow.name, bingListingId, fieldsUpdated: [], status: 'no_changes' };
  }

  const updated = await updateBingLocation(bingListingId, diff.updates);

  return {
    locationId: locationRow.name,
    bingListingId,
    fieldsUpdated: diff.changedFields,
    status: updated ? 'success' : 'error',
    errorMessage: updated ? undefined : 'PATCH request failed',
  };
}
