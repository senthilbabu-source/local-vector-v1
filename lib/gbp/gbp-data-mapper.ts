// ---------------------------------------------------------------------------
// lib/gbp/gbp-data-mapper.ts — Enhanced GBP → LocalVector Data Mapper
//
// Pure functions: no I/O, no Supabase, no auth.
// Extends the base mapper (lib/services/gbp-mapper.ts) with:
//   • Amenities mapping from GBP attributes
//   • Operational status mapping from openInfo
//   • Primary category extraction
//   • gbp_synced_at support
//
// Used by the /api/gbp/import "re-sync" endpoint (Sprint 89).
// The base mapper remains in use for initial import during OAuth callback.
//
// AI_RULES §41: All GBP field transformation centralized here.
// ---------------------------------------------------------------------------

import type { GBPLocation, GBPAttribute } from '@/lib/types/gbp';
import type { HoursData, DayOfWeek } from '@/lib/types/ground-truth';

// ── Mapped output type ─────────────────────────────────────────────────────

/**
 * Partial location update ready for Supabase `.update()`.
 * Only includes fields that exist in the GBP response — never overwrites
 * existing data with null when a GBP field is absent.
 */
export interface MappedLocationData {
  business_name?: string;
  phone?: string;
  website_url?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  hours_data?: HoursData;
  operational_status?: string | null;
  amenities?: Record<string, boolean>;
  primary_category?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Known GBP attribute IDs mapped to LocalVector amenity keys.
 * Extend as new GBP attributes are discovered.
 */
export const KNOWN_AMENITY_ATTRIBUTES: Record<string, string> = {
  has_wifi:                       'wifi',
  wi_fi:                          'wifi',
  has_outdoor_seating:            'outdoor_seating',
  outdoor_seating:                'outdoor_seating',
  has_parking:                    'parking',
  parking:                        'parking',
  has_valet_parking:              'valet_parking',
  serves_alcohol:                 'alcohol',
  has_bar:                        'bar',
  has_live_music:                 'live_music',
  has_happy_hour:                 'happy_hour',
  accepts_reservations:           'reservations',
  has_takeout:                    'takeout',
  has_delivery:                   'delivery',
  has_dine_in:                    'dine_in',
  wheelchair_accessible_entrance: 'wheelchair_accessible',
};

/**
 * Day name normalization: GBP 'MONDAY' → LocalVector 'monday'.
 */
export const GBP_DAY_MAP: Record<string, DayOfWeek> = {
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

// ── Pure functions ─────────────────────────────────────────────────────────

/**
 * Formats time from GBP's { hours, minutes } to "HH:MM" string.
 * Pads single-digit hours/minutes with leading zero.
 */
export function formatTime(time: { hours: number; minutes?: number }): string {
  const hh = String(time.hours).padStart(2, '0');
  const mm = String(time.minutes ?? 0).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Maps GBP regularHours periods to LocalVector hours_data format.
 *
 * All 7 days are always present in the output.
 * Days with no period default to 'closed' (the string literal).
 * GBP periods use openDay for the entry; the closeTime is stored on the
 * same day key even when it crosses midnight (e.g. close at 02:00 = next day).
 */
export function mapHours(
  periods: NonNullable<GBPLocation['regularHours']>['periods']
): HoursData {
  const result: HoursData = Object.fromEntries(
    ALL_DAYS.map((day) => [day, 'closed' as const]),
  ) as HoursData;

  for (const period of periods) {
    const day = GBP_DAY_MAP[period.openDay];
    if (!day) continue;

    result[day] = {
      open:  formatTime(period.openTime),
      close: formatTime(period.closeTime),
    };
  }

  return result;
}

/**
 * Maps GBP openInfo.status to LocalVector operational_status.
 *
 * 'OPEN' → 'open'
 * 'CLOSED_PERMANENTLY' → 'closed_permanently'
 * 'CLOSED_TEMPORARILY' → 'closed_temporarily'
 * undefined/null/unknown → null
 */
export function mapOperationalStatus(status: string | undefined | null): string | null {
  if (!status) return null;
  switch (status) {
    case 'OPEN':                return 'open';
    case 'CLOSED_PERMANENTLY':  return 'closed_permanently';
    case 'CLOSED_TEMPORARILY':  return 'closed_temporarily';
    default:                    return null;
  }
}

/**
 * Maps GBP attributes array to LocalVector amenities record.
 * Only includes known amenity attributeIds (see KNOWN_AMENITY_ATTRIBUTES).
 * Only includes attributes where values[0] is strictly `true`.
 */
export function mapAmenities(attributes: GBPAttribute[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const attr of attributes) {
    const amenityKey = KNOWN_AMENITY_ATTRIBUTES[attr.attributeId];
    if (!amenityKey) continue;

    if (attr.values[0] === true) {
      result[amenityKey] = true;
    }
  }

  return result;
}

/**
 * Maps a raw GBP API Location object to a partial LocalVector location update.
 *
 * Pure function — no side effects.
 * Partial: only sets fields that exist in the GBP response.
 * Never overwrites with null/undefined if the GBP field is absent.
 */
export function mapGBPToLocation(gbpLocation: GBPLocation): MappedLocationData {
  const mapped: MappedLocationData = {};

  // Business name
  if (gbpLocation.title) {
    mapped.business_name = gbpLocation.title;
  }

  // Phone
  if (gbpLocation.primaryPhone) {
    mapped.phone = gbpLocation.primaryPhone;
  }

  // Website
  if (gbpLocation.websiteUri) {
    mapped.website_url = gbpLocation.websiteUri;
  }

  // Address
  const addr = gbpLocation.storefrontAddress;
  if (addr) {
    if (addr.addressLines?.length) {
      mapped.address_line1 = addr.addressLines.join(', ');
    }
    if (addr.locality) mapped.city = addr.locality;
    if (addr.administrativeArea) mapped.state = addr.administrativeArea;
    if (addr.postalCode) mapped.zip = addr.postalCode;
  }

  // Hours — only set if GBP provides periods
  if (gbpLocation.regularHours?.periods?.length) {
    mapped.hours_data = mapHours(gbpLocation.regularHours.periods);
  }

  // Operational status — only set if GBP provides openInfo
  if (gbpLocation.openInfo?.status) {
    mapped.operational_status = mapOperationalStatus(gbpLocation.openInfo.status);
  }

  // Amenities — only set if GBP provides attributes
  if (gbpLocation.attributes?.length) {
    const amenities = mapAmenities(gbpLocation.attributes);
    if (Object.keys(amenities).length > 0) {
      mapped.amenities = amenities;
    }
  }

  // Primary category
  if (gbpLocation.categories?.primaryCategory?.displayName) {
    mapped.primary_category = gbpLocation.categories.primaryCategory.displayName;
  }

  return mapped;
}
