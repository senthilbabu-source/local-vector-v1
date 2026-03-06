// ---------------------------------------------------------------------------
// lib/entity-health/platform-fix-links.ts — S21 (AI_RULES §221)
//
// SSOT for external "Claim on [Platform]" links across entity health
// and citation pages. Covers all 7 entity_checks platforms.
// ---------------------------------------------------------------------------

export interface PlatformFixLink {
  label: string;
  url: string;
}

export const PLATFORM_FIX_LINKS: Record<string, PlatformFixLink> = {
  google_knowledge_panel: {
    label: 'Google Search Console',
    url: 'https://search.google.com/search-console',
  },
  google_business_profile: {
    label: 'Google Business Profile',
    url: 'https://business.google.com',
  },
  yelp: {
    label: 'Yelp for Business',
    url: 'https://biz.yelp.com',
  },
  tripadvisor: {
    label: 'TripAdvisor Owners',
    url: 'https://www.tripadvisor.com/Owners',
  },
  apple_maps: {
    label: 'Apple Business Connect',
    url: 'https://businessconnect.apple.com',
  },
  bing_places: {
    label: 'Bing Places',
    url: 'https://www.bingplaces.com',
  },
  wikidata: {
    label: 'Wikidata',
    url: 'https://www.wikidata.org/wiki/Special:NewItem',
  },
};

/**
 * Get the fix link for a platform. Returns null for unknown platforms.
 */
export function getPlatformFixLink(platform: string): PlatformFixLink | null {
  return PLATFORM_FIX_LINKS[platform] ?? null;
}
