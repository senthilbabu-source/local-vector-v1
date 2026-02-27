// ---------------------------------------------------------------------------
// lib/services/gbp-mapper.ts — GBP → LocalVector Data Mapper
//
// Pure functions: no I/O, no Supabase, no auth.
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §4.1, §4.2
// ---------------------------------------------------------------------------

import type { GBPLocation } from '@/lib/types/gbp';
import type { HoursData, DayOfWeek } from '@/lib/types/ground-truth';
import { toUniqueSlug } from '@/lib/utils/slug';

// ── Return type for mapGBPLocationToRow ────────────────────────────────────
// Tests check every field on this interface. DO NOT omit any.

export interface MappedLocation {
  name:                  string;
  slug:                  string;
  business_name:         string;
  address_line1:         string | null;
  city:                  string | null;
  state:                 string | null;
  zip:                   string | null;
  country:               string;
  phone:                 string | null;
  website_url:           string | null;
  google_place_id:       string | null;
  google_location_name:  string;
  hours_data:            HoursData | null;
  amenities:             null;   // GBP does not expose amenities — always null per RFC §4.3
  is_primary:            boolean;
}

// ── Day mapping constants ──────────────────────────────────────────────────

const GBP_DAY_MAP: Record<string, DayOfWeek> = {
  MONDAY:    'monday',
  TUESDAY:   'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY:  'thursday',
  FRIDAY:    'friday',
  SATURDAY:  'saturday',
  SUNDAY:    'sunday',
};

const ALL_DAYS: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

function formatTime(t: { hours: number; minutes?: number }): string {
  const hh = String(t.hours).padStart(2, '0');
  const mm = String(t.minutes ?? 0).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ── Exported functions ─────────────────────────────────────────────────────

/**
 * Maps GBP regularHours to our HoursData format (Doc 03 §15.1).
 *
 * Returns null if regularHours is undefined or has no periods.
 * Days not listed in periods are set to "closed".
 * Time format: "HH:MM" (24h, zero-padded, business local time).
 */
export function mapGBPHours(
  regularHours: GBPLocation['regularHours'] | undefined
): HoursData | null {
  if (!regularHours?.periods?.length) return null;

  const result: HoursData = Object.fromEntries(
    ALL_DAYS.map((day) => [day, 'closed'])
  ) as HoursData;

  for (const period of regularHours.periods) {
    const day = GBP_DAY_MAP[period.openDay];
    if (!day) continue; // Unknown day name — skip silently

    result[day] = {
      open:  formatTime(period.openTime),
      close: formatTime(period.closeTime),
    };
  }

  return result;
}

/**
 * Maps a GBP Location API response to a LocalVector locations row.
 *
 * @param gbpLocation - Raw GBP API response object
 * @param isPrimary - Whether this should be the org's primary location
 * @returns MappedLocation ready for Supabase INSERT (add org_id at call site)
 */
export function mapGBPLocationToRow(
  gbpLocation: GBPLocation,
  isPrimary: boolean
): MappedLocation {
  const address = gbpLocation.storefrontAddress;
  const addressLine1 = address?.addressLines?.join(', ') ?? null;

  return {
    name:                 gbpLocation.title,
    slug:                 toUniqueSlug(gbpLocation.title),
    business_name:        gbpLocation.title,
    address_line1:        addressLine1,
    city:                 address?.locality ?? null,
    state:                address?.administrativeArea ?? null,
    zip:                  address?.postalCode ?? null,
    country:              address?.regionCode ?? 'US',
    phone:                gbpLocation.primaryPhone ?? null,
    website_url:          gbpLocation.websiteUri ?? null,
    google_place_id:      gbpLocation.metadata?.placeId ?? null,
    google_location_name: gbpLocation.name,
    hours_data:           mapGBPHours(gbpLocation.regularHours),
    amenities:            null,
    is_primary:           isPrimary,
  };
}
