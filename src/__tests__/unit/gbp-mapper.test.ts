// ---------------------------------------------------------------------------
// gbp-mapper.test.ts — Unit tests for GBP → LocalVector data mapper
//
// Sprint 89: Pure function tests. No mocks needed — the mapper has no I/O.
// These test all edge cases in mapGBPHours() and mapGBPLocationToRow().
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-mapper.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { mapGBPHours, mapGBPLocationToRow } from '@/lib/services/gbp-mapper';
import type { GBPLocation } from '@/lib/types/gbp';
import type { HoursData } from '@/lib/types/ground-truth';
import {
  MOCK_GBP_LOCATION,
  MOCK_GBP_LOCATION_MINIMAL,
  MOCK_GBP_LOCATION_NO_ADDRESS,
  MOCK_GBP_LOCATION_SECOND,
} from '@/__fixtures__/golden-tenant';

// ═══════════════════════════════════════════════════════════════════════════
// mapGBPHours — 9 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('mapGBPHours', () => {
  it('should map standard 6-day schedule correctly (Monday closed)', () => {
    const result = mapGBPHours(MOCK_GBP_LOCATION.regularHours);
    expect(result).not.toBeNull();
    const hours = result as HoursData;
    expect(hours.monday).toBe('closed');
    expect(hours.tuesday).toEqual({ open: '17:00', close: '01:00' });
    expect(hours.wednesday).toEqual({ open: '17:00', close: '01:00' });
    expect(hours.thursday).toEqual({ open: '17:00', close: '01:00' });
    expect(hours.friday).toEqual({ open: '17:00', close: '02:00' });
    expect(hours.saturday).toEqual({ open: '17:00', close: '02:00' });
    expect(hours.sunday).toEqual({ open: '17:00', close: '01:00' });
  });

  it('should return null when regularHours is undefined', () => {
    expect(mapGBPHours(undefined)).toBeNull();
  });

  it('should return null when periods array is empty', () => {
    expect(mapGBPHours({ periods: [] })).toBeNull();
  });

  it('should handle missing minutes (defaults to 00)', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17 } },
      ],
    });
    expect(result).not.toBeNull();
    expect((result as HoursData).monday).toEqual({ open: '09:00', close: '17:00' });
  });

  it('should format hours as zero-padded HH:MM', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'TUESDAY', openTime: { hours: 8, minutes: 5 }, closeDay: 'TUESDAY', closeTime: { hours: 0, minutes: 0 } },
      ],
    });
    expect(result).not.toBeNull();
    expect((result as HoursData).tuesday).toEqual({ open: '08:05', close: '00:00' });
  });

  it('should mark days without periods as "closed"', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'WEDNESDAY', openTime: { hours: 10 }, closeDay: 'WEDNESDAY', closeTime: { hours: 18 } },
      ],
    });
    const hours = result as HoursData;
    expect(hours.monday).toBe('closed');
    expect(hours.tuesday).toBe('closed');
    expect(hours.wednesday).toEqual({ open: '10:00', close: '18:00' });
    expect(hours.thursday).toBe('closed');
    expect(hours.friday).toBe('closed');
    expect(hours.saturday).toBe('closed');
    expect(hours.sunday).toBe('closed');
  });

  it('should handle midnight crossover times (close hours 0 or 1)', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'FRIDAY', openTime: { hours: 20, minutes: 0 }, closeDay: 'SATURDAY', closeTime: { hours: 3, minutes: 0 } },
      ],
    });
    expect((result as HoursData).friday).toEqual({ open: '20:00', close: '03:00' });
  });

  it('should ignore unknown day names gracefully', () => {
    const result = mapGBPHours({
      periods: [
        { openDay: 'MOONDAY', openTime: { hours: 10 }, closeDay: 'MOONDAY', closeTime: { hours: 18 } },
        { openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17 } },
      ],
    });
    expect(result).not.toBeNull();
    expect((result as HoursData).monday).toEqual({ open: '09:00', close: '17:00' });
  });

  it('should map all 7 days from MOCK_GBP_LOCATION_SECOND', () => {
    const result = mapGBPHours(MOCK_GBP_LOCATION_SECOND.regularHours);
    expect(result).not.toBeNull();
    const hours = result as HoursData;
    expect(hours.monday).toEqual({ open: '11:30', close: '22:00' });
    expect(hours.friday).toEqual({ open: '11:30', close: '00:00' });
    expect(hours.saturday).toEqual({ open: '10:00', close: '00:00' });
    expect(hours.sunday).toEqual({ open: '10:00', close: '21:00' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// mapGBPLocationToRow — 13 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('mapGBPLocationToRow', () => {
  it('should map all address fields correctly from full GBP location', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.business_name).toBe('Charcoal N Chill');
    expect(result.address_line1).toBe('11950 Jones Bridge Road, Ste 103');
    expect(result.city).toBe('Alpharetta');
    expect(result.state).toBe('GA');
    expect(result.zip).toBe('30005');
    expect(result.country).toBe('US');
  });

  it('should join multiple addressLines with ", "', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, false);
    expect(result.address_line1).toBe('11950 Jones Bridge Road, Ste 103');
  });

  it('should handle single addressLine (no join needed)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION_SECOND, false);
    expect(result.address_line1).toBe('200 Peachtree St NW');
  });

  it('should handle missing storefrontAddress (all address fields null)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION_NO_ADDRESS, false);
    expect(result.address_line1).toBeNull();
    expect(result.city).toBeNull();
    expect(result.state).toBeNull();
    expect(result.zip).toBeNull();
    expect(result.country).toBe('US');
  });

  it('should set amenities to null (GBP does not expose them per RFC §4.3)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.amenities).toBeNull();
  });

  it('should map google_place_id from metadata.placeId', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.google_place_id).toBe('ChIJi8-1ywdO9YgR9s5j-y0_1lI');
  });

  it('should map google_location_name from location.name (full resource path)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.google_location_name).toBe('accounts/123456789/locations/987654321');
  });

  it('should pass isPrimary=true through unchanged', () => {
    expect(mapGBPLocationToRow(MOCK_GBP_LOCATION, true).is_primary).toBe(true);
  });

  it('should pass isPrimary=false through unchanged', () => {
    expect(mapGBPLocationToRow(MOCK_GBP_LOCATION, false).is_primary).toBe(false);
  });

  it('should handle missing optional fields (phone, website, metadata)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION_MINIMAL, true);
    expect(result.phone).toBeNull();
    expect(result.website_url).toBeNull();
    expect(result.google_place_id).toBeNull();
    expect(result.hours_data).toBeNull();
    expect(result.business_name).toBe('Ghost Kitchen XYZ');
  });

  it('should generate a valid slug from title (lowercase, no spaces)', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.slug).toMatch(/^charcoal-n-chill/);
    expect(result.slug).not.toContain(' ');
  });

  it('should produce correct hours_data for full GBP location', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.hours_data).not.toBeNull();
    const hours = result.hours_data as HoursData;
    expect(hours.monday).toBe('closed');
    expect(hours.tuesday).toEqual({ open: '17:00', close: '01:00' });
    expect(hours.friday).toEqual({ open: '17:00', close: '02:00' });
  });

  it('should use title for both name and business_name', () => {
    const result = mapGBPLocationToRow(MOCK_GBP_LOCATION, true);
    expect(result.name).toBe('Charcoal N Chill');
    expect(result.business_name).toBe('Charcoal N Chill');
  });
});
