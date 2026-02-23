// ---------------------------------------------------------------------------
// reality-score.test.ts — Unit tests for deriveRealityScore()
//
// Tests the formula exported from app/dashboard/page.tsx:
//   accuracy    = openAlertCount === 0 ? 100 : Math.max(40, 100 - openAlertCount * 15)
//   realityScore = Math.round(visibility × 0.4 + accuracy × 0.4 + dataHealth × 0.2)
//   visibility  = passed-in visibilityScore (0–100 integer, or null)
//   dataHealth  = 100 (user cleared onboarding guard)
//
// Canonical test value for visibilityScore: 60
//   realityScore = Math.round(24 + accuracy × 0.4 + 20) = Math.round(44 + accuracy × 0.4)
//
// No mocks needed — pure function.
//
// Run:
//   npx vitest run src/__tests__/unit/reality-score.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { deriveRealityScore } from '@/app/dashboard/page';

describe('deriveRealityScore', () => {
  it('returns realityScore=84 when 0 open alerts and visibility=60', () => {
    // accuracy=100: Math.round(24 + 40 + 20) = Math.round(84) = 84
    const { realityScore } = deriveRealityScore(0, 60);
    expect(realityScore).toBe(84);
  });

  it('returns realityScore=78 when 1 open alert and visibility=60', () => {
    // accuracy=max(40, 100-15)=85: Math.round(24 + 34 + 20) = Math.round(78) = 78
    const { realityScore } = deriveRealityScore(1, 60);
    expect(realityScore).toBe(78);
  });

  it('returns realityScore=72 when 2 open alerts and visibility=60', () => {
    // accuracy=max(40, 100-30)=70: Math.round(24 + 28 + 20) = Math.round(72) = 72
    const { realityScore } = deriveRealityScore(2, 60);
    expect(realityScore).toBe(72);
  });

  it('returns realityScore=60 when 4 open alerts and visibility=60', () => {
    // accuracy=max(40, 100-60)=40: Math.round(24 + 16 + 20) = Math.round(60) = 60
    const { realityScore } = deriveRealityScore(4, 60);
    expect(realityScore).toBe(60);
  });

  it('returns realityScore=60 when 5 open alerts (accuracy floor at 40) and visibility=60', () => {
    // accuracy=max(40, 100-75)=40 (floor kicks in): same as 4 alerts
    const { realityScore } = deriveRealityScore(5, 60);
    expect(realityScore).toBe(60);
  });

  it('returns realityScore=60 when 10 open alerts (floor persists) and visibility=60', () => {
    // accuracy=max(40, 100-150)=40: same floor
    const { realityScore } = deriveRealityScore(10, 60);
    expect(realityScore).toBe(60);
  });

  it('returns the passed visibilityScore as the visibility component', () => {
    expect(deriveRealityScore(0, 60).visibility).toBe(60);
    expect(deriveRealityScore(5, 75).visibility).toBe(75);
    expect(deriveRealityScore(10, 100).visibility).toBe(100);
  });

  it('always returns dataHealth=100 regardless of alert count', () => {
    expect(deriveRealityScore(0, 60).dataHealth).toBe(100);
    expect(deriveRealityScore(5, 60).dataHealth).toBe(100);
  });

  it('returns realityScore=null when visibilityScore is null', () => {
    const { realityScore, visibility } = deriveRealityScore(0, null);
    expect(realityScore).toBeNull();
    expect(visibility).toBeNull();
  });

  it('accuracy and dataHealth still compute correctly when visibilityScore is null', () => {
    const result0 = deriveRealityScore(0, null);
    expect(result0.accuracy).toBe(100);
    expect(result0.dataHealth).toBe(100);

    const result3 = deriveRealityScore(3, null);
    // accuracy = max(40, 100 - 45) = 55
    expect(result3.accuracy).toBe(55);
    expect(result3.dataHealth).toBe(100);
  });
});
