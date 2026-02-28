// ---------------------------------------------------------------------------
// src/__tests__/unit/guided-tour-steps.test.ts — Sprint E (M2)
//
// Validates the TOUR_STEPS export from GuidedTour.tsx.
// Covers structural integrity of existing steps and verifies the 3 new steps
// added in Sprint E (indices 5-7: share-of-voice, citations, revenue-impact).
//
// Run:
//   npx vitest run src/__tests__/unit/guided-tour-steps.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { TOUR_STEPS } from '@/app/dashboard/_components/GuidedTour';

describe('TOUR_STEPS — structural integrity', () => {
  it('tour has at least 8 steps', () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(8);
  });

  it('all steps have non-empty title', () => {
    for (const step of TOUR_STEPS) {
      expect(typeof step.title).toBe('string');
      expect(step.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('all steps have non-empty description', () => {
    for (const step of TOUR_STEPS) {
      expect(typeof step.description).toBe('string');
      expect(step.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('no step targets duplicate testids (all targetTestId values are unique)', () => {
    const ids = TOUR_STEPS.map((s) => s.targetTestId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('TOUR_STEPS — Sprint E new steps (indices 5-7)', () => {
  it('step at index 5 targets "nav-share-of-voice"', () => {
    expect(TOUR_STEPS[5].targetTestId).toBe('nav-share-of-voice');
  });

  it('step at index 6 targets "nav-citations"', () => {
    expect(TOUR_STEPS[6].targetTestId).toBe('nav-citations');
  });

  it('step at index 7 targets "nav-revenue-impact"', () => {
    expect(TOUR_STEPS[7].targetTestId).toBe('nav-revenue-impact');
  });

  it('new steps (indices 5-7) do not duplicate existing step targets (0-4)', () => {
    const existingTargets = new Set(TOUR_STEPS.slice(0, 5).map((s) => s.targetTestId));
    const newTargets = TOUR_STEPS.slice(5, 8).map((s) => s.targetTestId);

    for (const target of newTargets) {
      expect(existingTargets.has(target)).toBe(false);
    }
  });
});
