// ---------------------------------------------------------------------------
// lib/citation/citation-source-parser.ts — Citation Source Parser
//
// Pure functions. No I/O, no DB calls, no API calls.
//
// Parses Perplexity API responses (citedUrls) into structured citation source
// records, mapping domains to known platform names and calculating citation
// frequency scores.
//
// Sprint 97 — Gap #60 (Citation Intelligence Cron 40% -> 100%)
// AI_RULES §50: This is the ONLY place Perplexity citation responses are parsed.
// KNOWN_CITATION_PLATFORMS is the single registry for domain -> platform mapping.
// ---------------------------------------------------------------------------

import type { PlatformCitationCounts } from '@/lib/types/citations';

/**
 * Maps root domains to human-readable platform names.
 * This is the single source of truth for domain -> platform mapping.
 * Update here when adding new tracked platforms.
 */
export const KNOWN_CITATION_PLATFORMS: Record<string, string> = {
  'yelp.com':          'yelp',
  'tripadvisor.com':   'tripadvisor',
  'google.com':        'google',
  'maps.google.com':   'google',
  'facebook.com':      'facebook',
  'instagram.com':     'instagram',
  'reddit.com':        'reddit',
  'nextdoor.com':      'nextdoor',
  'foursquare.com':    'foursquare',
  'opentable.com':     'opentable',
  'resy.com':          'resy',
  'thrillist.com':     'thrillist',
  'timeout.com':       'timeout',
  'eater.com':         'eater',
  'zagat.com':         'zagat',
  'doordash.com':      'doordash',
  'grubhub.com':       'grubhub',
  'ubereats.com':      'ubereats',
  'zomato.com':        'zomato',
  'yellowpages.com':   'yellowpages',
  'bbb.org':           'bbb',
  'mapquest.com':      'mapquest',
};

/**
 * Extracts the root domain from a full URL, stripping www. prefix.
 *
 * "https://www.yelp.com/biz/charcoal-n-chill" -> "yelp.com"
 * "https://maps.google.com/place/..." -> "maps.google.com"
 * "malformed-url" -> ""
 */
export function extractDomain(url: string): string {
  if (!url) return '';
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname;
  } catch {
    return '';
  }
}

/**
 * Maps a domain string to a known platform name.
 *
 * "yelp.com" -> "yelp"
 * "maps.google.com" -> "google"
 * "unknowndomain.com" -> "unknowndomain.com" (returned as-is)
 */
export function domainToPlatform(domain: string): string {
  if (!domain) return '';

  // Check exact match first
  if (KNOWN_CITATION_PLATFORMS[domain]) {
    return KNOWN_CITATION_PLATFORMS[domain];
  }

  // Check if domain contains a known platform domain
  for (const [pattern, platform] of Object.entries(KNOWN_CITATION_PLATFORMS)) {
    if (domain.includes(pattern) || domain.endsWith(pattern)) {
      return platform;
    }
  }

  // Fallback: return domain as-is
  return domain;
}

/**
 * Aggregates citedUrls from multiple query results into platform citation counts.
 *
 * Deduplicates: each unique domain is counted at most once per query result set.
 * This prevents a single response citing "yelp.com/biz/a" and "yelp.com/biz/b"
 * from inflating the count for Yelp.
 *
 * @param queryResults - Array of { citedUrls: string[] } from Perplexity responses
 * @returns PlatformCitationCounts — { [platform]: appearance_count }
 */
export function aggregatePlatformCounts(
  queryResults: Array<{ citedUrls: string[] }>,
): PlatformCitationCounts {
  const counts: PlatformCitationCounts = {};

  for (const result of queryResults) {
    // Deduplicate platforms within a single response
    const seenPlatforms = new Set<string>();

    for (const url of result.citedUrls) {
      const domain = extractDomain(url);
      if (!domain) continue;

      const platform = domainToPlatform(domain);
      if (!platform) continue;

      // Only count each platform once per response
      if (!seenPlatforms.has(platform)) {
        seenPlatforms.add(platform);
        counts[platform] = (counts[platform] ?? 0) + 1;
      }
    }
  }

  return counts;
}

/**
 * Calculates citation_frequency from platform counts and total queries.
 * Returns a value between 0.0 and 1.0, rounded to 3 decimal places.
 *
 * @param appearances - Number of query responses where this platform appeared
 * @param totalQueries - Total number of queries run
 * @returns Citation frequency (0.0 to 1.0)
 */
export function calculateCitationFrequency(
  appearances: number,
  totalQueries: number,
): number {
  if (totalQueries === 0) return 0;
  const raw = appearances / totalQueries;
  return Math.round(Math.min(raw, 1) * 1000) / 1000;
}
