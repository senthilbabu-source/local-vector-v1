// ---------------------------------------------------------------------------
// day-of-week-urgency.test.ts — S21 (AI_RULES §221)
//
// Unit tests for computeUrgency() pure function.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { computeUrgency } from '@/lib/hallucinations/urgency';

// Helper: create an ISO date string for a specific day of week (UTC)
// 2026-03-03 = Tuesday, 2026-03-04 = Wednesday, 2026-03-05 = Thursday
// 2026-03-02 = Monday, 2026-03-06 = Friday, 2026-03-07 = Saturday, 2026-03-01 = Sunday
function dateForDay(dayName: string): string {
  const map: Record<string, string> = {
    sunday:    '2026-03-01T10:00:00Z',
    monday:    '2026-03-02T10:00:00Z',
    tuesday:   '2026-03-03T10:00:00Z',
    wednesday: '2026-03-04T10:00:00Z',
    thursday:  '2026-03-05T10:00:00Z',
    friday:    '2026-03-06T10:00:00Z',
    saturday:  '2026-03-07T10:00:00Z',
  };
  return map[dayName];
}

describe('computeUrgency', () => {
  it('Tuesday + critical = returns urgency result', () => {
    const result = computeUrgency('critical', dateForDay('tuesday'), 55, 1800);
    expect(result).not.toBeNull();
    expect(result!.badge).toBe('fix-before-weekend');
  });

  it('Wednesday + high = returns urgency result', () => {
    const result = computeUrgency('high', dateForDay('wednesday'), 55, 1800);
    expect(result).not.toBeNull();
  });

  it('Thursday + critical = returns urgency result', () => {
    const result = computeUrgency('critical', dateForDay('thursday'), 55, 1800);
    expect(result).not.toBeNull();
  });

  it('Monday + critical = returns null (not urgent window)', () => {
    expect(computeUrgency('critical', dateForDay('monday'), 55, 1800)).toBeNull();
  });

  it('Friday + critical = returns null (already weekend)', () => {
    expect(computeUrgency('critical', dateForDay('friday'), 55, 1800)).toBeNull();
  });

  it('Saturday + critical = returns null', () => {
    expect(computeUrgency('critical', dateForDay('saturday'), 55, 1800)).toBeNull();
  });

  it('Sunday + critical = returns null', () => {
    expect(computeUrgency('critical', dateForDay('sunday'), 55, 1800)).toBeNull();
  });

  it('Medium severity on Wednesday = returns null', () => {
    expect(computeUrgency('medium', dateForDay('wednesday'), 55, 1800)).toBeNull();
  });

  it('Low severity on Wednesday = returns null', () => {
    expect(computeUrgency('low', dateForDay('wednesday'), 55, 1800)).toBeNull();
  });

  it('revenueAtStake = 55 * 1800 / 4 * 0.4 = 9900 with defaults', () => {
    const result = computeUrgency('critical', dateForDay('tuesday'), 55, 1800);
    expect(result!.revenueAtStake).toBe(9900);
  });

  it('custom avg_ticket applies to revenueAtStake', () => {
    const result = computeUrgency('critical', dateForDay('tuesday'), 100, 1800);
    // 100 * 1800 / 4 * 0.4 = 18000
    expect(result!.revenueAtStake).toBe(18000);
  });

  it('custom monthlyCover applies to revenueAtStake', () => {
    const result = computeUrgency('critical', dateForDay('tuesday'), 55, 1000);
    // 55 * 1000 / 4 * 0.4 = 5500
    expect(result!.revenueAtStake).toBe(5500);
  });

  it('deadline is "this Friday" when Tuesday', () => {
    const result = computeUrgency('critical', dateForDay('tuesday'), 55, 1800);
    expect(result!.deadline).toBe('this Friday');
  });

  it('returns result with correct badge value', () => {
    const result = computeUrgency('high', dateForDay('wednesday'), 55, 1800);
    expect(result!.badge).toBe('fix-before-weekend');
  });

  it('revenueAtStake is rounded to nearest integer', () => {
    // 33 * 777 / 4 * 0.4 = 33 * 777 = 25641, /4 = 6410.25, *0.4 = 2564.1 → rounds to 2564
    const result = computeUrgency('critical', dateForDay('tuesday'), 33, 777);
    expect(Number.isInteger(result!.revenueAtStake)).toBe(true);
  });
});
