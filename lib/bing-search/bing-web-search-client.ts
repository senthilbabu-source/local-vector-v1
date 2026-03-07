// ---------------------------------------------------------------------------
// lib/bing-search/bing-web-search-client.ts — Bing Web Search API v7 client
//
// Fetches real web search results from the Bing index. These results are
// what Microsoft Copilot actually uses to ground its answers, making this
// the foundation for true Copilot SOV measurement.
//
// Fail-open design: returns empty results on any error so that Copilot SOV
// never blocks the rest of the multi-model pipeline.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type {
  BingSearchInput,
  BingSearchResponse,
  BingSearchResult,
  BingWebPage,
} from './types';

const BING_WEB_SEARCH_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';
const DEFAULT_MAX_RESULTS = 10;
const REQUEST_TIMEOUT_MS = 8_000;

/** Empty result returned on any failure — fail-open. */
function emptyResult(): BingSearchResult {
  return { pages: [], totalEstimatedMatches: 0, fromLiveApi: false };
}

/**
 * Build the search query string with optional geo-scoping.
 * If city/state are provided, appends them for local relevance
 * (e.g. "best BBQ near me" → "best BBQ near me Alpharetta GA").
 */
export function buildSearchQuery(input: BingSearchInput): string {
  let q = input.queryText.trim();

  // Only append geo context if the query doesn't already contain the city
  const cityLower = input.city?.toLowerCase() ?? '';
  if (cityLower && !q.toLowerCase().includes(cityLower)) {
    const parts = [input.city, input.state].filter(Boolean);
    if (parts.length > 0) {
      q = `${q} ${parts.join(', ')}`;
    }
  }

  return q;
}

/**
 * Validate and sanitize Bing API web page results.
 * Strips pages with missing required fields.
 */
export function sanitizePages(
  raw: unknown[],
  maxResults: number,
): BingWebPage[] {
  const pages: BingWebPage[] = [];
  for (const item of raw) {
    if (pages.length >= maxResults) break;
    if (
      typeof item === 'object' &&
      item !== null &&
      'name' in item &&
      'url' in item &&
      'snippet' in item &&
      typeof (item as Record<string, unknown>).name === 'string' &&
      typeof (item as Record<string, unknown>).url === 'string' &&
      typeof (item as Record<string, unknown>).snippet === 'string'
    ) {
      const p = item as Record<string, unknown>;
      pages.push({
        name: p.name as string,
        url: p.url as string,
        snippet: p.snippet as string,
        ...(typeof p.dateLastCrawled === 'string'
          ? { dateLastCrawled: p.dateLastCrawled }
          : {}),
      });
    }
  }
  return pages;
}

/**
 * Fetch web search results from the Bing Web Search API v7.
 *
 * @param input - Query text + optional city/state for geo-scoping
 * @param maxResults - Max number of results to return (default 10)
 * @returns Cleaned search results, or empty on any failure
 */
export async function searchBingWeb(
  input: BingSearchInput,
  maxResults = DEFAULT_MAX_RESULTS,
): Promise<BingSearchResult> {
  const apiKey = process.env.BING_SEARCH_API_KEY;
  if (!apiKey) {
    return emptyResult();
  }

  const query = buildSearchQuery(input);
  if (!query) {
    return emptyResult();
  }

  const url = new URL(BING_WEB_SEARCH_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));
  url.searchParams.set('mkt', 'en-US');
  url.searchParams.set('responseFilter', 'Webpages');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url.toString(), {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      Sentry.captureMessage(`Bing Web Search API error: ${response.status}`, {
        level: 'warning',
        extra: { status: response.status, body: errorBody.slice(0, 500), query },
        tags: { service: 'bing-web-search' },
      });
      return emptyResult();
    }

    const data: BingSearchResponse = await response.json();
    const rawPages = data.webPages?.value ?? [];

    return {
      pages: sanitizePages(rawPages, maxResults),
      totalEstimatedMatches: data.webPages?.totalEstimatedMatches ?? 0,
      fromLiveApi: true,
    };
  } catch (err) {
    // AbortError = timeout, network errors, etc. — all fail-open
    if (err instanceof Error && err.name !== 'AbortError') {
      Sentry.captureException(err, {
        tags: { service: 'bing-web-search' },
        extra: { query },
      });
    }
    return emptyResult();
  }
}
