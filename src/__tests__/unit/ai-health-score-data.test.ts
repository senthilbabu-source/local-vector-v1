// ---------------------------------------------------------------------------
// src/__tests__/unit/ai-health-score-data.test.ts
//
// Sprint 72: Data layer tests for AI Health Score fetcher.
// Mocks Supabase client with chainable query builders (AI_RULES §38.2).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchHealthScore } from '@/lib/data/ai-health-score';

// ---------------------------------------------------------------------------
// Mock computeHealthScore to isolate data layer testing
// ---------------------------------------------------------------------------

const mockComputeHealthScore = vi.fn().mockReturnValue({
  score: 55,
  grade: 'C',
  components: {
    visibility: { score: 42, weight: 0.3, label: 'Visibility' },
    accuracy: { score: 60, weight: 0.25, label: 'Accuracy' },
    structure: { score: 66, weight: 0.25, label: 'Structure' },
    freshness: { score: 16, weight: 0.2, label: 'Freshness' },
  },
  topRecommendation: null,
  recommendations: [],
});

vi.mock('@/lib/services/ai-health-score.service', () => ({
  computeHealthScore: (...args: unknown[]) => mockComputeHealthScore(...args),
}));

// ---------------------------------------------------------------------------
// Chainable Supabase mock builder
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: { data: unknown; count?: number | null; error: null }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chain = new Proxy(builder, {
    get(_target, prop: string) {
      if (prop === 'then') {
        // Make it thenable so await works
        return (resolve: (v: unknown) => void) => resolve(resolvedValue);
      }
      if (!builder[prop]) {
        builder[prop] = vi.fn().mockReturnValue(chain);
      }
      return builder[prop];
    },
  });
  return chain;
}

function createMockSupabase(overrides: {
  sovData?: { share_of_voice: number | null } | null;
  pageAuditData?: Record<string, unknown> | null;
  openHallucinationCount?: number;
  totalAuditCount?: number;
}) {
  const sovBuilder = createMockQueryBuilder({
    data: overrides.sovData ?? null,
    error: null,
  });
  const pageAuditBuilder = createMockQueryBuilder({
    data: overrides.pageAuditData ?? null,
    error: null,
  });
  const hallucinationBuilder = createMockQueryBuilder({
    data: null,
    count: overrides.openHallucinationCount ?? 0,
    error: null,
  });
  const auditBuilder = createMockQueryBuilder({
    data: null,
    count: overrides.totalAuditCount ?? 0,
    error: null,
  });

  let callIndex = 0;
  const builders = [sovBuilder, pageAuditBuilder, hallucinationBuilder, auditBuilder];

  const mockFrom = vi.fn().mockImplementation(() => {
    const builder = builders[callIndex] ?? builders[0];
    callIndex++;
    return builder;
  });

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    mockFrom,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOCATION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('fetchHealthScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. fetches all 4 data sources in parallel', async () => {
    const { client, mockFrom } = createMockSupabase({});
    await fetchHealthScore(client, ORG_ID, LOCATION_ID);

    // Should call .from() exactly 4 times (once per data source)
    expect(mockFrom).toHaveBeenCalledTimes(4);
    const tables = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).toContain('visibility_analytics');
    expect(tables).toContain('page_audits');
    expect(tables).toContain('ai_hallucinations');
    expect(tables).toContain('ai_audits');
  });

  it('2. passes correct org_id filter on all queries (belt-and-suspenders §18)', async () => {
    const { client, mockFrom } = createMockSupabase({});
    await fetchHealthScore(client, ORG_ID, LOCATION_ID);

    // All 4 builders should have had .eq called with 'org_id', ORG_ID
    for (let i = 0; i < 4; i++) {
      const builder = mockFrom.mock.results[i].value;
      expect(builder.eq).toHaveBeenCalledWith('org_id', ORG_ID);
    }
  });

  it('3. handles missing visibility_analytics row (returns null sovScore)', async () => {
    const { client } = createMockSupabase({ sovData: null });
    await fetchHealthScore(client, ORG_ID, LOCATION_ID);

    expect(mockComputeHealthScore).toHaveBeenCalledTimes(1);
    const input = mockComputeHealthScore.mock.calls[0][0];
    expect(input.sovScore).toBeNull();
  });

  it('4. handles missing page_audits row (returns null pageAudit)', async () => {
    const { client } = createMockSupabase({ pageAuditData: null });
    await fetchHealthScore(client, ORG_ID, LOCATION_ID);

    const input = mockComputeHealthScore.mock.calls[0][0];
    expect(input.pageAudit).toBeNull();
  });

  it('5. handles zero ai_hallucinations (returns openHallucinationCount: 0)', async () => {
    const { client } = createMockSupabase({ openHallucinationCount: 0 });
    await fetchHealthScore(client, ORG_ID, LOCATION_ID);

    const input = mockComputeHealthScore.mock.calls[0][0];
    expect(input.openHallucinationCount).toBe(0);
  });

  it('6. handles zero ai_audits (returns totalAuditCount: 0)', async () => {
    const { client } = createMockSupabase({ totalAuditCount: 0 });
    await fetchHealthScore(client, ORG_ID, LOCATION_ID);

    const input = mockComputeHealthScore.mock.calls[0][0];
    expect(input.totalAuditCount).toBe(0);
  });

  it('7. casts JSONB recommendations column correctly (§38.4)', async () => {
    const recs = [
      { issue: 'Test issue', fix: 'Test fix', impactPoints: 10, dimensionKey: 'answerFirst' },
    ];
    const { client } = createMockSupabase({
      pageAuditData: {
        overall_score: 66,
        answer_first_score: 65,
        schema_completeness_score: 55,
        faq_schema_score: 0,
        entity_clarity_score: 62,
        aeo_readability_score: 78,
        faq_schema_present: false,
        recommendations: recs,
      },
    });
    await fetchHealthScore(client, ORG_ID, LOCATION_ID);

    const input = mockComputeHealthScore.mock.calls[0][0];
    expect(input.pageAudit).not.toBeNull();
    expect(input.pageAudit.recommendations).toEqual(recs);
  });

  it('8. calls computeHealthScore with assembled HealthScoreInput', async () => {
    const { client } = createMockSupabase({
      sovData: { share_of_voice: 0.42 },
      pageAuditData: {
        overall_score: 66,
        answer_first_score: 65,
        schema_completeness_score: 55,
        faq_schema_score: 0,
        entity_clarity_score: 62,
        aeo_readability_score: 78,
        faq_schema_present: false,
        recommendations: [],
      },
      openHallucinationCount: 2,
      totalAuditCount: 5,
    });
    await fetchHealthScore(client, ORG_ID, LOCATION_ID);

    expect(mockComputeHealthScore).toHaveBeenCalledTimes(1);
    const input = mockComputeHealthScore.mock.calls[0][0];
    expect(input.sovScore).toBe(0.42);
    expect(input.openHallucinationCount).toBe(2);
    expect(input.totalAuditCount).toBe(5);
    expect(input.pageAudit).not.toBeNull();
  });

  it('9. returns the HealthScoreResult from computeHealthScore', async () => {
    const { client } = createMockSupabase({});
    const result = await fetchHealthScore(client, ORG_ID, LOCATION_ID);

    expect(result).toEqual(mockComputeHealthScore.mock.results[0].value);
  });
});
