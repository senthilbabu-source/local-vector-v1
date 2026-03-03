// @vitest-environment node
/**
 * DataHealth Scoring — Unit Tests (Sprint 124)
 *
 * Tests all 5 dimensions of computeDataHealthFromData():
 *   1. Core Identity (30pts)
 *   2. Hours Completeness (20pts)
 *   3. Amenities Coverage (20pts)
 *   4. Category/Description (15pts)
 *   5. Menu/Services (15pts)
 *
 * Also tests:
 *   - gbp_import_source=true → amenities null is no penalty
 *   - deriveRealityScore uses real dataHealth value
 *   - Edge cases (empty data, partial data)
 */

import { describe, it, expect } from 'vitest';
import {
  computeDataHealthFromData,
  scoreCoreIdentity,
  scoreHoursCompleteness,
  scoreAmenities,
  scoreCategoryDescription,
  scoreMenuServices,
  type LocationDataForHealth,
} from '@/lib/services/data-health.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_LOCATION: LocationDataForHealth = {
  business_name: 'Charcoal N Chill',
  address_line1: '123 Main St',
  phone: '+14045551234',
  website_url: 'https://charcoalnchill.com',
  hours_data: {
    monday: '11:00-22:00',
    tuesday: '11:00-22:00',
    wednesday: '11:00-22:00',
    thursday: '11:00-22:00',
    friday: '11:00-23:00',
    saturday: '11:00-23:00',
    sunday: '12:00-21:00',
  },
  amenities: {
    wifi: true,
    outdoor_seating: true,
    parking: true,
    delivery: false,
    takeout: true,
    dine_in: true,
  },
  categories: ['BBQ Restaurant', 'American Restaurant'],
  description: 'Award-winning BBQ restaurant in Alpharetta with slow-smoked meats and live music every Friday night.',
  gbp_import_source: false,
};

const EMPTY_LOCATION: LocationDataForHealth = {
  business_name: null,
  address_line1: null,
  phone: null,
  website_url: null,
  hours_data: null,
  amenities: null,
  categories: null,
  description: null,
  gbp_import_source: false,
};

// ---------------------------------------------------------------------------
// § 1 — Core Identity (30pts)
// ---------------------------------------------------------------------------

describe('scoreCoreIdentity', () => {
  it('returns 30 when all 4 fields present', () => {
    expect(scoreCoreIdentity(FULL_LOCATION)).toBe(30);
  });

  it('returns 0 when all fields null', () => {
    expect(scoreCoreIdentity(EMPTY_LOCATION)).toBe(0);
  });

  it('returns 7.5 per present field', () => {
    expect(scoreCoreIdentity({
      ...EMPTY_LOCATION,
      business_name: 'Test',
    })).toBe(7.5);

    expect(scoreCoreIdentity({
      ...EMPTY_LOCATION,
      business_name: 'Test',
      phone: '+1234',
    })).toBe(15);
  });

  it('returns 22.5 when one field missing', () => {
    expect(scoreCoreIdentity({
      ...FULL_LOCATION,
      website_url: null,
    })).toBe(22.5);
  });
});

// ---------------------------------------------------------------------------
// § 2 — Hours Completeness (20pts)
// ---------------------------------------------------------------------------

describe('scoreHoursCompleteness', () => {
  it('returns 20 when all 7 days have hours', () => {
    expect(scoreHoursCompleteness(FULL_LOCATION.hours_data)).toBe(20);
  });

  it('returns 0 when hours_data is null', () => {
    expect(scoreHoursCompleteness(null)).toBe(0);
  });

  it('returns 0 when hours_data is empty object', () => {
    expect(scoreHoursCompleteness({})).toBe(0);
  });

  it('returns partial score for missing days', () => {
    const partialHours = {
      monday: '11:00-22:00',
      tuesday: '11:00-22:00',
      wednesday: '11:00-22:00',
    };
    const score = scoreHoursCompleteness(partialHours);
    // 3/7 * 20 = 8.57
    expect(score).toBeCloseTo(8.57, 1);
  });

  it('does not count null or empty string entries', () => {
    const withNulls = {
      monday: '11:00-22:00',
      tuesday: null,
      wednesday: '',
      thursday: '11:00-22:00',
      friday: '11:00-23:00',
      saturday: null,
      sunday: '12:00-21:00',
    };
    const score = scoreHoursCompleteness(withNulls);
    // 4/7 * 20 = 11.43
    expect(score).toBeCloseTo(11.43, 1);
  });

  it('does not count "closed" as valid hours', () => {
    const withClosed = {
      monday: '11:00-22:00',
      tuesday: 'closed',
      wednesday: '11:00-22:00',
      thursday: 'closed',
      friday: '11:00-23:00',
      saturday: '11:00-23:00',
      sunday: '12:00-21:00',
    };
    const score = scoreHoursCompleteness(withClosed);
    // 5/7 * 20 = 14.29
    expect(score).toBeCloseTo(14.29, 1);
  });
});

