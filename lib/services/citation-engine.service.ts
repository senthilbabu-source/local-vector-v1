// ---------------------------------------------------------------------------
// lib/services/citation-engine.service.ts — Citation Intelligence Engine
//
// Measures which platforms AI actually cites when answering queries about a
// business category in a city. Unlike the Listings page (which tracks where
// a business *is listed*), this engine tracks where AI *looks*.
//
// This is aggregate market intelligence, not tenant-specific. Shared across
// all tenants in the same category+city.
//
// Pure service — never creates its own Supabase client. Callers pass one in.
//
// Spec: docs/18-CITATION-INTELLIGENCE.md §2
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { CitationCronResultSchema } from '@/lib/ai/schemas';
import type {
  PlatformCitationCounts,
  CitationQueryResult,
  CitationGapSummary,
  TenantListing,
  CitationSourceIntelligence,
} from '@/lib/types/citations';

// ---------------------------------------------------------------------------
// Constants — Category + Metro Configuration (Doc 18 §2.1)
// ---------------------------------------------------------------------------

export const TRACKED_CATEGORIES = [
  'hookah lounge',
  'restaurant',
  'bar',
  'lounge',
  'event venue',
  'nightclub',
  'coffee shop',
  'cocktail bar',
  'sports bar',
] as const;

