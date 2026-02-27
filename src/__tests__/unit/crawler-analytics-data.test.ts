/**
 * Unit Tests — Crawler Analytics Data Layer
 *
 * Strategy: mock Supabase client returning controlled crawler_hits rows.
 * Tests aggregation, blind spot detection, status thresholds, and sorting.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/crawler-analytics-data.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchCrawlerAnalytics } from '@/lib/data/crawler-analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

type CrawlerHitRow = { bot_type: string; crawled_at: string | null };

function makeMockSupabase(hits: CrawlerHitRow[]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({ data: hits, error: null })),
        })),
      })),
    })),
  } as unknown as SupabaseClient<Database>;
}

function makeHit(botType: string, daysAgo: number): CrawlerHitRow {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { bot_type: botType, crawled_at: d.toISOString() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchCrawlerAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all 10 bots even when crawler_hits is empty (all blind spots)', async () => {
    const supabase = makeMockSupabase([]);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);
    expect(result.bots).toHaveLength(10);
    expect(result.blindSpots).toHaveLength(10);
    expect(result.blindSpotCount).toBe(10);
    expect(result.totalVisits).toBe(0);
  });

  it('aggregates visit counts by bot_type correctly', async () => {
    const hits = [
      makeHit('gptbot', 1),
      makeHit('gptbot', 2),
      makeHit('gptbot', 3),
      makeHit('claudebot', 1),
    ];
    const supabase = makeMockSupabase(hits);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);

    const gptbot = result.bots.find((b) => b.botType === 'gptbot');
    const claudebot = result.bots.find((b) => b.botType === 'claudebot');
    expect(gptbot?.visitCount).toBe(3);
    expect(claudebot?.visitCount).toBe(1);
  });

  it('finds max crawled_at per bot_type for lastVisitAt', async () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 1);
    const older = new Date();
    older.setDate(older.getDate() - 5);

    const hits: CrawlerHitRow[] = [
      { bot_type: 'gptbot', crawled_at: older.toISOString() },
      { bot_type: 'gptbot', crawled_at: recent.toISOString() },
    ];
    const supabase = makeMockSupabase(hits);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);

    const gptbot = result.bots.find((b) => b.botType === 'gptbot');
    expect(gptbot?.lastVisitAt).toBe(recent.toISOString());
  });

  it('marks bots with 0 visits as blind_spot status', async () => {
    const supabase = makeMockSupabase([]);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);
    for (const bot of result.bots) {
      expect(bot.status).toBe('blind_spot');
    }
  });

  it('marks bots with 1-4 visits as low status', async () => {
    const hits = [makeHit('gptbot', 1), makeHit('gptbot', 2)];
    const supabase = makeMockSupabase(hits);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);

    const gptbot = result.bots.find((b) => b.botType === 'gptbot');
    expect(gptbot?.status).toBe('low');
  });

  it('marks bots with 5+ visits as active status', async () => {
    const hits = Array.from({ length: 7 }, (_, i) => makeHit('gptbot', i));
    const supabase = makeMockSupabase(hits);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);

    const gptbot = result.bots.find((b) => b.botType === 'gptbot');
    expect(gptbot?.status).toBe('active');
  });

  it('sorts bots by visitCount descending', async () => {
    const hits = [
      makeHit('claudebot', 1),
      makeHit('gptbot', 1),
      makeHit('gptbot', 2),
      makeHit('gptbot', 3),
    ];
    const supabase = makeMockSupabase(hits);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);

    // First bot should have the most visits
    expect(result.bots[0].botType).toBe('gptbot');
    expect(result.bots[0].visitCount).toBe(3);
    expect(result.bots[1].botType).toBe('claudebot');
    expect(result.bots[1].visitCount).toBe(1);
  });

  it('returns correct blindSpotCount', async () => {
    // 2 bots with visits → 8 blind spots
    const hits = [makeHit('gptbot', 1), makeHit('claudebot', 1)];
    const supabase = makeMockSupabase(hits);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);
    expect(result.blindSpotCount).toBe(8);
  });

  it('returns correct totalVisits', async () => {
    const hits = [
      makeHit('gptbot', 1),
      makeHit('gptbot', 2),
      makeHit('claudebot', 1),
    ];
    const supabase = makeMockSupabase(hits);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);
    expect(result.totalVisits).toBe(3);
  });

  it('includes fix recommendations for each blind spot', async () => {
    const supabase = makeMockSupabase([]);
    const result = await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);

    for (const spot of result.blindSpots) {
      expect(spot.fixRecommendation).toBeTruthy();
      expect(spot.fixRecommendation.length).toBeGreaterThan(10);
    }
  });

  it('filters to last 30 days only (older hits excluded)', async () => {
    // This test verifies the query is constructed with the 30-day filter.
    // The mock returns whatever we pass, so we verify the Supabase chain.
    const mockGte = vi.fn(() => ({ data: [], error: null }));
    const mockEq = vi.fn(() => ({ gte: mockGte }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    const supabase = {
      from: vi.fn(() => ({ select: mockSelect })),
    } as unknown as SupabaseClient<Database>;

    await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);

    expect(supabase.from).toHaveBeenCalledWith('crawler_hits');
    expect(mockSelect).toHaveBeenCalledWith('bot_type, crawled_at');
    expect(mockEq).toHaveBeenCalledWith('org_id', TEST_ORG_ID);
    // gte should be called with 'crawled_at' and a date string ~30 days ago
    expect(mockGte).toHaveBeenCalledWith('crawled_at', expect.any(String));
    const dateArg = (mockGte.mock.calls[0] as unknown[])[1] as string;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const parsedDate = new Date(dateArg);
    // Allow 1 second tolerance
    expect(Math.abs(parsedDate.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(1000);
  });

  it('scopes query by org_id (belt-and-suspenders)', async () => {
    const mockGte = vi.fn(() => ({ data: [], error: null }));
    const mockEq = vi.fn(() => ({ gte: mockGte }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    const supabase = {
      from: vi.fn(() => ({ select: mockSelect })),
    } as unknown as SupabaseClient<Database>;

    await fetchCrawlerAnalytics(supabase, TEST_ORG_ID);
    expect(mockEq).toHaveBeenCalledWith('org_id', TEST_ORG_ID);
  });
});
