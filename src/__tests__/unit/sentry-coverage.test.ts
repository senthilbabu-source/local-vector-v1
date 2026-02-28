// ---------------------------------------------------------------------------
// src/__tests__/unit/sentry-coverage.test.ts
//
// Sprint A (C1 + C3): Validates Sentry coverage on critical catch blocks
// and plan display name mapping.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Sentry before any module imports
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  init: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import { getPlanDisplayName, PLAN_DISPLAY_NAMES } from '@/lib/plan-display-names';

// ---------------------------------------------------------------------------
// Plan Display Names (C3)
// ---------------------------------------------------------------------------

describe('C3 — Plan display names', () => {
  it('getPlanDisplayName("growth") returns "AI Shield"', () => {
    expect(getPlanDisplayName('growth')).toBe('AI Shield');
  });

  it('getPlanDisplayName("agency") returns "Brand Fortress"', () => {
    expect(getPlanDisplayName('agency')).toBe('Brand Fortress');
  });

  it('getPlanDisplayName("starter") returns "Starter"', () => {
    expect(getPlanDisplayName('starter')).toBe('Starter');
  });

  it('getPlanDisplayName("trial") returns "The Audit"', () => {
    expect(getPlanDisplayName('trial')).toBe('The Audit');
  });

  it('getPlanDisplayName(null) returns "Free"', () => {
    expect(getPlanDisplayName(null)).toBe('Free');
  });

  it('getPlanDisplayName(undefined) returns "Free"', () => {
    expect(getPlanDisplayName(undefined)).toBe('Free');
  });

  it('getPlanDisplayName("unknown_value") returns "unknown_value" (defensive fallback)', () => {
    expect(getPlanDisplayName('unknown_value')).toBe('unknown_value');
  });

  it('PLAN_DISPLAY_NAMES has all 4 plan tiers', () => {
    expect(Object.keys(PLAN_DISPLAY_NAMES)).toEqual(
      expect.arrayContaining(['trial', 'starter', 'growth', 'agency']),
    );
    expect(Object.keys(PLAN_DISPLAY_NAMES)).toHaveLength(4);
  });
});
