// ---------------------------------------------------------------------------
// src/__tests__/unit/p3-fix-13/scan-data-resolver.test.ts — P3-FIX-13
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { resolveDataMode, getNextSundayUTC } from '@/lib/data/scan-data-resolver';

// ---------------------------------------------------------------------------
// Mock Supabase — fluent chain builder
// ---------------------------------------------------------------------------

function createMockSupabase(overrides: {
  orgCreatedAt?: string | null;
  firstEvalCreatedAt?: string | null;
  lastEvalCreatedAt?: string | null;
} = {}) {
  const {
    orgCreatedAt = new Date().toISOString(),
    firstEvalCreatedAt = null,
    lastEvalCreatedAt = null,
  } = overrides;

  return {
    from: vi.fn((table: string) => {
      let orderAsc = true;

      const chain: Record<string, any> = {};
      const self = () => chain;

      chain.select = vi.fn().mockImplementation(() => chain);
      chain.eq = vi.fn().mockImplementation(() => chain);
      chain.order = vi.fn().mockImplementation((_col: string, opts?: { ascending: boolean }) => {
        if (opts) orderAsc = opts.ascending;
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => chain);
      chain.single = vi.fn().mockImplementation(() => {
        if (table === 'organizations') {
          return Promise.resolve({ data: { created_at: orgCreatedAt }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
      chain.maybeSingle = vi.fn().mockImplementation(() => {
        if (table === 'sov_evaluations') {
          const val = orderAsc ? firstEvalCreatedAt : lastEvalCreatedAt;
          return Promise.resolve({
            data: val ? { created_at: val } : null,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      return chain;
    }),
  } as any;
}

// ---------------------------------------------------------------------------
// getNextSundayUTC
// ---------------------------------------------------------------------------

describe('getNextSundayUTC', () => {
  it('returns a Sunday', () => {
    const result = getNextSundayUTC(new Date('2026-03-03T12:00:00Z'));
    expect(result.getUTCDay()).toBe(0);
  });

  it('returns next Sunday when called on a non-Sunday', () => {
    const result = getNextSundayUTC(new Date('2026-03-03T12:00:00Z'));
    expect(result.toISOString()).toBe('2026-03-08T00:00:00.000Z');
  });

  it('returns next Sunday (7 days later) when called on a Sunday', () => {
    const result = getNextSundayUTC(new Date('2026-03-08T12:00:00Z'));
    expect(result.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('is always in the future relative to input', () => {
    const now = new Date('2026-03-03T12:00:00Z');
    const result = getNextSundayUTC(now);
    expect(result.getTime()).toBeGreaterThan(now.getTime());
  });

  it('is never more than 7 days away', () => {
    const now = new Date('2026-03-03T12:00:00Z');
    const result = getNextSundayUTC(now);
    const diffDays = (result.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeLessThanOrEqual(7);
  });

  it('sets time to midnight UTC', () => {
    const result = getNextSundayUTC(new Date('2026-03-03T15:30:45Z'));
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveDataMode
// ---------------------------------------------------------------------------

describe('resolveDataMode', () => {
  it('returns mode=sample when no real data and org < 14 days old', async () => {
    const supabase = createMockSupabase({
      orgCreatedAt: new Date().toISOString(),
      firstEvalCreatedAt: null,
    });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.mode).toBe('sample');
    expect(result.hasRealData).toBe(false);
    expect(result.isSampleOverlay).toBe(true);
  });

  it('returns mode=real when sov_evaluations exist', async () => {
    const scanDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = createMockSupabase({
      orgCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      firstEvalCreatedAt: scanDate,
      lastEvalCreatedAt: scanDate,
    });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.mode).toBe('real');
    expect(result.hasRealData).toBe(true);
    expect(result.isSampleOverlay).toBe(false);
  });

  it('returns mode=empty when no real data and org > 14 days old', async () => {
    const supabase = createMockSupabase({
      orgCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      firstEvalCreatedAt: null,
    });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.mode).toBe('empty');
    expect(result.hasRealData).toBe(false);
    expect(result.isSampleOverlay).toBe(false);
  });

  it('returns firstScanCompletedAt from sov_evaluations', async () => {
    const scanDate = '2026-02-15T02:00:00.000Z';
    const supabase = createMockSupabase({
      orgCreatedAt: '2026-01-01T00:00:00.000Z',
      firstEvalCreatedAt: scanDate,
      lastEvalCreatedAt: scanDate,
    });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.firstScanCompletedAt).toBe(scanDate);
  });

  it('returns null timestamps when no scans have run', async () => {
    const supabase = createMockSupabase({
      orgCreatedAt: new Date().toISOString(),
      firstEvalCreatedAt: null,
      lastEvalCreatedAt: null,
    });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.firstScanCompletedAt).toBeNull();
    expect(result.lastScanCompletedAt).toBeNull();
  });

  it('nextScheduledScanAt is always a future Sunday', async () => {
    const supabase = createMockSupabase();
    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    const nextScan = new Date(result.nextScheduledScanAt);
    expect(nextScan.getUTCDay()).toBe(0);
    expect(nextScan.getTime()).toBeGreaterThan(Date.now());
  });

  it('isFirstScanRecent=true when first scan completed < 24h ago and only one scan exists', async () => {
    const recentScan = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const supabase = createMockSupabase({
      orgCreatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      firstEvalCreatedAt: recentScan,
      lastEvalCreatedAt: recentScan,
    });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.isFirstScanRecent).toBe(true);
  });

  it('isFirstScanRecent=false when multiple scans exist', async () => {
    const firstScan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const lastScan = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const supabase = createMockSupabase({
      orgCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      firstEvalCreatedAt: firstScan,
      lastEvalCreatedAt: lastScan,
    });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.isFirstScanRecent).toBe(false);
  });

  it('isFirstScanRecent=false when first scan completed > 24h ago', async () => {
    const oldScan = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const supabase = createMockSupabase({
      orgCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      firstEvalCreatedAt: oldScan,
      lastEvalCreatedAt: oldScan,
    });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.isFirstScanRecent).toBe(false);
  });

  it('returns orgCreatedAt from the organizations table', async () => {
    const created = '2026-01-15T00:00:00.000Z';
    const supabase = createMockSupabase({ orgCreatedAt: created });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.orgCreatedAt).toBe(created);
  });

  it('handles null orgCreatedAt gracefully', async () => {
    const supabase = createMockSupabase({ orgCreatedAt: null });

    const result = await resolveDataMode({ supabase, orgId: 'org-1' });
    expect(result.orgCreatedAt).toBeNull();
    expect(result.mode).toBe('empty');
  });
});
