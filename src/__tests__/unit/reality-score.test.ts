// ---------------------------------------------------------------------------
// reality-score.test.ts — Unit tests for deriveRealityScore()
//
// Tests the formula exported from app/dashboard/page.tsx:
//   accuracy    = openAlertCount === 0 ? 100 : Math.max(40, 100 - openAlertCount * 15)
//   realityScore = Math.round(visibility × 0.4 + accuracy × 0.4 + dataHealth × 0.2)
//   visibility  = 98 (hardcoded)
//   dataHealth  = 100 (user cleared onboarding guard)
//
// No mocks needed — pure function.
//
// Run:
//   npx vitest run src/__tests__/unit/reality-score.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { deriveRealityScore } from '@/app/dashboard/page';

describe('deriveRealityScore', () => {
  it('returns realityScore=99 when 0 open alerts', () => {
    // accuracy=100: round(98×0.4 + 100×0.4 + 100×0.2) = round(39.2+40+20) = round(99.2) = 99
    const { realityScore } = deriveRealityScore(0);
    expect(realityScore).toBe(99);
  });

  it('returns realityScore=93 when 1 open alert', () => {
    // accuracy=max(40, 100-15)=85: round(39.2+34+20) = round(93.2) = 93
    const { realityScore } = deriveRealityScore(1);
    expect(realityScore).toBe(93);
  });

  it('returns realityScore=87 when 2 open alerts', () => {
    // accuracy=max(40, 100-30)=70: round(39.2+28+20) = round(87.2) = 87
    const { realityScore } = deriveRealityScore(2);
    expect(realityScore).toBe(87);
  });

  it('returns realityScore=75 when 4 open alerts', () => {
    // accuracy=max(40, 100-60)=40: round(39.2+16+20) = round(75.2) = 75
    const { realityScore } = deriveRealityScore(4);
    expect(realityScore).toBe(75);
  });

  it('returns realityScore=75 when 5 open alerts (accuracy floor at 40)', () => {
    // accuracy=max(40, 100-75)=40 (floor kicks in): round(39.2+16+20) = 75
    const { realityScore } = deriveRealityScore(5);
    expect(realityScore).toBe(75);
  });

  it('returns realityScore=75 when 10 open alerts (floor persists)', () => {
    // accuracy=max(40, 100-150)=40: same floor
    const { realityScore } = deriveRealityScore(10);
    expect(realityScore).toBe(75);
  });

  it('always returns visibility=98 regardless of alert count', () => {
    expect(deriveRealityScore(0).visibility).toBe(98);
    expect(deriveRealityScore(5).visibility).toBe(98);
    expect(deriveRealityScore(10).visibility).toBe(98);
  });

  it('always returns dataHealth=100 regardless of alert count', () => {
    expect(deriveRealityScore(0).dataHealth).toBe(100);
    expect(deriveRealityScore(5).dataHealth).toBe(100);
  });
});
