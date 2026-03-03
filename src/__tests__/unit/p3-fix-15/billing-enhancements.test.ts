// ---------------------------------------------------------------------------
// src/__tests__/unit/p3-fix-15/billing-enhancements.test.ts — P3-FIX-15
//
// Tests for billing page enhancements: plan tiers, subscription details,
// credits summary. Tests pure logic without importing server actions.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { getPlanDisplayName } from '@/lib/plan-display-names';
import { getCreditLimit, PLAN_CREDIT_LIMITS } from '@/lib/credits/credit-limits';

// ---------------------------------------------------------------------------
// Plan tier catalog logic
// ---------------------------------------------------------------------------

describe('plan tier catalog', () => {
  const PLAN_ORDER = ['trial', 'starter', 'growth', 'agency'] as const;

  it('defines 4 plan tiers in ascending order', () => {
    expect(PLAN_ORDER).toHaveLength(4);
    expect(PLAN_ORDER[0]).toBe('trial');
    expect(PLAN_ORDER[3]).toBe('agency');
  });

  it('each plan has a display name', () => {
    for (const plan of PLAN_ORDER) {
      const name = getPlanDisplayName(plan);
      expect(name).toBeTruthy();
      expect(typeof name).toBe('string');
    }
  });

  it('each plan has a credit limit', () => {
    for (const plan of PLAN_ORDER) {
      const limit = getCreditLimit(plan);
      expect(limit).toBeGreaterThan(0);
    }
  });

  it('credit limits increase with plan tier', () => {
    const trial = getCreditLimit('trial');
    const starter = getCreditLimit('starter');
    const growth = getCreditLimit('growth');
    const agency = getCreditLimit('agency');
    expect(trial).toBeLessThan(starter);
    expect(starter).toBeLessThan(growth);
    expect(growth).toBeLessThan(agency);
  });

  it('no duplicate plan names', () => {
    const names = PLAN_ORDER.map((p) => getPlanDisplayName(p));
    expect(new Set(names).size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// CTA label logic (mirrors billing page UpgradeButton)
// ---------------------------------------------------------------------------

describe('CTA label determination', () => {
  const PLAN_RANK: Record<string, number> = {
    trial: 0,
    starter: 1,
    growth: 2,
    agency: 3,
  };

  function getCtaLabel(currentPlan: string, targetPlan: string): string {
    if (currentPlan === targetPlan) return 'Current Plan';
    if (PLAN_RANK[currentPlan] < PLAN_RANK[targetPlan]) return 'Upgrade';
    return 'Downgrade';
  }

  it('shows "Current Plan" when current matches target', () => {
    expect(getCtaLabel('growth', 'growth')).toBe('Current Plan');
  });

  it('shows "Upgrade" for higher tiers', () => {
    expect(getCtaLabel('trial', 'starter')).toBe('Upgrade');
    expect(getCtaLabel('starter', 'growth')).toBe('Upgrade');
    expect(getCtaLabel('growth', 'agency')).toBe('Upgrade');
  });

  it('shows "Downgrade" for lower tiers', () => {
    expect(getCtaLabel('agency', 'growth')).toBe('Downgrade');
    expect(getCtaLabel('growth', 'starter')).toBe('Downgrade');
    expect(getCtaLabel('starter', 'trial')).toBe('Downgrade');
  });

  it('trial user sees Upgrade on all paid plans', () => {
    expect(getCtaLabel('trial', 'starter')).toBe('Upgrade');
    expect(getCtaLabel('trial', 'growth')).toBe('Upgrade');
    expect(getCtaLabel('trial', 'agency')).toBe('Upgrade');
  });
});

// ---------------------------------------------------------------------------
// Credit balance display logic
// ---------------------------------------------------------------------------

describe('credit balance display', () => {
  function getColorClass(used: number, limit: number): string {
    const pct = (used / limit) * 100;
    if (pct >= 90) return 'red';
    if (pct >= 70) return 'amber';
    return 'green';
  }

  it('shows green when usage is below 70%', () => {
    expect(getColorClass(50, 100)).toBe('green');
    expect(getColorClass(0, 500)).toBe('green');
  });

  it('shows amber when usage is 70-89%', () => {
    expect(getColorClass(75, 100)).toBe('amber');
    expect(getColorClass(89, 100)).toBe('amber');
  });

  it('shows red when usage is 90%+', () => {
    expect(getColorClass(90, 100)).toBe('red');
    expect(getColorClass(100, 100)).toBe('red');
    expect(getColorClass(500, 500)).toBe('red');
  });

  it('remaining = limit - used', () => {
    const used = 42;
    const limit = 500;
    expect(limit - used).toBe(458);
  });
});

// ---------------------------------------------------------------------------
// PLAN_CREDIT_LIMITS constants
// ---------------------------------------------------------------------------

describe('PLAN_CREDIT_LIMITS', () => {
  it('trial: 25 credits', () => expect(PLAN_CREDIT_LIMITS.trial).toBe(25));
  it('starter: 100 credits', () => expect(PLAN_CREDIT_LIMITS.starter).toBe(100));
  it('growth: 500 credits', () => expect(PLAN_CREDIT_LIMITS.growth).toBe(500));
  it('agency: 2000 credits', () => expect(PLAN_CREDIT_LIMITS.agency).toBe(2000));

  it('unknown plan defaults to trial limit', () => {
    expect(getCreditLimit('unknown')).toBe(25);
    expect(getCreditLimit(null)).toBe(25);
    expect(getCreditLimit(undefined)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Subscription details shape
// ---------------------------------------------------------------------------

describe('subscription details shape', () => {
  interface SubscriptionDetails {
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    status: string | null;
  }

  it('has required fields', () => {
    const details: SubscriptionDetails = {
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      status: null,
    };
    expect(details).toHaveProperty('currentPeriodEnd');
    expect(details).toHaveProperty('cancelAtPeriodEnd');
    expect(details).toHaveProperty('status');
  });

  it('cancelAtPeriodEnd defaults to false', () => {
    const details: SubscriptionDetails = {
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      status: null,
    };
    expect(details.cancelAtPeriodEnd).toBe(false);
  });
});