export const TRACKED_METROS: ReadonlyArray<{ city: string; state: string }> = [
  { city: 'Atlanta', state: 'GA' },
  { city: 'Dallas', state: 'TX' },
  { city: 'Houston', state: 'TX' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Miami', state: 'FL' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'New York', state: 'NY' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Las Vegas', state: 'NV' },
  { city: 'Denver', state: 'CO' },
  { city: 'Nashville', state: 'TN' },
  { city: 'Austin', state: 'TX' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Boston', state: 'MA' },
  { city: 'Philadelphia', state: 'PA' },
  { city: 'San Francisco', state: 'CA' },
  { city: 'Orlando', state: 'FL' },
  { city: 'San Diego', state: 'CA' },
  { city: 'Portland', state: 'OR' },
  { city: 'Charlotte', state: 'NC' },
];

// ---------------------------------------------------------------------------
// Platform Extraction (Doc 18 §2.2)
// ---------------------------------------------------------------------------

const PLATFORM_MAP: Record<string, string> = {
  'yelp.com': 'yelp',
  'tripadvisor.com': 'tripadvisor',
  'google.com/maps': 'google',
  'maps.google.com': 'google',
  'facebook.com': 'facebook',
  'instagram.com': 'instagram',
  'reddit.com': 'reddit',
  'nextdoor.com': 'nextdoor',
  'foursquare.com': 'foursquare',
  'opentable.com': 'opentable',
  'resy.com': 'resy',
  'thrillist.com': 'thrillist',
  'timeout.com': 'timeout',
  'eater.com': 'eater',
  'zagat.com': 'zagat',
};

/**
 * Maps a URL to a known platform name.
 * Returns null for malformed/empty URLs.
 * Falls back to the hostname (without TLD) for unrecognized domains.
 */
export function extractPlatform(url: string | null): string | null {
  if (!url) return null;

  try {
    const hostname = new URL(url).hostname.replace('www.', '');

    // Check known patterns (path-based first, then hostname-based)
    for (const [pattern, platform] of Object.entries(PLATFORM_MAP)) {
      if (hostname.includes(pattern) || url.includes(pattern)) return platform;
    }

    // Fallback: hostname without TLD (extensible)
    const parts = hostname.split('.');
    return parts.length > 0 ? parts[0] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Citation Prompt (Doc 18 §2.1)
// ---------------------------------------------------------------------------

export function buildCitationPrompt(queryText: string): string {
  return `Answer this question a local person might ask: '${queryText}'

List ALL businesses you would recommend.
For each business, include the source URL where you found the information.

Return ONLY valid JSON:
{
  "recommendations": [
    { "business": "Business Name", "source_url": "https://..." },
    { "business": "Business Name 2", "source_url": "https://..." }
  ]
}

Include every source URL. If multiple sources, list the primary one per business.`;
}

// ---------------------------------------------------------------------------
// Sample Query Generation (Doc 18 §2.1)
// ---------------------------------------------------------------------------

export function generateSampleQueries(
  category: string,
  city: string,
  state: string,
): string[] {
  return [
    `best ${category} in ${city} ${state}`,
    `top ${category} ${city}`,
    `${category} ${city} ${state} recommendations`,
    `where to find ${category} in ${city}`,
    `${category} near ${city}`,
  ];
}

// ---------------------------------------------------------------------------
// Rate limiter (mirrors sov-engine.service.ts)
// ---------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// runCitationQuery — Single Perplexity query for citation extraction
// ---------------------------------------------------------------------------

export async function runCitationQuery(
  queryText: string,
): Promise<CitationQueryResult> {
  if (!hasApiKey('perplexity')) {
    return { queryText, citedUrls: [], success: true };
  }

  const { text } = await generateText({
    model: getModel('sov-query'),
    system: 'You are a local business search assistant. Always respond with valid JSON only.',
    prompt: buildCitationPrompt(queryText),
    temperature: 0.3,
  });

  try {
    const parsed = CitationCronResultSchema.parse(JSON.parse(text));
    const citedUrls = parsed.recommendations
      .map((r) => r.source_url)
      .filter((url): url is string => url !== null);
    return { queryText, citedUrls, success: true };
  } catch {
    // Unparseable response — treat as no results
    return { queryText, citedUrls: [], success: true };
  }
}

// ---------------------------------------------------------------------------
// runCitationSample — Full sample for one category+metro (Doc 18 §2.1)
// ---------------------------------------------------------------------------

/**
 * Runs 5 sample discovery queries for a category+metro pair and counts
 * which platforms appear in the cited URLs.
 *
 * Returns platform citation counts and the number of successful queries.
 */
export async function runCitationSample(
  category: string,
  city: string,
  state: string,
): Promise<{ platformCounts: PlatformCitationCounts; successfulQueries: number; sampleQuery: string | null }> {
  const queries = generateSampleQueries(category, city, state);
  const platformCounts: PlatformCitationCounts = {};
  let successfulQueries = 0;
  let sampleQuery: string | null = null;

  for (const queryText of queries) {
    try {
      const result = await runCitationQuery(queryText);

      if (result.success) {
        successfulQueries++;
        if (!sampleQuery) sampleQuery = queryText;

        for (const url of result.citedUrls) {
          const platform = extractPlatform(url);
          if (platform) {
            platformCounts[platform] = (platformCounts[platform] ?? 0) + 1;
          }
        }
      }
    } catch {
      // Per-query failure — continue with next query
      continue;
    }

    // Rate limit: 500ms between Perplexity calls (Doc 18 §2.1)
    await sleep(500);
  }

  return { platformCounts, successfulQueries, sampleQuery };
}

// ---------------------------------------------------------------------------
// writeCitationResults — Upsert into citation_source_intelligence
// ---------------------------------------------------------------------------

/**
 * For each platform found, calculates citation_frequency and upserts into
 * the citation_source_intelligence table.
 *
 * Uses the UNIQUE constraint on (business_category, city, state, platform, model_provider)
 * to overwrite previous measurements safely (idempotent).
 */
export async function writeCitationResults(
  category: string,
  city: string,
  state: string,
  platformCounts: PlatformCitationCounts,
  successfulQueries: number,
  sampleQuery: string | null,
  supabase: SupabaseClient<Database>,
): Promise<number> {
  if (successfulQueries === 0) return 0;

  let platformsWritten = 0;

  for (const [platform, citationCount] of Object.entries(platformCounts)) {
    const frequency = citationCount / successfulQueries;

    const { error } = await supabase
      .from('citation_source_intelligence')
      .upsert(
        {
          business_category: category,
          city,
          state,
          platform,
          citation_frequency: Math.round(frequency * 1000) / 1000, // 3 decimal places
          sample_query: sampleQuery,
          sample_size: successfulQueries,
          model_provider: 'perplexity-sonar',
          measured_at: new Date().toISOString(),
        },
        {
          onConflict: 'business_category,city,state,platform,model_provider',
        },
      );

    if (error) {
      console.error(
        `[citation-engine] Upsert failed for ${platform} in ${category}/${city}:`,
        error.message,
      );
    } else {
      platformsWritten++;
    }
  }

  return platformsWritten;
}

// ---------------------------------------------------------------------------
// Citation Gap Score (Doc 18 §3.2)
// ---------------------------------------------------------------------------

/** Minimum citation frequency to consider a platform "meaningful". */
const CITATION_RELEVANCE_THRESHOLD = 0.30;

/**
 * Calculates how well a tenant's directory listings cover the platforms
 * that AI actually cites for their category+city.
 *
 * Pure function — no AI calls, no DB writes.
 *
 * @param platforms - citation_source_intelligence rows for the tenant's category+city
 * @param tenantListings - the tenant's listings joined with directory names
 * @returns gap score (0–100), coverage counts, and the biggest uncovered gap
 */
export function calculateCitationGapScore(
  platforms: CitationSourceIntelligence[],
  tenantListings: TenantListing[],
): CitationGapSummary {
  // Only count platforms where AI cites them meaningfully (>= 30% frequency)
  const relevantPlatforms = platforms.filter(
    (p) => p.citation_frequency >= CITATION_RELEVANCE_THRESHOLD,
  );

  if (relevantPlatforms.length === 0) {
    // No data yet — optimistic default
    return {
      gapScore: 100,
      platformsCovered: 0,
      platformsThatMatter: 0,
      topGap: null,
    };
  }

  const coveredPlatforms = relevantPlatforms.filter((platform) =>
    tenantListings.some(
      (listing) =>
        listing.directory.toLowerCase() === platform.platform.toLowerCase() &&
        listing.sync_status !== 'not_linked',
    ),
  );

  const gapScore = Math.round(
    (coveredPlatforms.length / relevantPlatforms.length) * 100,
  );

  // Find biggest uncovered gap (highest frequency platform tenant is NOT listed on)
  const uncoveredPlatforms = relevantPlatforms
    .filter((p) => !coveredPlatforms.includes(p))
    .sort((a, b) => b.citation_frequency - a.citation_frequency);

  const topGap = uncoveredPlatforms[0] ?? null;

  return {
    gapScore,
    platformsCovered: coveredPlatforms.length,
    platformsThatMatter: relevantPlatforms.length,
    topGap: topGap
      ? {
          platform: topGap.platform,
          citationFrequency: topGap.citation_frequency,
          action: `Claim your ${capitalize(topGap.platform)} listing to appear in ${Math.round(topGap.citation_frequency * 100)}% more AI answers`,
        }
      : null,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
