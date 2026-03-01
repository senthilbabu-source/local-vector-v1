// ---------------------------------------------------------------------------
// lib/nap-sync/adapters/yelp-adapter.ts — Yelp Fusion API NAP adapter
//
// Sprint 105: Reads live NAP data from Yelp. No write API — corrections are
// always manual (guided fix instructions only).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NAPAdapter } from './base-adapter';
import type { PlatformId, AdapterResult, PlatformContext, NAPData } from '../types';

const YELP_DAY_MAP: Record<number, string> = {
  0: 'monday',
  1: 'tuesday',
  2: 'wednesday',
  3: 'thursday',
  4: 'friday',
  5: 'saturday',
  6: 'sunday',
};

interface YelpHourPeriod {
  day: number;
  start: string;
  end: string;
  is_overnight: boolean;
}

/**
 * Normalizes Yelp hours to LocalVector format.
 * Yelp: { open: [{ day: 0, start: "1700", end: "0000", is_overnight: false }] }
 * LV:   { monday: { open: "17:00", close: "00:00", closed: false } }
 */
export function normalizeYelpHours(
  yelpHours: { open: YelpHourPeriod[] }[],
): Record<string, { open: string; close: string; closed: boolean }> {
  const result: Record<string, { open: string; close: string; closed: boolean }> = {};

  if (!yelpHours?.[0]?.open) return result;

  for (const period of yelpHours[0].open) {
    const dayName = YELP_DAY_MAP[period.day];
    if (!dayName) continue;

    const openTime = `${period.start.slice(0, 2)}:${period.start.slice(2)}`;
    const closeTime = `${period.end.slice(0, 2)}:${period.end.slice(2)}`;

    result[dayName] = {
      open: openTime,
      close: closeTime,
      closed: false,
    };
  }

  return result;
}

export class YelpNAPAdapter extends NAPAdapter {
  readonly platformId: PlatformId = 'yelp';

  async fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult> {
    try {
      const apiKey = process.env.YELP_FUSION_API_KEY;
      if (!apiKey) {
        return { status: 'unconfigured', platform: 'yelp', reason: 'no_api_key' };
      }

      if (!context.yelp_business_id) {
        return { status: 'not_found', platform: 'yelp' };
      }

      const url = `https://api.yelp.com/v3/businesses/${encodeURIComponent(context.yelp_business_id)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'not_found', platform: 'yelp' };
        }
        const errorBody = await response.text().catch(() => 'unknown');
        return {
          status: 'api_error',
          platform: 'yelp',
          message: `Yelp API error: ${response.status} — ${errorBody}`,
          http_status: response.status,
        };
      }

      const data = await response.json();

      const napData: NAPData = {};
      if (data.name) napData.name = data.name;
      if (data.phone) napData.phone = data.phone;
      if (data.url) napData.website = data.url;

      if (data.location) {
        if (data.location.address1) napData.address = data.location.address1;
        if (data.location.city) napData.city = data.location.city;
        if (data.location.state) napData.state = data.location.state;
        if (data.location.zip_code) napData.zip = data.location.zip_code;
      }

      if (data.hours) {
        napData.hours = normalizeYelpHours(data.hours);
      }

      if (typeof data.is_closed === 'boolean') {
        napData.operational_status = data.is_closed ? 'closed_permanently' : 'open';
      }

      return {
        status: 'ok',
        platform: 'yelp',
        data: napData,
        fetched_at: new Date().toISOString(),
      };
    } catch (err) {
      Sentry.captureException(err, { tags: { adapter: 'yelp', sprint: '105' } });
      return {
        status: 'api_error',
        platform: 'yelp',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