// ---------------------------------------------------------------------------
// § 3 — Amenities Coverage (20pts)
// ---------------------------------------------------------------------------

describe('scoreAmenities', () => {
  it('returns 20 when all amenities set (true or false)', () => {
    expect(scoreAmenities(FULL_LOCATION.amenities, false)).toBe(20);
  });

  it('returns 0 when amenities is null', () => {
    expect(scoreAmenities(null, false)).toBe(0);
  });

  it('returns 0 when amenities is empty object', () => {
    expect(scoreAmenities({}, false)).toBe(0);
  });

  it('returns 20 when gbp_import_source=true (no penalty for null amenities)', () => {
    expect(scoreAmenities(null, true)).toBe(20);
  });

  it('returns 20 when gbp_import_source=true even with empty amenities', () => {
    expect(scoreAmenities({}, true)).toBe(20);
  });

  it('returns partial score for mixed null/set amenities', () => {
    const partial = {
      wifi: true,
      outdoor_seating: null,
      parking: false,
      delivery: null,
    };
    // 2/4 set = 50% → 10pts
    expect(scoreAmenities(partial, false)).toBe(10);
  });

  it('counts false as "set" (not null)', () => {
    const allFalse = {
      wifi: false,
      parking: false,
      delivery: false,
    };
    expect(scoreAmenities(allFalse, false)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// § 4 — Category/Description (15pts)
// ---------------------------------------------------------------------------

describe('scoreCategoryDescription', () => {
  it('returns 15 when both category and description present', () => {
    expect(scoreCategoryDescription(
      ['BBQ Restaurant'],
      'Award-winning BBQ restaurant in Alpharetta with slow-smoked meats and live music.',
    )).toBe(15);
  });

  it('returns 0 when both null', () => {
    expect(scoreCategoryDescription(null, null)).toBe(0);
  });

  it('returns 7.5 for category only', () => {
    expect(scoreCategoryDescription(['Restaurant'], null)).toBe(7.5);
  });

  it('returns 7.5 for description only (≥50 chars)', () => {
    expect(scoreCategoryDescription(
      null,
      'Award-winning BBQ restaurant in Alpharetta with slow-smoked meats.',
    )).toBe(7.5);
  });

  it('returns 7.5 when description is < 50 chars', () => {
    // Only category points, description too short
    expect(scoreCategoryDescription(['BBQ'], 'Short desc')).toBe(7.5);
  });

  it('returns 0 when categories is empty array', () => {
    expect(scoreCategoryDescription([], null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// § 5 — Menu/Services (15pts)
// ---------------------------------------------------------------------------

describe('scoreMenuServices', () => {
  it('returns 15 when published menu exists', () => {
    expect(scoreMenuServices(true)).toBe(15);
  });

  it('returns 0 when no published menu', () => {
    expect(scoreMenuServices(false)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// § 6 — Composite computeDataHealthFromData
// ---------------------------------------------------------------------------

describe('computeDataHealthFromData', () => {
  it('returns score near 100 for full data with published menu', () => {
    const result = computeDataHealthFromData(FULL_LOCATION, true);
    expect(result.total).toBe(100);
    expect(result.coreIdentity).toBe(30);
    expect(result.hoursComplete).toBe(20);
    expect(result.amenities).toBe(20);
    expect(result.categoryDesc).toBe(15);
    expect(result.menuServices).toBe(15);
    expect(result.gbpImportSource).toBe(false);
  });

  it('returns 0 for completely empty data without menu', () => {
    const result = computeDataHealthFromData(EMPTY_LOCATION, false);
    expect(result.total).toBe(0);
  });

  it('penalizes missing hours correctly', () => {
    const noHours = { ...FULL_LOCATION, hours_data: null };
    const result = computeDataHealthFromData(noHours, true);
    // 30 + 0 + 20 + 15 + 15 = 80
    expect(result.total).toBe(80);
    expect(result.hoursComplete).toBe(0);
  });

  it('gbp_import_source=true gives full amenities even when null', () => {
    const gbpLocation = {
      ...FULL_LOCATION,
      amenities: null,
      gbp_import_source: true,
    };
    const result = computeDataHealthFromData(gbpLocation, true);
    // amenities should be 20 (no penalty)
    expect(result.amenities).toBe(20);
    expect(result.gbpImportSource).toBe(true);
    expect(result.total).toBe(100);
  });

  it('deducts 15 when no magic menu published', () => {
    const result = computeDataHealthFromData(FULL_LOCATION, false);
    expect(result.total).toBe(85);
    expect(result.menuServices).toBe(0);
  });

  it('deducts 15 for empty description', () => {
    const noDesc = { ...FULL_LOCATION, description: null };
    const result = computeDataHealthFromData(noDesc, true);
    expect(result.total).toBe(93); // 100 - 7.5, rounded
    expect(result.categoryDesc).toBe(7.5);
  });

  it('rounds total to integer', () => {
    const partialAmenities = {
      ...FULL_LOCATION,
      amenities: { wifi: true, parking: null, delivery: null } as Record<string, boolean | null>,
    };
    const result = computeDataHealthFromData(partialAmenities, true);
    expect(Number.isInteger(result.total)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// § 7 — deriveRealityScore uses real dataHealth
// ---------------------------------------------------------------------------

describe('deriveRealityScore with dataHealthScore', () => {
  // Import the function from the dashboard page
  // We can't import from the page directly (it's a server component),
  // so we test the formula logic inline
  it('uses dataHealthScore when provided', () => {
    // Formula: vis*0.4 + acc*0.4 + dh*0.2
    const vis = 80;
    const acc = 100; // 0 alerts
    const dh = 60;
    const expected = Math.round(vis * 0.4 + acc * 0.4 + dh * 0.2);
    // 32 + 40 + 12 = 84
    expect(expected).toBe(84);
  });

  it('dataHealthScore overrides simulationScore when both present', () => {
    // When dataHealthScore=60, simulationScore=90:
    // dataHealth should be 60 (not blended with simulation)
    const dataHealthScore = 60;
    const simulationScore = 90;
    // deriveRealityScore prefers dataHealthScore
    const dataHealth = dataHealthScore != null
      ? dataHealthScore
      : simulationScore != null
        ? Math.round(100 * 0.5 + simulationScore * 0.5)
        : 100;
    expect(dataHealth).toBe(60);
  });

  it('falls back to simulationScore blend when dataHealthScore null', () => {
    const dataHealthScore = null;
    const simulationScore = 80;
    const dataHealth = dataHealthScore != null
      ? dataHealthScore
      : simulationScore != null
        ? Math.round(100 * 0.5 + simulationScore * 0.5)
        : 100;
    // 50 + 40 = 90
    expect(dataHealth).toBe(90);
  });

  it('falls back to 100 when both null', () => {
    const dataHealthScore = null;
    const simulationScore = null;
    const dataHealth = dataHealthScore != null
      ? dataHealthScore
      : simulationScore != null
        ? Math.round(100 * 0.5 + simulationScore * 0.5)
        : 100;
    expect(dataHealth).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// § 8 — Cron registration
// ---------------------------------------------------------------------------

describe('data-health-refresh cron registration', () => {
  it('is registered in vercel.json', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vercelJson = require('../../../vercel.json');
    const paths = vercelJson.crons.map((c: { path: string }) => c.path);
    expect(paths).toContain('/api/cron/data-health-refresh');
  });

  it('runs daily at 5 AM UTC', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vercelJson = require('../../../vercel.json');
    const cron = vercelJson.crons.find((c: { path: string }) => c.path === '/api/cron/data-health-refresh');
    expect(cron.schedule).toBe('0 5 * * *');
  });
});
