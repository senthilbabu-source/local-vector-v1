// lib/bing-places/bing-places-mapper.ts — Sprint 131
// Maps LocalVector locations row → Bing Places format.
// Reuses toE164() from apple-bc-mapper.
// PURE FUNCTIONS — no I/O.

import type { BingLocation, BingHours } from './bing-places-types';
import { BING_CATEGORY_MAP } from './bing-places-types';
import { toE164 } from '@/lib/apple-bc/apple-bc-mapper';

/**
 * Convert LocalVector hours_data JSONB to Bing regularHours array.
 * Bing uses capitalized day names (not UPPERCASE like Apple).
 */
export function toBingHours(
  hours_data: Record<string, { open?: string; close?: string; closed?: boolean } | null> | null,
): BingHours[] {
  if (!hours_data) return [];

  const dayMap: Record<string, BingHours['dayOfWeek']> = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  };

  const result: BingHours[] = [];
  for (const [day, hours] of Object.entries(hours_data)) {
    const bingDay = dayMap[day.toLowerCase()];
    if (!bingDay) continue;

    if (!hours || hours.closed) {
      result.push({ dayOfWeek: bingDay, isClosed: true });
    } else if (hours.open && hours.close) {
      result.push({ dayOfWeek: bingDay, openTime: hours.open, closeTime: hours.close });
    }
  }

  return result;
}

/**
 * Map LocalVector categories JSONB array to Bing category IDs.
 * Returns up to 3 categories.
 */
export function toBingCategories(categories: unknown[] | null): string[] {
  if (!Array.isArray(categories) || categories.length === 0) return [];

  return categories
    .map(cat => BING_CATEGORY_MAP[String(cat)] ?? null)
    .filter((c): c is string => c !== null)
    .slice(0, 3);
}

/**
 * Map LocalVector operational_status to Bing status.
 */
export function toBingStatus(
  operational_status: string | null,
): 'OPEN' | 'CLOSED' | 'TEMPORARILY_CLOSED' {
  switch (operational_status?.toUpperCase()) {
    case 'CLOSED_PERMANENTLY': return 'CLOSED';
    case 'CLOSED_TEMPORARILY': return 'TEMPORARILY_CLOSED';
    default: return 'OPEN';
  }
}

/**
 * Build a BingLocation from a LocalVector locations row.
 * Only includes non-null fields (partial update safety).
 */
export function buildBingLocation(loc: {
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
  hours_data: unknown;
  categories: unknown;
  operational_status: string | null;
}): Partial<BingLocation> {
  const result: Partial<BingLocation> = {};

  result.businessName = loc.name;

  if (loc.address_line1 && loc.city && loc.state) {
    result.address = {
      streetAddress: loc.address_line1,
      city: loc.city,
      state: loc.state,
      zipCode: loc.zip ?? '',
      country: 'US',
    };
  }

  const phone = toE164(loc.phone);
  if (phone) result.phone = phone;

  if (loc.website_url) result.website = loc.website_url;

  const hours = toBingHours(loc.hours_data as Record<string, { open?: string; close?: string; closed?: boolean } | null>);
  if (hours.length > 0) result.hours = hours;

  const cats = toBingCategories(loc.categories as unknown[]);
  if (cats.length > 0) result.categories = cats;

  result.status = toBingStatus(loc.operational_status);

  return result;
}
