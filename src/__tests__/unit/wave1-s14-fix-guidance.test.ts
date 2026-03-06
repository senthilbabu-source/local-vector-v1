// ---------------------------------------------------------------------------
// wave1-s14-fix-guidance.test.ts — S14: fix-guidance.ts pure function tests
// AI_RULES §214
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  getFixGuidance,
  getRevenueImpactBySeverity,
  SEVERITY_REVENUE_IMPACT,
  FIX_GUIDANCE,
} from '@/lib/hallucinations/fix-guidance';

describe('getFixGuidance', () => {
  it('returns guidance for "hours" category', () => {
    const g = getFixGuidance('hours');
    expect(g).not.toBeNull();
    expect(g!.category).toBe('hours');
    expect(g!.steps.length).toBeGreaterThan(0);
    expect(g!.platforms.length).toBeGreaterThan(0);
  });

  it('returns guidance for "address" category', () => {
    const g = getFixGuidance('address');
    expect(g).not.toBeNull();
    expect(g!.category).toBe('address');
  });

  it('returns guidance for "phone" category', () => {
    const g = getFixGuidance('phone');
    expect(g).not.toBeNull();
  });

  it('returns guidance for "menu" category', () => {
    const g = getFixGuidance('menu');
    expect(g).not.toBeNull();
  });

  it('returns guidance for "cuisine" category', () => {
    const g = getFixGuidance('cuisine');
    expect(g).not.toBeNull();
  });

  it('returns guidance for "closed" category', () => {
    const g = getFixGuidance('closed');
    expect(g).not.toBeNull();
  });

  it('is case-insensitive — "HOURS" returns same as "hours"', () => {
    expect(getFixGuidance('HOURS')).toEqual(getFixGuidance('hours'));
  });

  it('is case-insensitive — "Menu" returns same as "menu"', () => {
    expect(getFixGuidance('Menu')).toEqual(getFixGuidance('menu'));
  });

  it('returns null for unknown category', () => {
    expect(getFixGuidance('unknown_category')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getFixGuidance('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(getFixGuidance(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getFixGuidance(undefined)).toBeNull();
  });

  it('each guidance has estimatedDays as a positive number', () => {
    for (const key of Object.keys(FIX_GUIDANCE)) {
      const g = FIX_GUIDANCE[key];
      expect(g.estimatedDays).toBeGreaterThan(0);
    }
  });

  it('each guidance has a non-empty title', () => {
    for (const key of Object.keys(FIX_GUIDANCE)) {
      expect(FIX_GUIDANCE[key].title.length).toBeGreaterThan(0);
    }
  });

  it('platforms have name and url fields', () => {
    const g = getFixGuidance('hours');
    for (const platform of g!.platforms) {
      expect(typeof platform.name).toBe('string');
      expect(typeof platform.url).toBe('string');
      expect(platform.url.startsWith('http')).toBe(true);
    }
  });

  it('all steps are non-empty strings', () => {
    const g = getFixGuidance('address');
    for (const step of g!.steps) {
      expect(step.length).toBeGreaterThan(0);
    }
  });
});

describe('getRevenueImpactBySeverity', () => {
  it('returns 180 for critical', () => {
    expect(getRevenueImpactBySeverity('critical')).toBe(180);
  });

  it('returns 100 for high', () => {
    expect(getRevenueImpactBySeverity('high')).toBe(100);
  });

  it('returns 50 for medium', () => {
    expect(getRevenueImpactBySeverity('medium')).toBe(50);
  });

  it('returns 20 for low', () => {
    expect(getRevenueImpactBySeverity('low')).toBe(20);
  });

  it('is case-insensitive — "CRITICAL" returns same as "critical"', () => {
    expect(getRevenueImpactBySeverity('CRITICAL')).toBe(180);
  });

  it('returns 0 for unknown severity', () => {
    expect(getRevenueImpactBySeverity('unknown')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(getRevenueImpactBySeverity(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(getRevenueImpactBySeverity(undefined)).toBe(0);
  });
});

describe('SEVERITY_REVENUE_IMPACT constant', () => {
  it('has all four severity levels', () => {
    expect(SEVERITY_REVENUE_IMPACT.critical).toBeDefined();
    expect(SEVERITY_REVENUE_IMPACT.high).toBeDefined();
    expect(SEVERITY_REVENUE_IMPACT.medium).toBeDefined();
    expect(SEVERITY_REVENUE_IMPACT.low).toBeDefined();
  });

  it('critical > high > medium > low', () => {
    expect(SEVERITY_REVENUE_IMPACT.critical).toBeGreaterThan(SEVERITY_REVENUE_IMPACT.high);
    expect(SEVERITY_REVENUE_IMPACT.high).toBeGreaterThan(SEVERITY_REVENUE_IMPACT.medium);
    expect(SEVERITY_REVENUE_IMPACT.medium).toBeGreaterThan(SEVERITY_REVENUE_IMPACT.low);
  });
});
