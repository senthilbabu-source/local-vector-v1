// ---------------------------------------------------------------------------
// lib/nap-sync/adapters/apple-maps-adapter.ts — Apple Maps NAP adapter
//
// Sprint 105: Reads NAP data via Apple MapKit JS Server API.
// No write API — corrections are always manual (portal only).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NAPAdapter } from './base-adapter';
import type { PlatformId, AdapterResult, PlatformContext, NAPData } from '../types';

/**
 * Generates a signed MapKit JWT for Apple Maps Server API calls.
 * Uses APPLE_MAPS_PRIVATE_KEY (PEM string), APPLE_MAPS_KEY_ID, APPLE_MAPS_TEAM_ID.
 */
async function generateAppleMapsJWT(): Promise<string> {
  const privateKey = process.env.APPLE_MAPS_PRIVATE_KEY;
  const keyId = process.env.APPLE_MAPS_KEY_ID;
  const teamId = process.env.APPLE_MAPS_TEAM_ID;

  if (!privateKey || !keyId || !teamId) {
    throw new Error('Apple Maps credentials not configured');
  }

  // Import the private key for ES256 signing
  const keyData = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  // Build JWT header + payload
  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 1800, // 30 minutes
  };

  const toBase64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const encodedHeader = toBase64Url(header);
  const encodedPayload = toBase64Url(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${encodedSignature}`;
}

export class AppleMapsNAPAdapter extends NAPAdapter {
  readonly platformId: PlatformId = 'apple_maps';

  async fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult> {
    try {
      const hasCredentials =
        process.env.APPLE_MAPS_PRIVATE_KEY &&
        process.env.APPLE_MAPS_KEY_ID &&
        process.env.APPLE_MAPS_TEAM_ID;

      if (!hasCredentials) {
        return { status: 'unconfigured', platform: 'apple_maps', reason: 'no_credentials' };
      }

      const jwt = await generateAppleMapsJWT();

      // Use place search by name + address to find the business
      const searchQuery = context.apple_maps_id
        ? context.apple_maps_id
        : undefined;

      if (!searchQuery) {
        return { status: 'unconfigured', platform: 'apple_maps', reason: 'no_apple_maps_id' };
      }

      // Apple Maps Server API — search for place by ID
      const url = `https://maps-api.apple.com/v1/place/${encodeURIComponent(searchQuery)}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'not_found', platform: 'apple_maps' };
        }
        const errorBody = await response.text().catch(() => 'unknown');
        return {
          status: 'api_error',
          platform: 'apple_maps',
          message: `Apple Maps API error: ${response.status} — ${errorBody}`,
          http_status: response.status,
        };
      }

      const data = await response.json();

      const napData: NAPData = {};
      if (data.name) napData.name = data.name;
      if (data.formattedAddressLines?.[0]) napData.address = data.formattedAddressLines[0];
      if (data.locality) napData.city = data.locality;
      if (data.administrativeArea) napData.state = data.administrativeArea;
      if (data.postCode) napData.zip = data.postCode;
      if (data.telephone) napData.phone = data.telephone;
      if (data.urls?.[0]) napData.website = data.urls[0];

      return {
        status: 'ok',
        platform: 'apple_maps',
        data: napData,
        fetched_at: new Date().toISOString(),
      };
    } catch (err) {
      Sentry.captureException(err, { tags: { adapter: 'apple_maps', sprint: '105' } });
      return {
        status: 'api_error',
        platform: 'apple_maps',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
