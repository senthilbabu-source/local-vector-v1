// ---------------------------------------------------------------------------
// Sprint O (M4): Revenue Config Defaults — unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '@/lib/services/revenue-leak.service';
import { DEFAULT_REVENUE_CONFIG } from '@/lib/services/revenue-impact.service';
import { getIndustryRevenueDefaults } from '@/lib/revenue-impact/industry-revenue-defaults';

describe('DEFAULT_CONFIG (revenue-leak old system)', () => {
  it('avg_ticket is between $40 and $80 (restaurant-appropriate)', () => {
    expect(DEFAULT_CONFIG.avg_ticket).toBeGreaterThanOrEqual(40);
    expect(DEFAULT_CONFIG.avg_ticket).toBeLessThanOrEqual(80);
  });

  it('avg_ticket is aligned with revenue-impact service ($55)', () => {
    expect(DEFAULT_CONFIG.avg_ticket).toBe(55);
  });

  it('monthly_searches is positive and reasonable', () => {
    expect(DEFAULT_CONFIG.monthly_searches).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.monthly_searches).toBeLessThanOrEqual(10000);
  });

  it('local_conversion_rate is between 0.01 and 0.10', () => {
    expect(DEFAULT_CONFIG.local_conversion_rate).toBeGreaterThanOrEqual(0.01);
    expect(DEFAULT_CONFIG.local_conversion_rate).toBeLessThanOrEqual(0.10);
  });

  it('walk_away_rate is between 0.40 and 0.90', () => {
    expect(DEFAULT_CONFIG.walk_away_rate).toBeGreaterThanOrEqual(0.40);
    expect(DEFAULT_CONFIG.walk_away_rate).toBeLessThanOrEqual(0.90);
  });

  it('no field is 0, null, or undefined', () => {
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      expect(value, `${key} should not be 0`).not.toBe(0);
      expect(value, `${key} should not be null`).not.toBeNull();
      expect(value, `${key} should not be undefined`).not.toBeUndefined();
    }
  });
});

describe('DEFAULT_REVENUE_CONFIG (revenue-impact new system)', () => {
  it('avgCustomerValue is between $40 and $80', () => {
    expect(DEFAULT_REVENUE_CONFIG.avgCustomerValue).toBeGreaterThanOrEqual(40);
    expect(DEFAULT_REVENUE_CONFIG.avgCustomerValue).toBeLessThanOrEqual(80);
  });

  it('monthlyCovers is between 500 and 5000', () => {
    expect(DEFAULT_REVENUE_CONFIG.monthlyCovers).toBeGreaterThanOrEqual(500);
    expect(DEFAULT_REVENUE_CONFIG.monthlyCovers).toBeLessThanOrEqual(5000);
  });

  it('matches restaurant industry defaults', () => {
    const restaurantDefaults = getIndustryRevenueDefaults('restaurant');
    expect(DEFAULT_REVENUE_CONFIG.avgCustomerValue).toBe(restaurantDefaults.avgCustomerValue);
    expect(DEFAULT_REVENUE_CONFIG.monthlyCovers).toBe(restaurantDefaults.monthlyCovers);
  });

  it('no field is 0, null, or undefined', () => {
    for (const [key, value] of Object.entries(DEFAULT_REVENUE_CONFIG)) {
      expect(value, `${key} should not be 0`).not.toBe(0);
      expect(value, `${key} should not be null`).not.toBeNull();
      expect(value, `${key} should not be undefined`).not.toBeUndefined();
    }
  });
});

describe('Revenue config alignment across systems', () => {
  it('old avg_ticket aligns with new avgCustomerValue', () => {
    expect(DEFAULT_CONFIG.avg_ticket).toBe(DEFAULT_REVENUE_CONFIG.avgCustomerValue);
  });
});
