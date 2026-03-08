// ---------------------------------------------------------------------------
// lib/services/gsc-client.ts — Google Search Console API v3 Client (Sprint 3)
//
// Fetches search analytics data for a verified site.
// All calls are server-only — access_token comes from google_oauth_tokens.
// No Vercel AI SDK — this is a direct Google API call (no LLM involved).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GSCQueryRow {
  query: string;
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;       // 0.0–1.0
  position: number;  // average ranking position
}

export interface GSCSearchAnalyticsResult {
  aiOverviewQueries: GSCQueryRow[];   // queries that triggered an AI Overview
  allQueries: GSCQueryRow[];          // all queries (for baseline comparison)
  siteUrl: string;
  dateRange: { startDate: string; endDate: string };
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GSCTokenExpiredError extends Error {
  constructor() {
    super('GSC token expired');
    this.name = 'GSCTokenExpiredError';
  }
}

export class GSCScopeNotGrantedError extends Error {
  constructor() {
    super('GSC scope not granted — tenant must re-authorize');
    this.name = 'GSCScopeNotGrantedError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const GSC_BASE = 'https://www.googleapis.com/webmasters/v3/sites';

interface GSCApiRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCApiResponse {
  rows?: GSCApiRow[];
  responseAggregationType?: string;
}

function parseRows(apiRows: GSCApiRow[] | undefined | null): GSCQueryRow[] {
  if (!apiRows || apiRows.length === 0) return [];
  return apiRows.map((row) => ({
    query: row.keys[0] ?? '',
    date: row.keys[1] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

async function fetchSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  aiOverviewFilter: boolean,
): Promise<GSCQueryRow[]> {
  const endpoint = `${GSC_BASE}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  const body: Record<string, unknown> = {
    startDate,
    endDate,
    dimensions: ['query', 'date'],
    searchType: 'web',
    aggregationType: 'byQuery',
    rowLimit: aiOverviewFilter ? 1000 : 500,
  };

  if (aiOverviewFilter) {
    body.dimensionFilterGroups = [
      {
        filters: [
          {
            dimension: 'searchAppearance',
            expression: 'AI_OVERVIEW',
          },
        ],
      },
    ];
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new GSCTokenExpiredError();
  }

  if (response.status === 403) {
    throw new GSCScopeNotGrantedError();
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    throw new Error(`GSC API error ${response.status}: ${errText}`);
  }

  const data: GSCApiResponse = await response.json();
  return parseRows(data.rows);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch search analytics data from GSC.
 * Runs two queries in sequence:
 *   1. AI_OVERVIEW filter — queries that showed an AI Overview
 *   2. No filter — all queries for baseline
 *
 * Returns partial results if one query fails (non-throwing for partial).
 * Throws GSCTokenExpiredError on 401, GSCScopeNotGrantedError on 403.
 */
export async function fetchGSCSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GSCSearchAnalyticsResult> {
  const result: GSCSearchAnalyticsResult = {
    aiOverviewQueries: [],
    allQueries: [],
    siteUrl,
    dateRange: { startDate, endDate },
    fetchedAt: new Date().toISOString(),
  };

  // Query 1: AI_OVERVIEW filtered — throws on 401/403
  result.aiOverviewQueries = await fetchSearchAnalytics(
    accessToken,
    siteUrl,
    startDate,
    endDate,
    true,
  );

  // Query 2: All queries baseline — partial failure OK
  try {
    result.allQueries = await fetchSearchAnalytics(
      accessToken,
      siteUrl,
      startDate,
      endDate,
      false,
    );
  } catch (err) {
    // If the first query succeeded but this one fails, return partial results
    // (unless it's a token/scope error — those should propagate)
    if (err instanceof GSCTokenExpiredError || err instanceof GSCScopeNotGrantedError) {
      throw err;
    }
    Sentry.captureException(err, {
      tags: { file: 'gsc-client.ts', sprint: '3' },
      extra: { phase: 'all-queries-baseline', siteUrl },
    });
  }

  return result;
}
