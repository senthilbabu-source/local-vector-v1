// ---------------------------------------------------------------------------
// lib/services/entity-health.service.ts — Entity Knowledge Graph Health
//
// Sprint 80: Pure scoring service. No I/O, no Supabase, no side effects (AI_RULES §39).
// Computes entity health from the entity_checks row.
// ---------------------------------------------------------------------------

// ── Platform Registry ──────────────────────────────────────────────────────

export type EntityPlatform =
  | 'google_knowledge_panel'
  | 'google_business_profile'
  | 'yelp'
  | 'tripadvisor'
  | 'apple_maps'
  | 'bing_places'
  | 'wikidata';

export type EntityStatus = 'confirmed' | 'missing' | 'unchecked' | 'incomplete';

export interface PlatformInfo {
  key: EntityPlatform;
  label: string;
  description: string;
  /** Why this platform matters for AI visibility */
  aiImpact: string;
  /** Step-by-step guide to claim/verify on this platform */
  claimGuide: string[];
  /** External URL to claim the listing */
  claimUrl: string;
  /** Can we auto-detect from existing LocalVector data? */
  autoDetectable: boolean;
  /** Priority for AI citation: higher = more important */
  priority: number;
}

export const ENTITY_PLATFORM_REGISTRY: PlatformInfo[] = [
  {
    key: 'google_knowledge_panel',
    label: 'Google Knowledge Panel',
    description: 'A prominent info box in Google Search results that confirms your business as a recognized entity.',
    aiImpact: 'Google-based AI models (Gemini, Google AI Overviews) heavily rely on Knowledge Graph entities for factual grounding.',
    claimGuide: [
      'Search for your business name on Google',
      'If a Knowledge Panel appears on the right side, click "Claim this business"',
      'Follow the verification steps (usually email or phone)',
      'If no panel exists, ensure your Google Business Profile is complete and verified',
    ],
    claimUrl: 'https://www.google.com/search',
    autoDetectable: true,
    priority: 10,
  },
  {
    key: 'google_business_profile',
    label: 'Google Business Profile',
    description: "Your verified GBP listing is the primary data source for Google's AI products.",
    aiImpact: 'The #1 data source for Google AI Overviews. A verified, complete GBP is the single highest-impact action for AI visibility.',
    claimGuide: [
      'Go to business.google.com',
      'Search for your business or add it',
      'Complete all fields: hours, categories, photos, services, attributes',
      'Verify via postcard, phone, or email',
      'Post updates weekly to signal freshness',
    ],
    claimUrl: 'https://business.google.com',
    autoDetectable: true,
    priority: 10,
  },
  {
    key: 'yelp',
    label: 'Yelp',
    description: "Yelp's entity database is a primary citation source for ChatGPT and Copilot.",
    aiImpact: 'ChatGPT and Microsoft Copilot frequently cite Yelp reviews and ratings. An unclaimed Yelp page means AI engines cite unverified information about you.',
    claimGuide: [
      'Go to biz.yelp.com',
      'Search for your business',
      'Click "Claim this business" (or "Add your business" if not found)',
      'Verify ownership via phone or email',
      'Complete your profile: hours, photos, categories, response to reviews',
    ],
    claimUrl: 'https://biz.yelp.com',
    autoDetectable: false,
    priority: 9,
  },
  {
    key: 'tripadvisor',
    label: 'TripAdvisor',
    description: 'TripAdvisor is used by Perplexity and Copilot for restaurant recommendations.',
    aiImpact: "Perplexity and Copilot cite TripAdvisor for restaurant rankings. Missing means AI can't verify your quality via TripAdvisor reviews.",
    claimGuide: [
      'Go to tripadvisor.com/owners',
      'Search for your business',
      'Click "Claim your listing" (or add it if not found)',
      'Verify via phone or credit card',
      'Complete profile: photos, hours, menu, management responses',
    ],
    claimUrl: 'https://www.tripadvisor.com/owners',
    autoDetectable: false,
    priority: 7,
  },
  {
    key: 'apple_maps',
    label: 'Apple Maps Connect',
    description: 'Apple Maps data powers Siri and Apple Intelligence recommendations.',
    aiImpact: "Siri and Apple Intelligence use Apple Maps for local business queries. An unclaimed listing means Siri won't recommend you.",
    claimGuide: [
      'Go to mapsconnect.apple.com',
      'Sign in with your Apple ID',
      'Search for your business or add it',
      'Verify ownership (phone call)',
      'Complete all fields: hours, categories, photos, payment methods',
    ],
    claimUrl: 'https://mapsconnect.apple.com',
    autoDetectable: false,
    priority: 8,
  },
  {
    key: 'bing_places',
    label: 'Bing Places for Business',
    description: 'Bing Places is the primary data source for Microsoft Copilot.',
    aiImpact: "Microsoft Copilot grounds its responses on Bing's index. An incomplete or missing Bing Places listing means Copilot guesses about your business.",
    claimGuide: [
      'Go to bingplaces.com',
      'Sign in with a Microsoft account',
      'Import from Google Business Profile (fastest) or add manually',
      'Verify via phone, email, or postal mail',
      'Ensure hours, categories, and photos are complete',
    ],
    claimUrl: 'https://www.bingplaces.com',
    autoDetectable: false,
    priority: 8,
  },
  {
    key: 'wikidata',
    label: 'Wikidata',
    description: 'Wikidata is the structured knowledge base used by many AI models for entity resolution.',
    aiImpact: "Advanced AEO step. Wikidata entities are used by AI models for disambiguation. Most local restaurants won't have this — but notable establishments can benefit.",
    claimGuide: [
      'Go to wikidata.org',
      'Search for your business (it likely does not exist yet)',
      'Create a new item with property "instance of" -> "restaurant"',
      'Add properties: official website, location, coordinates, inception date',
      'Link to your Wikipedia article if one exists',
      'Note: Wikidata entries must be notable — requires media coverage or Wikipedia article',
    ],
    claimUrl: 'https://www.wikidata.org',
    autoDetectable: false,
    priority: 3,
  },
];

