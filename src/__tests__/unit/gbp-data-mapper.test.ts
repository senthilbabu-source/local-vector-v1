// ---------------------------------------------------------------------------
// Unit tests for lib/gbp/gbp-data-mapper.ts — Sprint 89
//
// Pure function tests — zero mocks needed.
// Tests the enhanced GBP → LocalVector data mapper.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  mapGBPToLocation,
  mapHours,
  mapOperationalStatus,
  mapAmenities,
  formatTime,
  KNOWN_AMENITY_ATTRIBUTES,
  GBP_DAY_MAP,
} from '@/lib/gbp/gbp-data-mapper';
import {
  MOCK_GBP_LOCATION_ENRICHED,
  MOCK_GBP_MAPPED,
  MOCK_GBP_LOCATION_MINIMAL,
  MOCK_GBP_LOCATION_NO_ADDRESS,
} from '@/src/__fixtures__/golden-tenant';
import type { GBPLocation, GBPAttribute } from '@/lib/types/gbp';

// ── mapGBPToLocation ────────────────────────────────────────────────────────

describe('mapGBPToLocation', () => {
  it('maps business name from title', () => {
    const result = mapGBPToLocation({ name: 'loc/1', title: 'My Biz' } as GBPLocation);
    expect(result.business_name).toBe('My Biz');
  });

  it('maps primary phone number', () => {
    const result = mapGBPToLocation({
      name: 'loc/1',
      title: 'Test',
      primaryPhone: '+14705550123',
    } as GBPLocation);
    expect(result.phone).toBe('+14705550123');
  });

  it('maps website URI', () => {
    const result = mapGBPToLocation({
      name: 'loc/1',
      title: 'Test',
      websiteUri: 'https://example.com',
    } as GBPLocation);
    expect(result.website_url).toBe('https://example.com');
  });

  it('maps full address (addressLines joined, locality, state, zip)', () => {
    const result = mapGBPToLocation({
      name: 'loc/1',
      title: 'Test',
      storefrontAddress: {
        addressLines: ['123 Main St', 'Suite 100'],
        locality: 'Atlanta',
        administrativeArea: 'GA',
        postalCode: '30301',
      },
    } as GBPLocation);
    expect(result.address_line1).toBe('123 Main St, Suite 100');
    expect(result.city).toBe('Atlanta');
    expect(result.state).toBe('GA');
    expect(result.zip).toBe('30301');
  });

  it("maps operational_status 'OPEN' → 'open'", () => {
    const result = mapGBPToLocation({
      name: 'loc/1',
      title: 'Test',
      openInfo: { status: 'OPEN' },
    } as GBPLocation);
    expect(result.operational_status).toBe('open');
  });

  it("maps operational_status 'CLOSED_PERMANENTLY' → 'closed_permanently'", () => {
    const result = mapGBPToLocation({
      name: 'loc/1',
      title: 'Test',
      openInfo: { status: 'CLOSED_PERMANENTLY' },
    } as GBPLocation);
    expect(result.operational_status).toBe('closed_permanently');
  });

  it("maps operational_status 'CLOSED_TEMPORARILY' → 'closed_temporarily'", () => {
    const result = mapGBPToLocation({
      name: 'loc/1',
      title: 'Test',
      openInfo: { status: 'CLOSED_TEMPORARILY' },
    } as GBPLocation);
    expect(result.operational_status).toBe('closed_temporarily');
  });

  it('does not set operational_status when openInfo is undefined', () => {
    const result = mapGBPToLocation({ name: 'loc/1', title: 'Test' } as GBPLocation);
    expect(result.operational_status).toBeUndefined();
  });

  it('maps known amenity attributes to boolean amenities record', () => {
    const result = mapGBPToLocation({
      name: 'loc/1',
      title: 'Test',
      attributes: [
        { attributeId: 'has_wifi', values: [true] },
        { attributeId: 'has_outdoor_seating', values: [true] },
      ],
    } as GBPLocation);
    expect(result.amenities).toEqual({ wifi: true, outdoor_seating: true });
  });

  it('ignores unknown/unrecognized attribute IDs', () => {
    const result = mapGBPToLocation({
      name: 'loc/1',
      title: 'Test',
      attributes: [
        { attributeId: 'has_wifi', values: [true] },
        { attributeId: 'unknown_attribute_xyz', values: [true] },
      ],
    } as GBPLocation);
    expect(result.amenities).toEqual({ wifi: true });
  });

  it('maps primary category displayName', () => {
    const result = mapGBPToLocation({
      name: 'loc/1',
      title: 'Test',
      categories: { primaryCategory: { displayName: 'Restaurant' } },
    } as GBPLocation);
    expect(result.primary_category).toBe('Restaurant');
  });

  it('handles missing optional fields gracefully (no undefined in output)', () => {
    const result = mapGBPToLocation({ name: 'loc/1', title: 'Test' } as GBPLocation);
    // Should not set fields that don't exist in the GBP response
    expect(result.phone).toBeUndefined();
    expect(result.website_url).toBeUndefined();
    expect(result.address_line1).toBeUndefined();
    expect(result.hours_data).toBeUndefined();
    expect(result.operational_status).toBeUndefined();
    expect(result.amenities).toBeUndefined();
    expect(result.primary_category).toBeUndefined();
    // business_name should be set from title
    expect(result.business_name).toBe('Test');
  });

  it('maps full MOCK_GBP_LOCATION_ENRICHED → matches MOCK_GBP_MAPPED exactly', () => {
    const result = mapGBPToLocation(MOCK_GBP_LOCATION_ENRICHED);
    expect(result).toEqual(MOCK_GBP_MAPPED);
  });
});

