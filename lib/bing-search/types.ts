// ---------------------------------------------------------------------------
// lib/bing-search/types.ts — Bing Web Search API v7 response types
//
// Typed surface for the Bing Web Search API v7 JSON response.
// Only the fields we actually consume are modeled — the full API
// returns many more fields that are irrelevant for SOV grounding.
//
// Ref: https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/reference/response-objects
// ---------------------------------------------------------------------------

/** A single web page result from Bing Web Search. */
export interface BingWebPage {
  /** Display title of the web page. */
  name: string;
  /** Full URL. */
  url: string;
  /** Snippet shown in search results. */
  snippet: string;
  /** ISO date string of last crawl (may be absent). */
  dateLastCrawled?: string;
}

/** The `webPages` section of the Bing response. */
export interface BingWebPagesResponse {
  /** Total estimated matches (may be very large). */
  totalEstimatedMatches?: number;
  /** Ordered list of web page results. */
  value: BingWebPage[];
}

/** Top-level Bing Web Search API v7 response. */
export interface BingSearchResponse {
  _type: string;
  webPages?: BingWebPagesResponse;
}

/** Input for a Bing web search query scoped to a location. */
export interface BingSearchInput {
  /** The SOV query text (e.g. "best BBQ in Alpharetta"). */
  queryText: string;
  /** City for geo-scoping (e.g. "Alpharetta"). */
  city?: string | null;
  /** State for geo-scoping (e.g. "GA"). */
  state?: string | null;
}

/** Cleaned result from a Bing web search. */
export interface BingSearchResult {
  /** The search results, limited to `maxResults`. */
  pages: BingWebPage[];
  /** Total estimated matches from Bing. */
  totalEstimatedMatches: number;
  /** Whether the results came from the live API (vs. empty fallback). */
  fromLiveApi: boolean;
}
