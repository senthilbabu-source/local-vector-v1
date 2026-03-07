// ---------------------------------------------------------------------------
// wave5-s30-ai-response-summary.test.ts — S30 (§233)
//
// Pure function tests for ai-response-summary service.
// Run: npx vitest run src/__tests__/unit/wave5-s30-ai-response-summary.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import {
  isResponseStale,
  formatResponseSnippet,
} from '@/lib/services/ai-response-summary';

// ---------------------------------------------------------------------------
// isResponseStale
// ---------------------------------------------------------------------------

describe('S30 — isResponseStale', () => {
  it('returns false for fresh timestamps (< 7 days)', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isResponseStale(twoDaysAgo)).toBe(false);
  });

  it('returns true for stale timestamps (> 7 days)', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isResponseStale(tenDaysAgo)).toBe(true);
  });

  it('returns true for exactly 7 days (boundary)', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000).toISOString();
    expect(isResponseStale(sevenDaysAgo)).toBe(true);
  });

  it('supports custom threshold (3 days)', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    expect(isResponseStale(fourDaysAgo, 3)).toBe(true);
    expect(isResponseStale(fourDaysAgo, 5)).toBe(false);
  });

  it('returns true for null/undefined', () => {
    expect(isResponseStale(null)).toBe(true);
    expect(isResponseStale(undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatResponseSnippet
// ---------------------------------------------------------------------------

describe('S30 — formatResponseSnippet', () => {
  it('returns full string if under limit', () => {
    expect(formatResponseSnippet('Hello world.', 150)).toBe('Hello world.');
  });

  it('returns empty string for null', () => {
    expect(formatResponseSnippet(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatResponseSnippet(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatResponseSnippet('')).toBe('');
  });

  it('truncates at sentence boundary when available', () => {
    const text = 'Charcoal N Chill is a popular BBQ restaurant in Alpharetta. They serve brisket and ribs. The restaurant has been praised for its smoky flavors and excellent service in the area.';
    const result = formatResponseSnippet(text, 100);
    // Should end at a period within the first 100 chars
    expect(result.endsWith('.')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('falls back to word boundary when no sentence boundary in range', () => {
    const text = 'A ' + 'very '.repeat(30) + 'long phrase without periods';
    const result = formatResponseSnippet(text, 50);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(55); // word boundary + ellipsis
  });

  it('handles text with exactly maxLength', () => {
    const text = 'x'.repeat(150);
    const result = formatResponseSnippet(text, 150);
    expect(result).toBe(text);
  });

  it('trims whitespace', () => {
    expect(formatResponseSnippet('  hello world  ', 150)).toBe('hello world');
  });
});
