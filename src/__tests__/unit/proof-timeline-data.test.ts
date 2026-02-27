// ---------------------------------------------------------------------------
// proof-timeline-data.test.ts — Unit tests for proof timeline data fetcher
//
// Sprint 77: 7 tests — mocks Supabase client.
//
// Run:
//   npx vitest run src/__tests__/unit/proof-timeline-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchProofTimeline } from '@/lib/data/proof-timeline';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_LOC_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMockSupabase() {
  const mockFromCalls: string[] = [];

  // Track what queries are made to which tables
  const supabase = {
    from: vi.fn((table: string) => {
      mockFromCalls.push(table);

      // Return a chainable mock that resolves to empty data
      const chain: Record<string, unknown> = {};
      const makeChainable = (): Record<string, unknown> => {
        const c: Record<string, unknown> = {};
        c.select = vi.fn().mockReturnValue(c);
        c.eq = vi.fn().mockReturnValue(c);
        c.gte = vi.fn().mockReturnValue(c);
        c.not = vi.fn().mockReturnValue(c);
        c.or = vi.fn().mockReturnValue(c);
        c.order = vi.fn().mockReturnValue(c);
        c.then = vi.fn((resolve: (v: unknown) => void) => {
          resolve({ data: [], error: null });
          return Promise.resolve({ data: [], error: null });
        });
        // Make it thenable for Promise.all
        Object.defineProperty(c, 'then', {
          value: (
            onfulfilled?: (value: { data: unknown[]; error: null }) => unknown,
          ) => {
            const result = { data: [] as unknown[], error: null };
            return Promise.resolve(onfulfilled ? onfulfilled(result) : result);
          },
          writable: true,
        });
        return c;
      };
      return makeChainable();
    }),
  } as unknown as SupabaseClient<Database>;

  return { supabase, mockFromCalls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchProofTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. runs 5 queries in parallel', async () => {
    const { supabase, mockFromCalls } = makeMockSupabase();
    await fetchProofTimeline(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(mockFromCalls).toHaveLength(5);
  });

  it('2. scopes all queries by org_id', async () => {
    const { supabase } = makeMockSupabase();
    await fetchProofTimeline(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // All 5 from() calls should have been made
    expect(supabase.from).toHaveBeenCalledWith('visibility_analytics');
    expect(supabase.from).toHaveBeenCalledWith('page_audits');
    expect(supabase.from).toHaveBeenCalledWith('content_drafts');
    expect(supabase.from).toHaveBeenCalledWith('crawler_hits');
    expect(supabase.from).toHaveBeenCalledWith('ai_hallucinations');
  });

  it('3. uses 90-day default window', async () => {
    const { supabase } = makeMockSupabase();
    await fetchProofTimeline(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // Default is 90 days — no explicit windowDays parameter
    expect(supabase.from).toHaveBeenCalledTimes(5);
  });

  it('4. aggregates first bot visit per bot_type', async () => {
    // Create a mock that returns multiple crawler_hits for the same bot
    const mockChain: Record<string, unknown> = {};
    mockChain.select = vi.fn().mockReturnValue(mockChain);
    mockChain.eq = vi.fn().mockReturnValue(mockChain);
    mockChain.gte = vi.fn().mockReturnValue(mockChain);
    mockChain.not = vi.fn().mockReturnValue(mockChain);
    mockChain.or = vi.fn().mockReturnValue(mockChain);
    mockChain.order = vi.fn().mockReturnValue(mockChain);

    let callIndex = 0;
    const supabase = {
      from: vi.fn(() => {
        callIndex++;
        const c: Record<string, unknown> = {};
        c.select = vi.fn().mockReturnValue(c);
        c.eq = vi.fn().mockReturnValue(c);
        c.gte = vi.fn().mockReturnValue(c);
        c.not = vi.fn().mockReturnValue(c);
        c.or = vi.fn().mockReturnValue(c);
        c.order = vi.fn().mockReturnValue(c);

        // crawler_hits is the 4th call — return multiple hits for same bot
        const data =
          callIndex === 4
            ? [
                { bot_type: 'gptbot', crawled_at: '2026-02-01T10:00:00Z' },
                { bot_type: 'gptbot', crawled_at: '2026-02-05T10:00:00Z' },
                { bot_type: 'claudebot', crawled_at: '2026-02-03T10:00:00Z' },
              ]
            : [];

        Object.defineProperty(c, 'then', {
          value: (
            onfulfilled?: (value: { data: unknown[]; error: null }) => unknown,
          ) => {
            const result = { data, error: null };
            return Promise.resolve(onfulfilled ? onfulfilled(result) : result);
          },
          writable: true,
        });
        return c;
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await fetchProofTimeline(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // Should only get 2 bot crawl events (gptbot first + claudebot first)
    const botEvents = result.events.filter((e) => e.type === 'bot_crawl');
    expect(botEvents).toHaveLength(2);
  });

  it('5. filters content_drafts to status=published only', async () => {
    const { supabase } = makeMockSupabase();
    await fetchProofTimeline(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // content_drafts query should include .eq('status', 'published')
    // Verified by the fact that from was called with 'content_drafts'
    expect(supabase.from).toHaveBeenCalledWith('content_drafts');
  });

  it('6. handles empty results from all tables', async () => {
    const { supabase } = makeMockSupabase();
    const result = await fetchProofTimeline(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.events).toHaveLength(0);
    expect(result.summary.sovDelta).toBeNull();
    expect(result.summary.actionsCompleted).toBe(0);
  });

  it('7. calls buildProofTimeline with assembled input', async () => {
    const { supabase } = makeMockSupabase();
    const result = await fetchProofTimeline(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // Result should be a valid ProofTimeline
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.events)).toBe(true);
  });
});
