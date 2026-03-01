// ---------------------------------------------------------------------------
// lib/authority/citation-source-detector.ts — Citation Source Detector
//
// Sprint 108: Uses Perplexity Sonar to detect where the business is being
// cited across the web, then classifies each source into an authority tier.
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import type { GroundTruth, CitationSource, AuthorityTier, CitationSourceType } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_QUERIES_PER_RUN = 5;
const MAX_CITATIONS_PER_QUERY = 10;

/** Known Tier 2 domains — major platforms AI trusts. */
export const KNOWN_TIER2_DOMAINS: Record<string, CitationSourceType> = {
  'yelp.com':          'yelp',
  'tripadvisor.com':   'tripadvisor',
  'maps.google.com':   'google_maps',
  'google.com':        'google_maps',
  'apple.com':         'apple_maps',
  'maps.apple.com':    'apple_maps',
  'facebook.com':      'facebook',
  'en.wikipedia.org':  'wikipedia',
  'wikipedia.org':     'wikipedia',
  'wikidata.org':      'wikidata',
  'foursquare.com':    'foursquare',
  'opentable.com':     'opentable',
  'eater.com':         'industry_guide',
  'thrillist.com':     'industry_guide',
  'zagat.com':         'industry_guide',
  'timeout.com':       'industry_guide',
  'reddit.com':        'reddit',
};

/** Known Tier 1 patterns — journalism, government, academic. */
export const KNOWN_TIER1_PATTERNS: Array<{ pattern: string; sourceType: CitationSourceType }> = [
  { pattern: '.gov',          sourceType: 'government' },
  { pattern: '.edu',          sourceType: 'academic' },
  { pattern: 'nytimes.com',   sourceType: 'regional_news' },
  { pattern: 'wsj.com',       sourceType: 'regional_news' },
  { pattern: 'latimes.com',   sourceType: 'regional_news' },
  { pattern: 'washingtonpost.com', sourceType: 'regional_news' },
  { pattern: 'cnn.com',       sourceType: 'regional_news' },
  { pattern: 'forbes.com',    sourceType: 'regional_news' },
  { pattern: 'ajc.com',       sourceType: 'regional_news' },
  { pattern: 'usatoday.com',  sourceType: 'regional_news' },
  { pattern: 'bbc.com',       sourceType: 'regional_news' },
  { pattern: 'reuters.com',   sourceType: 'regional_news' },
  { pattern: 'apnews.com',    sourceType: 'regional_news' },
];

// ── Zod schema for Perplexity response ───────────────────────────────────────

const CitationResponseSchema = z.object({
  citations: z.array(z.object({
    url: z.string(),
    snippet: z.string().optional().default(''),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional().default('neutral'),
  })).default([]),
});

// ── Classification functions ─────────────────────────────────────────────────

/**
 * Extracts the effective domain from a URL.
 * Strips www. prefix and returns the hostname.
 */
