import { describe, it, expect } from 'vitest';
import {
  getIndustryRevenueDefaults,
  REVENUE_FIELD_LABELS,
  REVENUE_FIELD_DESCRIPTIONS,
} from '@/lib/revenue-impact/industry-revenue-defaults';

describe('getIndustryRevenueDefaults', () => {
  it('returns restaurant defaults for "restaurant"', () => {
    const d = getIndustryRevenueDefaults('restaurant');
    expect(d.avgCustomerValue).toBe(55);
    expect(d.monthlyCovers).toBe(1800);
  });

  it('returns medical_dental defaults', () => {
    const d = getIndustryRevenueDefaults('medical_dental');
    expect(d.avgCustomerValue).toBe(285);
    expect(d.monthlyCovers).toBe(360);
  });

  it('returns legal defaults', () => {
    const d = getIndustryRevenueDefaults('legal');
    expect(d.avgCustomerValue).toBe(350);
    expect(d.monthlyCovers).toBe(300);
  });

  it('returns real_estate defaults', () => {
    const d = getIndustryRevenueDefaults('real_estate');
    expect(d.avgCustomerValue).toBe(150);
    expect(d.monthlyCovers).toBe(400);
  });

  it('returns generic defaults for null', () => {
    const d = getIndustryRevenueDefaults(null);
    expect(d.avgCustomerValue).toBe(65);
    expect(d.monthlyCovers).toBe(750);
  });

  it('returns generic defaults for undefined', () => {
    const d = getIndustryRevenueDefaults(undefined);
    expect(d.avgCustomerValue).toBe(65);
    expect(d.monthlyCovers).toBe(750);
  });

  it('returns generic defaults for unknown industry', () => {
    const d = getIndustryRevenueDefaults('unknown_industry_xyz');
    expect(d.avgCustomerValue).toBe(65);
    expect(d.monthlyCovers).toBe(750);
  });

  it('returns positive values for all known industries', () => {
    const ids = ['restaurant', 'medical_dental', 'legal', 'real_estate'];
    for (const id of ids) {
      const d = getIndustryRevenueDefaults(id);
      expect(d.avgCustomerValue).toBeGreaterThan(0);
      expect(d.monthlyCovers).toBeGreaterThan(0);
    }
  });

  it('all defaults have avgCustomerValue and monthlyCovers fields', () => {
    const ids = ['restaurant', 'medical_dental', 'legal', 'real_estate', null];
    for (const id of ids) {
      const d = getIndustryRevenueDefaults(id);
      expect(d).toHaveProperty('avgCustomerValue');
      expect(d).toHaveProperty('monthlyCovers');
      expect(typeof d.avgCustomerValue).toBe('number');
      expect(typeof d.monthlyCovers).toBe('number');
    }
  });
});

describe('REVENUE_FIELD_LABELS', () => {
  it('has labels for avgCustomerValue and monthlyCovers', () => {
    expect(REVENUE_FIELD_LABELS.avgCustomerValue).toBeTruthy();
    expect(REVENUE_FIELD_LABELS.monthlyCovers).toBeTruthy();
  });
});

describe('REVENUE_FIELD_DESCRIPTIONS', () => {
  it('has descriptions for avgCustomerValue and monthlyCovers', () => {
    expect(REVENUE_FIELD_DESCRIPTIONS.avgCustomerValue).toBeTruthy();
    expect(REVENUE_FIELD_DESCRIPTIONS.monthlyCovers).toBeTruthy();
  });
});
