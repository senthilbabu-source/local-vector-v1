// ---------------------------------------------------------------------------
// health-streak.test.ts — S20 (AI_RULES §220)
//
// Unit tests for computeHealthStreak() pure function.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { computeHealthStreak, type WeeklySnapshot } from '@/lib/services/health-streak.service';

function makeSnapshot(accuracy: number | null, week: number): WeeklySnapshot {
  const d = new Date('2026-01-01');
  d.setDate(d.getDate() + week * 7);
  return { accuracy_score: accuracy, snapshot_date: d.toISOString() };
}

describe('computeHealthStreak', () => {
  it('returns streak 0 for empty snapshots', () => {
    const result = computeHealthStreak([]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.isOnStreak).toBe(false);
  });

  it('returns streak 0 for null input', () => {
    const result = computeHealthStreak(null as unknown as WeeklySnapshot[]);
    expect(result.currentStreak).toBe(0);
  });

  it('returns streak 1 for a single clean week', () => {
    const result = computeHealthStreak([makeSnapshot(90, 0)]);
    expect(result.currentStreak).toBe(1);
    expect(result.isOnStreak).toBe(false); // need >= 2
  });

  it('returns streak 4 for 4 consecutive clean weeks', () => {
    const result = computeHealthStreak([
      makeSnapshot(86, 0),
      makeSnapshot(90, 1),
      makeSnapshot(88, 2),
      makeSnapshot(92, 3),
    ]);
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(4);
    expect(result.isOnStreak).toBe(true);
  });

  it('resets streak when a week has accuracy < 85', () => {
    const result = computeHealthStreak([
      makeSnapshot(90, 0),
      makeSnapshot(90, 1),
      makeSnapshot(60, 2), // breaks streak
      makeSnapshot(90, 3),
    ]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(2);
  });

  it('isOnStreak is false when streak < 2', () => {
    const result = computeHealthStreak([makeSnapshot(90, 0)]);
    expect(result.isOnStreak).toBe(false);
  });

  it('longestStreak tracked independently from currentStreak', () => {
    const result = computeHealthStreak([
      makeSnapshot(90, 0),
      makeSnapshot(90, 1),
      makeSnapshot(90, 2), // longest = 3
      makeSnapshot(50, 3), // break
      makeSnapshot(90, 4),
      makeSnapshot(90, 5), // current = 2
    ]);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(3);
    expect(result.isOnStreak).toBe(true);
  });

  it('accuracy score exactly 85 = clean week (boundary)', () => {
    const result = computeHealthStreak([
      makeSnapshot(85, 0),
      makeSnapshot(85, 1),
    ]);
    expect(result.currentStreak).toBe(2);
    expect(result.isOnStreak).toBe(true);
  });

  it('accuracy score 84 = not clean week', () => {
    const result = computeHealthStreak([
      makeSnapshot(90, 0),
      makeSnapshot(84, 1),
    ]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(1);
  });

  it('handles null accuracy_score as not clean', () => {
    const result = computeHealthStreak([
      makeSnapshot(90, 0),
      makeSnapshot(null, 1),
      makeSnapshot(90, 2),
    ]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it('all dirty weeks = streak 0', () => {
    const result = computeHealthStreak([
      makeSnapshot(50, 0),
      makeSnapshot(60, 1),
      makeSnapshot(70, 2),
    ]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.isOnStreak).toBe(false);
  });

  it('long streak ending with dirty week = current 0, longest preserved', () => {
    const result = computeHealthStreak([
      makeSnapshot(90, 0),
      makeSnapshot(90, 1),
      makeSnapshot(90, 2),
      makeSnapshot(90, 3),
      makeSnapshot(90, 4),
      makeSnapshot(50, 5), // breaks the 5-week streak
    ]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(5);
    expect(result.isOnStreak).toBe(false);
  });

  it('handles mixed null and valid scores correctly', () => {
    const result = computeHealthStreak([
      makeSnapshot(null, 0),
      makeSnapshot(90, 1),
      makeSnapshot(90, 2),
      makeSnapshot(null, 3),
      makeSnapshot(90, 4),
    ]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(2);
  });
});