// ── mapHours ────────────────────────────────────────────────────────────────

describe('mapHours', () => {
  it('returns all 7 days in output (even if only some in GBP periods)', () => {
    const result = mapHours([
      { openDay: 'MONDAY', openTime: { hours: 9, minutes: 0 }, closeDay: 'MONDAY', closeTime: { hours: 17, minutes: 0 } },
    ]);
    const days = Object.keys(result);
    expect(days).toHaveLength(7);
    expect(days).toContain('monday');
    expect(days).toContain('sunday');
  });

  it('maps MONDAY openTime {hours:17, minutes:0} → open: "17:00"', () => {
    const result = mapHours([
      { openDay: 'MONDAY', openTime: { hours: 17, minutes: 0 }, closeDay: 'MONDAY', closeTime: { hours: 23, minutes: 0 } },
    ]);
    const mon = result.monday;
    expect(mon).toEqual({ open: '17:00', close: '23:00' });
  });

  it('maps closeTime {hours:0, minutes:0} → close: "00:00" (midnight close)', () => {
    const result = mapHours([
      { openDay: 'FRIDAY', openTime: { hours: 17, minutes: 0 }, closeDay: 'SATURDAY', closeTime: { hours: 0, minutes: 0 } },
    ]);
    const fri = result.friday;
    expect(fri).toEqual({ open: '17:00', close: '00:00' });
  });

  it("days absent from periods default to 'closed'", () => {
    const result = mapHours([
      { openDay: 'MONDAY', openTime: { hours: 9, minutes: 0 }, closeDay: 'MONDAY', closeTime: { hours: 17, minutes: 0 } },
    ]);
    expect(result.tuesday).toBe('closed');
    expect(result.wednesday).toBe('closed');
    expect(result.sunday).toBe('closed');
  });

  it("Sunday-closed scenario: no SUNDAY period → 'closed'", () => {
    const result = mapHours([
      { openDay: 'MONDAY', openTime: { hours: 9, minutes: 0 }, closeDay: 'MONDAY', closeTime: { hours: 17, minutes: 0 } },
    ]);
    expect(result.sunday).toBe('closed');
  });

  it('maps full Charcoal N Chill hours to MOCK_GBP_MAPPED.hours_data', () => {
    const periods = MOCK_GBP_LOCATION_ENRICHED.regularHours!.periods;
    const result = mapHours(periods);
    expect(result).toEqual(MOCK_GBP_MAPPED.hours_data);
  });

  it('formats single-digit hours with leading zero ("09:00" not "9:00")', () => {
    const result = mapHours([
      { openDay: 'MONDAY', openTime: { hours: 9, minutes: 0 }, closeDay: 'MONDAY', closeTime: { hours: 17, minutes: 0 } },
    ]);
    const mon = result.monday;
    expect(mon).toEqual({ open: '09:00', close: '17:00' });
  });

  it('formats minutes with leading zero ("09:05" not "9:5")', () => {
    const result = mapHours([
      { openDay: 'MONDAY', openTime: { hours: 9, minutes: 5 }, closeDay: 'MONDAY', closeTime: { hours: 17, minutes: 30 } },
    ]);
    const mon = result.monday;
    expect(mon).toEqual({ open: '09:05', close: '17:30' });
  });
});

