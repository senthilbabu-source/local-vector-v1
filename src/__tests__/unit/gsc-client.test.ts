// ---------------------------------------------------------------------------
// src/__tests__/unit/gsc-client.test.ts — GSC Client unit tests (Sprint 3)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub Sentry before importing the module under test
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import {
  fetchGSCSearchAnalytics,
  GSCTokenExpiredError,
  GSCScopeNotGrantedError,
} from '@/lib/services/gsc-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCESS_TOKEN = 'ya29.test-token';
const SITE_URL = 'https://charcoalnchill.com/';
const START_DATE = '2026-02-07';
const END_DATE = '2026-03-07';

function makeGSCResponse(rows: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> | null) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ rows }),
    text: async () => JSON.stringify({ rows }),
  };
}

function makeErrorResponse(status: number, body = 'error') {
  return {
    ok: false,
    status,
    json: async () => ({ error: body }),
    text: async () => body,
  };
}

const SAMPLE_ROWS = [
  { keys: ['hookah bar alpharetta', '2026-03-01'], clicks: 26, impressions: 1240, ctr: 0.021, position: 3.2 },
  { keys: ['hookah lounge near me', '2026-03-02'], clicks: 18, impressions: 890, ctr: 0.02, position: 4.1 },
];

const BASELINE_ROWS = [
  { keys: ['charcoal n chill menu', '2026-03-01'], clicks: 50, impressions: 2000, ctr: 0.025, position: 2.5 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('gsc-client', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns aiOverviewQueries when API returns rows', async () => {
    // First call: AI_OVERVIEW filter
    mockFetch.mockResolvedValueOnce(makeGSCResponse(SAMPLE_ROWS));
    // Second call: all queries baseline
    mockFetch.mockResolvedValueOnce(makeGSCResponse(BASELINE_ROWS));

    const result = await fetchGSCSearchAnalytics(ACCESS_TOKEN, SITE_URL, START_DATE, END_DATE);

    expect(result.aiOverviewQueries).toHaveLength(2);
    expect(result.aiOverviewQueries[0].query).toBe('hookah bar alpharetta');
    expect(result.aiOverviewQueries[0].clicks).toBe(26);
    expect(result.aiOverviewQueries[0].impressions).toBe(1240);
    expect(result.allQueries).toHaveLength(1);
    expect(result.siteUrl).toBe(SITE_URL);
  });

  it('returns empty aiOverviewQueries array when API returns no rows', async () => {
    mockFetch.mockResolvedValueOnce(makeGSCResponse(null));
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));

    const result = await fetchGSCSearchAnalytics(ACCESS_TOKEN, SITE_URL, START_DATE, END_DATE);

    expect(result.aiOverviewQueries).toHaveLength(0);
    expect(result.allQueries).toHaveLength(0);
  });

  it('throws GSCTokenExpiredError on 401 response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401));

    await expect(
      fetchGSCSearchAnalytics(ACCESS_TOKEN, SITE_URL, START_DATE, END_DATE),
    ).rejects.toThrow(GSCTokenExpiredError);
  });

  it('throws GSCScopeNotGrantedError on 403 response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(403));

    await expect(
      fetchGSCSearchAnalytics(ACCESS_TOKEN, SITE_URL, START_DATE, END_DATE),
    ).rejects.toThrow(GSCScopeNotGrantedError);
  });

  it('returns partial results if AI_OVERVIEW fetch succeeds but all-queries fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(makeGSCResponse(SAMPLE_ROWS));
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'internal error'));

    const result = await fetchGSCSearchAnalytics(ACCESS_TOKEN, SITE_URL, START_DATE, END_DATE);

    expect(result.aiOverviewQueries).toHaveLength(2);
    expect(result.allQueries).toHaveLength(0); // failed gracefully
  });

  it('correctly encodes siteUrl in the endpoint URL', async () => {
    const specialUrl = 'https://example.com/path with spaces/';
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));

    await fetchGSCSearchAnalytics(ACCESS_TOKEN, specialUrl, START_DATE, END_DATE);

    const firstCallUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstCallUrl).toContain(encodeURIComponent(specialUrl));
    expect(firstCallUrl).not.toContain(specialUrl); // must be encoded
  });

  it('passes correct date range in request body', async () => {
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));

    await fetchGSCSearchAnalytics(ACCESS_TOKEN, SITE_URL, START_DATE, END_DATE);

    const firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(firstCallBody.startDate).toBe(START_DATE);
    expect(firstCallBody.endDate).toBe(END_DATE);
  });

  it('passes correct Authorization header with access_token', async () => {
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));

    await fetchGSCSearchAnalytics(ACCESS_TOKEN, SITE_URL, START_DATE, END_DATE);

    const firstCallHeaders = mockFetch.mock.calls[0][1].headers;
    expect(firstCallHeaders.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('AI_OVERVIEW filter query includes the searchAppearance dimensionFilter', async () => {
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));

    await fetchGSCSearchAnalytics(ACCESS_TOKEN, SITE_URL, START_DATE, END_DATE);

    const aiOverviewBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(aiOverviewBody.dimensionFilterGroups).toBeDefined();
    expect(aiOverviewBody.dimensionFilterGroups[0].filters[0].dimension).toBe('searchAppearance');
    expect(aiOverviewBody.dimensionFilterGroups[0].filters[0].expression).toBe('AI_OVERVIEW');
  });

  it('all-queries fetch does NOT include the searchAppearance dimensionFilter', async () => {
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));
    mockFetch.mockResolvedValueOnce(makeGSCResponse([]));

    await fetchGSCSearchAnalytics(ACCESS_TOKEN, SITE_URL, START_DATE, END_DATE);

    const allQueriesBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(allQueriesBody.dimensionFilterGroups).toBeUndefined();
  });
});
