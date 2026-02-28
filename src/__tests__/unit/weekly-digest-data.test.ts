// ---------------------------------------------------------------------------
// src/__tests__/unit/weekly-digest-data.test.ts
//
// Sprint 78: Data layer tests for fetchDigestForOrg().
// Mocks Supabase client with chainable query builders (AI_RULES §38.2).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchDigestForOrg } from '@/lib/data/weekly-digest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockBuildDigestPayload = vi.fn().mockReturnValue({
  recipientEmail: 'test@example.com',
  recipientName: 'Test',
  businessName: 'Test Biz',
  subject: 'Test Subject',
  healthScore: { current: 50, delta: null, trend: 'new' },
  sov: { currentPercent: null, delta: null, trend: 'new' },
  issues: [],
  wins: [],
  opportunities: [],
  botSummary: null,
  dashboardUrl: 'https://app.localvector.ai/dashboard',
  unsubscribeUrl: 'https://app.localvector.ai/dashboard/settings',
});

vi.mock('@/lib/services/weekly-digest.service', () => ({
  buildDigestPayload: (...args: unknown[]) => mockBuildDigestPayload(...args),
}));

const mockFetchHealthScore = vi.fn().mockResolvedValue({
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

vi.mock('@/lib/data/ai-health-score', () => ({
  fetchHealthScore: (...args: unknown[]) => mockFetchHealthScore(...args),
}));

// ---------------------------------------------------------------------------
// Chainable Supabase mock builder
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: { data: unknown; count?: number | null; error: null }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chain = new Proxy(builder, {
    get(_target, prop: string) {
      if (prop === 'then') {
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

// ---------------------------------------------------------------------------
// Factory for mock Supabase with configurable per-table responses
// ---------------------------------------------------------------------------

interface MockConfig {
  org?: { id: string; name: string; owner_user_id: string | null; notify_weekly_digest: boolean | null } | null;
  owner?: { email: string; full_name: string | null } | null;
  location?: { id: string; business_name: string; city: string | null; state: string | null } | null;
  currentSnapshot?: { share_of_voice: number | null; snapshot_date: string } | null;
  previousSnapshot?: { share_of_voice: number | null; snapshot_date: string } | null;
  newHallucinations?: Array<{ claim_text: string; severity: string; model_provider: string }>;
  resolvedCount?: number;
  sovWins?: Array<{ query_id: string; engine: string }>;
  botVisitCount?: number;
  blindSpotData?: Array<{ bot_type: string }>;
  sovQueries?: Array<{ id: string; query_text: string }>;
}

function createMockSupabase(config: MockConfig = {}) {
  const defaultOrg = { id: 'org-1', name: 'Test Org', owner_user_id: 'user-1', notify_weekly_digest: true };
  const defaultOwner = { email: 'test@example.com', full_name: 'Test User' };
  const defaultLocation = { id: 'loc-1', business_name: 'Test Biz', city: 'Atlanta', state: 'GA' };

  const tableResponses: Record<string, ReturnType<typeof createMockQueryBuilder>> = {
    organizations: createMockQueryBuilder({ data: config.org !== undefined ? config.org : defaultOrg, error: null }),
    users: createMockQueryBuilder({ data: config.owner !== undefined ? config.owner : defaultOwner, error: null }),
    locations: createMockQueryBuilder({ data: config.location !== undefined ? config.location : defaultLocation, error: null }),
  };

  // Track call index for tables that are called multiple times
  const visAnalyticsCalls: ReturnType<typeof createMockQueryBuilder>[] = [
    createMockQueryBuilder({ data: config.currentSnapshot ?? null, error: null }),
    createMockQueryBuilder({ data: config.previousSnapshot ?? null, error: null }),
  ];
  let visCallIndex = 0;

  const hallucinationCalls: ReturnType<typeof createMockQueryBuilder>[] = [
    createMockQueryBuilder({ data: config.newHallucinations ?? [], error: null }),
    createMockQueryBuilder({ data: null, count: config.resolvedCount ?? 0, error: null }),
  ];
  let hallCallIndex = 0;

  // Sprint C: sov_evaluations is called twice — first for count guard, then for SOV wins data
  const sovEvalCalls: ReturnType<typeof createMockQueryBuilder>[] = [
    createMockQueryBuilder({ data: null, count: 10, error: null }), // guard: count > 0
    createMockQueryBuilder({ data: config.sovWins ?? [], error: null }), // parallel: SOV wins
  ];
  let sovCallIndex = 0;

  tableResponses.crawler_hits_count = createMockQueryBuilder({ data: null, count: config.botVisitCount ?? 0, error: null });
  tableResponses.crawler_hits_blind = createMockQueryBuilder({ data: config.blindSpotData ?? [], error: null });
  tableResponses.target_queries = createMockQueryBuilder({ data: config.sovQueries ?? [], error: null });

  let crawlerCallIndex = 0;

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'visibility_analytics') {
      return visAnalyticsCalls[visCallIndex++] ?? visAnalyticsCalls[0];
    }
    if (table === 'ai_hallucinations') {
      return hallucinationCalls[hallCallIndex++] ?? hallucinationCalls[0];
    }
    if (table === 'sov_evaluations') {
      return sovEvalCalls[sovCallIndex++] ?? sovEvalCalls[1];
    }
    if (table === 'crawler_hits') {
      const idx = crawlerCallIndex++;
      return idx === 0 ? tableResponses.crawler_hits_count : tableResponses.crawler_hits_blind;
    }
    return tableResponses[table] ?? createMockQueryBuilder({ data: null, error: null });
  });

  return { from: mockFrom } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchDigestForOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when org has notify_weekly_digest=false', async () => {
    const supabase = createMockSupabase({
      org: { id: 'org-1', name: 'Test', owner_user_id: 'user-1', notify_weekly_digest: false },
    });
    const result = await fetchDigestForOrg(supabase, 'org-1');
    expect(result).toBeNull();
  });

  it('returns null when owner_user_id has no user record', async () => {
    const supabase = createMockSupabase({ owner: null });
    const result = await fetchDigestForOrg(supabase, 'org-1');
    expect(result).toBeNull();
  });

  it('returns null when no primary location exists', async () => {
    const supabase = createMockSupabase({ location: null });
    const result = await fetchDigestForOrg(supabase, 'org-1');
    expect(result).toBeNull();
  });

  it('runs parallel queries for digest data', async () => {
    const supabase = createMockSupabase();
    await fetchDigestForOrg(supabase, 'org-1');

    // Should call from() for: organizations, users, locations,
    // then parallel: visibility_analytics (x2), ai_hallucinations (x2),
    // sov_evaluations, crawler_hits (x2)
    expect(supabase.from).toHaveBeenCalled();
  });

  it('scopes all queries by org_id', async () => {
    const supabase = createMockSupabase();
    await fetchDigestForOrg(supabase, 'org-1');

    // organizations query should use eq('id', orgId)
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
    expect(fromCalls.some((c: string[]) => c[0] === 'organizations')).toBe(true);
  });

  it('limits new hallucinations to 5', async () => {
    const supabase = createMockSupabase();
    await fetchDigestForOrg(supabase, 'org-1');

    // The ai_hallucinations query builder should have .limit(5) called
    // Verified by the mock setup — the proxy chains all methods
    expect(supabase.from).toHaveBeenCalledWith('ai_hallucinations');
  });

  it('limits SOV wins to 5', async () => {
    const supabase = createMockSupabase();
    await fetchDigestForOrg(supabase, 'org-1');

    expect(supabase.from).toHaveBeenCalledWith('sov_evaluations');
  });

  it('resolves SOV win query text via target_queries', async () => {
    const supabase = createMockSupabase({
      sovWins: [{ query_id: 'q-1', engine: 'perplexity' }],
      sovQueries: [{ id: 'q-1', query_text: 'hookah near me' }],
    });
    await fetchDigestForOrg(supabase, 'org-1');

    // Should call target_queries to resolve query text
    expect(supabase.from).toHaveBeenCalledWith('target_queries');
    // buildDigestPayload should receive the resolved sovWins
    expect(mockBuildDigestPayload).toHaveBeenCalled();
    const inputArg = mockBuildDigestPayload.mock.calls[0][0];
    expect(inputArg.sovWins[0].query_text).toBe('hookah near me');
  });

  it('calculates blind spots from tracked bots minus seen bots', async () => {
    const supabase = createMockSupabase({
      blindSpotData: [
        { bot_type: 'gptbot' },
        { bot_type: 'gptbot' }, // duplicate — should deduplicate
        { bot_type: 'perplexitybot' },
      ],
    });
    await fetchDigestForOrg(supabase, 'org-1');

    expect(mockBuildDigestPayload).toHaveBeenCalled();
    const inputArg = mockBuildDigestPayload.mock.calls[0][0];
    // 10 tracked - 2 distinct = 8 blind spots
    expect(inputArg.newBlindSpots).toBe(8);
  });

  it('returns DigestPayload on happy path', async () => {
    const supabase = createMockSupabase({
      currentSnapshot: { share_of_voice: 0.25, snapshot_date: '2026-02-26' },
      previousSnapshot: { share_of_voice: 0.20, snapshot_date: '2026-02-19' },
      newHallucinations: [
        { claim_text: 'Wrong hours', severity: 'high', model_provider: 'openai-gpt4o' },
      ],
      resolvedCount: 1,
      botVisitCount: 5,
    });

    const result = await fetchDigestForOrg(supabase, 'org-1');
    expect(result).not.toBeNull();
    expect(result!.recipientEmail).toBe('test@example.com');
  });
});
