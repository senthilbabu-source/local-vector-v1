// ---------------------------------------------------------------------------
// sov-engine-service.test.ts — Unit tests for lib/services/sov-engine.service
//
// Strategy:
//   • generateText is mocked at the 'ai' module level — no real API calls.
//   • hasApiKey is mocked to control mock/real code paths.
//   • Supabase mock is passed as a parameter (service is a pure function).
//
// Run:
//   npx vitest run src/__tests__/unit/sov-engine-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the AI SDK ──────────────────────────────────────────────────────
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// ── Mock the providers ──────────────────────────────────────────────────
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));

import {
  runSOVQuery,
  writeSOVResults,
  type SOVQueryInput,
} from '@/lib/services/sov-engine.service';
import { generateText } from 'ai';
import { hasApiKey } from '@/lib/ai/providers';

// ── Test data ────────────────────────────────────────────────────────────

const MOCK_QUERY: SOVQueryInput = {
  id: 'q-uuid-001',
  query_text: 'best hookah bar in Alpharetta GA',
  query_category: 'discovery',
  location_id: 'loc-uuid-001',
  org_id: 'org-uuid-001',
  locations: {
    business_name: 'Charcoal N Chill',
    city: 'Alpharetta',
    state: 'GA',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────

function makeMockSupabase() {
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    from: vi.fn(() => ({
      upsert: mockUpsert,
      insert: mockInsert,
      update: mockUpdate,
    })),
    _mockUpsert: mockUpsert,
    _mockInsert: mockInsert,
  };
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── runSOVQuery tests ────────────────────────────────────────────────────

describe('runSOVQuery', () => {
  it('returns mock result when API key is absent', async () => {
    vi.mocked(hasApiKey).mockReturnValue(false);

    const result = await runSOVQuery(MOCK_QUERY);

    expect(result.queryId).toBe('q-uuid-001');
    expect(result.ourBusinessCited).toBe(false);
    expect(result.businessesFound).toEqual([]);
    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
  });

  it('detects business citation via fuzzy match (case-insensitive)', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        businesses: ['charcoal n chill', 'Cloud 9 Lounge', 'Sahara Hookah'],
        cited_url: 'https://yelp.com/charcoal-n-chill',
      }),
    } as never);

    const result = await runSOVQuery(MOCK_QUERY);

    expect(result.ourBusinessCited).toBe(true);
    expect(result.citationUrl).toBe('https://yelp.com/charcoal-n-chill');
    expect(result.businessesFound).toEqual(['Cloud 9 Lounge', 'Sahara Hookah']);
  });

  it('returns ourBusinessCited=false when not mentioned', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        businesses: ['Cloud 9 Lounge', 'Sahara Hookah'],
        cited_url: null,
      }),
    } as never);

    const result = await runSOVQuery(MOCK_QUERY);

    expect(result.ourBusinessCited).toBe(false);
    expect(result.businessesFound).toEqual(['Cloud 9 Lounge', 'Sahara Hookah']);
  });

  it('handles unparseable text from generateText gracefully', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: 'not valid json',
    } as never);

    const result = await runSOVQuery(MOCK_QUERY);

    expect(result.ourBusinessCited).toBe(false);
    expect(result.businessesFound).toEqual([]);
  });

  it('detects partial name matches (substring)', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        businesses: ['Charcoal N Chill Hookah Lounge & Restaurant'],
        cited_url: null,
      }),
    } as never);

    const result = await runSOVQuery(MOCK_QUERY);

    expect(result.ourBusinessCited).toBe(true);
  });
});

// ── writeSOVResults tests ────────────────────────────────────────────────

describe('writeSOVResults', () => {
  it('returns zero metrics when results array is empty', async () => {
    const supabase = makeMockSupabase();
    const metrics = await writeSOVResults('org-001', [], supabase);

    expect(metrics.shareOfVoice).toBe(0);
    expect(metrics.citationRate).toBe(0);
    expect(metrics.firstMoverCount).toBe(0);
  });

  it('calculates share_of_voice as percentage of cited queries', async () => {
    const supabase = makeMockSupabase();
    const results = [
      { queryId: 'q1', queryText: 'test', queryCategory: 'discovery', locationId: 'loc1', ourBusinessCited: true, businessesFound: [], citationUrl: null },
      { queryId: 'q2', queryText: 'test2', queryCategory: 'discovery', locationId: 'loc1', ourBusinessCited: false, businessesFound: ['Competitor'], citationUrl: null },
      { queryId: 'q3', queryText: 'test3', queryCategory: 'near_me', locationId: 'loc1', ourBusinessCited: true, businessesFound: [], citationUrl: 'https://yelp.com' },
    ];

    const metrics = await writeSOVResults('org-001', results, supabase);

    expect(metrics.shareOfVoice).toBe(66.7);
  });

  it('detects first mover opportunities (no businesses found)', async () => {
    const supabase = makeMockSupabase();
    const results = [
      { queryId: 'q1', queryText: 'date night Alpharetta', queryCategory: 'occasion', locationId: 'loc1', ourBusinessCited: false, businessesFound: [], citationUrl: null },
      { queryId: 'q2', queryText: 'best hookah near me', queryCategory: 'near_me', locationId: 'loc1', ourBusinessCited: false, businessesFound: [], citationUrl: null },
      { queryId: 'q3', queryText: 'vs competitor', queryCategory: 'comparison', locationId: 'loc1', ourBusinessCited: false, businessesFound: [], citationUrl: null },
    ];

    const metrics = await writeSOVResults('org-001', results, supabase);

    expect(metrics.firstMoverCount).toBe(2);
  });

  it('writes to visibility_analytics via upsert', async () => {
    const supabase = makeMockSupabase();
    const results = [
      { queryId: 'q1', queryText: 'test', queryCategory: 'discovery', locationId: 'loc1', ourBusinessCited: true, businessesFound: [], citationUrl: null },
    ];

    await writeSOVResults('org-001', results, supabase);

    expect(supabase.from).toHaveBeenCalledWith('visibility_analytics');
  });
});