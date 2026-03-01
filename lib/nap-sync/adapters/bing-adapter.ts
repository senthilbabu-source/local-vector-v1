// ---------------------------------------------------------------------------
// lib/nap-sync/adapters/bing-adapter.ts — Bing Local Search NAP adapter
//
// Sprint 105: Reads NAP data from Bing Local Search API.
// No write API — corrections are always manual (portal only).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NAPAdapter } from './base-adapter';
import type { PlatformId, AdapterResult, PlatformContext, NAPData } from '../types';

/**
 * Scores address similarity between Bing result and Ground Truth (0–1).
 * Uses normalized string comparison — lowercase, strip punctuation.
 */
export function scoreAddressSimilarity(
  bingAddress: string,
  groundTruthAddress: string,
): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,#\-]/g, ' ')
      .replace(/\bst\b/g, 'street')
      .replace(/\brd\b/g, 'road')
      .replace(/\bblvd\b/g, 'boulevard')
      .replace(/\bave\b/g, 'avenue')
      .replace(/\bdr\b/g, 'drive')
      .replace(/\bln\b/g, 'lane')
      .replace(/\bct\b/g, 'court')
      .replace(/\bste\b/g, 'suite')
      .replace(/\s+/g, ' ')
      .trim();

  const a = normalize(bingAddress);
  const b = normalize(groundTruthAddress);

  if (a === b) return 1.0;

  // Token-based Jaccard similarity
  const tokensA = new Set(a.split(' '));
  const tokensB = new Set(b.split(' '));

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export class BingNAPAdapter extends NAPAdapter {
  readonly platformId: PlatformId = 'bing';

  async fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult> {
    try {
      const apiKey = process.env.BING_SEARCH_API_KEY;
      if (!apiKey) {
        return { status: 'unconfigured', platform: 'bing', reason: 'no_api_key' };
      }

      // If we have a stored bing_listing_id, use it as part of the search
      // Otherwise, we need name + city + state from context
      const searchQuery = context.bing_listing_id ?? undefined;
      if (!searchQuery) {
        return { status: 'unconfigured', platform: 'bing', reason: 'no_bing_listing_id' };
      }

      const url = `https://api.bing.microsoft.com/v7.0/localbusinesses/search?q=${encodeURIComponent(searchQuery)}&mkt=en-US`;

      const response = await fetch(url, {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        return {
          status: 'api_error',
          platform: 'bing',
          message: `Bing API error: ${response.status} — ${errorBody}`,
          http_status: response.status,
        };
      }

      const data = await response.json();
      const places = data.places?.value ?? [];

      if (places.length === 0) {
        return { status: 'not_found', platform: 'bing' };
      }

      // Take the first result (best match from Bing)
      const place = places[0];

      const napData: NAPData = {};
      if (place.name) napData.name = place.name;
      if (place.telephone) napData.phone = place.telephone;
      if (place.url) napData.website = place.url;

      if (place.address) {
        if (place.address.streetAddress) napData.address = place.address.streetAddress;
        if (place.address.addressLocality) napData.city = place.address.addressLocality;
        if (place.address.addressRegion) napData.state = place.address.addressRegion;
        if (place.address.postalCode) napData.zip = place.address.postalCode;
      }

      // Bing Local Search does not return hours

      return {
        status: 'ok',
        platform: 'bing',
        data: napData,
        fetched_at: new Date().toISOString(),
      };
    } catch (err) {
      Sentry.captureException(err, { tags: { adapter: 'bing', sprint: '105' } });
      return {
        status: 'api_error',
        platform: 'bing',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
