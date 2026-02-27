// ---------------------------------------------------------------------------
// lib/services/gbp-mapper.ts — GBP → LocalVector Data Mapper
//
// Pure functions: no I/O, no Supabase, no auth.
// Spec: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §4.1, §4.2
// ---------------------------------------------------------------------------

import type { GBPLocation } from '@/lib/types/gbp';
import type { HoursData, DayOfWeek } from '@/lib/types/ground-truth';
import { toUniqueSlug } from '@/lib/utils/slug';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MappedLocation {
  name: string;
  slug: string;
  business_name: string;
  is_primary: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
  website_url: string | null;
  google_place_id: string | null;
  google_location_name: string | null;
  hours_data: HoursData | null;
  amenities: null; // GBP does not expose amenities (RFC §4.3)
}

// ---------------------------------------------------------------------------
// Day name mapping: GBP ALL_CAPS → our lowercase DayOfWeek
// ---------------------------------------------------------------------------

const GBP_DAY_MAP: Record<string, DayOfWeek> = {
  MONDAY: 'monday',
  TUESDAY: 'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY: 'thursday',
  FRIDAY: 'friday',
  SATURDAY: 'saturday',
  SUNDAY: 'sunday',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(t: { hours: number; minutes?: number }): string {
  const h = String(t.hours).padStart(2, '0');
  const m = String(t.minutes ?? 0).padStart(2, '0');
  return `${h}:${m}`;
}

// ---------------------------------------------------------------------------
// mapGBPHours — RFC §4.2
// ---------------------------------------------------------------------------

export function mapGBPHours(
  regularHours: GBPLocation['regularHours'],
): HoursData | null {
  if (!regularHours?.periods || regularHours.periods.length === 0) {
    return null;
  }

  // Initialize all 7 days as "closed"
  const hours: HoursData = {
    monday: 'closed',
    tuesday: 'closed',
    wednesday: 'closed',
    thursday: 'closed',
    friday: 'closed',
    saturday: 'closed',
    sunday: 'closed',
  };

  for (const period of regularHours.periods) {
    const day = GBP_DAY_MAP[period.openDay];
    if (!day) continue; // skip unknown day names

    hours[day] = {
      open: formatTime(period.openTime),
      close: formatTime(period.closeTime),
    };
  }

  return hours;
}

// ---------------------------------------------------------------------------
// mapGBPLocationToRow — RFC §4.1
// ---------------------------------------------------------------------------

export function mapGBPLocationToRow(
  gbpLocation: GBPLocation,
  isPrimary: boolean,
): MappedLocation {
  const addr = gbpLocation.storefrontAddress;

  return {
    name: gbpLocation.title,
    slug: toUniqueSlug(gbpLocation.title),
    business_name: gbpLocation.title,
    is_primary: isPrimary,

    // Address fields
    address_line1: addr?.addressLines?.[0] ?? null,
    address_line2:
      addr?.addressLines && addr.addressLines.length > 1
        ? addr.addressLines.slice(1).join(', ')
        : null,
    city: addr?.locality ?? null,
    state: addr?.administrativeArea ?? null,
    zip: addr?.postalCode ?? null,
    country: addr?.regionCode ?? null,

    // Contact
    phone: gbpLocation.primaryPhone ?? null,
    website_url: gbpLocation.websiteUri ?? null,

    // Google identifiers
    google_place_id: gbpLocation.metadata?.placeId ?? null,
    google_location_name: gbpLocation.name,

    // Hours
    hours_data: mapGBPHours(gbpLocation.regularHours),

    // Amenities: intentionally null — GBP does not expose them (RFC §4.3)
    amenities: null,
  };
}
