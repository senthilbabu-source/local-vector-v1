// ---------------------------------------------------------------------------
// plan-enforcer.test.ts — Unit tests for lib/plan-enforcer.ts
//
// Tests all 9 exported gating functions against every plan tier.
// No mocks needed — pure function tests.
//
// Run:
//   npx vitest run src/__tests__/unit/plan-enforcer.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  canRunDailyAudit,
  canRunSovEvaluation,
  canRunCompetitorIntercept,
  canRunAutopilot,
  canRunPageAudit,
  canRunOccasionEngine,
  canConnectGBP,
  maxLocations,
  maxCompetitors,
} from '@/lib/plan-enforcer';

describe('canRunDailyAudit', () => {
  it('returns false for trial plan', () => {
    expect(canRunDailyAudit('trial')).toBe(false);
  });

  it('returns false for starter plan', () => {
    expect(canRunDailyAudit('starter')).toBe(false);
  });

  it('returns true for growth plan', () => {
    expect(canRunDailyAudit('growth')).toBe(true);
  });

  it('returns true for agency plan', () => {
    expect(canRunDailyAudit('agency')).toBe(true);
  });
});

describe('canRunSovEvaluation', () => {
  it('returns false for trial plan', () => {
    expect(canRunSovEvaluation('trial')).toBe(false);
  });

  it('returns false for starter plan', () => {
    expect(canRunSovEvaluation('starter')).toBe(false);
  });

  it('returns true for growth plan', () => {
    expect(canRunSovEvaluation('growth')).toBe(true);
  });

  it('returns true for agency plan', () => {
    expect(canRunSovEvaluation('agency')).toBe(true);
  });
});

describe('canRunCompetitorIntercept', () => {
  it('returns false for starter plan', () => {
    expect(canRunCompetitorIntercept('starter')).toBe(false);
  });

  it('returns true for growth plan', () => {
    expect(canRunCompetitorIntercept('growth')).toBe(true);
  });
});

describe('maxLocations', () => {
  it('returns 1 for growth plan', () => {
    expect(maxLocations('growth')).toBe(1);
  });

  it('returns 10 for agency plan', () => {
    expect(maxLocations('agency')).toBe(10);
  });
});

describe('maxCompetitors', () => {
  it('returns 0 for trial plan (no competitor access)', () => {
    expect(maxCompetitors('trial')).toBe(0);
  });

  it('returns 0 for starter plan (no competitor access)', () => {
    expect(maxCompetitors('starter')).toBe(0);
  });

  it('returns 3 for growth plan', () => {
    expect(maxCompetitors('growth')).toBe(3);
  });

  it('returns 10 for agency plan', () => {
    expect(maxCompetitors('agency')).toBe(10);
  });
});

describe('canRunAutopilot', () => {
  it('returns false for trial plan', () => {
    expect(canRunAutopilot('trial')).toBe(false);
  });

  it('returns false for starter plan', () => {
    expect(canRunAutopilot('starter')).toBe(false);
  });

  it('returns true for growth plan', () => {
    expect(canRunAutopilot('growth')).toBe(true);
  });

  it('returns true for agency plan', () => {
    expect(canRunAutopilot('agency')).toBe(true);
  });
});

describe('canRunPageAudit', () => {
  it('returns false for trial plan', () => {
    expect(canRunPageAudit('trial')).toBe(false);
  });

  it('returns false for starter plan', () => {
    expect(canRunPageAudit('starter')).toBe(false);
  });

  it('returns true for growth plan', () => {
    expect(canRunPageAudit('growth')).toBe(true);
  });

  it('returns true for agency plan', () => {
    expect(canRunPageAudit('agency')).toBe(true);
  });
});

describe('canRunOccasionEngine', () => {
  it('returns false for trial plan', () => {
    expect(canRunOccasionEngine('trial')).toBe(false);
  });

  it('returns false for starter plan', () => {
    expect(canRunOccasionEngine('starter')).toBe(false);
  });

  it('returns true for growth plan', () => {
    expect(canRunOccasionEngine('growth')).toBe(true);
  });

  it('returns true for agency plan', () => {
    expect(canRunOccasionEngine('agency')).toBe(true);
  });
});

describe('canConnectGBP', () => {
  it('returns false for trial plan', () => {
    expect(canConnectGBP('trial')).toBe(false);
  });

  it('returns true for starter plan', () => {
    expect(canConnectGBP('starter')).toBe(true);
  });

  it('returns true for growth plan', () => {
    expect(canConnectGBP('growth')).toBe(true);
  });

  it('returns true for agency plan', () => {
    expect(canConnectGBP('agency')).toBe(true);
  });
});
