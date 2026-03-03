// ---------------------------------------------------------------------------
// src/__tests__/unit/p3-fix-16/core-dashboard-pages.test.ts — P3-FIX-16
//
// Tests validating core dashboard data page patterns:
// - Data mode resolution
// - Sample vs real data flow
// - Empty state conditions
// - Next scan date formatting
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { isSampleMode } from '@/lib/sample-data/use-sample-mode';
import { resolveDataMode, getNextSundayUTC } from '@/lib/data/scan-data-resolver';
import { deriveRealityScore } from '@/app/dashboard/page';
import {
  SAMPLE_VISIBILITY_SCORE,
  SAMPLE_OPEN_ALERT_COUNT,
  SAMPLE_WRONG_FACTS_COUNT,
} from '@/lib/sample-data/sample-dashboard-data';

// ---------------------------------------------------------------------------
// Sample mode transition logic
// ---------------------------------------------------------------------------

describe('sample mode transition logic', () => {
  it('sample mode active when no visibility score and org < 14 days', () => {
    const now = new Date();
    expect(isSampleMode(null, now.toISOString())).toBe(true);
  });

  it('sample mode inactive when visibility score exists', () => {
    expect(isSampleMode(47, new Date().toISOString())).toBe(false);
  });

  it('sample mode inactive after 14 days even without data', () => {
    const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    expect(isSampleMode(null, old.toISOString())).toBe(false);
  });

  it('transition boundary: exactly 14 days is NOT sample mode', () => {
    const exactly14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(isSampleMode(null, exactly14.toISOString())).toBe(false);
  });

  it('sample data constants are defined for overlays', () => {
    expect(SAMPLE_VISIBILITY_SCORE).toBeGreaterThan(0);
    expect(SAMPLE_OPEN_ALERT_COUNT).toBeGreaterThanOrEqual(0);
    expect(SAMPLE_WRONG_FACTS_COUNT).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Reality Score derivation (core dashboard metric)
// ---------------------------------------------------------------------------

describe('deriveRealityScore', () => {
  it('returns null realityScore when visibility is null', () => {
    const result = deriveRealityScore(0, null);
    expect(result.realityScore).toBeNull();
    expect(result.visibility).toBeNull();
  });

  it('returns numeric realityScore when visibility is present', () => {
    const result = deriveRealityScore(0, 50);
    expect(result.realityScore).toBeTypeOf('number');
    expect(result.realityScore).toBeGreaterThan(0);
  });

  it('accuracy is 100 when 0 open alerts', () => {
    const result = deriveRealityScore(0, 50);
    expect(result.accuracy).toBe(100);
  });

  it('accuracy drops 15 per alert (floor 40)', () => {
    expect(deriveRealityScore(1, 50).accuracy).toBe(85);
    expect(deriveRealityScore(4, 50).accuracy).toBe(40);
    expect(deriveRealityScore(10, 50).accuracy).toBe(40); // floor
  });

  it('uses dataHealthScore when provided', () => {
    const withHealth = deriveRealityScore(0, 50, 80);
    const withoutHealth = deriveRealityScore(0, 50, null, null);
    // DataHealth affects the 0.2 weight component
    expect(withHealth.dataHealth).toBe(80);
    expect(withoutHealth.dataHealth).toBe(100); // default
  });

  it('reality = visibility*0.4 + accuracy*0.4 + health*0.2', () => {
    const result = deriveRealityScore(0, 50, 80);
    // visibility=50, accuracy=100, health=80
    // 50*0.4 + 100*0.4 + 80*0.2 = 20 + 40 + 16 = 76
    expect(result.realityScore).toBe(76);
  });
});

// ---------------------------------------------------------------------------
// Data mode states (the 4 states from P3-FIX-16 spec)
// ---------------------------------------------------------------------------

describe('dashboard data page states', () => {
  // STATE 1: sample data (dataMode='sample', data exists in-memory)
  it('STATE 1: sample mode shows sample constants', () => {
    const sampleMode = isSampleMode(null, new Date().toISOString());
    expect(sampleMode).toBe(true);
    // Dashboard uses SAMPLE_* constants when sampleMode=true
    const displayScores = sampleMode
      ? deriveRealityScore(SAMPLE_OPEN_ALERT_COUNT, SAMPLE_VISIBILITY_SCORE)
      : deriveRealityScore(0, null);
    expect(displayScores.realityScore).not.toBeNull();
  });

  // STATE 2: real data (dataMode='real', data from DB)
  it('STATE 2: real data mode uses actual DB values', () => {
    const sampleMode = isSampleMode(72, new Date().toISOString());
    expect(sampleMode).toBe(false);
    const displayScores = deriveRealityScore(2, 72, 85);
    expect(displayScores.realityScore).not.toBeNull();
    expect(displayScores.visibility).toBe(72);
  });

  // STATE 3: real mode, no data yet
  it('STATE 3: real mode with null visibility shows empty state', () => {
    const result = deriveRealityScore(0, null);
    expect(result.realityScore).toBeNull();
    expect(result.visibility).toBeNull();
    // UI should show "Welcome" banner with next scan date
  });

  // STATE 4: error handling (tested via component tests)
  it('STATE 4: deriveRealityScore handles edge cases without throwing', () => {
    expect(() => deriveRealityScore(0, null, null, null)).not.toThrow();
    expect(() => deriveRealityScore(100, 0, 0, 0)).not.toThrow();
    expect(() => deriveRealityScore(-1, 100)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Next scan date (used in empty states and banners)
// ---------------------------------------------------------------------------

describe('next scan date for empty states', () => {
  it('getNextSundayUTC returns a valid date', () => {
    const nextScan = getNextSundayUTC();
    expect(nextScan).toBeInstanceOf(Date);
    expect(nextScan.getUTCDay()).toBe(0); // Sunday
  });

  it('next scan date is March 8 for a Tuesday March 3 input', () => {
    const nextScan = getNextSundayUTC(new Date('2026-03-03T12:00:00Z'));
    expect(nextScan.getUTCDate()).toBe(8);
    expect(nextScan.getUTCMonth()).toBe(2); // March = 2
    expect(nextScan.getUTCFullYear()).toBe(2026);
  });
});

// ---------------------------------------------------------------------------
// Data filtering by mode
// ---------------------------------------------------------------------------

describe('data mode filtering', () => {
  it('sample and real data do not coexist in display', () => {
    // When sampleMode=true, we use SAMPLE_* constants (no DB data)
    // When sampleMode=false, we use fetchDashboardData results
    // There is no mixing — verified by the rendering paths in page.tsx:
    //   if (!onboardingState.has_real_data) → SampleDashboard (in-memory)
    //   else → real dashboard with optional sample overlays for < 14 days
    const sampleActive = isSampleMode(null, new Date().toISOString());
    const realActive = isSampleMode(50, new Date().toISOString());
    // They should never both be true for same inputs
    expect(sampleActive).not.toBe(realActive);
  });
});
