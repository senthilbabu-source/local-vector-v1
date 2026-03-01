// ---------------------------------------------------------------------------
// lib/authority/sameas-enricher.ts — sameAs Enricher
//
// Sprint 108: Identifies high-value sameAs URLs the business should add
// to its schema but hasn't yet.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { GroundTruth, CitationSource, SameAsGap, AuthorityTier } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

/** High-value sameAs platforms in priority order. */
export const HIGH_VALUE_SAMEAS_PLATFORMS: Array<{
  platform: string;
  tier: AuthorityTier;
  estimated_impact: 'high' | 'medium' | 'low';
  domain_pattern: string;
}> = [
  { platform: 'wikidata',     tier: 'tier2', estimated_impact: 'high',   domain_pattern: 'wikidata.org' },
  { platform: 'wikipedia',    tier: 'tier2', estimated_impact: 'high',   domain_pattern: 'wikipedia.org' },
  { platform: 'yelp',         tier: 'tier2', estimated_impact: 'high',   domain_pattern: 'yelp.com' },
  { platform: 'tripadvisor',  tier: 'tier2', estimated_impact: 'high',   domain_pattern: 'tripadvisor.com' },
  { platform: 'google_maps',  tier: 'tier2', estimated_impact: 'medium', domain_pattern: 'google.com' },
  { platform: 'apple_maps',   tier: 'tier2', estimated_impact: 'medium', domain_pattern: 'maps.apple.com' },
  { platform: 'facebook',     tier: 'tier2', estimated_impact: 'medium', domain_pattern: 'facebook.com' },
  { platform: 'foursquare',   tier: 'tier2', estimated_impact: 'low',    domain_pattern: 'foursquare.com' },
  { platform: 'opentable',    tier: 'tier2', estimated_impact: 'low',    domain_pattern: 'opentable.com' },
];

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Identifies high-value sameAs URLs the business should add to its schema.
 * Compares existing sameAs URLs + listing platform IDs against ideal platforms.
 * Never throws — returns [] on failure.
 */
export async function detectSameAsGaps(
  supabase: SupabaseClient<Database>,
  groundTruth: GroundTruth,
  locationId: string,
  detectedCitations: CitationSource[],
): Promise<SameAsGap[]> {
  try {
    // 1. Fetch existing sameAs URLs from homepage schema
    const existingSameAs = await fetchExistingSameAs(supabase, locationId);

    // 2. Fetch platform URLs from listing_platform_ids
    const { data: platformIds } = await supabase
      .from('listing_platform_ids')
      .select('platform, platform_id')
      .eq('location_id', locationId);
    const claimedPlatforms = new Set((platformIds ?? []).map(p => p.platform));

    // 3. Build set of "already linked" domains
    const linkedDomains = new Set<string>();
    for (const url of existingSameAs) {
      try {
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        linkedDomains.add(hostname);
      } catch (_e) {
        // Skip invalid URLs
      }
    }

    // 4. Also add domains from detected citations that are sameAs candidates
    const citationUrls = new Map<string, string>();
    for (const c of detectedCitations) {
      if (c.is_sameas_candidate) {
        citationUrls.set(c.domain, c.url);
      }
    }

    // 5. Check which HIGH_VALUE_SAMEAS_PLATFORMS are missing
    const gaps: SameAsGap[] = [];
    for (const platform of HIGH_VALUE_SAMEAS_PLATFORMS) {
      const isLinked = Array.from(linkedDomains).some(d =>
        d.includes(platform.domain_pattern) || platform.domain_pattern.includes(d)
      );

      if (isLinked) continue;

      // Check if we found a citation URL for this platform
      const citationUrl = Array.from(citationUrls.entries()).find(([domain]) =>
        domain.includes(platform.domain_pattern) || platform.domain_pattern.includes(domain)
      );

      const isClaimed = claimedPlatforms.has(platform.platform);
      const { action_label, action_instructions, effort } = generateSameAsInstructions(
        platform.platform,
        groundTruth.name,
        groundTruth.city,
        citationUrl?.[1],
      );

      gaps.push({
        url: citationUrl?.[1] ?? '',
        platform: platform.platform,
        tier: platform.tier,
        estimated_impact: platform.estimated_impact,
        action_label,
        action_instructions,
        already_in_schema: false,
      });
    }

    return gaps;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { file: 'sameas-enricher.ts', sprint: '108' },
    });
    return [];
  }
}

/**
 * Fetches existing sameAs URLs from the homepage schema.
 */
export async function fetchExistingSameAs(
  supabase: SupabaseClient<Database>,
  locationId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('page_schemas')
    .select('json_ld')
    .eq('location_id', locationId)
    .eq('page_type', 'homepage')
    .eq('status', 'published')
    .limit(1)
    .maybeSingle();

  if (error || !data?.json_ld) return [];

  const jsonLd = data.json_ld as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(jsonLd)) return [];

  for (const schema of jsonLd) {
    if (schema.sameAs && Array.isArray(schema.sameAs)) {
      return schema.sameAs.filter((u): u is string => typeof u === 'string');
    }
  }

  return [];
}