export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname;
  } catch (_e) {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

/**
 * Classifies a citation URL into an authority tier.
 * Pure function — no I/O.
 */
export function classifySourceTier(
  url: string,
  businessWebsite: string | null,
): { tier: AuthorityTier; sourceType: CitationSourceType } {
  const domain = extractDomain(url);

  // Check if it's the business's own website → Tier 1
  if (businessWebsite) {
    const businessDomain = extractDomain(businessWebsite);
    if (domain === businessDomain || domain.endsWith('.' + businessDomain)) {
      return { tier: 'tier1', sourceType: 'brand_website' };
    }
  }

  // Check KNOWN_TIER2_DOMAINS — exact match or subdomain
  for (const [knownDomain, sourceType] of Object.entries(KNOWN_TIER2_DOMAINS)) {
    if (domain === knownDomain || domain.endsWith('.' + knownDomain)) {
      return { tier: 'tier2', sourceType };
    }
  }

  // Check KNOWN_TIER1_PATTERNS — suffix/domain match
  for (const { pattern, sourceType } of KNOWN_TIER1_PATTERNS) {
    if (domain.endsWith(pattern) || domain === pattern.replace(/^\./, '')) {
      return { tier: 'tier1', sourceType };
    }
  }

  // Default: Tier 3
  return { tier: 'tier3', sourceType: 'other' };
}

/**
 * Determines if a citation URL is a strong sameAs candidate.
 * Must be Tier 2 and a direct business listing/page (not a category page).
 */
export function isSameAsCandidate(
  url: string,
  businessName: string,
): boolean {
  const domain = extractDomain(url);
  const lowerUrl = url.toLowerCase();
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Yelp business page
  if (domain === 'yelp.com' && lowerUrl.includes('/biz/')) return true;

  // TripAdvisor restaurant page
  if (domain === 'tripadvisor.com' && lowerUrl.includes('restaurant_review')) return true;

  // Google Maps place
  if ((domain === 'google.com' || domain === 'maps.google.com') &&
      (lowerUrl.includes('/maps/place/') || lowerUrl.includes('?cid='))) return true;

  // Facebook business page
  if (domain === 'facebook.com' && !lowerUrl.includes('/groups/') &&
      !lowerUrl.includes('/events/')) return true;

  // Wikipedia article
  if (domain === 'wikipedia.org' || domain === 'en.wikipedia.org') return true;

  // Wikidata entity
  if (domain === 'wikidata.org' && lowerUrl.includes('/wiki/Q')) return true;

  // OpenTable restaurant page
  if (domain === 'opentable.com' && lowerUrl.includes('/restaurant/')) return true;

  // Foursquare venue
  if (domain === 'foursquare.com' && lowerUrl.includes('/v/')) return true;

  // Apple Maps place
  if ((domain === 'apple.com' || domain === 'maps.apple.com') &&
      lowerUrl.includes('/place')) return true;

  // Check if URL contains business name slug (generic candidate)
  if (lowerUrl.includes(slug) && slug.length > 3) return true;

  return false;
}

// ── Perplexity Query ─────────────────────────────────────────────────────────

/**
 * Builds query strings for citation detection.
 * Returns up to MAX_QUERIES_PER_RUN targeted queries.
 */
export function buildCitationQueries(groundTruth: GroundTruth): string[] {
  const { name, city, state } = groundTruth;
  const queries: string[] = [
    `"${name}" ${city} ${state}`,
    `"${name}" ${city} reviews`,
    `"${name}" ${city} restaurant`,
    `best restaurants ${city} ${state} "${name}"`,
    `"${name}" hookah ${city}`,
  ];
  return queries.slice(0, MAX_QUERIES_PER_RUN);
}

/**
 * Runs Perplexity Sonar queries to detect where the business is being cited.
 * Returns deduplicated citation sources classified by tier.
 * Never throws — returns [] with errors logged on failure.
 */
export async function detectCitationSources(
  groundTruth: GroundTruth,
): Promise<CitationSource[]> {
  if (!hasApiKey('perplexity')) {
    return [];
  }

  const queries = buildCitationQueries(groundTruth);
  const allCitations = new Map<string, CitationSource>();
  const now = new Date().toISOString();

  for (const query of queries) {
    try {
      const { text } = await generateText({
        model: getModel('authority-citation'),
        system: `You are a web citation analyst. Search for all web pages, articles, directories, and platforms that mention the specified business. Return ONLY valid JSON with this structure:
{
  "citations": [
    { "url": "https://...", "snippet": "brief excerpt mentioning the business", "sentiment": "positive" | "neutral" | "negative" }
  ]
}
Return up to ${MAX_CITATIONS_PER_QUERY} citations. Only include URLs that actually mention the business.`,
        prompt: `Find all web citations for: ${query}`,
        temperature: 0.3,
        maxTokens: 1000,
      });

      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();

      const parsed = CitationResponseSchema.safeParse(JSON.parse(cleaned));
      if (!parsed.success) continue;

      for (const citation of parsed.data.citations) {
        const domain = extractDomain(citation.url);
        // Deduplicate by domain — keep highest tier
        if (allCitations.has(domain)) {
          const existing = allCitations.get(domain)!;
          const newClassification = classifySourceTier(citation.url, groundTruth.website ?? null);
          const tierRank: Record<AuthorityTier, number> = { tier1: 3, tier2: 2, tier3: 1, unknown: 0 };
          if (tierRank[newClassification.tier] > tierRank[existing.tier]) {
            allCitations.set(domain, {
              url: citation.url,
              domain,
              tier: newClassification.tier,
              source_type: newClassification.sourceType,
              snippet: citation.snippet || null,
              detected_at: now,
              sentiment: citation.sentiment || 'unknown',
              is_sameas_candidate: isSameAsCandidate(citation.url, groundTruth.name),
            });
          }
          continue;
        }

        const { tier, sourceType } = classifySourceTier(citation.url, groundTruth.website ?? null);
        allCitations.set(domain, {
          url: citation.url,
          domain,
          tier,
          source_type: sourceType,
          snippet: citation.snippet || null,
          detected_at: now,
          sentiment: citation.sentiment || 'unknown',
          is_sameas_candidate: isSameAsCandidate(citation.url, groundTruth.name),
        });
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { file: 'citation-source-detector.ts', sprint: '108' },
        extra: { query },
      });
    }
  }

  return Array.from(allCitations.values());
}
