// lib/apple-bc/apple-bc-client.ts — Sprint 130
//
// Thin API client for Apple Business Connect REST API.
// Authentication: ES256 JWT client credentials flow.
//
// SECURITY RULES (AI_RULES §162):
// - NEVER log the private key (APPLE_BC_PRIVATE_KEY env var)
// - NEVER log access tokens
// - Log only: location_id, status codes, field names
// - Token cache in module-level variable (1hr expiry)

import * as Sentry from '@sentry/nextjs';
import type { ABCLocation, ABCSyncResult } from './apple-bc-types';
import { buildABCLocation } from './apple-bc-mapper';
import { computeLocationDiff } from './apple-bc-diff';

const ABC_BASE_URL = 'https://api.businessconnect.apple.com/v1';

// Module-level token cache (resets on cold start, which is fine — just re-auths)
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Generate and cache an Apple BC access token.
 * Uses ES256 JWT assertion (client_credentials grant).
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken; // Still valid with 1-min buffer
  }

  const clientId = process.env.APPLE_BC_CLIENT_ID;
  const privateKey = process.env.APPLE_BC_PRIVATE_KEY;

  if (!clientId || !privateKey) {
    throw new Error('APPLE_BC_CLIENT_ID or APPLE_BC_PRIVATE_KEY not configured');
  }

  // Import jose for ES256 JWT signing
  const { SignJWT, importPKCS8 } = await import('jose');

  const key = await importPKCS8(privateKey, 'ES256');
  const jwt = await new SignJWT({ sub: clientId })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(clientId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);

  const response = await fetch(`${ABC_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: jwt,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`ABC auth failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return cachedToken;
}

async function abcFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${ABC_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });
}

/** Search for an existing Apple BC listing by name + city. */
export async function searchABCLocation(
  name: string,
  city: string,
): Promise<ABCLocation | null> {
  try {
    const params = new URLSearchParams({ q: `${name} ${city}`, limit: '5' });
    const res = await abcFetch(`/locations?${params}`);
    if (!res.ok) return null;

    const data = await res.json() as { locations?: ABCLocation[] };
    if (!data.locations || data.locations.length === 0) return null;

    // Return first result (rank by name similarity in the cron)
    return data.locations[0] ?? null;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'apple-bc', action: 'search' } });
    return null;
  }
}

/** Get a location by Apple location ID. */
export async function getABCLocation(appleLocationId: string): Promise<ABCLocation | null> {
  try {
    const res = await abcFetch(`/locations/${appleLocationId}`);
    if (!res.ok) return null;
    return res.json() as Promise<ABCLocation>;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'apple-bc', action: 'get' } });
    return null;
  }
}

/** Update a location — partial fields only. Returns updated location. */
export async function updateABCLocation(
  appleLocationId: string,
  fields: Partial<ABCLocation>,
): Promise<boolean> {
  try {
    const res = await abcFetch(`/locations/${appleLocationId}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    return res.ok;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'apple-bc', action: 'update' } });
    return false;
  }
}

/** Permanently close a location (separate endpoint from update). */
export async function closeABCLocation(appleLocationId: string): Promise<boolean> {
  try {
    const res = await abcFetch(`/locations/${appleLocationId}/close`, { method: 'POST' });
    return res.ok;
  } catch (err) {
    Sentry.captureException(err, { tags: { client: 'apple-bc', action: 'close' } });
    return false;
  }
}

/**
 * Full sync for one location: fetch current Apple data, diff, update if changed.
 * This is the main function called by the cron.
 */
export async function syncOneLocation(
  locationRow: Parameters<typeof buildABCLocation>[0],
  appleLocationId: string,
): Promise<ABCSyncResult> {
  // Handle permanent close separately
  if (locationRow.operational_status?.toUpperCase() === 'CLOSED_PERMANENTLY') {
    const closed = await closeABCLocation(appleLocationId);
    return {
      locationId: locationRow.name,
      appleLocationId,
      fieldsUpdated: closed ? ['operational_status'] : [],
      status: closed ? 'success' : 'error',
      errorMessage: closed ? undefined : 'closeLocation API call failed',
    };
  }

  const currentApple = await getABCLocation(appleLocationId);
  const localMapped = buildABCLocation(locationRow);
  const diff = computeLocationDiff(localMapped, currentApple);

  if (!diff.hasChanges) {
    return { locationId: locationRow.name, appleLocationId, fieldsUpdated: [], status: 'no_changes' };
  }

  const updated = await updateABCLocation(appleLocationId, diff.updates);

  return {
    locationId: locationRow.name,
    appleLocationId,
    fieldsUpdated: diff.changedFields,
    status: updated ? 'success' : 'error',
    errorMessage: updated ? undefined : 'PATCH request failed',
  };
}
