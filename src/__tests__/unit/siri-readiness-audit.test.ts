// ---------------------------------------------------------------------------
// Sprint 5: Siri Readiness Audit — Unit Tests
//
// Pure function tests for auditSiriReadiness.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { auditSiriReadiness } from '@/lib/services/siri-readiness-audit.service';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Full location data — represents a complete location
const FULL_LOCATION = {
  business_name: 'Charcoal & Chill BBQ',
  address_line1: '123 Smoky Lane',
  city: 'Atlanta',
  state: 'GA',
  zip: '30301',
  phone: '(404) 555-1234',
  website_url: 'https://charcoalnchill.com',
  hours_data: {
    monday: { open: '11:00', close: '22:00' },
    tuesday: { open: '11:00', close: '22:00' },
    wednesday: { open: '11:00', close: '22:00' },
    thursday: { open: '11:00', close: '22:00' },
    friday: { open: '11:00', close: '23:00' },
    saturday: { open: '10:00', close: '23:00' },
    sunday: { open: '10:00', close: '21:00' },
  },
  categories: ['Restaurant'],
};

// Empty location — all null
const EMPTY_LOCATION = {
  business_name: null,
  address_line1: null,
  city: null,
  state: null,
  zip: null,
  phone: null,
  website_url: null,
  hours_data: null,
  categories: null,
};

describe('auditSiriReadiness', () => {
  it('1. returns score=100 for fully complete location data', () => {
    const result = auditSiriReadiness(FULL_LOCATION);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.checks.every(c => c.passed)).toBe(true);
  });

  it('2. returns score=0 for location with all null fields', () => {
    const result = auditSiriReadiness(EMPTY_LOCATION);
    // Status always passes (defaults to OPEN), so minimum is 10
    expect(result.score).toBe(10);
    expect(result.grade).toBe('F');
  });

  it('3. phone in non-E.164 format still earns phone points (toE164 normalizes)', () => {
    const result = auditSiriReadiness({
      ...EMPTY_LOCATION,
      phone: '(404) 555-1234',
    });
    const phoneCheck = result.checks.find(c => c.field === 'telephone');
    expect(phoneCheck?.earned).toBe(15);
    expect(phoneCheck?.passed).toBe(true);
  });

  it('4. partial hours (3 days) earns 10 points not 20', () => {
    const result = auditSiriReadiness({
      ...EMPTY_LOCATION,
      hours_data: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
      },
    });
    const hoursCheck = result.checks.find(c => c.field === 'regularHours');
    expect(hoursCheck?.earned).toBe(10);
    expect(hoursCheck?.passed).toBe(false);
    expect(hoursCheck?.detail).toContain('3 of 7 days');
  });

  it('5. full hours (7 days) earns 20 points', () => {
    const result = auditSiriReadiness({
      ...EMPTY_LOCATION,
      hours_data: FULL_LOCATION.hours_data,
    });
    const hoursCheck = result.checks.find(c => c.field === 'regularHours');
    expect(hoursCheck?.earned).toBe(20);
    expect(hoursCheck?.passed).toBe(true);
  });

  it('6. missing categories earns 0 category points', () => {
    const result = auditSiriReadiness({
      ...FULL_LOCATION,
      categories: [],
    });
    const catCheck = result.checks.find(c => c.field === 'categories');
    expect(catCheck?.earned).toBe(0);
    expect(catCheck?.passed).toBe(false);
  });

  it('7. grade A for score >= 90', () => {
    // Full location = 100
    const result = auditSiriReadiness(FULL_LOCATION);
    expect(result.grade).toBe('A');
  });

  it('8. grade B for score 75-89', () => {
    // Remove categories (10pts) and partial hours (10pts) = 80
    const result = auditSiriReadiness({
      ...FULL_LOCATION,
      categories: [],
      hours_data: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
      },
    });
    // 15 (name) + 20 (address) + 15 (phone) + 10 (website) + 10 (partial hours) + 0 (categories) + 10 (status) = 80
    expect(result.score).toBe(80);
    expect(result.grade).toBe('B');
  });

  it('9. grade F for score < 35', () => {
    // Only status (10 pts)
    const result = auditSiriReadiness(EMPTY_LOCATION);
    expect(result.score).toBe(10);
    expect(result.grade).toBe('F');
  });

  it('10. missing_critical includes Business Hours when hours_data is null', () => {
    const result = auditSiriReadiness({
      ...FULL_LOCATION,
      hours_data: null,
    });
    expect(result.missing_critical).toContain('Business Hours');
  });

  it('11. checks array has exactly 7 entries (one per field)', () => {
    const result = auditSiriReadiness(FULL_LOCATION);
    expect(result.checks).toHaveLength(7);
    const fields = result.checks.map(c => c.field);
    expect(fields).toEqual([
      'displayName',
      'address',
      'telephone',
      'websiteUrl',
      'regularHours',
      'categories',
      'status',
    ]);
  });
});
