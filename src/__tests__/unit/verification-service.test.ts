// @vitest-environment node
/**
 * Verification Service — Unit Tests (DIST-4: Verification Pipeline)
 *
 * Tests:
 *   Pure functions (no mocks):
 *   1–2.  hasCrawledEvent — true/false
 *   3–4.  hasLiveInAIEvent — true/false
 *   5.    matchMenuItemsInResponses — exact substring match
 *   6.    matchMenuItemsInResponses — case-insensitive
 *   7.    matchMenuItemsInResponses — no match
 *   8.    matchMenuItemsInResponses — skips short names (< 3 chars)
 *   9.    matchMenuItemsInResponses — multiple items across responses
 *   10.   matchMenuItemsInResponses — null rawResponse handled
 *   11.   matchMenuItemsInResponses — empty arrays
 *
 *   I/O functions (mock Supabase):
 *   12–13. detectCrawlHits — finds hits / no hits
 *   14.    detectCrawlHits — alreadyRecorded dedup
 *   15–16. detectCitationMatches — positive / negative
 *   17.    verifyMenuPropagation — appends 'crawled'
 *   18.    verifyMenuPropagation — appends 'live_in_ai'
 *   19.    verifyMenuPropagation — skips update when dedup'd
 *   20.    verifyMenuPropagation — returns null for non-published
 *
 *   Admin aggregation:
 *   21.    getDistributionHealthStats — correct percentages
 *   22.    getDistributionHealthStats — zero published menus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PropagationEvent } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  hasCrawledEvent,
  hasLiveInAIEvent,
  matchMenuItemsInResponses,
  detectCrawlHits,
  detectCitationMatches,
  verifyMenuPropagation,
  getDistributionHealthStats,
} from '@/lib/distribution/verification-service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MENU_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORG_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

const BASE_EVENTS: PropagationEvent[] = [
  { event: 'published', date: '2026-03-01T00:00:00Z' },
  { event: 'indexnow_pinged', date: '2026-03-01T00:01:00Z' },
];

const EVENTS_WITH_CRAWLED: PropagationEvent[] = [
  ...BASE_EVENTS,
  { event: 'crawled', date: '2026-03-02T00:00:00Z' },
];

const EVENTS_WITH_LIVE: PropagationEvent[] = [
  ...BASE_EVENTS,
  { event: 'live_in_ai', date: '2026-03-03T00:00:00Z' },
];

const EVENTS_WITH_BOTH: PropagationEvent[] = [
  ...BASE_EVENTS,
  { event: 'crawled', date: '2026-03-02T00:00:00Z' },
  { event: 'live_in_ai', date: '2026-03-03T00:00:00Z' },
];

const EXTRACTED_DATA = {
  items: [
    { id: 'i1', name: 'Chicken 65', price: '14.99', category: 'Appetizers', confidence: 0.95 },
    { id: 'i2', name: 'Lamb Biryani', price: '18.99', category: 'Mains', confidence: 0.88 },
    { id: 'i3', name: 'Naan', price: '3.99', category: 'Breads', confidence: 0.92 },
  ],
  extracted_at: '2026-03-04T00:00:00Z',
};

const RAW_RESPONSE_WITH_MENU_ITEMS = JSON.stringify({
  businesses: ['Restaurant that serves Chicken 65 and Lamb Biryani'],
  cited_url: 'https://example.com',
});

const RAW_RESPONSE_NO_MATCH = JSON.stringify({
  businesses: ['Pizza Palace', 'Burger Barn'],
  cited_url: null,
});

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

function buildChainableMock(data: unknown = null, error: unknown = null) {
  const terminal = vi.fn().mockResolvedValue({ data, error });
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  // All chainable methods return the chain itself
  for (const method of ['select', 'eq', 'gte', 'order', 'limit', 'update']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // Terminal method
  chain.single = terminal;
  // For non-single queries, resolve the chain itself
  chain.then = vi.fn().mockImplementation((resolve) => resolve({ data, error }));

  // Make the chain thenable for await
  const proxy = new Proxy(chain, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve({ data, error });
      }
      return target[prop as string];
    },
  });

  return proxy;
}

function buildMockSupabaseForVerification(overrides: {
  menuRow?: Record<string, unknown> | null;
  menuError?: unknown;
  crawlerHits?: Array<Record<string, unknown>>;
  sovEvals?: Array<Record<string, unknown>>;
  publishedMenus?: Array<Record<string, unknown>>;
} = {}) {
  const {
    menuRow = { extracted_data: EXTRACTED_DATA, propagation_events: BASE_EVENTS },
    menuError = null,
    crawlerHits = [],
    sovEvals = [],
  } = overrides;

  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq });

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'magic_menus') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, _val: unknown) => ({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: menuRow, error: menuError }),
              }),
              single: vi.fn().mockResolvedValue({ data: menuRow, error: menuError }),
            })),
          }),
          update: updateFn,
        };
      }
      if (table === 'crawler_hits') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: crawlerHits, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'sov_evaluations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: sovEvals, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn() }) };
    }),
  };

  return { client, updateFn, updateEq };
}

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('hasCrawledEvent', () => {
  it('returns true when crawled event exists', () => {
    expect(hasCrawledEvent(EVENTS_WITH_CRAWLED)).toBe(true);
  });

  it('returns false when crawled event is absent', () => {
    expect(hasCrawledEvent(BASE_EVENTS)).toBe(false);
  });
});

describe('hasLiveInAIEvent', () => {
  it('returns true when live_in_ai event exists', () => {
    expect(hasLiveInAIEvent(EVENTS_WITH_LIVE)).toBe(true);
  });

  it('returns false when live_in_ai event is absent', () => {
    expect(hasLiveInAIEvent(BASE_EVENTS)).toBe(false);
  });
});

describe('matchMenuItemsInResponses', () => {
  it('finds exact substring match in raw_response', () => {
    const result = matchMenuItemsInResponses({
      menuItemNames: ['Chicken 65'],
      sovResponses: [{ rawResponse: RAW_RESPONSE_WITH_MENU_ITEMS }],
    });
    expect(result.isLiveInAI).toBe(true);
    expect(result.matchedItems).toContain('Chicken 65');
    expect(result.matchCount).toBe(1);
  });

  it('matches case-insensitively', () => {
    const result = matchMenuItemsInResponses({
      menuItemNames: ['chicken 65'],
      sovResponses: [{ rawResponse: RAW_RESPONSE_WITH_MENU_ITEMS }],
    });
    expect(result.isLiveInAI).toBe(true);
    expect(result.matchedItems).toContain('chicken 65');
  });

  it('returns no match when item name is absent', () => {
    const result = matchMenuItemsInResponses({
      menuItemNames: ['Lobster Thermidor'],
      sovResponses: [{ rawResponse: RAW_RESPONSE_NO_MATCH }],
    });
    expect(result.isLiveInAI).toBe(false);
    expect(result.matchedItems).toHaveLength(0);
  });

  it('skips names shorter than 3 characters', () => {
    const result = matchMenuItemsInResponses({
      menuItemNames: ['Te', 'Lamb Biryani'],
      sovResponses: [{ rawResponse: RAW_RESPONSE_WITH_MENU_ITEMS }],
    });
    expect(result.matchedItems).toEqual(['Lamb Biryani']);
    expect(result.matchCount).toBe(1);
  });

  it('matches multiple items across multiple responses', () => {
    const result = matchMenuItemsInResponses({
      menuItemNames: ['Chicken 65', 'Lamb Biryani', 'Tandoori Shrimp'],
      sovResponses: [
        { rawResponse: RAW_RESPONSE_WITH_MENU_ITEMS },
        { rawResponse: RAW_RESPONSE_NO_MATCH },
      ],
    });
    expect(result.isLiveInAI).toBe(true);
    expect(result.matchedItems).toEqual(['Chicken 65', 'Lamb Biryani']);
    expect(result.matchCount).toBe(2);
  });

  it('handles null rawResponse gracefully', () => {
    const result = matchMenuItemsInResponses({
      menuItemNames: ['Chicken 65'],
      sovResponses: [{ rawResponse: null }, { rawResponse: null }],
    });
    expect(result.isLiveInAI).toBe(false);
    expect(result.matchedItems).toHaveLength(0);
  });

  it('handles empty arrays', () => {
    const result = matchMenuItemsInResponses({
      menuItemNames: [],
      sovResponses: [],
    });
    expect(result.isLiveInAI).toBe(false);
    expect(result.matchedItems).toHaveLength(0);
    expect(result.matchCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// I/O function tests (mock Supabase)
// ---------------------------------------------------------------------------

describe('detectCrawlHits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('finds crawler hits and returns bot types', async () => {
    const { client } = buildMockSupabaseForVerification({
      crawlerHits: [
        { bot_type: 'gptbot', crawled_at: '2026-03-03T12:00:00Z' },
        { bot_type: 'perplexitybot', crawled_at: '2026-03-03T10:00:00Z' },
      ],
    });

    const result = await detectCrawlHits(client as never, MENU_ID, BASE_EVENTS);
    expect(result.hasCrawlHits).toBe(true);
    expect(result.botTypes).toContain('gptbot');
    expect(result.botTypes).toContain('perplexitybot');
    expect(result.latestCrawlAt).toBe('2026-03-03T12:00:00Z');
    expect(result.alreadyRecorded).toBe(false);
  });

  it('returns hasCrawlHits=false when no hits', async () => {
    const { client } = buildMockSupabaseForVerification({ crawlerHits: [] });

    const result = await detectCrawlHits(client as never, MENU_ID, BASE_EVENTS);
    expect(result.hasCrawlHits).toBe(false);
    expect(result.botTypes).toHaveLength(0);
    expect(result.latestCrawlAt).toBeNull();
  });

  it('sets alreadyRecorded=true when crawled event exists', async () => {
    const { client } = buildMockSupabaseForVerification({
      crawlerHits: [{ bot_type: 'gptbot', crawled_at: '2026-03-03T12:00:00Z' }],
    });

    const result = await detectCrawlHits(client as never, MENU_ID, EVENTS_WITH_CRAWLED);
    expect(result.alreadyRecorded).toBe(true);
    expect(result.hasCrawlHits).toBe(true);
  });
});

describe('detectCitationMatches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns isLiveInAI=true when menu item found in SOV response', async () => {
    const { client } = buildMockSupabaseForVerification({
      sovEvals: [{ raw_response: RAW_RESPONSE_WITH_MENU_ITEMS }],
    });

    const result = await detectCitationMatches(
      client as never,
      ORG_ID,
      ['Chicken 65', 'Lamb Biryani'],
      BASE_EVENTS,
    );
    expect(result.isLiveInAI).toBe(true);
    expect(result.matchedItems).toContain('Chicken 65');
    expect(result.alreadyRecorded).toBe(false);
  });

  it('returns isLiveInAI=false when no menu items match', async () => {
    const { client } = buildMockSupabaseForVerification({
      sovEvals: [{ raw_response: RAW_RESPONSE_NO_MATCH }],
    });

    const result = await detectCitationMatches(
      client as never,
      ORG_ID,
      ['Chicken 65', 'Lamb Biryani'],
      BASE_EVENTS,
    );
    expect(result.isLiveInAI).toBe(false);
    expect(result.matchedItems).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests (verifyMenuPropagation)
// ---------------------------------------------------------------------------

describe('verifyMenuPropagation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('appends crawled event when crawl detected and not yet recorded', async () => {
    const { client, updateFn } = buildMockSupabaseForVerification({
      menuRow: { extracted_data: EXTRACTED_DATA, propagation_events: BASE_EVENTS },
      crawlerHits: [{ bot_type: 'gptbot', crawled_at: '2026-03-03T12:00:00Z' }],
      sovEvals: [{ raw_response: RAW_RESPONSE_NO_MATCH }],
    });

    const result = await verifyMenuPropagation(client as never, MENU_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(result!.eventsAdded).toContain('crawled');
    expect(result!.eventsAdded).not.toContain('live_in_ai');
    expect(updateFn).toHaveBeenCalled();
  });

  it('appends live_in_ai event when citation matched and not yet recorded', async () => {
    const { client, updateFn } = buildMockSupabaseForVerification({
      menuRow: { extracted_data: EXTRACTED_DATA, propagation_events: BASE_EVENTS },
      crawlerHits: [],
      sovEvals: [{ raw_response: RAW_RESPONSE_WITH_MENU_ITEMS }],
    });

    const result = await verifyMenuPropagation(client as never, MENU_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(result!.eventsAdded).toContain('live_in_ai');
    expect(result!.eventsAdded).not.toContain('crawled');
    expect(updateFn).toHaveBeenCalled();
  });

  it('skips DB update when both events already recorded', async () => {
    const { client, updateFn } = buildMockSupabaseForVerification({
      menuRow: { extracted_data: EXTRACTED_DATA, propagation_events: EVENTS_WITH_BOTH },
      crawlerHits: [{ bot_type: 'gptbot', crawled_at: '2026-03-03T12:00:00Z' }],
      sovEvals: [{ raw_response: RAW_RESPONSE_WITH_MENU_ITEMS }],
    });

    const result = await verifyMenuPropagation(client as never, MENU_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(result!.eventsAdded).toHaveLength(0);
    expect(updateFn).not.toHaveBeenCalled();
  });

  it('returns null for non-published or missing menu', async () => {
    const { client } = buildMockSupabaseForVerification({
      menuRow: null,
      menuError: { message: 'not found' },
    });

    const result = await verifyMenuPropagation(client as never, MENU_ID, ORG_ID);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Admin aggregation tests
// ---------------------------------------------------------------------------

describe('getDistributionHealthStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('computes percentages correctly for multiple orgs', async () => {
    const publishedMenus = [
      {
        org_id: 'org-1',
        propagation_events: [
          { event: 'published', date: '2026-03-01' },
          { event: 'crawled', date: '2026-03-02' },
          { event: 'live_in_ai', date: '2026-03-03' },
        ],
        last_distributed_at: '2026-03-01T00:01:00Z',
      },
      {
        org_id: 'org-2',
        propagation_events: [{ event: 'published', date: '2026-03-01' }],
        last_distributed_at: '2026-03-01T00:01:00Z',
      },
      {
        org_id: 'org-3',
        propagation_events: [{ event: 'published', date: '2026-03-01' }],
        last_distributed_at: null,
      },
    ];

    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: publishedMenus, error: null }),
        }),
      }),
    };

    const stats = await getDistributionHealthStats(client as never);
    expect(stats.totalOrgsWithPublishedMenus).toBe(3);
    expect(stats.orgsDistributed).toBe(2);
    expect(stats.orgsCrawled).toBe(1);
    expect(stats.orgsLiveInAI).toBe(1);
    expect(stats.pctDistributed).toBe(67);
    expect(stats.pctCrawled).toBe(33);
    expect(stats.pctLiveInAI).toBe(33);
  });

  it('handles zero published menus without division-by-zero', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    const stats = await getDistributionHealthStats(client as never);
    expect(stats.totalOrgsWithPublishedMenus).toBe(0);
    expect(stats.orgsDistributed).toBe(0);
    expect(stats.pctDistributed).toBe(0);
    expect(stats.pctCrawled).toBe(0);
    expect(stats.pctLiveInAI).toBe(0);
  });
});
