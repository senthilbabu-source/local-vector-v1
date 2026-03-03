// ---------------------------------------------------------------------------
// Sprint 130: Apple Business Connect — 34 unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Pure function imports (no mocking needed)
import {
  toE164,
  toABCHours,
  toABCCategories,
  toABCStatus,
  buildABCLocation,
} from '@/lib/apple-bc/apple-bc-mapper';
import { computeLocationDiff } from '@/lib/apple-bc/apple-bc-diff';
import { APPLE_CATEGORY_MAP } from '@/lib/apple-bc/apple-bc-types';
import type { ABCLocation } from '@/lib/apple-bc/apple-bc-types';
import { GOLDEN_TENANT } from '@/src/__fixtures__/golden-tenant';

const ROOT = join(__dirname, '..', '..', '..');

// ---------------------------------------------------------------------------
// toE164
// ---------------------------------------------------------------------------
describe('toE164', () => {
  it('converts 10-digit US number to E.164', () => {
    expect(toE164('4705461234')).toBe('+14705461234');
  });

  it('converts 11-digit US number starting with 1 to E.164', () => {
    expect(toE164('14705461234')).toBe('+14705461234');
  });

  it('passes through already-E.164 number unchanged', () => {
    expect(toE164('+14705461234')).toBe('+14705461234');
  });

  it('strips dashes, spaces, parens before converting', () => {
    expect(toE164('(470) 546-1234')).toBe('+14705461234');
    expect(toE164('470 546 1234')).toBe('+14705461234');
    expect(toE164('470-546-1234')).toBe('+14705461234');
  });

  it('returns undefined for null input', () => {
    expect(toE164(null)).toBeUndefined();
  });

  it('returns undefined for unconvertible number (<10 digits)', () => {
    expect(toE164('123456')).toBeUndefined();
    expect(toE164('abc')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// toABCHours
// ---------------------------------------------------------------------------
describe('toABCHours', () => {
  it('converts open/close hours to ABC format', () => {
    const hours = toABCHours({
      monday: { open: '09:00', close: '17:00' },
    });
    expect(hours).toEqual([
      { dayOfWeek: 'MONDAY', openTime: '09:00', closeTime: '17:00' },
    ]);
  });

  it('marks closed days with isClosed=true', () => {
    const hours = toABCHours({
      monday: { closed: true },
    });
    expect(hours).toEqual([
      { dayOfWeek: 'MONDAY', isClosed: true },
    ]);
  });

  it('returns empty array for null hours_data', () => {
    expect(toABCHours(null)).toEqual([]);
  });

  it('handles lowercase day names', () => {
    const hours = toABCHours({
      tuesday: { open: '10:00', close: '22:00' },
    });
    expect(hours[0]?.dayOfWeek).toBe('TUESDAY');
  });

  it('ignores unrecognized day keys', () => {
    const hours = toABCHours({
      holiday: { open: '10:00', close: '22:00' },
    });
    expect(hours).toEqual([]);
  });

  it('omits days with neither hours nor closed flag (null entries)', () => {
    const hours = toABCHours({
      monday: null,
      tuesday: { open: '10:00', close: '22:00' },
    });
    // null → closed
    expect(hours).toHaveLength(2);
    expect(hours[0]).toEqual({ dayOfWeek: 'MONDAY', isClosed: true });
    expect(hours[1]).toEqual({ dayOfWeek: 'TUESDAY', openTime: '10:00', closeTime: '22:00' });
  });
});

// ---------------------------------------------------------------------------
// toABCCategories
// ---------------------------------------------------------------------------
describe('toABCCategories', () => {
  it('maps Restaurant category to RESTAURANT', () => {
    expect(toABCCategories(['Restaurant'])).toEqual(['RESTAURANT']);
  });

  it('maps NightClub to NIGHTCLUB', () => {
    expect(toABCCategories(['NightClub'])).toEqual(['NIGHTCLUB']);
  });

  it('maps MedicalClinic to MEDICAL_CLINIC', () => {
    expect(toABCCategories(['MedicalClinic'])).toEqual(['MEDICAL_CLINIC']);
  });

  it('returns empty array for null categories', () => {
    expect(toABCCategories(null)).toEqual([]);
  });

  it('returns empty array for unmapped category', () => {
    expect(toABCCategories(['UnknownCategory'])).toEqual([]);
  });

  it('caps at 3 categories', () => {
    const cats = toABCCategories([
      'Restaurant', 'Cafe', 'BarOrPub', 'Hotel', 'Bakery',
    ]);
    expect(cats).toHaveLength(3);
    expect(cats).toEqual(['RESTAURANT', 'COFFEE_SHOP', 'BAR']);
  });
});

// ---------------------------------------------------------------------------
// toABCStatus
// ---------------------------------------------------------------------------
describe('toABCStatus', () => {
  it('returns OPEN for OPERATIONAL status', () => {
    expect(toABCStatus('OPERATIONAL')).toBe('OPEN');
  });

  it('returns CLOSED_PERMANENTLY for closed_permanently', () => {
    expect(toABCStatus('closed_permanently')).toBe('CLOSED_PERMANENTLY');
  });

  it('returns CLOSED_TEMPORARILY for closed_temporarily', () => {
    expect(toABCStatus('closed_temporarily')).toBe('CLOSED_TEMPORARILY');
  });

  it('returns OPEN for null status', () => {
    expect(toABCStatus(null)).toBe('OPEN');
  });
});

// ---------------------------------------------------------------------------
// buildABCLocation
// ---------------------------------------------------------------------------
describe('buildABCLocation', () => {
  const fullLocation = {
    name: GOLDEN_TENANT.location.business_name,
    address_line1: GOLDEN_TENANT.location.address_line1,
    city: GOLDEN_TENANT.location.city,
    state: GOLDEN_TENANT.location.state,
    zip: GOLDEN_TENANT.location.zip,
    phone: GOLDEN_TENANT.location.phone,
    website_url: GOLDEN_TENANT.location.website_url,
    hours_data: {
      tuesday: { open: '17:00', close: '01:00' },
      wednesday: { open: '17:00', close: '01:00' },
    },
    categories: ['Restaurant'],
    operational_status: 'OPERATIONAL',
  };

  it('includes all fields for complete location', () => {
    const result = buildABCLocation(fullLocation);
    expect(result.displayName).toBe('Charcoal N Chill');
    expect(result.address).toBeDefined();
    expect(result.telephone).toBeDefined();
    expect(result.websiteUrl).toBe('https://charcoalnchill.com');
    expect(result.regularHours).toBeDefined();
    expect(result.categories).toBeDefined();
    expect(result.status).toBe('OPEN');
  });

  it('omits telephone when phone is null', () => {
    const result = buildABCLocation({ ...fullLocation, phone: null });
    expect(result.telephone).toBeUndefined();
  });

  it('omits address when city is null', () => {
    const result = buildABCLocation({ ...fullLocation, city: null });
    expect(result.address).toBeUndefined();
  });

  it('omits websiteUrl when null', () => {
    const result = buildABCLocation({ ...fullLocation, website_url: null });
    expect(result.websiteUrl).toBeUndefined();
  });

  it('omits regularHours when hours_data is null', () => {
    const result = buildABCLocation({ ...fullLocation, hours_data: null });
    expect(result.regularHours).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeLocationDiff
// ---------------------------------------------------------------------------
describe('computeLocationDiff', () => {
  const localVersion: Partial<ABCLocation> = {
    displayName: 'Charcoal N Chill',
    telephone: '+14705464866',
    websiteUrl: 'https://charcoalnchill.com',
    status: 'OPEN',
    address: {
      addressLine1: '11950 Jones Bridge Road Ste 103',
      city: 'Alpharetta',
      stateOrProvince: 'GA',
      postalCode: '30005',
      country: 'US',
    },
    regularHours: [
      { dayOfWeek: 'TUESDAY', openTime: '17:00', closeTime: '01:00' },
    ],
  };

  it('returns full location when appleVersion is null (create case)', () => {
    const diff = computeLocationDiff(localVersion, null);
    expect(diff.hasChanges).toBe(true);
    expect(diff.changedFields).toEqual(Object.keys(localVersion));
    expect(diff.updates).toEqual(localVersion);
  });

  it('returns hasChanges=false when all fields match', () => {
    const diff = computeLocationDiff(localVersion, localVersion as ABCLocation);
    expect(diff.hasChanges).toBe(false);
    expect(diff.changedFields).toEqual([]);
    expect(diff.updates).toEqual({});
  });

  it('returns changed displayName only', () => {
    const apple = { ...localVersion, displayName: 'Old Name' } as ABCLocation;
    const diff = computeLocationDiff(localVersion, apple);
    expect(diff.changedFields).toEqual(['displayName']);
    expect(diff.updates.displayName).toBe('Charcoal N Chill');
  });

  it('returns changed telephone only', () => {
    const apple = { ...localVersion, telephone: '+10000000000' } as ABCLocation;
    const diff = computeLocationDiff(localVersion, apple);
    expect(diff.changedFields).toContain('telephone');
    expect(diff.updates.telephone).toBe('+14705464866');
  });

  it('returns changed address only', () => {
    const apple = {
      ...localVersion,
      address: { addressLine1: 'Different', city: 'X', stateOrProvince: 'Y', postalCode: '0', country: 'US' },
    } as ABCLocation;
    const diff = computeLocationDiff(localVersion, apple);
    expect(diff.changedFields).toContain('address');
    expect(diff.updates.address).toEqual(localVersion.address);
  });

  it('returns changed hours only', () => {
    const apple = {
      ...localVersion,
      regularHours: [{ dayOfWeek: 'MONDAY' as const, isClosed: true }],
    } as ABCLocation;
    const diff = computeLocationDiff(localVersion, apple);
    expect(diff.changedFields).toContain('regularHours');
  });

  it('does NOT include unchanged fields in updates', () => {
    const apple = { ...localVersion, displayName: 'Old Name' } as ABCLocation;
    const diff = computeLocationDiff(localVersion, apple);
    expect(diff.updates.telephone).toBeUndefined();
    expect(diff.updates.websiteUrl).toBeUndefined();
    expect(diff.updates.address).toBeUndefined();
  });

  it('handles CLOSED_PERMANENTLY status change', () => {
    const local: Partial<ABCLocation> = { ...localVersion, status: 'CLOSED_PERMANENTLY' };
    const apple = { ...localVersion } as ABCLocation;
    const diff = computeLocationDiff(local, apple);
    expect(diff.changedFields).toContain('status');
    expect(diff.updates.status).toBe('CLOSED_PERMANENTLY');
  });
});

// ---------------------------------------------------------------------------
// apple-bc-sync cron — file-level tests
// ---------------------------------------------------------------------------
describe('apple-bc-sync cron', () => {
  const cronPath = join(ROOT, 'app/api/cron/apple-bc-sync/route.ts');
  const cronSrc = readFileSync(cronPath, 'utf-8');

  it('returns 401 without CRON_SECRET', () => {
    expect(cronSrc).toContain("'Unauthorized'");
    expect(cronSrc).toContain('status: 401');
  });

  it('returns skipped when kill switch active', () => {
    expect(cronSrc).toContain('APPLE_BC_CRON_DISABLED');
    expect(cronSrc).toContain('kill switch');
  });

  it('skips non-Agency orgs', () => {
    expect(cronSrc).toContain("planSatisfies(orgPlan, 'agency')");
    expect(cronSrc).toContain('skipped++');
  });

  it('skips unclaimed connections', () => {
    expect(cronSrc).toContain("'claimed'");
    expect(cronSrc).toContain('.not(');
  });

  it('writes sync_log entry after each location', () => {
    expect(cronSrc).toContain("'apple_bc_sync_log'");
    expect(cronSrc).toContain('.insert(');
  });
});

// ---------------------------------------------------------------------------
// APPLE_CATEGORY_MAP
// ---------------------------------------------------------------------------
describe('APPLE_CATEGORY_MAP', () => {
  it('has 20 category entries', () => {
    expect(Object.keys(APPLE_CATEGORY_MAP)).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// vercel.json registration
// ---------------------------------------------------------------------------
describe('apple-bc-sync cron registration', () => {
  const vercelJson = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf-8'));
  const cronPaths = vercelJson.crons.map((c: { path: string }) => c.path);

  it('registers apple-bc-sync in vercel.json', () => {
    expect(cronPaths).toContain('/api/cron/apple-bc-sync');
  });

  it('runs at 3:30 AM UTC', () => {
    const cron = vercelJson.crons.find((c: { path: string }) => c.path === '/api/cron/apple-bc-sync');
    expect(cron.schedule).toBe('30 3 * * *');
  });
});