// ── mapOperationalStatus ────────────────────────────────────────────────────

describe('mapOperationalStatus', () => {
  it("'OPEN' → 'open'", () => {
    expect(mapOperationalStatus('OPEN')).toBe('open');
  });

  it("'CLOSED_PERMANENTLY' → 'closed_permanently'", () => {
    expect(mapOperationalStatus('CLOSED_PERMANENTLY')).toBe('closed_permanently');
  });

  it("'CLOSED_TEMPORARILY' → 'closed_temporarily'", () => {
    expect(mapOperationalStatus('CLOSED_TEMPORARILY')).toBe('closed_temporarily');
  });

  it('undefined → null', () => {
    expect(mapOperationalStatus(undefined)).toBeNull();
  });

  it('null → null', () => {
    expect(mapOperationalStatus(null)).toBeNull();
  });

  it('unknown string → null', () => {
    expect(mapOperationalStatus('SOMETHING_ELSE')).toBeNull();
  });
});

// ── mapAmenities ────────────────────────────────────────────────────────────

describe('mapAmenities', () => {
  it("'has_wifi' with [true] → { wifi: true }", () => {
    const result = mapAmenities([{ attributeId: 'has_wifi', values: [true] }]);
    expect(result).toEqual({ wifi: true });
  });

  it("'has_wifi' with [false] → does NOT include wifi (omit falsy)", () => {
    const result = mapAmenities([{ attributeId: 'has_wifi', values: [false] }]);
    expect(result).toEqual({});
  });

  it("'has_outdoor_seating' maps correctly", () => {
    const result = mapAmenities([{ attributeId: 'has_outdoor_seating', values: [true] }]);
    expect(result).toEqual({ outdoor_seating: true });
  });

  it("'serves_alcohol' maps correctly", () => {
    const result = mapAmenities([{ attributeId: 'serves_alcohol', values: [true] }]);
    expect(result).toEqual({ alcohol: true });
  });

  it('unknown attributeId is ignored', () => {
    const result = mapAmenities([{ attributeId: 'totally_unknown', values: [true] }]);
    expect(result).toEqual({});
  });

  it('empty attributes array → empty object {}', () => {
    const result = mapAmenities([]);
    expect(result).toEqual({});
  });

  it('maps all 6 Charcoal N Chill attributes correctly', () => {
    const attrs = MOCK_GBP_LOCATION_ENRICHED.attributes!;
    const result = mapAmenities(attrs);
    expect(result).toEqual(MOCK_GBP_MAPPED.amenities);
  });
});

// ── formatTime ──────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('{hours:9, minutes:0} → "09:00"', () => {
    expect(formatTime({ hours: 9, minutes: 0 })).toBe('09:00');
  });

  it('{hours:17, minutes:30} → "17:30"', () => {
    expect(formatTime({ hours: 17, minutes: 30 })).toBe('17:30');
  });

  it('{hours:0, minutes:0} → "00:00"', () => {
    expect(formatTime({ hours: 0, minutes: 0 })).toBe('00:00');
  });

  it('{hours:23, minutes:59} → "23:59"', () => {
    expect(formatTime({ hours: 23, minutes: 59 })).toBe('23:59');
  });

  it('{hours:9, minutes:5} → "09:05"', () => {
    expect(formatTime({ hours: 9, minutes: 5 })).toBe('09:05');
  });
});
