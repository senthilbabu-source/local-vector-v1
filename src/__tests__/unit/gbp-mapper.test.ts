// ---------------------------------------------------------------------------
// src/__tests__/unit/gbp-mapper.test.ts
//
// Sprint 89: Pure function tests for GBP → LocalVector mapper.
// No Supabase mocks needed — pure mapping logic only.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  mapGBPHours,
  mapGBPLocationToRow,
} from '@/lib/services/gbp-mapper';
import type { GBPLocation } from '@/lib/types/gbp';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_GBP_LOCATION: GBPLocation = {
  name: 'accounts/123456/locations/987654',
  title: 'Charcoal N Chill',
  storefrontAddress: {
    addressLines: ['123 Main St', 'Suite 100'],
    locality: 'Atlanta',
    administrativeArea: 'GA',
    postalCode: '30301',
    regionCode: 'US',
  },
  regularHours: {
    periods: [
      { openDay: 'MONDAY', openTime: { hours: 11, minutes: 0 }, closeDay: 'MONDAY', closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'TUESDAY', openTime: { hours: 11, minutes: 0 }, closeDay: 'TUESDAY', closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'WEDNESDAY', openTime: { hours: 11, minutes: 0 }, closeDay: 'WEDNESDAY', closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'THURSDAY', openTime: { hours: 11, minutes: 0 }, closeDay: 'THURSDAY', closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'FRIDAY', openTime: { hours: 11, minutes: 0 }, closeDay: 'FRIDAY', closeTime: { hours: 23, minutes: 30 } },
      { openDay: 'SATURDAY', openTime: { hours: 10, minutes: 0 }, closeDay: 'SATURDAY', closeTime: { hours: 23, minutes: 30 } },
      { openDay: 'SUNDAY', openTime: { hours: 10, minutes: 0 }, closeDay: 'SUNDAY', closeTime: { hours: 21, minutes: 0 } },
    ],
  },
  primaryPhone: '(470) 546-4866',
  websiteUri: 'https://charcoalnchill.com',
  metadata: {
    placeId: 'ChIJxxxxxxxxxx',
    mapsUri: 'https://maps.google.com/?cid=123',
    newReviewUri: 'https://search.google.com/local/writereview?placeid=ChIJxxxxxxxxxx',
  },
};

const MINIMAL_GBP_LOCATION: GBPLocation = {
  name: 'accounts/111/locations/222',
  title: 'Bare Minimum Spot',
};

// ---------------------------------------------------------------------------
// mapGBPHours
// ---------------------------------------------------------------------------

describe('mapGBPHours', () => {
  it('maps standard 7-day schedule correctly', () => {
    const result = mapGBPHours(FULL_GBP_LOCATION.regularHours);
    expect(result).not.toBeNull();
    expect(result!.monday).toEqual({ open: '11:00', close: '22:00' });
    expect(result!.friday).toEqual({ open: '11:00', close: '23:30' });
    expect(result!.saturday).toEqual({ open: '10:00', close: '23:30' });
    expect(result!.sunday).toEqual({ open: '10:00', close: '21:00' });
  });

  it('returns null when regularHours is undefined', () => {
    expect(mapGBPHours(undefined)).toBeNull();
  });

  it('returns null when periods array is empty', () => {
    expect(mapGBPHours({ periods: [] })).toBeNull();
  });

  it('handles missing minutes (defaults to 00)', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17 } },
      ],
    });
    expect(result!.monday).toEqual({ open: '09:00', close: '17:00' });
  });

  it('formats hours as zero-padded HH:MM', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'TUESDAY', openTime: { hours: 6, minutes: 5 }, closeDay: 'TUESDAY', closeTime: { hours: 1, minutes: 0 } },
      ],
    });
    expect(result!.tuesday).toEqual({ open: '06:05', close: '01:00' });
  });

  it('marks days without periods as "closed"', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'WEDNESDAY', openTime: { hours: 12 }, closeDay: 'WEDNESDAY', closeTime: { hours: 20 } },
      ],
    });
    expect(result!.wednesday).toEqual({ open: '12:00', close: '20:00' });
    expect(result!.monday).toBe('closed');
    expect(result!.tuesday).toBe('closed');
    expect(result!.thursday).toBe('closed');
    expect(result!.friday).toBe('closed');
    expect(result!.saturday).toBe('closed');
    expect(result!.sunday).toBe('closed');
  });

  it('handles midnight crossover (closeTime hours=0)', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'FRIDAY', openTime: { hours: 18 }, closeDay: 'SATURDAY', closeTime: { hours: 0, minutes: 0 } },
      ],
    });
    expect(result!.friday).toEqual({ open: '18:00', close: '00:00' });
  });

  it('ignores unknown day names gracefully', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'FUNDAY', openTime: { hours: 10 }, closeDay: 'FUNDAY', closeTime: { hours: 18 } },
        { openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17 } },
      ],
    });
    expect(result!.monday).toEqual({ open: '09:00', close: '17:00' });
    // All other days remain "closed", no crash on FUNDAY
    expect(result!.tuesday).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// mapGBPLocationToRow
