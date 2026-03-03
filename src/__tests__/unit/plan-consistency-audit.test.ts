// ---------------------------------------------------------------------------
// src/__tests__/unit/plan-consistency-audit.test.ts — P1-FIX-08
//
// Tests for new plan-enforcer gating functions + regression guards ensuring
// plan display names never leak raw enum values into the UI.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  planSatisfies,
  canViewRevenueLeak,
  canConfigureWebhook,
  canManageApiKeys,
  PLAN_HIERARCHY,
  type PlanTier,
} from '@/lib/plan-enforcer';
import { getPlanDisplayName } from '@/lib/plan-display-names';

// ---------------------------------------------------------------------------
// canViewRevenueLeak — Growth+ (P1-FIX-08)
// ---------------------------------------------------------------------------

describe('canViewRevenueLeak', () => {
  it('returns false for trial', () => {
    expect(canViewRevenueLeak('trial')).toBe(false);
  });
  it('returns false for starter', () => {
    expect(canViewRevenueLeak('starter')).toBe(false);
  });
  it('returns true for growth', () => {
    expect(canViewRevenueLeak('growth')).toBe(true);
  });
  it('returns true for agency', () => {
    expect(canViewRevenueLeak('agency')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canConfigureWebhook — Agency only (P1-FIX-08)
// ---------------------------------------------------------------------------

describe('canConfigureWebhook', () => {
  it('returns false for trial', () => {
    expect(canConfigureWebhook('trial')).toBe(false);
  });
  it('returns false for starter', () => {
    expect(canConfigureWebhook('starter')).toBe(false);
  });
  it('returns false for growth', () => {
    expect(canConfigureWebhook('growth')).toBe(false);
  });
  it('returns true for agency', () => {
    expect(canConfigureWebhook('agency')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canManageApiKeys — Agency only (P1-FIX-08)
// ---------------------------------------------------------------------------

describe('canManageApiKeys', () => {
  it('returns false for trial', () => {
    expect(canManageApiKeys('trial')).toBe(false);
  });
  it('returns false for starter', () => {
    expect(canManageApiKeys('starter')).toBe(false);
  });
  it('returns false for growth', () => {
    expect(canManageApiKeys('growth')).toBe(false);
  });
  it('returns true for agency', () => {
    expect(canManageApiKeys('agency')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// planSatisfies edge cases
// ---------------------------------------------------------------------------

describe('planSatisfies edge cases', () => {
  it('returns false for null plan against growth requirement', () => {
    expect(planSatisfies(null, 'growth')).toBe(false);
  });
  it('returns false for undefined plan against growth requirement', () => {
    expect(planSatisfies(undefined, 'growth')).toBe(false);
  });
  it('returns false for unknown string against growth requirement', () => {
    expect(planSatisfies('banana', 'growth')).toBe(false);
  });
  it('returns true when current equals required', () => {
    expect(planSatisfies('growth', 'growth')).toBe(true);
  });
  it('returns true when current exceeds required', () => {
    expect(planSatisfies('agency', 'growth')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PLAN_HIERARCHY structural check
// ---------------------------------------------------------------------------

describe('PLAN_HIERARCHY', () => {
  it('has exactly the 4 expected tiers', () => {
    expect(Object.keys(PLAN_HIERARCHY).sort()).toEqual(
      ['agency', 'growth', 'starter', 'trial'],
    );
  });
  it('trial is the lowest tier (0)', () => {
    expect(PLAN_HIERARCHY['trial']).toBe(0);
  });
  it('agency is the highest tier (3)', () => {
    expect(PLAN_HIERARCHY['agency']).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getPlanDisplayName regression — raw enum values must never appear in UI
// ---------------------------------------------------------------------------

describe('getPlanDisplayName regression', () => {
  const tiers: PlanTier[] = ['trial', 'starter', 'growth', 'agency'];

  for (const tier of tiers) {
    it(`never returns raw enum value "${tier}"`, () => {
      const display = getPlanDisplayName(tier);
      expect(display).not.toBe(tier);
      expect(display.length).toBeGreaterThan(0);
    });
  }

  it('returns "Free" for null plan', () => {
    expect(getPlanDisplayName(null)).toBe('Free');
  });
});
