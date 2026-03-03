/**
 * Plan Tier Resolver Tests — P0-FIX-01
 *
 * 7 tests covering resolvePlanTierFromPriceId — pure function mapping
 * Stripe price IDs to internal plan tier values.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolvePlanTierFromPriceId } from '@/lib/stripe/plan-tier-resolver';

// Save original env
const origEnv = { ...process.env };

beforeAll(() => {
  process.env.STRIPE_PRICE_ID_STARTER = 'price_starter_test_123';
  process.env.STRIPE_PRICE_ID_GROWTH = 'price_growth_test_456';
  process.env.STRIPE_PRICE_ID_AGENCY_SEAT = 'price_agency_test_789';
});

afterAll(() => {
  process.env.STRIPE_PRICE_ID_STARTER = origEnv.STRIPE_PRICE_ID_STARTER;
  process.env.STRIPE_PRICE_ID_GROWTH = origEnv.STRIPE_PRICE_ID_GROWTH;
  process.env.STRIPE_PRICE_ID_AGENCY_SEAT = origEnv.STRIPE_PRICE_ID_AGENCY_SEAT;
});

describe('resolvePlanTierFromPriceId', () => {
  it('returns starter for starter price ID', () => {
    expect(resolvePlanTierFromPriceId('price_starter_test_123')).toBe('starter');
  });

  it('returns growth for growth price ID', () => {
    expect(resolvePlanTierFromPriceId('price_growth_test_456')).toBe('growth');
  });

  it('returns agency for agency price ID', () => {
    expect(resolvePlanTierFromPriceId('price_agency_test_789')).toBe('agency');
  });

  it('returns null for null price ID', () => {
    expect(resolvePlanTierFromPriceId(null)).toBeNull();
  });

  it('returns null for undefined price ID', () => {
    expect(resolvePlanTierFromPriceId(undefined)).toBeNull();
  });

  it('returns null for unknown price ID', () => {
    expect(resolvePlanTierFromPriceId('price_unknown_999')).toBeNull();
  });

  it('returns null for empty string price ID', () => {
    expect(resolvePlanTierFromPriceId('')).toBeNull();
  });
});
