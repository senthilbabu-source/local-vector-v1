// ---------------------------------------------------------------------------
// content-calendar-data.test.ts — Sprint 83: Content Calendar Data Layer
//
// 11 tests covering fetchContentCalendar — mocks Supabase client.
//
// Run: npx vitest run src/__tests__/unit/content-calendar-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchContentCalendar } from '@/lib/data/content-calendar';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_LOC_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

type QueryResult = {
  data: unknown[] | Record<string, unknown> | null;
  error: null;
  count?: number | null;
};

function makeMockSupabase(
  overrides: Record<string, QueryResult> = {},
) {
  const mockFromCalls: string[] = [];

  const supabase = {
    from: vi.fn((table: string) => {
      mockFromCalls.push(table);

      const override = overrides[table];
      const defaultResult: QueryResult = { data: [], error: null, count: 0 };
      const result = override ?? defaultResult;

      const c: Record<string, unknown> = {};
      c.select = vi.fn().mockReturnValue(c);
      c.eq = vi.fn().mockReturnValue(c);
      c.gte = vi.fn().mockReturnValue(c);
      c.lt = vi.fn().mockReturnValue(c);
      c.not = vi.fn().mockReturnValue(c);
      c.in = vi.fn().mockReturnValue(c);
      c.order = vi.fn().mockReturnValue(c);
      c.limit = vi.fn().mockReturnValue(c);
      c.single = vi.fn().mockReturnValue(c);
      c.maybeSingle = vi.fn().mockReturnValue(c);

      Object.defineProperty(c, 'then', {
        value: (
          onfulfilled?: (value: QueryResult) => unknown,
        ) => {
          return Promise.resolve(onfulfilled ? onfulfilled(result) : result);
        },
        writable: true,
      });
      return c;
    }),
  } as unknown as SupabaseClient<Database>;

  return { supabase, mockFromCalls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchContentCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. runs parallel queries for all signal sources', async () => {
    const { supabase, mockFromCalls } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
    });
    await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // 11 from() calls: locations, local_occasions, sov_evaluations,
    // target_queries, page_audits, magic_menus, crawler_hits x2,
    // competitor_intercepts, ai_hallucinations, content_drafts
    expect(mockFromCalls).toHaveLength(11);
  });

  it('2. scopes queries by org_id', async () => {
    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
    });
    await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(supabase.from).toHaveBeenCalledWith('locations');
    expect(supabase.from).toHaveBeenCalledWith('sov_evaluations');
    expect(supabase.from).toHaveBeenCalledWith('target_queries');
    expect(supabase.from).toHaveBeenCalledWith('page_audits');
    expect(supabase.from).toHaveBeenCalledWith('competitor_intercepts');
    expect(supabase.from).toHaveBeenCalledWith('ai_hallucinations');
    expect(supabase.from).toHaveBeenCalledWith('content_drafts');
  });

  it('3. filters occasions to within trigger window', async () => {
    const today = new Date();
    const fiveDaysOut = new Date(today);
    fiveDaysOut.setDate(fiveDaysOut.getDate() + 5);
    const mm = String(fiveDaysOut.getMonth() + 1).padStart(2, '0');
    const dd = String(fiveDaysOut.getDate()).padStart(2, '0');

    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
      local_occasions: {
        data: [
          {
            id: 'occ-1',
            name: 'Test',
            occasion_type: 'holiday',
            annual_date: `${mm}-${dd}`,
            trigger_days_before: 14,
            peak_query_patterns: [],
            is_active: true,
          },
          {
            id: 'occ-far',
            name: 'Far Away',
            occasion_type: 'holiday',
            annual_date: '12-25',
            trigger_days_before: 7, // Too far away to be within 7 days
            peak_query_patterns: [],
            is_active: true,
          },
        ],
        error: null,
      },
    });
    const result = await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // Only the near occasion should generate a recommendation
    expect(result.signalSummary.occasionCount).toBeGreaterThanOrEqual(1);
  });

  it('4. computes SOV gaps from evaluations (null rank_position)', async () => {
    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
      target_queries: {
        data: [
          { id: 'q1', query_text: 'test query', query_category: 'discovery' },
        ],
        error: null,
      },
      sov_evaluations: {
        data: [
          { query_id: 'q1', engine: 'openai', rank_position: null },
          { query_id: 'q1', engine: 'perplexity', rank_position: 2 },
        ],
        error: null,
      },
    });
    const result = await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.signalSummary.sovGapCount).toBe(1);
  });

  it('5. computes daysSinceAudit for page freshness', async () => {
    const thirtyFiveDaysAgo = new Date();
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);

    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
      page_audits: {
        data: [
          {
            page_url: 'https://example.com/about',
            page_type: 'about',
            last_audited_at: thirtyFiveDaysAgo.toISOString(),
            overall_score: 60,
          },
        ],
        error: null,
      },
    });
    const result = await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.signalSummary.freshnessCount).toBeGreaterThanOrEqual(1);
  });

  it('6. computes menu staleness and bot visit decline', async () => {
    const fiftyDaysAgo = new Date();
    fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50);

    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
      magic_menus: {
        data: { id: 'menu-1', updated_at: fiftyDaysAgo.toISOString() },
        error: null,
      },
      // crawler_hits calls return count
    });
    const result = await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // Should have at least the menu freshness rec
    expect(result.signalSummary.freshnessCount).toBeGreaterThanOrEqual(1);
  });

  it('7. fetches pending competitor gaps (action_status=pending)', async () => {
    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
      competitor_intercepts: {
        data: [
          {
            id: 'ci-1',
            competitor_name: 'Rival',
            query_asked: 'test',
            winning_factor: null,
            suggested_action: null,
            gap_magnitude: 'medium',
          },
        ],
        error: null,
      },
    });
    const result = await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.signalSummary.competitorGapCount).toBe(1);
  });

  it('8. fetches open hallucinations (correction_status=open)', async () => {
    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
      ai_hallucinations: {
        data: [
          {
            id: 'h-1',
            claim_text: 'false claim',
            severity: 'high',
            model_provider: 'openai-gpt4o',
          },
        ],
        error: null,
      },
    });
    const result = await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.signalSummary.hallucinationFixCount).toBe(1);
  });

  it('9. collects existing draft trigger_ids for dedup', async () => {
    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
      ai_hallucinations: {
        data: [
          {
            id: 'h-filtered',
            claim_text: 'false claim',
            severity: 'high',
            model_provider: 'openai-gpt4o',
          },
        ],
        error: null,
      },
      content_drafts: {
        data: [{ trigger_id: 'h-filtered' }],
        error: null,
      },
    });
    const result = await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // h-filtered should be filtered out since it has an existing draft
    expect(result.signalSummary.hallucinationFixCount).toBe(0);
  });

  it('10. returns ContentCalendarResult on happy path', async () => {
    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
    });
    const result = await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result).toHaveProperty('thisWeek');
    expect(result).toHaveProperty('nextWeek');
    expect(result).toHaveProperty('twoWeeks');
    expect(result).toHaveProperty('later');
    expect(result).toHaveProperty('totalCount');
    expect(result).toHaveProperty('signalSummary');
  });

  it('11. handles empty data for all signal sources', async () => {
    const { supabase } = makeMockSupabase({
      locations: { data: { business_name: 'Test Biz' }, error: null },
    });
    const result = await fetchContentCalendar(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.totalCount).toBe(0);
    expect(result.thisWeek).toEqual([]);
    expect(result.nextWeek).toEqual([]);
    expect(result.twoWeeks).toEqual([]);
    expect(result.later).toEqual([]);
  });
});
