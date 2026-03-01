// ---------------------------------------------------------------------------
// lib/authority/types.ts — Semantic Authority Mapping shared types
//
// Sprint 108: Entity authority measurement across the AI knowledge ecosystem.
// All authority engine components import from here.
// ---------------------------------------------------------------------------

export type { GroundTruth } from '@/lib/nap-sync/types';

/**
 * The three authority tiers AI engines apply to citation sources.
 *
 * Tier 1 — Primary (highest AI trust weight):
 *   Journalism, local news, government (.gov), academic (.edu),
 *   the brand's own authoritative pages
 *
 * Tier 2 — Trusted (high AI trust weight):
 *   Major review platforms (Yelp, TripAdvisor, OpenTable),
 *   Wikipedia, Wikidata, Apple Maps, Google Maps, Facebook,
 *   industry-specific platforms (Foursquare, Zagat, Eater)
 *
 * Tier 3 — Secondary (declining AI trust weight):
 *   SEO-optimized affiliate blogs, aggregator sites, low-authority
 *   directories, scraped listing sites, content farms
 */
export type AuthorityTier = 'tier1' | 'tier2' | 'tier3' | 'unknown';

/**
 * Fine-grained classification of citation source.
 */
export type CitationSourceType =
  | 'local_news'
  | 'regional_news'
  | 'government'
  | 'academic'
  | 'brand_website'
  | 'yelp'
  | 'tripadvisor'
  | 'google_maps'
  | 'apple_maps'
  | 'facebook'
  | 'wikipedia'
  | 'wikidata'
  | 'foursquare'
  | 'opentable'
  | 'industry_guide'
  | 'reddit'
  | 'aggregator_blog'
  | 'affiliate_site'
  | 'low_authority_directory'
  | 'other';

/**
 * A single detected citation of the business from a web source.
 */
export interface CitationSource {
  url: string;
  domain: string;
  tier: AuthorityTier;
  source_type: CitationSourceType;
  snippet: string | null;
  detected_at: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  is_sameas_candidate: boolean;
}

/**
 * The five dimensions of entity authority.
 */
export interface AuthorityDimensions {
  tier1_citation_score: number;    // 0–30
  tier2_coverage_score: number;    // 0–25
  platform_breadth_score: number;  // 0–20
  sameas_score: number;            // 0–15
  velocity_score: number;          // 0–10
}

/**
 * Full entity authority profile for a location.
 */
export interface EntityAuthorityProfile {
  location_id: string;
  org_id: string;
  entity_authority_score: number;
  dimensions: AuthorityDimensions;
  tier_breakdown: {
    tier1: number;
    tier2: number;
    tier3: number;
    unknown: number;
  };
  top_citations: CitationSource[];
  sameas_gaps: SameAsGap[];
  citation_velocity: number | null;
  velocity_label: 'growing' | 'stable' | 'declining' | 'unknown';
  recommendations: AuthorityRecommendation[];
  snapshot_at: string;
}

/**
 * A high-value sameAs URL that is not yet in the business's schema.
 */
export interface SameAsGap {
  url: string;
  platform: string;
  tier: AuthorityTier;
  estimated_impact: 'high' | 'medium' | 'low';
  action_label: string;
  action_instructions: string;
  already_in_schema: boolean;
}

/**
 * A prioritized, actionable recommendation to improve authority.
 */
export interface AuthorityRecommendation {
  priority: 1 | 2 | 3;
  category: 'tier1_citation' | 'tier2_listing' | 'sameas' | 'velocity_recovery' | 'platform_breadth';
  title: string;
  description: string;
  estimated_score_gain: number;
  effort: 'low' | 'medium' | 'high';
  action_type: 'create_content' | 'claim_listing' | 'add_sameas' | 'outreach' | 'review_request';
  autopilot_trigger?: boolean;
}

/**
 * Monthly snapshot stored for velocity calculation.
 */
export interface AuthoritySnapshot {
  id: string;
  location_id: string;
  org_id: string;
  entity_authority_score: number;
  tier_breakdown: { tier1: number; tier2: number; tier3: number };
  total_citations: number;
  sameas_count: number;
  snapshot_month: string;
  created_at: string;
}

/**
 * Result of a full authority mapping run.
 */
export interface AuthorityMappingResult {
  location_id: string;
  org_id: string;
  entity_authority_score: number;
  citations_detected: number;
  sameas_gaps_found: number;
  velocity: number | null;
  autopilot_drafts_triggered: number;
  errors: string[];
  run_at: string;
}

/**
 * API response shape for the authority status endpoint.
 */
export interface AuthorityStatusResponse {
  profile: EntityAuthorityProfile | null;
  history: AuthoritySnapshot[];
  last_run_at: string | null;
}