/**
 * Checks the Wikidata API for an entity matching the business name + city.
 * Uses the Wikidata search API (free, no key required).
 * Never throws — returns { found: false } on failure.
 */
export async function checkWikidataEntity(
  businessName: string,
  city: string,
): Promise<{ found: boolean; wikidataUrl?: string; qId?: string }> {
  try {
    const searchQuery = `${businessName} ${city}`;
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchQuery)}&language=en&format=json&limit=5`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return { found: false };

    const data = await response.json() as {
      search?: Array<{ id: string; label: string; description?: string }>;
    };

    if (!data.search?.length) return { found: false };

    // Look for a match that's a restaurant/business
    const match = data.search.find(item => {
      const label = item.label.toLowerCase();
      const name = businessName.toLowerCase();
      return label.includes(name) || name.includes(label);
    });

    if (match) {
      return {
        found: true,
        wikidataUrl: `https://www.wikidata.org/wiki/${match.id}`,
        qId: match.id,
      };
    }

    return { found: false };
  } catch (_e) {
    return { found: false };
  }
}

/**
 * Generates instructions for addressing a sameAs gap.
 * Pure function.
 */
export function generateSameAsInstructions(
  platform: string,
  businessName: string,
  city: string,
  existingUrl?: string,
): { action_label: string; action_instructions: string; effort: 'low' | 'medium' | 'high' } {
  switch (platform) {
    case 'wikidata':
      return {
        action_label: `Create a Wikidata entity for ${businessName}`,
        action_instructions: `Create a Wikidata item for ${businessName}:\n1. Go to wikidata.org and create a free account.\n2. Click 'Create new item'.\n3. Add label: '${businessName}'.\n4. Add P31 (instance of): Q11707 (restaurant).\n5. Add P131 (located in): search for ${city}.\n6. Add P856 (official website): your website URL.\nOnce published, add the Wikidata URL to your schema sameAs.`,
        effort: 'medium',
      };

    case 'wikipedia':
      return {
        action_label: `Check Wikipedia coverage for ${businessName}`,
        action_instructions: `Search Wikipedia for '${city} restaurants' or 'restaurants in ${city}' lists. If your business qualifies for notability, request addition. This is a high-value Tier 2 citation.`,
        effort: 'high',
      };

    case 'yelp':
      if (existingUrl) {
        return {
          action_label: 'Add Yelp listing to your schema sameAs',
          action_instructions: `Your Yelp listing exists at ${existingUrl}. Add this URL to your homepage schema sameAs array to link the entities.`,
          effort: 'low',
        };
      }
      return {
        action_label: `Claim your Yelp listing for ${businessName}`,
        action_instructions: `Visit biz.yelp.com and search for ${businessName} in ${city}. Claim your listing, then add the URL to your schema sameAs.`,
        effort: 'medium',
      };

    case 'tripadvisor':
      if (existingUrl) {
        return {
          action_label: 'Add TripAdvisor listing to your schema sameAs',
          action_instructions: `Your TripAdvisor listing exists at ${existingUrl}. Add this URL to your homepage schema sameAs array.`,
          effort: 'low',
        };
      }
      return {
        action_label: `Claim your TripAdvisor listing for ${businessName}`,
        action_instructions: `Visit tripadvisor.com/owners and search for ${businessName} to claim your listing. Once claimed, add it to your schema sameAs.`,
        effort: 'medium',
      };

    case 'google_maps':
      return {
        action_label: 'Add Google Maps link to your schema sameAs',
        action_instructions: `Find your Google Maps listing by searching for ${businessName} ${city}. Copy the URL and add it to your homepage schema sameAs array.`,
        effort: 'low',
      };

    case 'apple_maps':
      return {
        action_label: 'Claim your Apple Maps listing',
        action_instructions: `Visit mapsconnect.apple.com and search for ${businessName}. Claim your listing, then add the Apple Maps URL to your schema sameAs.`,
        effort: 'medium',
      };

    case 'facebook':
      if (existingUrl) {
        return {
          action_label: 'Add Facebook page to your schema sameAs',
          action_instructions: `Your Facebook page exists at ${existingUrl}. Add this URL to your homepage schema sameAs array.`,
          effort: 'low',
        };
      }
      return {
        action_label: `Create a Facebook Business page for ${businessName}`,
        action_instructions: `Create a Facebook Business page for ${businessName}. Add your address, hours, and contact info. Then add the page URL to your schema sameAs.`,
        effort: 'medium',
      };

    case 'foursquare':
      return {
        action_label: 'Claim your Foursquare listing',
        action_instructions: `Visit business.foursquare.com and search for ${businessName} in ${city}. Claim your listing and add the URL to your schema sameAs.`,
        effort: 'medium',
      };

    case 'opentable':
      return {
        action_label: 'List on OpenTable for reservation bookings',
        action_instructions: `Visit restaurant.opentable.com to sign up ${businessName}. Once active, add the listing URL to your schema sameAs.`,
        effort: 'high',
      };

    default:
      return {
        action_label: `Add ${platform} link to your schema`,
        action_instructions: `Find your listing on ${platform} and add the URL to your homepage schema sameAs array.`,
        effort: 'medium',
      };
  }
}