// ── Input / Output Types ───────────────────────────────────────────────────

export interface EntityCheckRow {
  google_knowledge_panel: string;
  google_business_profile: string;
  yelp: string;
  tripadvisor: string;
  apple_maps: string;
  bing_places: string;
  wikidata: string;
  platform_metadata: Record<string, unknown>;
}

export interface EntityHealthResult {
  /** Per-platform status with metadata */
  platforms: Array<{
    info: PlatformInfo;
    status: EntityStatus;
    metadata?: Record<string, unknown>;
  }>;

  /** Aggregate: confirmed count out of total (excluding wikidata from denominator) */
  confirmedCount: number;
  totalPlatforms: number; // 6 (wikidata excluded from health calculation)

  /** Overall entity health */
  score: number; // 0-100
  rating: 'strong' | 'at_risk' | 'critical' | 'unknown';

  /** Fix recommendations sorted by priority */
  recommendations: Array<{
    platform: EntityPlatform;
    label: string;
    action: string;
    priority: number;
    claimUrl: string;
  }>;
}

// ── Health Computation ─────────────────────────────────────────────────────

/**
 * Pure function — computes entity health from the entity_checks row.
 * No I/O, no side effects.
 */
export function computeEntityHealth(check: EntityCheckRow): EntityHealthResult {
  const platformStatuses = ENTITY_PLATFORM_REGISTRY.map((info) => ({
    info,
    status: check[info.key] as EntityStatus,
    metadata: (check.platform_metadata as Record<string, Record<string, unknown>>)?.[info.key],
  }));

  // Score: count confirmed out of 6 core platforms (exclude wikidata — it's advanced/optional)
  const corePlatforms = platformStatuses.filter((p) => p.info.key !== 'wikidata');
  const confirmedCount = corePlatforms.filter((p) => p.status === 'confirmed').length;
  const totalPlatforms = corePlatforms.length; // 6

  // Score: percentage of core platforms confirmed
  const score = totalPlatforms > 0 ? Math.round((confirmedCount / totalPlatforms) * 100) : 0;

  // Rating
  const rating: EntityHealthResult['rating'] =
    confirmedCount === 0 && corePlatforms.every((p) => p.status === 'unchecked')
      ? 'unknown'
      : confirmedCount >= 5
        ? 'strong'
        : confirmedCount >= 3
          ? 'at_risk'
          : 'critical';

  // Recommendations: missing + incomplete + unchecked platforms, sorted by priority desc
  const recommendations = platformStatuses
    .filter((p) => p.status !== 'confirmed')
    .sort((a, b) => b.info.priority - a.info.priority)
    .map((p) => ({
      platform: p.info.key,
      label: p.info.label,
      action:
        p.status === 'missing'
          ? `Claim your ${p.info.label} listing`
          : p.status === 'incomplete'
            ? `Complete your ${p.info.label} listing (missing data)`
            : `Check your ${p.info.label} presence`,
      priority: p.info.priority,
      claimUrl: p.info.claimUrl,
    }));

  return {
    platforms: platformStatuses,
    confirmedCount,
    totalPlatforms,
    score,
    rating,
    recommendations,
  };
}