// ---------------------------------------------------------------------------

describe('mapGBPLocationToRow', () => {
  it('maps all address fields correctly', () => {
    const result = mapGBPLocationToRow(FULL_GBP_LOCATION, true);
    expect(result.address_line1).toBe('123 Main St');
    expect(result.city).toBe('Atlanta');
    expect(result.state).toBe('GA');
    expect(result.zip).toBe('30301');
    expect(result.country).toBe('US');
  });

  it('joins multiple addressLines with ", "', () => {
    const result = mapGBPLocationToRow(FULL_GBP_LOCATION, true);
    expect(result.address_line1).toBe('123 Main St');
    expect(result.address_line2).toBe('Suite 100');
  });

  it('handles single addressLine (no address_line2)', () => {
    const loc: GBPLocation = {
      ...FULL_GBP_LOCATION,
      storefrontAddress: {
        addressLines: ['456 Oak Ave'],
        locality: 'Miami',
        administrativeArea: 'FL',
        postalCode: '33101',
      },
    };
    const result = mapGBPLocationToRow(loc, false);
    expect(result.address_line1).toBe('456 Oak Ave');
    expect(result.address_line2).toBeNull();
  });

  it('handles missing storefrontAddress (all address fields null)', () => {
    const result = mapGBPLocationToRow(MINIMAL_GBP_LOCATION, true);
    expect(result.address_line1).toBeNull();
    expect(result.address_line2).toBeNull();
    expect(result.city).toBeNull();
    expect(result.state).toBeNull();
    expect(result.zip).toBeNull();
    expect(result.country).toBeNull();
  });

  it('sets amenities to null (GBP does not expose them)', () => {
    const result = mapGBPLocationToRow(FULL_GBP_LOCATION, true);
    expect(result.amenities).toBeNull();
  });

  it('maps google_place_id from metadata.placeId', () => {
    const result = mapGBPLocationToRow(FULL_GBP_LOCATION, true);
    expect(result.google_place_id).toBe('ChIJxxxxxxxxxx');
  });

  it('maps google_location_name from location.name', () => {
    const result = mapGBPLocationToRow(FULL_GBP_LOCATION, true);
    expect(result.google_location_name).toBe('accounts/123456/locations/987654');
  });

  it('passes isPrimary through unchanged', () => {
    expect(mapGBPLocationToRow(FULL_GBP_LOCATION, true).is_primary).toBe(true);
    expect(mapGBPLocationToRow(FULL_GBP_LOCATION, false).is_primary).toBe(false);
  });

  it('handles missing optional fields (phone, website, metadata)', () => {
    const result = mapGBPLocationToRow(MINIMAL_GBP_LOCATION, false);
    expect(result.phone).toBeNull();
    expect(result.website_url).toBeNull();
    expect(result.google_place_id).toBeNull();
  });

  it('generates a valid slug from title', () => {
    const result = mapGBPLocationToRow(FULL_GBP_LOCATION, true);
    expect(result.slug).toMatch(/^charcoal-n-chill-[a-z0-9]+$/);
  });

  it('maps business_name from title', () => {
    const result = mapGBPLocationToRow(FULL_GBP_LOCATION, true);
    expect(result.business_name).toBe('Charcoal N Chill');
    expect(result.name).toBe('Charcoal N Chill');
  });

  it('maps hours_data via mapGBPHours', () => {
    const result = mapGBPLocationToRow(FULL_GBP_LOCATION, true);
    expect(result.hours_data).not.toBeNull();
    expect(result.hours_data!.monday).toEqual({ open: '11:00', close: '22:00' });
  });

  it('sets hours_data to null when no regularHours', () => {
    const result = mapGBPLocationToRow(MINIMAL_GBP_LOCATION, false);
    expect(result.hours_data).toBeNull();
  });

  it('handles storefrontAddress with empty addressLines', () => {
    const loc: GBPLocation = {
      ...FULL_GBP_LOCATION,
      storefrontAddress: {
        addressLines: [],
        locality: 'Denver',
      },
    };
    const result = mapGBPLocationToRow(loc, true);
    expect(result.address_line1).toBeNull();
    expect(result.address_line2).toBeNull();
    expect(result.city).toBe('Denver');
  });

  it('maps phone and website from GBP fields', () => {
    const result = mapGBPLocationToRow(FULL_GBP_LOCATION, true);
    expect(result.phone).toBe('(470) 546-4866');
    expect(result.website_url).toBe('https://charcoalnchill.com');
  });
});
