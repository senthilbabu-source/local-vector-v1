// ---------------------------------------------------------------------------
// bing-web-search.test.ts — Unit tests for Bing Web Search API client +
// Bing-grounded SOV query runner
//
// Tests cover:
//   1. buildSearchQuery() — geo-scoping logic
//   2. sanitizePages() — input validation + truncation
//   3. searchBingWeb() — API call, error handling, fail-open
//   4. formatBingResultsAsContext() — context formatting for LLM
//   5. buildBingGroundedSystemPrompt() — grounded prompt construction
//   6. extractRelevantBingSources() — cited URL extraction
//   7. detectBusinessMention() — name normalization + matching
//   8. runBingGroundedSOVQuery() — end-to-end pipeline
//
// Run:
//   npx vitest run src/__tests__/unit/bing-web-search.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock AI SDK ─────────────────────────────────────────────────────────
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// ── Mock providers ──────────────────────────────────────────────────────
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));

// ── Mock Sentry ─────────────────────────────────────────────────────────
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// ── Mock searchBingWeb for runBingGroundedSOVQuery tests ─────────────────
// vi.hoisted() ensures the mock fn is available to the hoisted vi.mock factory.
const { mockSearchBingWeb } = vi.hoisted(() => ({
  mockSearchBingWeb: vi.fn(),
}));

vi.mock('@/lib/bing-search/bing-web-search-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/bing-search/bing-web-search-client')>();
  return {
    ...original,
    searchBingWeb: mockSearchBingWeb,
  };
});

import {
  buildSearchQuery,
  sanitizePages,
} from '@/lib/bing-search/bing-web-search-client';

import {
  formatBingResultsAsContext,
  buildBingGroundedSystemPrompt,
  buildFallbackSystemPrompt,
  extractRelevantBingSources,
  detectBusinessMention,
  runBingGroundedSOVQuery,
} from '@/lib/bing-search/bing-grounded-sov';

import { generateText } from 'ai';
import { hasApiKey } from '@/lib/ai/providers';
import * as Sentry from '@sentry/nextjs';
import type { BingWebPage } from '@/lib/bing-search/types';
import type { SOVQueryInput } from '@/lib/services/sov-engine.service';

// ── Test data ────────────────────────────────────────────────────────────

