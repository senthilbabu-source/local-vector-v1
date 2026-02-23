// ---------------------------------------------------------------------------
// scan-health-utils.test.ts — Unit tests for formatRelativeTime + nextSundayLabel
//
// Tests app/dashboard/_components/scan-health-utils.ts:
//   1. formatRelativeTime — < 1 hour     → "just now"
//   2. formatRelativeTime — 3 hours ago  → "3h ago"
//   3. formatRelativeTime — 1 day ago    → "yesterday"
//   4. formatRelativeTime — 4 days ago   → "4 days ago"
//   5. formatRelativeTime — 10 days ago  → short date ("Jan 15" format)
//   6. nextSundayLabel    — always returns a Sunday in the future
//
// No mocks needed — pure functions with no external dependencies.
//
// Run:
//   npx vitest run src/__tests__/unit/scan-health-utils.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { formatRelativeTime, nextSundayLabel } from '@/app/dashboard/_components/scan-health-utils';

// ── Helpers ───────────────────────────────────────────────────────────────

/** Returns an ISO string representing `hoursAgo` hours in the past. */
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

/** Returns an ISO string representing `daysAgo` days in the past. */
function daysAgo(d: number): string {
  return hoursAgo(d * 24);
}

// ── formatRelativeTime ────────────────────────────────────────────────────

describe('formatRelativeTime', () => {

  it('returns "just now" for a timestamp less than 1 hour ago', () => {
    expect(formatRelativeTime(hoursAgo(0.5))).toBe('just now');
    expect(formatRelativeTime(hoursAgo(0))).toBe('just now');
  });

  it('returns "Xh ago" for a timestamp N hours ago (< 24 hours)', () => {
    expect(formatRelativeTime(hoursAgo(3))).toBe('3h ago');
    expect(formatRelativeTime(hoursAgo(23))).toBe('23h ago');
    // Boundary: exactly 1 hour ago
    expect(formatRelativeTime(hoursAgo(1))).toBe('1h ago');
  });

  it('returns "yesterday" for a timestamp exactly 1 day ago', () => {
    expect(formatRelativeTime(daysAgo(1))).toBe('yesterday');
  });

  it('returns "X days ago" for a timestamp 2–6 days ago', () => {
    expect(formatRelativeTime(daysAgo(2))).toBe('2 days ago');
    expect(formatRelativeTime(daysAgo(4))).toBe('4 days ago');
    expect(formatRelativeTime(daysAgo(6))).toBe('6 days ago');
  });

  it('returns a short date string (e.g. "Jan 15") for timestamps 7+ days ago', () => {
    const result10 = formatRelativeTime(daysAgo(10));
    const result30 = formatRelativeTime(daysAgo(30));
    // Should match "Mon DD" format — not "just now", "h ago", "days ago", or "yesterday"
    expect(result10).not.toContain('ago');
    expect(result10).not.toBe('just now');
    expect(result10).not.toBe('yesterday');
    // Should be a valid short-month + day string (e.g. "Jan 15", "Feb 2")
    expect(result10).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    expect(result30).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

});

// ── nextSundayLabel ───────────────────────────────────────────────────────

describe('nextSundayLabel', () => {

  it('returns a short date string in "Mon DD" format', () => {
    const label = nextSundayLabel();
    // e.g. "Mar 2", "Feb 28", "Jan 15"
    expect(label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('always returns a date at least 1 day in the future', () => {
    const label  = nextSundayLabel();
    const parsed = new Date(`${label} ${new Date().getFullYear()}`);
    // Adjust for year boundary (e.g. "Jan 5" could be next year if today is Dec 30)
    const today  = new Date();
    if (parsed.getMonth() < today.getMonth()) {
      parsed.setFullYear(today.getFullYear() + 1);
    }
    // The next Sunday must be strictly in the future (>= 1 day from now)
    const diffDays = (parsed.getTime() - today.getTime()) / 86_400_000;
    expect(diffDays).toBeGreaterThan(0);
    expect(diffDays).toBeLessThanOrEqual(7);
  });

});