const MOCK_PAGES: BingWebPage[] = [
  {
    name: 'Charcoal N Chill - Best Hookah Bar',
    url: 'https://yelp.com/biz/charcoal-n-chill',
    snippet: 'Charcoal N Chill is a top-rated hookah lounge in Alpharetta, GA.',
  },
  {
    name: 'Top 10 Hookah Bars in Alpharetta',
    url: 'https://tripadvisor.com/hookah-alpharetta',
    snippet: 'Best hookah bars including Cloud 9 and Charcoal N Chill.',
  },
  {
    name: 'Cloud 9 Lounge - Hookah & Cocktails',
    url: 'https://cloud9lounge.com',
    snippet: 'Cloud 9 Lounge offers premium hookah and cocktails in downtown Alpharetta.',
  },
];

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

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: Bing returns live results (used by runBingGroundedSOVQuery tests)
  mockSearchBingWeb.mockResolvedValue({
    pages: MOCK_PAGES,
    totalEstimatedMatches: 1500,
    fromLiveApi: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. buildSearchQuery (pure function — no mocks needed)
// ═══════════════════════════════════════════════════════════════════════════

describe('buildSearchQuery', () => {
  it('returns query text as-is when no city/state', () => {
    expect(buildSearchQuery({ queryText: 'best BBQ near me' })).toBe('best BBQ near me');
  });

  it('appends city and state when provided', () => {
    expect(
      buildSearchQuery({ queryText: 'best BBQ near me', city: 'Alpharetta', state: 'GA' }),
    ).toBe('best BBQ near me Alpharetta, GA');
  });

  it('does not duplicate city if already in query', () => {
    expect(
      buildSearchQuery({
        queryText: 'best BBQ in Alpharetta',
        city: 'Alpharetta',
        state: 'GA',
      }),
    ).toBe('best BBQ in Alpharetta');
  });

  it('handles city-only (no state)', () => {
    expect(
      buildSearchQuery({ queryText: 'best sushi', city: 'Austin', state: null }),
    ).toBe('best sushi Austin');
  });

  it('handles null city and state', () => {
    expect(
      buildSearchQuery({ queryText: 'best pizza', city: null, state: null }),
    ).toBe('best pizza');
  });

  it('trims whitespace from query text', () => {
    expect(buildSearchQuery({ queryText: '  best tacos  ' })).toBe('best tacos');
  });

  it('is case-insensitive for city dedup', () => {
    expect(
      buildSearchQuery({
        queryText: 'best BBQ in alpharetta',
        city: 'Alpharetta',
        state: 'GA',
      }),
    ).toBe('best BBQ in alpharetta');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. sanitizePages (pure function — no mocks needed)
// ═══════════════════════════════════════════════════════════════════════════

describe('sanitizePages', () => {
  it('accepts valid pages with required fields', () => {
    const result = sanitizePages(
      [{ name: 'Page', url: 'https://example.com', snippet: 'Text' }],
      10,
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Page');
  });

  it('rejects pages missing required fields', () => {
    const result = sanitizePages(
      [
        { name: 'Page', url: 'https://example.com' }, // missing snippet
        { name: 'Page', snippet: 'Text' }, // missing url
        { url: 'https://example.com', snippet: 'Text' }, // missing name
      ],
      10,
    );
    expect(result).toHaveLength(0);
  });

  it('respects maxResults limit', () => {
    const pages = Array.from({ length: 20 }, (_, i) => ({
      name: `Page ${i}`,
      url: `https://example.com/${i}`,
      snippet: `Snippet ${i}`,
    }));
    const result = sanitizePages(pages, 5);
    expect(result).toHaveLength(5);
  });

  it('preserves optional dateLastCrawled', () => {
    const result = sanitizePages(
      [
        {
          name: 'Page',
          url: 'https://example.com',
          snippet: 'Text',
          dateLastCrawled: '2026-03-01T00:00:00Z',
        },
      ],
      10,
    );
    expect(result[0].dateLastCrawled).toBe('2026-03-01T00:00:00Z');
  });

  it('skips non-string dateLastCrawled', () => {
    const result = sanitizePages(
      [{ name: 'Page', url: 'https://example.com', snippet: 'Text', dateLastCrawled: 12345 }],
      10,
    );
    expect(result[0].dateLastCrawled).toBeUndefined();
  });

  it('rejects null and non-object items', () => {
    const result = sanitizePages([null, undefined, 'string', 42, true] as unknown[], 10);
    expect(result).toHaveLength(0);
  });

  it('rejects items with non-string required fields', () => {
    const result = sanitizePages(
      [{ name: 123, url: 'https://example.com', snippet: 'Text' }],
      10,
    );
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. formatBingResultsAsContext (pure function)
// ═══════════════════════════════════════════════════════════════════════════

describe('formatBingResultsAsContext', () => {
  it('returns empty string for no pages', () => {
    expect(formatBingResultsAsContext([])).toBe('');
  });

  it('formats pages with numbered indices', () => {
    const context = formatBingResultsAsContext([MOCK_PAGES[0]]);
    expect(context).toContain('[1]');
    expect(context).toContain('Charcoal N Chill');
    expect(context).toContain('URL: https://yelp.com/biz/charcoal-n-chill');
  });

  it('formats multiple pages with sequential numbering', () => {
    const context = formatBingResultsAsContext(MOCK_PAGES);
    expect(context).toContain('[1]');
    expect(context).toContain('[2]');
    expect(context).toContain('[3]');
  });

  it('truncates very long context with marker', () => {
    const longPages: BingWebPage[] = Array.from({ length: 50 }, (_, i) => ({
      name: `Page ${i} with a very long title that takes up space in the context window`,
      url: `https://example.com/very/long/path/${i}/page`,
      snippet: `This is a very detailed snippet for page ${i} that describes the content at length to fill up the context buffer.`,
    }));
    const context = formatBingResultsAsContext(longPages);
    expect(context).toContain('[...truncated]');
    expect(context.length).toBeLessThanOrEqual(4100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. buildBingGroundedSystemPrompt + buildFallbackSystemPrompt (pure)
// ═══════════════════════════════════════════════════════════════════════════

describe('buildBingGroundedSystemPrompt', () => {
  it('includes Copilot identity', () => {
    const prompt = buildBingGroundedSystemPrompt('context');
    expect(prompt).toContain('Microsoft Copilot');
  });

  it('includes Bing search grounding instruction', () => {
    const prompt = buildBingGroundedSystemPrompt('context');
    expect(prompt).toContain('Bing search results');
    expect(prompt).toContain('ONLY use information');
  });

  it('embeds the search results context', () => {
    const prompt = buildBingGroundedSystemPrompt('My search context data');
    expect(prompt).toContain('My search context data');
  });
});

describe('buildFallbackSystemPrompt', () => {
  it('includes Bing Places reference', () => {
    const prompt = buildFallbackSystemPrompt();
    expect(prompt).toContain('Bing Places');
  });

  it('includes Yelp and TripAdvisor', () => {
    const prompt = buildFallbackSystemPrompt();
    expect(prompt).toContain('Yelp');
    expect(prompt).toContain('TripAdvisor');
  });

  it('mentions Microsoft Copilot identity', () => {
    const prompt = buildFallbackSystemPrompt();
    expect(prompt).toContain('Microsoft Copilot');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. extractRelevantBingSources (pure function)
// ═══════════════════════════════════════════════════════════════════════════

describe('extractRelevantBingSources', () => {
  it('returns pages whose title mentions the business', () => {
    const sources = extractRelevantBingSources(MOCK_PAGES, 'Charcoal N Chill');
    expect(sources).toHaveLength(2);
    expect(sources[0].url).toBe('https://yelp.com/biz/charcoal-n-chill');
    expect(sources[1].url).toBe('https://tripadvisor.com/hookah-alpharetta');
  });

  it('returns pages whose snippet mentions the business', () => {
    const pages: BingWebPage[] = [
      {
        name: 'Top Hookah Bars',
        url: 'https://example.com',
        snippet: 'Visit Charcoal N Chill for the best experience.',
      },
    ];
    const sources = extractRelevantBingSources(pages, 'Charcoal N Chill');
    expect(sources).toHaveLength(1);
  });

  it('returns empty array when no pages mention the business', () => {
    const sources = extractRelevantBingSources(MOCK_PAGES, 'Nonexistent Business');
    expect(sources).toEqual([]);
  });

  it('returns empty array for empty business name', () => {
    const sources = extractRelevantBingSources(MOCK_PAGES, '');
    expect(sources).toEqual([]);
  });

  it('is case-insensitive', () => {
    const sources = extractRelevantBingSources(MOCK_PAGES, 'charcoal n chill');
    expect(sources.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. detectBusinessMention (pure function)
// ═══════════════════════════════════════════════════════════════════════════

describe('detectBusinessMention', () => {
  it('detects exact match (case-insensitive)', () => {
    expect(detectBusinessMention('Visit Charcoal N Chill today!', 'Charcoal N Chill')).toBe(true);
  });

  it('detects with & normalization', () => {
    expect(detectBusinessMention('Visit Charcoal & Chill today!', 'Charcoal N Chill')).toBe(true);
  });

  it('detects with "and" normalization', () => {
    expect(
      detectBusinessMention('Visit Charcoal and Chill today!', 'Charcoal N Chill'),
    ).toBe(true);
  });

  it('detects with "\'n\'" normalization', () => {
    expect(
      detectBusinessMention("Visit Charcoal 'n' Chill today!", 'Charcoal N Chill'),
    ).toBe(true);
  });

  it('strips "The" prefix', () => {
    expect(
      detectBusinessMention('The Charcoal Grill is great.', 'The Charcoal Grill'),
    ).toBe(true);
    expect(detectBusinessMention('Charcoal Grill is great.', 'The Charcoal Grill')).toBe(true);
  });

  it('returns false when business not mentioned', () => {
    expect(
      detectBusinessMention('Cloud 9 Lounge is the best hookah bar.', 'Charcoal N Chill'),
    ).toBe(false);
  });

  it('returns false for empty response', () => {
    expect(detectBusinessMention('', 'Charcoal N Chill')).toBe(false);
  });

  it('returns false for empty business name', () => {
    expect(detectBusinessMention('Some response text.', '')).toBe(false);
  });

  it('handles punctuation in names', () => {
    expect(
      detectBusinessMention("Joe's Crab Shack is good.", "Joe's Crab Shack"),
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. runBingGroundedSOVQuery — end-to-end pipeline
//    (uses mocked searchBingWeb + mocked generateText)
// ═══════════════════════════════════════════════════════════════════════════

describe('runBingGroundedSOVQuery', () => {
  it('returns mock result when openai key missing', async () => {
    vi.mocked(hasApiKey).mockReturnValue(false);

    const result = await runBingGroundedSOVQuery(MOCK_QUERY);

    expect(result.engine).toBe('copilot');
    expect(result.ourBusinessCited).toBe(false);
    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
    expect(mockSearchBingWeb).not.toHaveBeenCalled();
  });

  it('calls searchBingWeb then LLM when keys present', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Charcoal N Chill is the top hookah bar in Alpharetta.',
    } as never);

    const result = await runBingGroundedSOVQuery(MOCK_QUERY);

    expect(result.engine).toBe('copilot');
    expect(result.ourBusinessCited).toBe(true);
    expect(mockSearchBingWeb).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(1);
  });

  it('includes citedSources from Bing results', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Charcoal N Chill is recommended.',
    } as never);

    const result = await runBingGroundedSOVQuery(MOCK_QUERY);

    expect(result.citedSources).toBeDefined();
    expect(result.citedSources!.length).toBeGreaterThan(0);
    expect(result.citedSources![0].url).toBe('https://yelp.com/biz/charcoal-n-chill');
    expect(result.citationUrl).toBe('https://yelp.com/biz/charcoal-n-chill');
  });

  it('falls back to simulation prompt when Bing API returns no results', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    mockSearchBingWeb.mockResolvedValueOnce({
      pages: [],
      totalEstimatedMatches: 0,
      fromLiveApi: false,
    });
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Cloud 9 Lounge is popular.',
    } as never);

    const result = await runBingGroundedSOVQuery(MOCK_QUERY);

    expect(result.engine).toBe('copilot');
    expect(result.ourBusinessCited).toBe(false);
    expect(result.citedSources).toBeUndefined();
  });

  it('returns mock result on LLM failure (fail-open)', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockRejectedValueOnce(new Error('LLM timeout'));

    const result = await runBingGroundedSOVQuery(MOCK_QUERY);

    expect(result.engine).toBe('copilot');
    expect(result.ourBusinessCited).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('preserves queryId, queryText, queryCategory, locationId', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    mockSearchBingWeb.mockResolvedValueOnce({
      pages: [],
      totalEstimatedMatches: 0,
      fromLiveApi: true,
    });
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'No results found.',
    } as never);

    const result = await runBingGroundedSOVQuery(MOCK_QUERY);

    expect(result.queryId).toBe('q-uuid-001');
    expect(result.queryText).toBe('best hookah bar in Alpharetta GA');
    expect(result.queryCategory).toBe('discovery');
    expect(result.locationId).toBe('loc-uuid-001');
  });

  it('uses grounded prompt when Bing returns results', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    // Default mock already returns MOCK_PAGES with fromLiveApi: true
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Charcoal N Chill.',
    } as never);

    await runBingGroundedSOVQuery(MOCK_QUERY);

    const callArgs = vi.mocked(generateText).mock.calls[0][0] as { system: string };
    expect(callArgs.system).toContain('ONLY use information');
    expect(callArgs.system).toContain('Bing Search Results');
    expect(callArgs.system).toContain('Charcoal N Chill');
  });

  it('uses fallback prompt when Bing returns no live results', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    mockSearchBingWeb.mockResolvedValueOnce({
      pages: [],
      totalEstimatedMatches: 0,
      fromLiveApi: false,
    });
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Some hookah bars.',
    } as never);

    await runBingGroundedSOVQuery(MOCK_QUERY);

    const callArgs = vi.mocked(generateText).mock.calls[0][0] as { system: string };
    expect(callArgs.system).toContain('Bing Places');
    expect(callArgs.system).not.toContain('ONLY use information');
  });

  it('passes city and state to searchBingWeb', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Response.',
    } as never);

    await runBingGroundedSOVQuery(MOCK_QUERY);

    expect(mockSearchBingWeb).toHaveBeenCalledWith(
      expect.objectContaining({
        queryText: 'best hookah bar in Alpharetta GA',
        city: 'Alpharetta',
        state: 'GA',
      }),
      10,
    );
  });
});
