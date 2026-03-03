# Sprint 108 — Semantic Authority Mapping

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Build the **Semantic Authority Mapping Engine** — LocalVector's system for measuring, tracking, and improving a business's standing as a recognized, authoritative *entity* in the AI knowledge ecosystem.

There is a critical distinction this sprint operates on:

- **Schema Expansion (Sprint 106)** answered: *"Can AI read your website's structured data?"*
- **Review Intelligence (Sprint 107)** answered: *"What are customers saying about you?"*
- **Content Briefs (Sprint 86)** answered: *"What content gaps are losing you AI citations?"*
- **Semantic Authority Mapping (Sprint 108)** answers: *"Does the broader internet treat you as a trusted, authoritative entity — and are AI engines learning from sources that help or hurt you?"*

AI engines like ChatGPT and Perplexity don't just index your website. They build entity representations from across the entire web. A business cited primarily in Tier 3 affiliate blogs and aggregator spam will lose ground to a competitor whose entity is reinforced by local news coverage, Wikidata entries, Wikipedia mentions, and high-frequency Yelp/TripAdvisor reviews. This sprint makes that authority hierarchy visible and actionable.

**What this sprint builds:**

1. **Citation Source Detector** — Uses Perplexity Sonar to scan for live citations of the business across the web, then classifies each source into an authority tier (Tier 1: journalism/gov/edu, Tier 2: major platforms, Tier 3: aggregators/blogs)
2. **Entity Authority Scorer** — Computes an `entity_authority_score` (0–100) from five dimensions: citation tier composition, platform breadth, sameAs completeness, citation velocity, and Wikidata/Wikipedia presence
3. **sameAs Enricher** — Suggests and stores high-value `sameAs` URLs not yet in the business's schema (Wikidata, Wikipedia category pages, Google Knowledge Graph, local press articles)
4. **Citation Velocity Monitor** — Stores monthly authority snapshots and computes velocity (growing/decaying) per source tier; alerts on Tier 1 decay
5. **Authority Recommendations Engine** — Generates prioritized, actionable steps to improve authority tier composition
6. **Authority Panel** — Dashboard panel: authority score, tier breakdown chart, velocity trend, sameAs gap list, top recommendations
7. **Monthly Authority Cron** — Runs citation detection for all Growth+ locations; stores snapshots; computes velocity deltas; triggers Autopilot drafts for locations with severe decay

**Why now (after Sprint 86):** The Autopilot Engine (Sprint 86) can now *create content* to address authority gaps. Sprint 108 is what *detects* those gaps at the entity level and feeds them back into the content pipeline. The two sprints form a closed loop: Autopilot publishes content → Authority Mapper measures whether the published content is gaining Tier 1/2 citations → velocity improves or a new draft is triggered.

**Key research signals that shape this sprint:**
- Entity presence on 4+ platforms = 2.8x AI citation rate (Digital Bloom, Jan 2026)
- 19.72% increase in AI Overview visibility after sameAs entity linking (Schema App, Jan 2026)
- Wikidata is the #1 Knowledge Graph source used by Google AI (Digital Bloom)
- LLMs are being tuned away from Tier 3 aggregators toward Tier 1 journalism/gov/edu
- Brands with velocity < −20% month-over-month are on a citation decline trajectory

**Gap being closed:** Semantic Authority Mapping 0% → 100%. Unblocks Sprint 109 (Voice Search Optimization), which requires authority signals to build voice-optimized content.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                              — All rules (45+ after Sprint 86)
Read CLAUDE.md                                                     — Implementation inventory
Read MEMORY.md                                                     — Architectural decisions
Read supabase/prod_schema.sql
  § FIND: locations table — name, website, phone, primary_category, city, state
  § FIND: listing_platform_ids (Sprint 105) — sameAs platform URLs already captured
  § FIND: page_schemas (Sprint 106) — json_ld contains sameAs array
  § FIND: reviews table (Sprint 107) — keywords column used for entity signal
  § FIND: content_drafts (Sprint 86) — published drafts become potential Tier 3 citations
  § FIND: citation_source_intelligence — aggregate platform frequency data (Doc 18 cron)
Read lib/supabase/database.types.ts                                — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                             — Golden Tenant (org_id: a0eebc99)
Read lib/nap-sync/types.ts                                         — GroundTruth type
Read lib/schema-expansion/types.ts                                 — PageType, GeneratedSchema
Read lib/autopilot/types.ts                                        — DraftTriggerInput (Sprint 86)
Read lib/autopilot/triggers/schema-gap-trigger.ts                  — Pattern for Autopilot trigger integration
Read lib/plan-enforcer.ts                                          — Plan gating
Read lib/supabase/server.ts                                        — createServiceRoleClient()
Read app/dashboard/page.tsx                                        — Dashboard to insert AuthorityPanel
Read app/api/cron/autopilot/route.ts                               — Sprint 86 cron pattern (follow exactly)
Read vercel.json                                                   — Existing crons
Read lib/nap-sync/adapters/yelp-adapter.ts                         — Perplexity API pattern (if Perplexity
                                                                     calls exist in nap-sync; otherwise
                                                                     check lib/sov/ for the Perplexity
                                                                     Sonar call pattern)
```

**Specifically understand before writing code:**
- The `citation_source_intelligence` table: this stores aggregate market data (platform frequency by category+city), NOT per-tenant citations. Sprint 108 creates a new `entity_authority_citations` table for per-tenant citation tracking — do NOT confuse these two tables
- The `listing_platform_ids` table structure: `platform`, `platform_id`, `platform_url` — the `platform_url` field is where sameAs URLs come from (Sprint 105 already captured GBP + Yelp URLs)
- The `page_schemas.json_ld` field: for homepage schemas, this contains a `sameAs` array — Sprint 108 both reads from it and adds to it
- The Perplexity Sonar call pattern used in the Fear Engine / SOV Engine — Sprint 108 reuses this exact pattern for citation detection. Find it before writing any Perplexity code

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/authority/
  index.ts                                   — barrel export
  types.ts                                   — all shared types
  citation-source-detector.ts                — Perplexity Sonar scan + tier classification
  entity-authority-scorer.ts                 — computes entity_authority_score (0–100)
  sameas-enricher.ts                         — discovers + suggests high-value sameAs URLs
  citation-velocity-monitor.ts               — computes velocity deltas from monthly snapshots
  authority-recommendations.ts               — generates prioritized action recommendations
  authority-service.ts                       — runAuthorityMapping() orchestrator
```

---

### Component 1: Shared Types — `lib/authority/types.ts`

```typescript
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
 * A single detected citation of the business from a web source.
 */
export interface CitationSource {
  url: string;
  domain: string;
  tier: AuthorityTier;
  source_type: CitationSourceType;
  snippet: string | null;           // Excerpt showing how the business is mentioned
  detected_at: string;              // ISO timestamp
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  is_sameas_candidate: boolean;     // Should this URL be added to schema sameAs?
}

/**
 * Fine-grained classification of citation source.
 */
export type CitationSourceType =
  | 'local_news'             // Tier 1: local newspaper, news site
  | 'regional_news'          // Tier 1: regional/national news publication
  | 'government'             // Tier 1: .gov domain
  | 'academic'               // Tier 1: .edu domain
  | 'brand_website'          // Tier 1: the business's own website
  | 'yelp'                   // Tier 2
  | 'tripadvisor'            // Tier 2
  | 'google_maps'            // Tier 2
  | 'apple_maps'             // Tier 2
  | 'facebook'               // Tier 2
  | 'wikipedia'              // Tier 2
  | 'wikidata'               // Tier 2
  | 'foursquare'             // Tier 2
  | 'opentable'              // Tier 2
  | 'industry_guide'         // Tier 2: Eater, Zagat, Thrillist, Time Out
  | 'reddit'                 // Tier 2 (high LLM weight for organic mentions)
  | 'aggregator_blog'        // Tier 3
  | 'affiliate_site'         // Tier 3
  | 'low_authority_directory' // Tier 3
  | 'other';                 // Tier 3 default for unclassified

/**
 * The five dimensions of entity authority.
 */
export interface AuthorityDimensions {
  tier1_citation_score: number;    // 0–30: are authoritative sources citing you?
  tier2_coverage_score: number;    // 0–25: are major trusted platforms covering you?
  platform_breadth_score: number;  // 0–20: are you on 4+ platforms AI cites?
  sameas_score: number;            // 0–15: how complete is your sameAs graph?
  velocity_score: number;          // 0–10: are citations growing or decaying?
}

/**
 * Full entity authority profile for a location.
 */
export interface EntityAuthorityProfile {
  location_id: string;
  org_id: string;
  entity_authority_score: number;           // 0–100 composite
  dimensions: AuthorityDimensions;
  tier_breakdown: {
    tier1: number;   // count of Tier 1 citations detected
    tier2: number;
    tier3: number;
    unknown: number;
  };
  top_citations: CitationSource[];          // Top 5 highest-value citations
  sameas_gaps: SameAsGap[];                 // High-value sameAs URLs not yet in schema
  citation_velocity: number | null;         // % change vs. last month. null = first run
  velocity_label: 'growing' | 'stable' | 'declining' | 'unknown';
  recommendations: AuthorityRecommendation[];
  snapshot_at: string;
}

/**
 * A high-value sameAs URL that is not yet in the business's schema.
 */
export interface SameAsGap {
  url: string;
  platform: string;               // e.g. 'wikidata', 'wikipedia', 'yelp', 'apple_maps'
  tier: AuthorityTier;
  estimated_impact: 'high' | 'medium' | 'low';
  action_label: string;           // e.g. "Add your Wikidata entity"
  action_instructions: string;    // Step-by-step guidance
  already_in_schema: boolean;     // If true, exclude from gaps list
}

/**
 * A prioritized, actionable recommendation to improve authority.
 */
export interface AuthorityRecommendation {
  priority: 1 | 2 | 3;           // 1 = highest impact
  category: 'tier1_citation' | 'tier2_listing' | 'sameas' | 'velocity_recovery' | 'platform_breadth';
  title: string;
  description: string;
  estimated_score_gain: number;   // Estimated point increase in entity_authority_score
  effort: 'low' | 'medium' | 'high';
  action_type: 'create_content' | 'claim_listing' | 'add_sameas' | 'outreach' | 'review_request';
  autopilot_trigger?: boolean;    // If true, can auto-create a content draft (Sprint 86)
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
  snapshot_month: string;         // YYYY-MM (e.g. "2026-03")
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
 * Perplexity Sonar query result shape (reuse from existing Fear/SOV engine).
 */
export interface PerplexitySonarResult {
  answer: string;
  citations: Array<{ url: string; snippet?: string }>;
}
```

---

### Component 2: Citation Source Detector — `lib/authority/citation-source-detector.ts`

```typescript
/**
 * Runs Perplexity Sonar queries to detect where the business is being cited across the web.
 * Classifies each source into an authority tier.
 *
 * Query strategy — 5 targeted queries per location:
 * 1. "{businessName} {city}" — direct name search
 * 2. "{businessName} {city} reviews" — review platform citations
 * 3. "{businessName} {city} {category}" — category-specific citations
 * 4. "{category} {city} recommendations" — third-party list mentions
 * 5. "{businessName} hookah {city}" — (category-specific keyword variant)
 *
 * For each query, extract citation URLs from Perplexity's `citations` array.
 * Scan the answer text for mentions of the business name.
 * Classify each URL using classifySourceTier().
 *
 * REUSE: The Perplexity Sonar API call pattern from the Fear Engine / SOV Engine.
 * Find the existing Perplexity call in lib/sov/ or lib/fear-engine/ and import it —
 * do NOT rewrite the HTTP call logic.
 *
 * MAX_QUERIES_PER_RUN = 5 (cost control — Perplexity Sonar at ~$0.005/query = $0.025/location/month)
 * MAX_CITATIONS_PER_QUERY = 10
 *
 * Deduplication: if the same domain appears in multiple queries, keep one record
 * (highest-tier classification wins).
 *
 * Returns: CitationSource[] — all detected citations, deduplicated by domain.
 * Never throws — returns [] with errors logged on failure.
 */
export async function detectCitationSources(
  groundTruth: GroundTruth,
  locationId: string,
  orgId: string,
): Promise<CitationSource[]> { ... }

/**
 * Classifies a citation URL into an authority tier.
 * Pure function — no I/O.
 *
 * Classification logic (in order of precedence):
 * 1. Check KNOWN_TIER2_DOMAINS — exact match → tier2
 * 2. Check KNOWN_TIER1_PATTERNS — .gov, .edu, known news domains → tier1
 * 3. Check business's own website domain → tier1 (brand_website)
 * 4. Check if URL contains businessName slug → potential tier1/2 (look up domain authority)
 * 5. reddit.com → tier2 (Reddit gets high LLM weighting for organic mentions)
 * 6. Any other domain → tier3
 */
export function classifySourceTier(
  url: string,
  businessWebsite: string | null,
): { tier: AuthorityTier; sourceType: CitationSourceType } { ... }

/**
 * Determines if a citation URL is a strong sameAs candidate.
 * Criteria: tier2 or tier1 AND the URL directly points to the business's listing/page.
 * (not a category listing page, not a review roundup — a page specifically ABOUT this business)
 */
export function isSameAsCandidate(
  url: string,
  businessName: string,
): boolean { ... }

/**
 * Known Tier 2 domains — major platforms AI trusts.
 * Mirrors the PLATFORM_MAP from citation_source_intelligence (Doc 18)
 * but adds tier classification.
 */
export const KNOWN_TIER2_DOMAINS: Record<string, CitationSourceType> = {
  'yelp.com':          'yelp',
  'tripadvisor.com':   'tripadvisor',
  'maps.google.com':   'google_maps',
  'google.com/maps':   'google_maps',
  'apple.com/maps':    'apple_maps',
  'facebook.com':      'facebook',
  'en.wikipedia.org':  'wikipedia',
  'wikidata.org':      'wikidata',
  'foursquare.com':    'foursquare',
  'opentable.com':     'opentable',
  'eater.com':         'industry_guide',
  'thrillist.com':     'industry_guide',
  'zagat.com':         'industry_guide',
  'timeout.com':       'industry_guide',
  'reddit.com':        'reddit',
};

/**
 * Known Tier 1 patterns — journalism, government, academic.
 * Domain suffix or pattern match.
 */
export const KNOWN_TIER1_PATTERNS: Array<{ pattern: string; sourceType: CitationSourceType }> = [
  { pattern: '.gov',    sourceType: 'government' },
  { pattern: '.edu',    sourceType: 'academic' },
  { pattern: 'ajc.com', sourceType: 'regional_news' },       // Atlanta Journal-Constitution
  { pattern: 'wsj.com', sourceType: 'regional_news' },
  { pattern: 'nytimes.com', sourceType: 'regional_news' },
  { pattern: 'latimes.com', sourceType: 'regional_news' },
  // 'local_news' pattern: any URL containing city name + known news TLDs
  // Detected heuristically: if domain contains city name and ends in .com/.net/.org
  // and is NOT in KNOWN_TIER2_DOMAINS, classify as local_news (Tier 1)
];
```

---

### Component 3: Entity Authority Scorer — `lib/authority/entity-authority-scorer.ts`

```typescript
/**
 * Computes the entity_authority_score (0–100) from five dimensions.
 * Pure function — no I/O.
 *
 * ── SCORING DIMENSIONS ──────────────────────────────────────────────
 *
 * 1. Tier 1 Citation Score (max 30 pts)
 *    - 0 Tier 1 citations:  0 pts
 *    - 1 Tier 1 citation:   15 pts
 *    - 2 Tier 1 citations:  22 pts
 *    - 3+ Tier 1 citations: 30 pts
 *    Rationale: Even a single local news mention is enormously valuable.
 *    Diminishing returns above 3 because the marginal AI signal is smaller.
 *
 * 2. Tier 2 Coverage Score (max 25 pts)
 *    - formula: min(25, tier2_citation_count × 5)
 *    - Cap at 5 Tier 2 sources = full 25 pts
 *    Rationale: Platform breadth (4+ platforms) drives 2.8x citation rate.
 *    A business on Google Maps + Yelp + TripAdvisor + Foursquare hits the 4-platform threshold.
 *
 * 3. Platform Breadth Score (max 20 pts)
 *    - Count unique platforms in listing_platform_ids that are claimed + active
 *    - 1–2 platforms:  5 pts
 *    - 3–4 platforms: 12 pts
 *    - 5+ platforms:  20 pts
 *    Rationale: Platform breadth (independent of citations) signals entity legitimacy.
 *
 * 4. sameAs Score (max 15 pts)
 *    - formula: min(15, sameas_count × 3)
 *    - Count sameAs URLs in page_schemas.json_ld for homepage schema
 *    - 5+ sameAs URLs = full 15 pts
 *    Rationale: sameAs is the primary mechanism for entity graph linking.
 *    19.72% AI Overview increase after entity linking implementation.
 *
 * 5. Velocity Score (max 10 pts)
 *    - velocity >= +10% (growing):     10 pts
 *    - velocity -10% to +10% (stable):  6 pts
 *    - velocity -20% to -10% (fading):  3 pts
 *    - velocity < -20% (declining):     0 pts
 *    - No previous snapshot (first run): 5 pts (neutral)
 *
 * ────────────────────────────────────────────────────────────────────
 */
export function computeAuthorityScore(
  citations: CitationSource[],
  platformCount: number,
  sameAsCount: number,
  velocity: number | null,
): { score: number; dimensions: AuthorityDimensions } { ... }

/**
 * Computes the velocity label from a velocity number.
 * Pure function.
 */
export function getVelocityLabel(
  velocity: number | null,
): EntityAuthorityProfile['velocity_label'] { ... }

/**
 * Counts the unique platforms in listing_platform_ids for a location.
 * Counts only 'active' / 'claimed' listings.
 */
export async function countActivePlatforms(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
): Promise<number> { ... }

/**
 * Counts the sameAs URLs in the homepage schema for a location.
 * Reads from page_schemas table: page_type = 'homepage', status = 'published'.
 * Returns 0 if no published homepage schema exists.
 */
export async function countSameAsUrls(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
): Promise<number> { ... }
```

---

### Component 4: sameAs Enricher — `lib/authority/sameas-enricher.ts`

```typescript
/**
 * Identifies high-value sameAs URLs the business should add to its schema
 * but hasn't yet.
 *
 * SameAs gap detection strategy:
 * 1. Fetch all sameAs URLs currently in homepage schema (page_schemas.json_ld)
 * 2. Fetch all platform URLs in listing_platform_ids (Sprint 105)
 * 3. Build a set of "already linked" URLs (combine both sources)
 * 4. Check which HIGH_VALUE_SAMEAS_PLATFORMS are missing from the "already linked" set
 * 5. For each missing platform, check if the business has a listing there
 *    (query listing_platform_ids for that platform)
 * 6. If listed but not in sameAs → SameAsGap (already_in_schema=false, easy win)
 * 7. If not listed → SameAsGap with higher effort (need to claim first)
 * 8. Special case: Wikidata — check via Wikidata API if entity exists
 * 9. Special case: Wikipedia — check if business name appears on any Wikipedia page
 *
 * Returns: SameAsGap[] ordered by estimated_impact DESC
 * Never throws — returns [] on failure.
 */
export async function detectSameAsGaps(
  supabase: ReturnType<typeof createServiceRoleClient>,
  groundTruth: GroundTruth,
  locationId: string,
  detectedCitations: CitationSource[],
): Promise<SameAsGap[]> { ... }

/**
 * Checks the Wikidata API for an entity matching the business name + city.
 * Wikidata SPARQL endpoint: https://query.wikidata.org/sparql
 * Query: wikibase:label for business name + P131 (located in) for city
 *
 * IMPORTANT: The Wikidata public API is free and requires no key.
 * Timeout: 5 seconds. On timeout → return { found: false }.
 * Never throw.
 *
 * Returns: { found: boolean; wikidataUrl?: string; qId?: string }
 */
export async function checkWikidataEntity(
  businessName: string,
  city: string,
): Promise<{ found: boolean; wikidataUrl?: string; qId?: string }> { ... }

/**
 * Generates the action_instructions string for a sameAs gap.
 * Pure function.
 *
 * Examples by platform:
 * - wikidata (not found): "Create a Wikidata item for [businessName]:
 *   1. Go to wikidata.org and create a free account.
 *   2. Click 'Create new item'.
 *   3. Add label: '[businessName]'.
 *   4. Add P31 (instance of): Q11707 (restaurant) or Q1569659 (hookah lounge).
 *   5. Add P131 (located in): [city's Wikidata QID].
 *   6. Add P856 (official website): [website URL].
 *   Once published, add the Wikidata URL to your schema sameAs."
 * - yelp (listed but not in sameAs): "Your Yelp listing exists.
 *   Add [yelp_url] to your schema sameAs to link them."
 * - wikipedia: "Search Wikipedia for '[category] in [city]' lists.
 *   If your business qualifies, request addition. This is a high-value Tier 1 citation."
 */
export function generateSameAsInstructions(
  platform: string,
  businessName: string,
  city: string,
  existingUrl?: string,
): { action_label: string; action_instructions: string; effort: 'low' | 'medium' | 'high' } { ... }

/**
 * High-value sameAs platforms in priority order.
 * Used to generate the SameAsGap list.
 */
export const HIGH_VALUE_SAMEAS_PLATFORMS: Array<{
  platform: string;
  tier: AuthorityTier;
  estimated_impact: 'high' | 'medium' | 'low';
}> = [
  { platform: 'wikidata',     tier: 'tier2', estimated_impact: 'high' },
  { platform: 'wikipedia',    tier: 'tier2', estimated_impact: 'high' },
  { platform: 'yelp',         tier: 'tier2', estimated_impact: 'high' },
  { platform: 'tripadvisor',  tier: 'tier2', estimated_impact: 'high' },
  { platform: 'google_maps',  tier: 'tier2', estimated_impact: 'medium' },
  { platform: 'apple_maps',   tier: 'tier2', estimated_impact: 'medium' },
  { platform: 'facebook',     tier: 'tier2', estimated_impact: 'medium' },
  { platform: 'foursquare',   tier: 'tier2', estimated_impact: 'low' },
  { platform: 'opentable',    tier: 'tier2', estimated_impact: 'low' },
];
```

---

### Component 5: Citation Velocity Monitor — `lib/authority/citation-velocity-monitor.ts`

```typescript
/**
 * Stores a monthly authority snapshot for a location.
 * Called at the end of each successful authority mapping run.
 * Uses snapshot_month = current YYYY-MM to prevent duplicate snapshots in the same month.
 * Uses UPSERT on (location_id, snapshot_month) unique constraint.
 */
export async function saveAuthoritySnapshot(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
  profile: EntityAuthorityProfile,
): Promise<void> { ... }

/**
 * Computes velocity: the % change in total citations vs. the previous month's snapshot.
 * formula: velocity = (current_total - previous_total) / previous_total × 100
 *
 * Returns: number (e.g. 15.0 = +15%, -22.5 = -22.5%) or null (no previous snapshot).
 */
export async function computeCitationVelocity(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  currentTierBreakdown: { tier1: number; tier2: number; tier3: number },
): Promise<number | null> { ... }

/**
 * Checks if this location should trigger a "Citation Decay Alert".
 * Condition: velocity < -20% (month-over-month total citation decline > 20%)
 * When true: creates an Autopilot draft with trigger_type = 'prompt_missing'
 * targeting the queries most likely behind the decline.
 *
 * Uses createDraft() from lib/autopilot/create-draft.ts (Sprint 86).
 */
export async function checkAndAlertDecay(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
  velocity: number,
  groundTruth: GroundTruth,
): Promise<{ alerted: boolean; draftCreated: boolean }> { ... }

/**
 * Returns the last 6 months of authority snapshots for a location.
 * Used to render the velocity trend chart in the dashboard.
 */
export async function getAuthorityHistory(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  months?: number,  // default: 6
): Promise<AuthoritySnapshot[]> { ... }
```

---

### Component 6: Authority Recommendations Engine — `lib/authority/authority-recommendations.ts`

```typescript
/**
 * Generates a prioritized list of actionable recommendations for improving authority.
 * Pure function — no I/O.
 *
 * Recommendation generation rules (evaluated in order — up to 5 total):
 *
 * PRIORITY 1 (highest impact):
 * - If tier1_citations === 0: "Get featured in local press"
 *   → Suggests reaching out to local news sites or submitting a press release
 *   → autopilot_trigger: true (can auto-draft a press release brief)
 *   → estimated_score_gain: 15–30 pts
 *
 * - If velocity < -20%: "Citation decline alert — publish new content immediately"
 *   → autopilot_trigger: true
 *   → estimated_score_gain: 10 pts
 *
 * PRIORITY 2:
 * - If any HIGH_VALUE_SAMEAS_PLATFORMS with estimated_impact='high' not in sameAs:
 *   → "Add [platform] to your sameAs links"
 *   → effort: 'low' (if listing exists) or 'medium' (if not yet claimed)
 *   → estimated_score_gain: 3–8 pts per platform (capped at first 3 gaps)
 *
 * - If platform_breadth < 4: "Get listed on [missing Tier 2 platform]"
 *   → autopilot_trigger: false (listing claim, not content)
 *   → estimated_score_gain: 5 pts per platform
 *
 * PRIORITY 3:
 * - If tier2_citations < 3: "Increase review volume on [best-cited Tier 2 platform]"
 *   → Links to review intelligence recommendation
 *   → estimated_score_gain: 3–5 pts
 *
 * - If sameAs_count < 3: "Add more entity links to your homepage schema"
 *   → Lists specific platforms with easy-add instructions
 *   → estimated_score_gain: 5 pts
 *
 * Returns: AuthorityRecommendation[] sorted by priority ASC, then estimated_score_gain DESC.
 * Maximum 5 recommendations.
 */
export function generateRecommendations(
  profile: Omit<EntityAuthorityProfile, 'recommendations'>,
  sameAsGaps: SameAsGap[],
): AuthorityRecommendation[] { ... }

/**
 * Generates the recommendation for Tier 1 citation gap.
 * Pure function.
 * Uses groundTruth to personalize (e.g. "Contact AJC Food & Dining" for Atlanta businesses).
 */
export function buildTier1CitationRecommendation(
  groundTruth: GroundTruth,
  tier1Count: number,
): AuthorityRecommendation { ... }

/**
 * Generates the recommendation for citation velocity decline.
 * Pure function.
 */
export function buildVelocityDecayRecommendation(
  velocity: number,
  topDeclinedTier: AuthorityTier,
): AuthorityRecommendation { ... }
```

---

### Component 7: Authority Service Orchestrator — `lib/authority/authority-service.ts`

```typescript
/**
 * Runs the full semantic authority mapping for a single location.
 *
 * Flow:
 * 1. Fetch GroundTruth for locationId (name, category, city, state, website)
 * 2. Detect citation sources — detectCitationSources() → CitationSource[]
 * 3. Count active platforms — countActivePlatforms()
 * 4. Count existing sameAs URLs — countSameAsUrls()
 * 5. Compute velocity — computeCitationVelocity()
 * 6. Compute authority score — computeAuthorityScore()
 * 7. Detect sameAs gaps — detectSameAsGaps()
 * 8. Generate recommendations — generateRecommendations()
 * 9. Build EntityAuthorityProfile
 * 10. Save snapshot — saveAuthoritySnapshot()
 * 11. Upsert to entity_authority_profiles table
 * 12. Check decay and trigger Autopilot draft if needed — checkAndAlertDecay()
 * 13. Update locations.authority_score + locations.authority_last_run_at
 * 14. Return AuthorityMappingResult
 *
 * Uses createServiceRoleClient().
 * Never throws — returns partial results with errors array.
 */
export async function runAuthorityMapping(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
): Promise<AuthorityMappingResult> { ... }

/**
 * Runs authority mapping for ALL active Growth+ locations.
 * Called by the monthly authority cron.
 * Sequential processing — rate limit protection (5 Perplexity queries per location).
 * 1 second sleep between locations.
 */
export async function runAuthorityMappingForAllLocations(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<{ processed: number; total_score_avg: number; errors: number }> { ... }
```

---

### Component 8: API Routes

#### `app/api/authority/run/route.ts`

```typescript
/**
 * POST /api/authority/run
 * On-demand authority mapping for the authenticated user's location.
 *
 * Error codes:
 * - "unauthorized"           — no session
 * - "plan_upgrade_required"  — Starter (Growth+ only)
 * - "no_location"            — org has no location
 * - "run_failed"             — runAuthorityMapping threw
 */
export async function POST(request: Request) { ... }
```

#### `app/api/authority/status/route.ts`

```typescript
/**
 * GET /api/authority/status
 * Returns the current EntityAuthorityProfile + last 6 months of snapshots
 * for the authenticated user's location.
 *
 * Response:
 * {
 *   profile: EntityAuthorityProfile | null,
 *   history: AuthoritySnapshot[],         // Last 6 months, asc order
 *   last_run_at: string | null,
 * }
 *
 * Returns 200 with profile=null if authority mapping has never been run.
 */
export async function GET(request: Request) { ... }
```

#### `app/api/authority/sameas/route.ts`

```typescript
/**
 * GET /api/authority/sameas
 * Returns current sameAs gaps and existing sameAs URLs for the location.
 *
 * Response:
 * {
 *   existing_sameas: string[],         // Currently in homepage schema
 *   gaps: SameAsGap[],                 // Missing high-value platforms
 * }
 *
 * POST /api/authority/sameas
 * Adds a sameAs URL to the homepage schema.
 * Body: { url: string }
 *
 * Flow:
 * 1. Validate URL (must be https://, must be in KNOWN_TIER2_DOMAINS or manually approved)
 * 2. Fetch homepage page_schemas row for this location
 * 3. Add URL to json_ld.sameAs array (deduplicated)
 * 4. Update page_schemas row
 * 5. Ping IndexNow (reuse lib/indexnow.ts — Sprint 89 pattern)
 * 6. Return { ok: true, sameas_count: number }
 */
export async function GET(request: Request) { ... }
export async function POST(request: Request) { ... }
```

#### `app/api/cron/authority-mapping/route.ts`

```typescript
/**
 * GET /api/cron/authority-mapping
 * Monthly authority mapping cron.
 * Schedule: 1st of month, 5 AM UTC (after NAP sync at 3AM, schema drift at 4AM)
 * Security: CRON_SECRET header.
 *
 * Runs runAuthorityMappingForAllLocations().
 * After completion, updates Reality Score DataHealth component for affected orgs.
 */
export async function GET(request: Request) { ... }
```

**Update `vercel.json`:**
```json
{
  "crons": [
    { "path": "/api/cron/sov",               "schedule": "0 2 * * 1" },
    { "path": "/api/cron/nap-sync",          "schedule": "0 3 * * 1" },
    { "path": "/api/cron/schema-drift",      "schedule": "0 4 1 * *" },
    { "path": "/api/cron/review-sync",       "schedule": "0 1 * * 0" },
    { "path": "/api/cron/autopilot",         "schedule": "0 2 * * 3" },
    { "path": "/api/cron/authority-mapping", "schedule": "0 5 1 * *" }
  ]
}
```

---

### Component 9: Migration

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 108: Semantic Authority Mapping — New Tables + Columns
-- ══════════════════════════════════════════════════════════════

-- 1. entity_authority_citations — per-tenant citation tracking
--    NOTE: citation_source_intelligence is AGGREGATE market data (not touched here)
--    This table is per-TENANT, per-RUN.
CREATE TABLE IF NOT EXISTS public.entity_authority_citations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id             uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  url                text        NOT NULL,
  domain             text        NOT NULL,
  tier               text        NOT NULL CHECK (tier IN ('tier1','tier2','tier3','unknown')),
  source_type        text        NOT NULL,
  snippet            text,
  sentiment          text        CHECK (sentiment IN ('positive','neutral','negative','unknown'))
                                 DEFAULT 'unknown',
  is_sameas_candidate boolean    NOT NULL DEFAULT false,
  detected_at        timestamptz NOT NULL DEFAULT now(),
  run_month          text        NOT NULL,   -- YYYY-MM: which cron run produced this
  UNIQUE (location_id, url, run_month)       -- One record per URL per monthly run
);

ALTER TABLE public.entity_authority_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authority_citations: org members read own"
  ON public.entity_authority_citations FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "authority_citations: service role full access"
  ON public.entity_authority_citations USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_authority_citations_location_month
  ON public.entity_authority_citations (location_id, run_month);

CREATE INDEX IF NOT EXISTS idx_authority_citations_tier
  ON public.entity_authority_citations (location_id, tier, detected_at DESC);

COMMENT ON TABLE public.entity_authority_citations IS
  'Per-tenant citation sources detected via Perplexity Sonar. Sprint 108.
   Distinct from citation_source_intelligence (aggregate market data).';

-- ──────────────────────────────────────────────────────────────

-- 2. entity_authority_profiles — current authority state per location
CREATE TABLE IF NOT EXISTS public.entity_authority_profiles (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                   uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  entity_authority_score   integer     NOT NULL CHECK (entity_authority_score BETWEEN 0 AND 100),

  -- Dimension scores (denormalized for fast dashboard queries)
  tier1_citation_score     integer     NOT NULL DEFAULT 0,
  tier2_coverage_score     integer     NOT NULL DEFAULT 0,
  platform_breadth_score   integer     NOT NULL DEFAULT 0,
  sameas_score             integer     NOT NULL DEFAULT 0,
  velocity_score           integer     NOT NULL DEFAULT 5,

  -- Tier counts
  tier1_count              integer     NOT NULL DEFAULT 0,
  tier2_count              integer     NOT NULL DEFAULT 0,
  tier3_count              integer     NOT NULL DEFAULT 0,

  -- sameAs state
  sameas_gaps              jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- SameAsGap[]
  sameas_count             integer     NOT NULL DEFAULT 0,

  -- Velocity
  citation_velocity        numeric(6,2),   -- % change. NULL = first run
  velocity_label           text        CHECK (velocity_label IN ('growing','stable','declining','unknown'))
                                       DEFAULT 'unknown',

  -- Recommendations
  recommendations          jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- AuthorityRecommendation[]

  -- Metadata
  snapshot_at              timestamptz NOT NULL DEFAULT now(),
  last_run_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id)  -- One profile per location (upsert on update)
);

ALTER TABLE public.entity_authority_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authority_profiles: org members read own"
  ON public.entity_authority_profiles FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "authority_profiles: service role full access"
  ON public.entity_authority_profiles USING (auth.role() = 'service_role');

COMMENT ON TABLE public.entity_authority_profiles IS
  'Current entity authority state per location. Upserted monthly. Sprint 108.';

-- ──────────────────────────────────────────────────────────────

-- 3. entity_authority_snapshots — monthly history for velocity calculation
CREATE TABLE IF NOT EXISTS public.entity_authority_snapshots (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                 uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  entity_authority_score integer     NOT NULL,
  tier1_count            integer     NOT NULL DEFAULT 0,
  tier2_count            integer     NOT NULL DEFAULT 0,
  tier3_count            integer     NOT NULL DEFAULT 0,
  total_citations        integer     NOT NULL DEFAULT 0,
  sameas_count           integer     NOT NULL DEFAULT 0,
  snapshot_month         text        NOT NULL,   -- YYYY-MM
  created_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id, snapshot_month)  -- One snapshot per location per month
);

ALTER TABLE public.entity_authority_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authority_snapshots: org members read own"
  ON public.entity_authority_snapshots FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "authority_snapshots: service role full access"
  ON public.entity_authority_snapshots USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_authority_snapshots_location_month
  ON public.entity_authority_snapshots (location_id, snapshot_month DESC);

COMMENT ON TABLE public.entity_authority_snapshots IS
  'Monthly authority score history for velocity trending. Sprint 108.';

-- ──────────────────────────────────────────────────────────────

-- 4. Add authority columns to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS authority_score        integer CHECK (authority_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS authority_last_run_at  timestamptz;

COMMENT ON COLUMN public.locations.authority_score IS
  'Entity authority score 0–100. NULL = never run. Sprint 108.';
```

**Update `prod_schema.sql`**, **`database.types.ts`** — add all three new tables and two new location columns.

---

### Component 10: Seed Data — `supabase/seed.sql`

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 108: Authority Mapping seed for golden tenant
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_location_id uuid;
  v_org_id      uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  SELECT id INTO v_location_id FROM public.locations WHERE org_id = v_org_id LIMIT 1;

  -- Seed authority profile (realistic starting state for Charcoal N Chill)
  INSERT INTO public.entity_authority_profiles (
    location_id, org_id,
    entity_authority_score,
    tier1_citation_score, tier2_coverage_score, platform_breadth_score,
    sameas_score, velocity_score,
    tier1_count, tier2_count, tier3_count,
    sameas_count, citation_velocity, velocity_label,
    sameas_gaps, recommendations
  ) VALUES (
    v_location_id, v_org_id,
    58,      -- Entity authority score 58/100 — real gap to address
    0,       -- No Tier 1 press citations yet (biggest gap)
    15,      -- 3 Tier 2 sources detected (Google, Yelp, Facebook)
    12,      -- 3 active platforms (below the 4+ threshold)
    9,       -- 3 sameAs URLs in schema
    5,       -- First run, neutral velocity
    0, 3, 4,
    3,
    NULL,    -- First run — no velocity yet
    'unknown',
    '[
      {
        "url": "",
        "platform": "wikidata",
        "tier": "tier2",
        "estimated_impact": "high",
        "action_label": "Create a Wikidata entity for Charcoal N Chill",
        "action_instructions": "Go to wikidata.org, create a free account, and create a new item for Charcoal N Chill as a hookah lounge (Q1569659) located in Alpharetta, GA.",
        "already_in_schema": false
      },
      {
        "url": "",
        "platform": "tripadvisor",
        "tier": "tier2",
        "estimated_impact": "high",
        "action_label": "Claim your TripAdvisor listing",
        "action_instructions": "Visit tripadvisor.com/owners and search for Charcoal N Chill to claim your listing. Once claimed, add it to your schema sameAs.",
        "already_in_schema": false
      }
    ]'::jsonb,
    '[
      {
        "priority": 1,
        "category": "tier1_citation",
        "title": "Get featured in Atlanta local press",
        "description": "No Tier 1 press citations found. A single mention in AJC, Eater Atlanta, or a local news blog would add 15–30 points to your authority score.",
        "estimated_score_gain": 22,
        "effort": "high",
        "action_type": "outreach",
        "autopilot_trigger": true
      },
      {
        "priority": 2,
        "category": "sameas",
        "title": "Add Wikidata entity link to your schema",
        "description": "Wikidata is the #1 Knowledge Graph source used by Google AI. Creating an entity and linking it adds a strong Tier 2 authority signal.",
        "estimated_score_gain": 8,
        "effort": "medium",
        "action_type": "add_sameas",
        "autopilot_trigger": false
      }
    ]'::jsonb
  )
  ON CONFLICT (location_id) DO NOTHING;

  -- Seed 2 months of historical snapshots
  INSERT INTO public.entity_authority_snapshots (
    location_id, org_id, entity_authority_score,
    tier1_count, tier2_count, tier3_count,
    total_citations, sameas_count, snapshot_month
  ) VALUES
    (v_location_id, v_org_id, 52, 0, 2, 3, 5, 2, '2026-01'),
    (v_location_id, v_org_id, 55, 0, 3, 3, 6, 3, '2026-02')
  ON CONFLICT (location_id, snapshot_month) DO NOTHING;

  -- Seed 5 detected citation sources
  INSERT INTO public.entity_authority_citations (
    location_id, org_id, url, domain, tier, source_type,
    snippet, sentiment, is_sameas_candidate, run_month
  ) VALUES
    (v_location_id, v_org_id,
     'https://www.yelp.com/biz/charcoal-n-chill-alpharetta', 'yelp.com',
     'tier2', 'yelp',
     'Charcoal N Chill: Premium hookah lounge in Alpharetta, GA. 163 reviews · 4.3 stars',
     'positive', true, '2026-03'),
    (v_location_id, v_org_id,
     'https://www.facebook.com/charcoalnchill', 'facebook.com',
     'tier2', 'facebook',
     'Charcoal N Chill hookah lounge and Indo-American fusion restaurant in Alpharetta',
     'neutral', true, '2026-03'),
    (v_location_id, v_org_id,
     'https://maps.google.com/?cid=527487414899304357', 'google.com',
     'tier2', 'google_maps',
     'Charcoal N Chill · Hookah bar · 11950 Jones Bridge Rd, Alpharetta',
     'positive', true, '2026-03'),
    (v_location_id, v_org_id,
     'https://www.bestrestaurantsalpharetta.com/hookah', 'bestrestaurantsalpharetta.com',
     'tier3', 'aggregator_blog',
     'Top 5 Hookah Lounges in Alpharetta — #2: Charcoal N Chill',
     'positive', false, '2026-03'),
    (v_location_id, v_org_id,
     'https://www.reddit.com/r/atlanta/comments/hookah_alpharetta/', 'reddit.com',
     'tier2', 'reddit',
     'r/Atlanta: Best hookah spots near Alpharetta? Charcoal N Chill mentioned 3 times',
     'positive', false, '2026-03')
  ON CONFLICT (location_id, url, run_month) DO NOTHING;

  -- Update location authority state
  UPDATE public.locations
     SET authority_score       = 58,
         authority_last_run_at = NOW() - INTERVAL '1 day'
   WHERE id = v_location_id;
END $$;
```

---

### Component 11: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
// Sprint 108 — Semantic Authority Mapping fixtures

export const MOCK_CITATION_SOURCES: CitationSource[] = [
  {
    url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta',
    domain: 'yelp.com',
    tier: 'tier2', source_type: 'yelp',
    snippet: 'Charcoal N Chill: Premium hookah lounge in Alpharetta, GA. 163 reviews.',
    detected_at: '2026-03-01T05:00:00.000Z',
    sentiment: 'positive', is_sameas_candidate: true,
  },
  {
    url: 'https://www.reddit.com/r/atlanta/comments/hookah_alpharetta',
    domain: 'reddit.com',
    tier: 'tier2', source_type: 'reddit',
    snippet: 'Best hookah spots near Alpharetta? Charcoal N Chill mentioned 3 times.',
    detected_at: '2026-03-01T05:00:00.000Z',
    sentiment: 'positive', is_sameas_candidate: false,
  },
  {
    url: 'https://www.bestrestaurantsalpharetta.com/hookah',
    domain: 'bestrestaurantsalpharetta.com',
    tier: 'tier3', source_type: 'aggregator_blog',
    snippet: 'Top 5 Hookah Lounges in Alpharetta — #2: Charcoal N Chill.',
    detected_at: '2026-03-01T05:00:00.000Z',
    sentiment: 'positive', is_sameas_candidate: false,
  },
];

export const MOCK_SAMEAS_GAPS: SameAsGap[] = [
  {
    url: '',
    platform: 'wikidata',
    tier: 'tier2',
    estimated_impact: 'high',
    action_label: 'Create a Wikidata entity for Charcoal N Chill',
    action_instructions: 'Go to wikidata.org and create a new item...',
    already_in_schema: false,
  },
  {
    url: '',
    platform: 'tripadvisor',
    tier: 'tier2',
    estimated_impact: 'high',
    action_label: 'Claim your TripAdvisor listing',
    action_instructions: 'Visit tripadvisor.com/owners and search for Charcoal N Chill...',
    already_in_schema: false,
  },
];

export const MOCK_AUTHORITY_DIMENSIONS: AuthorityDimensions = {
  tier1_citation_score: 0,
  tier2_coverage_score: 15,
  platform_breadth_score: 12,
  sameas_score: 9,
  velocity_score: 5,
};

export const MOCK_AUTHORITY_PROFILE: EntityAuthorityProfile = {
  location_id: 'loc-golden-tenant-id',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  entity_authority_score: 58,
  dimensions: MOCK_AUTHORITY_DIMENSIONS,
  tier_breakdown: { tier1: 0, tier2: 3, tier3: 4, unknown: 0 },
  top_citations: MOCK_CITATION_SOURCES,
  sameas_gaps: MOCK_SAMEAS_GAPS,
  citation_velocity: null,
  velocity_label: 'unknown',
  recommendations: [],
  snapshot_at: '2026-03-01T05:00:00.000Z',
};

export const MOCK_AUTHORITY_SNAPSHOTS: AuthoritySnapshot[] = [
  { id: 'snap-001', location_id: 'loc-golden-tenant-id', org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    entity_authority_score: 52, tier1_count: 0, tier2_count: 2, tier3_count: 3,
    total_citations: 5, sameas_count: 2, snapshot_month: '2026-01', created_at: '2026-01-01T05:00:00Z' },
  { id: 'snap-002', location_id: 'loc-golden-tenant-id', org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    entity_authority_score: 55, tier1_count: 0, tier2_count: 3, tier3_count: 3,
    total_citations: 6, sameas_count: 3, snapshot_month: '2026-02', created_at: '2026-02-01T05:00:00Z' },
];
```

---

### Component 12: Authority Panel — `app/dashboard/_components/AuthorityPanel.tsx`

```
┌────────────────────────────────────────────────────────────────────┐
│  🏛️  Semantic Authority                  Score: 58/100   Grade: C  │
│  Last mapped: yesterday   [Re-map Now →]                           │
├────────────────────────────────────────────────────────────────────┤
│  🔴 CRITICAL GAP: No Tier 1 press citations found                  │
│  A single mention in local news adds 15–30 points to your score.   │
├─────────────────────────────────┬──────────────────────────────────┤
│  SCORE BREAKDOWN                │  CITATION SOURCES (7 total)      │
│  ─────────────────────────────  │  ──────────────────────────────  │
│  Tier 1 Citations     0/30  ❌  │  🔴 Tier 1 (Press/Gov)   0       │
│  Tier 2 Coverage     15/25  ⚠️  │  🟡 Tier 2 (Platforms)   3       │
│  Platform Breadth    12/20  ⚠️  │  ⚪ Tier 3 (Blogs)        4       │
│  sameAs Links         9/15  ⚠️  │                                   │
│  Velocity             5/10  —   │  Reddit mention detected ✓        │
├─────────────────────────────────┼──────────────────────────────────┤
│  VELOCITY TREND (6 months)      │  TOP RECOMMENDATIONS             │
│  [sparkline chart: 52→55→58]   │  1. 🔴 Get Atlanta press coverage │
│                                 │     +22 pts  ·  High effort       │
│  ↑ +5.5% / month (stable)      │     [Create Press Brief →]        │
│                                 │  2. ⚠️  Add Wikidata entity link  │
│                                 │     +8 pts  ·  Medium effort      │
│                                 │     [Add to Schema →]             │
├─────────────────────────────────┴──────────────────────────────────┤
│  SAMEAS GAPS (2 missing)                                            │
│  Wikidata: Not linked  [How to create entity →]                     │
│  TripAdvisor: Not linked  [Claim listing →]                         │
└────────────────────────────────────────────────────────────────────┘
```

**Implementation rules:**
- `'use client'` — loads via `GET /api/authority/status`
- Plan gate: Growth+ only
- Score colored: ≥80 green, 60–79 yellow, <60 red
- Letter grade: A (90+), B (80–89), C (60–79), D (40–59), F (<40)
- "Create Press Brief →" on Tier 1 recommendation: calls `POST /api/autopilot/drafts` with `{ trigger_type: 'manual', content_type: 'blog_post', target_query: 'local press feature {businessName} {city}', additional_context: 'Generate a press release brief for outreach to local Atlanta media' }`
- "Add to Schema →" on sameAs recommendation: opens `SameAsAddModal`
- Velocity sparkline: simple SVG line chart, last 6 months, dots at each snapshot
- Skeleton loading while data fetches
- All interactive elements: `data-testid` attributes required

---

### Component 13: sameAs Add Modal — `app/dashboard/_components/SameAsAddModal.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  🔗 Add sameAs Link — Wikidata                                   │
│  ──────────────────────────────────────────────────────────────  │
│  Wikidata is the #1 Knowledge Graph source used by Google AI.    │
│  Linking your business entity adds a strong authority signal.    │
│                                                                   │
│  Steps to create your Wikidata entity:                           │
│  1. Go to wikidata.org and create a free account                 │
│  2. Click 'Create new item'                                      │
│  3. Add label: 'Charcoal N Chill'                               │
│  4. Add P31 (instance of): Q1569659 (hookah lounge)             │
│  5. Add P856 (official website): charcoalnchill.com              │
│  6. Copy the Wikidata URL from your browser                      │
│                                                                   │
│  Once you have the Wikidata URL, paste it below:                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ https://www.wikidata.org/wiki/Q...                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ──────────────────────────────────────────────────────────────  │
│  [Cancel]                                  [✅ Add to Schema]    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/citation-source-detector.test.ts`

**Pure functions — zero mocks.**

```
describe('classifySourceTier')
  1.  'yelp.com' → { tier: 'tier2', sourceType: 'yelp' }
  2.  'tripadvisor.com' → { tier: 'tier2', sourceType: 'tripadvisor' }
  3.  'reddit.com' → { tier: 'tier2', sourceType: 'reddit' }
  4.  'wikidata.org' → { tier: 'tier2', sourceType: 'wikidata' }
  5.  'en.wikipedia.org' → { tier: 'tier2', sourceType: 'wikipedia' }
  6.  'whitehouse.gov' → { tier: 'tier1', sourceType: 'government' }
  7.  'gatech.edu' → { tier: 'tier1', sourceType: 'academic' }
  8.  'ajc.com' → { tier: 'tier1', sourceType: 'regional_news' }
  9.  'charcoalnchill.com' (business own domain) → { tier: 'tier1', sourceType: 'brand_website' }
  10. 'bestrestaurantsalpharetta.com' → { tier: 'tier3', sourceType: 'aggregator_blog' }
  11. 'eater.com' → { tier: 'tier2', sourceType: 'industry_guide' }
  12. 'unknown-blog.net' → { tier: 'tier3', sourceType: 'other' }
  13. URL with 'www.' prefix stripped correctly
  14. invalid URL (no https://) → { tier: 'unknown', sourceType: 'other' } (no throw)

describe('isSameAsCandidate')
  15. Yelp /biz/charcoal-n-chill-alpharetta → true (business-specific URL)
  16. Yelp /search?find_desc=hookah → false (category search, not business page)
  17. Google Maps CID URL → true
  18. Wikipedia main article page → true
  19. Reddit thread URL → false (not a dedicated business page)
  20. TripAdvisor restaurant page for this business → true
```

**20 tests. Zero mocks.**

---

### Test File 2: `src/__tests__/unit/entity-authority-scorer.test.ts`

**Pure functions — zero mocks.**

```
describe('computeAuthorityScore')
  1.  0 Tier 1, 3 Tier 2, 3 platforms, 3 sameAs, null velocity → score ~41
  2.  3 Tier 1, 5 Tier 2, 5 platforms, 5 sameAs, +15% velocity → score = 100
  3.  0 everything → score = 5 (velocity neutral baseline only)
  4.  score is always between 0 and 100
  5.  MOCK_CITATION_SOURCES → score matches MOCK_AUTHORITY_PROFILE.entity_authority_score (~58)
  6.  tier1_citation_score: 1 citation → 15pts, 2 → 22pts, 3+ → 30pts
  7.  tier2_coverage_score: capped at 25 (5+ sources)
  8.  platform_breadth_score: 4 platforms → 12pts, 5+ → 20pts
  9.  velocity_score: < -20% → 0pts, >= +10% → 10pts

describe('getVelocityLabel')
  10. +15% → 'growing'
  11. +5% → 'stable'
  12. -5% → 'stable'
  13. -15% → 'declining'
  14. -25% → 'declining'
  15. null → 'unknown'
```

**15 tests. Zero mocks.**

---

### Test File 3: `src/__tests__/unit/sameas-enricher.test.ts`

**Pure + Supabase mocked + Wikidata API mocked.**

```
describe('generateSameAsInstructions')
  1.  wikidata (not found) → instructions include wikidata.org steps
  2.  yelp (exists, not in schema) → action_label includes 'Add to schema', effort 'low'
  3.  tripadvisor (not claimed) → action_label includes 'Claim', effort 'medium'
  4.  wikipedia → instructions mention contacting Wikipedia editors, effort 'high'

describe('checkWikidataEntity')
  5.  Wikidata API returns match → { found: true, wikidataUrl, qId }
  6.  Wikidata API returns no match → { found: false }
  7.  Wikidata API times out → { found: false } (no throw)
  8.  Wikidata API returns error → { found: false } (no throw)

describe('detectSameAsGaps — Supabase mocked')
  9.  Yelp in listing_platform_ids but NOT in page_schemas sameAs → gap returned
  10. Yelp in listing_platform_ids AND in page_schemas sameAs → gap not returned (already_in_schema=true filtered out)
  11. Platform not in listing_platform_ids → gap returned with effort 'medium' (need to claim)
  12. Wikidata not found → gap with effort 'medium' (needs creation)
  13. Returns gaps sorted by estimated_impact high → medium → low
  14. Returns empty array if all HIGH_VALUE_SAMEAS_PLATFORMS already linked
```

**14 tests.**

---

### Test File 4: `src/__tests__/unit/citation-velocity-monitor.test.ts`

**Supabase mocked.**

```
describe('computeCitationVelocity')
  1.  previous snapshot has 5 citations, current has 6 → velocity = +20.0
  2.  previous snapshot has 8 citations, current has 6 → velocity = -25.0
  3.  no previous snapshot → null
  4.  previous snapshot has 0 citations → null (avoid divide-by-zero)
  5.  velocity rounds to 1 decimal place

describe('checkAndAlertDecay')
  6.  velocity = -25 → alerted: true, calls createDraft()
  7.  velocity = -15 → alerted: false (above -20% threshold)
  8.  velocity = +10 → alerted: false
  9.  createDraft called with trigger_type = 'prompt_missing' when decay alert fires
  10. does not create duplicate decay draft within same month (dedup check)

describe('getAuthorityHistory')
  11. returns snapshots in chronological order (asc)
  12. limits to requested months count
  13. returns empty array when no snapshots exist (no throw)
```

**13 tests.**

---

### Test File 5: `src/__tests__/unit/authority-recommendations.test.ts`

**Pure functions — zero mocks.**

```
describe('generateRecommendations')
  1.  0 Tier 1 citations → first recommendation is tier1_citation gap (priority 1)
  2.  velocity < -20% → velocity_recovery recommendation included
  3.  returns max 5 recommendations
  4.  recommendations sorted by priority ASC
  5.  sameAs gaps with high impact → sameas recommendation included (priority 2)
  6.  platform_breadth < 4 → platform_breadth recommendation included
  7.  all signals healthy → returns low-priority minor recommendations only
  8.  autopilot_trigger: true on tier1_citation recommendation

describe('buildTier1CitationRecommendation')
  9.  Atlanta business → description mentions 'AJC' or 'Eater Atlanta'
  10. estimated_score_gain between 15 and 30

describe('buildVelocityDecayRecommendation')
  11. velocity = -25 → title includes 'Citation decline alert'
  12. autopilot_trigger: true
```

**12 tests. Zero mocks.**

---

### Test File 6: `src/__tests__/unit/authority-routes.test.ts`

```
describe('POST /api/authority/run')
  1.  returns 401 when not authenticated
  2.  returns 403 with 'plan_upgrade_required' for Starter
  3.  returns { ok: true, result: AuthorityMappingResult } on success
  4.  calls runAuthorityMapping with correct location_id + org_id

describe('GET /api/authority/status')
  5.  returns { profile, history, last_run_at } on success
  6.  returns profile: null when never run (200, not 404)
  7.  returns history as array sorted chronologically

describe('GET /api/authority/sameas')
  8.  returns { existing_sameas, gaps } for authenticated user

describe('POST /api/authority/sameas')
  9.  validates URL must be https://
  10. adds URL to page_schemas.json_ld sameAs array
  11. calls IndexNow ping after update
  12. returns 422 for non-https URL
  13. deduplicates — adding same URL twice = ok, count stays same
```

**13 tests.**

---

### Test File 7: `src/__tests__/e2e/authority-panel.spec.ts` — Playwright

```typescript
describe('Authority Panel', () => {
  test('renders panel with score and tier breakdown', async ({ page }) => {
    // Mock GET /api/authority/status → { profile: MOCK_AUTHORITY_PROFILE, history: MOCK_AUTHORITY_SNAPSHOTS }
    // Navigate to /dashboard
    // Assert: "Semantic Authority" panel visible (data-testid="authority-panel")
    // Assert: "58/100" score visible
    // Assert: "Grade: C" visible
    // Assert: tier breakdown shows 0 Tier 1, 3 Tier 2, 4 Tier 3
  });

  test('critical gap banner shown when Tier 1 citations = 0', async ({ page }) => {
    // Assert: red alert banner "No Tier 1 press citations found" visible
  });

  test('velocity sparkline renders with 2 data points', async ({ page }) => {
    // Assert: sparkline SVG element present (data-testid="velocity-sparkline")
    // Assert: stable velocity label visible
  });

  test('recommendation Create Press Brief triggers autopilot draft', async ({ page }) => {
    // Mock POST /api/autopilot/drafts → { ok: true, draft: { id: 'draft-new' } }
    // Click "Create Press Brief →" on recommendation 1
    // Assert: success toast "Draft created" visible
  });

  test('sameAs gaps listed with Add to Schema action', async ({ page }) => {
    // Assert: "SAMEAS GAPS (2 missing)" section visible
    // Assert: "Wikidata: Not linked" row visible
    // Assert: "Add to Schema →" button for Wikidata (data-testid="sameas-add-wikidata")
  });

  test('SameAs Add Modal opens with instructions', async ({ page }) => {
    // Click "Add to Schema →" for Wikidata
    // Assert: SameAsAddModal opens (data-testid="sameas-add-modal")
    // Assert: Wikidata creation instructions visible
    // Assert: URL input field visible (data-testid="sameas-url-input")
  });

  test('submitting valid Wikidata URL adds to schema', async ({ page }) => {
    // Mock POST /api/authority/sameas → { ok: true, sameas_count: 4 }
    // Type 'https://www.wikidata.org/wiki/Q123456' in URL input
    // Click "Add to Schema"
    // Assert: success state, modal closes
    // Assert: sameAs gaps refreshed (1 remaining)
  });

  test('Re-map Now triggers authority scan', async ({ page }) => {
    // Mock POST /api/authority/run → { ok: true, result: { entity_authority_score: 62 } }
    // Click "Re-map Now →"
    // Assert: loading state on button
    // Assert: score updates after completion
  });

  test('Starter plan sees upgrade prompt', async ({ page }) => {
    // Mock GET /api/authority/status → 403
    // Assert: upgrade prompt visible
  });
});
```

**9 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/citation-source-detector.test.ts   # 20 tests
npx vitest run src/__tests__/unit/entity-authority-scorer.test.ts    # 15 tests
npx vitest run src/__tests__/unit/sameas-enricher.test.ts            # 14 tests
npx vitest run src/__tests__/unit/citation-velocity-monitor.test.ts  # 13 tests
npx vitest run src/__tests__/unit/authority-recommendations.test.ts  # 12 tests
npx vitest run src/__tests__/unit/authority-routes.test.ts           # 13 tests
npx vitest run                                                         # ALL — zero regressions
npx playwright test src/__tests__/e2e/authority-panel.spec.ts        # 9 e2e tests
npx tsc --noEmit                                                       # 0 type errors
```

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/authority/types.ts` | **CREATE** | All shared types |
| 2 | `lib/authority/citation-source-detector.ts` | **CREATE** | Perplexity scan + tier classification |
| 3 | `lib/authority/entity-authority-scorer.ts` | **CREATE** | Score computation |
| 4 | `lib/authority/sameas-enricher.ts` | **CREATE** | sameAs gap detection + Wikidata check |
| 5 | `lib/authority/citation-velocity-monitor.ts` | **CREATE** | Snapshot + velocity + decay alert |
| 6 | `lib/authority/authority-recommendations.ts` | **CREATE** | Recommendation generation |
| 7 | `lib/authority/authority-service.ts` | **CREATE** | Orchestrator + cron runner |
| 8 | `lib/authority/index.ts` | **CREATE** | Barrel export |
| 9 | `app/api/authority/run/route.ts` | **CREATE** | On-demand run |
| 10 | `app/api/authority/status/route.ts` | **CREATE** | Dashboard status + history |
| 11 | `app/api/authority/sameas/route.ts` | **CREATE** | Get/add sameAs links |
| 12 | `app/api/cron/authority-mapping/route.ts` | **CREATE** | Monthly cron |
| 13 | `app/dashboard/_components/AuthorityPanel.tsx` | **CREATE** | Authority dashboard panel |
| 14 | `app/dashboard/_components/SameAsAddModal.tsx` | **CREATE** | sameAs URL add modal |
| 15 | `app/dashboard/page.tsx` | **MODIFY** | Add AuthorityPanel (Growth+ gated) |
| 16 | `vercel.json` | **MODIFY** | Add authority-mapping cron (1st of month, 5 AM UTC) |
| 17 | `supabase/migrations/[timestamp]_authority_mapping.sql` | **CREATE** | 3 new tables + 2 location columns |
| 18 | `supabase/prod_schema.sql` | **MODIFY** | Add new tables + columns |
| 19 | `lib/supabase/database.types.ts` | **MODIFY** | Add authority types |
| 20 | `supabase/seed.sql` | **MODIFY** | Seed profile + 2 snapshots + 5 citations |
| 21 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add 4 authority fixtures |
| 22 | `src/__tests__/unit/citation-source-detector.test.ts` | **CREATE** | 20 tests |
| 23 | `src/__tests__/unit/entity-authority-scorer.test.ts` | **CREATE** | 15 tests |
| 24 | `src/__tests__/unit/sameas-enricher.test.ts` | **CREATE** | 14 tests |
| 25 | `src/__tests__/unit/citation-velocity-monitor.test.ts` | **CREATE** | 13 tests |
| 26 | `src/__tests__/unit/authority-recommendations.test.ts` | **CREATE** | 12 tests |
| 27 | `src/__tests__/unit/authority-routes.test.ts` | **CREATE** | 13 tests |
| 28 | `src/__tests__/e2e/authority-panel.spec.ts` | **CREATE** | 9 Playwright tests |

---

## 🚫 What NOT to Do

1. **DO NOT confuse `entity_authority_citations` with `citation_source_intelligence`** — they are completely different tables. `citation_source_intelligence` is aggregate market data (which platforms AI cites for a category+city). `entity_authority_citations` is per-tenant (which specific URLs cite this specific business). Never write to `citation_source_intelligence` from Sprint 108 code.
2. **DO NOT re-implement the Perplexity Sonar HTTP call** — find the existing call pattern in `lib/sov/` or the Fear Engine and import it. Zero new Perplexity HTTP code.
3. **DO NOT re-implement IndexNow** — use `lib/indexnow.ts` (Sprint 89) when pinging after sameAs update.
4. **DO NOT re-implement GBP token refresh** — not needed in this sprint (no GBP write operations). Authority mapping is read-only to all external APIs.
5. **DO NOT auto-add sameAs URLs to schema** — only the `POST /api/authority/sameas` route (user-initiated) can add sameAs URLs. The detector identifies gaps; the user decides what to add.
6. **DO NOT fabricate citation sources** — the `detectCitationSources()` function only returns URLs actually found in Perplexity Sonar responses. Never generate or infer citation URLs.
7. **DO NOT query Wikidata more than once per run per location** — 5-second timeout, single call, cache result in the authority profile. Wikidata can be slow under load.
8. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
9. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
10. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.
11. **DO NOT edit `middleware.ts`** (AI_RULES §6).
12. **DO NOT run citation detection for Starter plan locations** — plan gate enforced in both on-demand API route and cron. Starter sees the upgrade prompt.
13. **DO NOT make the velocity sparkline depend on an external charting library** — implement it as a simple inline SVG path calculated from the snapshot data. No new chart dependencies.
14. **DO NOT process more than 5 Perplexity queries per location per run** — MAX_QUERIES_PER_RUN = 5 is a hard cost control. $0.025/location/month at current Perplexity pricing.

---

## ✅ Definition of Done

- [ ] `lib/authority/types.ts` — All types: AuthorityTier, CitationSourceType, CitationSource, AuthorityDimensions, EntityAuthorityProfile, SameAsGap, AuthorityRecommendation, AuthoritySnapshot, AuthorityMappingResult
- [ ] `citation-source-detector.ts` — Perplexity reuse, 5 queries, tier classification, sameAs candidate detection, dedup by domain
- [ ] `entity-authority-scorer.ts` — All 5 dimensions, pure, score always 0–100, MOCK_AUTHORITY_PROFILE score validated
- [ ] `sameas-enricher.ts` — Gap detection from listing_platform_ids + page_schemas, Wikidata API with 5s timeout, HIGH_VALUE_SAMEAS_PLATFORMS list, instruction generator
- [ ] `citation-velocity-monitor.ts` — Snapshot save (upsert), velocity calculation, decay alert at < -20% → createDraft()
- [ ] `authority-recommendations.ts` — All rule types, max 5 recs, priority + score_gain ordering
- [ ] `authority-service.ts` — runAuthorityMapping() with all 14 steps, runAuthorityMappingForAllLocations() sequential
- [ ] All 3 API routes + cron implemented
- [ ] `POST /api/authority/sameas`: validates https://, deduplicates, pings IndexNow
- [ ] `vercel.json` updated with authority-mapping cron
- [ ] `AuthorityPanel.tsx` — score + grade + tier breakdown + sparkline + recommendations + sameAs gaps + skeleton + plan gate
- [ ] `SameAsAddModal.tsx` — platform-specific instructions + URL input + validation
- [ ] `app/dashboard/page.tsx` updated with AuthorityPanel
- [ ] Migration: 3 new tables + 2 location columns
- [ ] `prod_schema.sql` updated
- [ ] `database.types.ts` updated
- [ ] Seed: authority profile (score 58) + 2 snapshots + 5 citations
- [ ] `golden-tenant.ts`: 4 authority fixtures
- [ ] `data-testid` on all interactive elements
- [ ] `npx vitest run src/__tests__/unit/citation-source-detector.test.ts` — **20 tests passing**
- [ ] `npx vitest run src/__tests__/unit/entity-authority-scorer.test.ts` — **15 tests passing**
- [ ] `npx vitest run src/__tests__/unit/sameas-enricher.test.ts` — **14 tests passing**
- [ ] `npx vitest run src/__tests__/unit/citation-velocity-monitor.test.ts` — **13 tests passing**
- [ ] `npx vitest run src/__tests__/unit/authority-recommendations.test.ts` — **12 tests passing**
- [ ] `npx vitest run src/__tests__/unit/authority-routes.test.ts` — **13 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/authority-panel.spec.ts` — **9 tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format

```markdown
## 2026-03-01 — Sprint 108: Semantic Authority Mapping (Completed)

**Goal:** Build the entity authority layer — measuring how the broader internet treats the business as a trusted entity. Answers: "Are authoritative sources citing you, and is that changing over time?"

**Scope:**
- `lib/authority/types.ts` — **NEW.** AuthorityTier (tier1/tier2/tier3/unknown), CitationSourceType (18 types), CitationSource, AuthorityDimensions (5), EntityAuthorityProfile, SameAsGap, AuthorityRecommendation, AuthoritySnapshot, AuthorityMappingResult.
- `lib/authority/citation-source-detector.ts` — **NEW.** Perplexity Sonar reuse (5 queries/run). classifySourceTier(): KNOWN_TIER2_DOMAINS (15 entries), KNOWN_TIER1_PATTERNS (gov/edu/major news). isSameAsCandidate(): URL specificity check. Domain deduplication (highest tier wins).
- `lib/authority/entity-authority-scorer.ts` — **NEW.** 5 dimensions: Tier 1 (30pts, diminishing returns 0→15→22→30), Tier 2 (25pts, ×5 per source), Platform Breadth (20pts, thresholds 5/12/20), sameAs (15pts, ×3 per link), Velocity (10pts, thresholds). countActivePlatforms() + countSameAsUrls() DB helpers.
- `lib/authority/sameas-enricher.ts` — **NEW.** HIGH_VALUE_SAMEAS_PLATFORMS (9 platforms). detectSameAsGaps(): cross-references listing_platform_ids vs page_schemas sameAs. checkWikidataEntity(): SPARQL query, 5s timeout, never throw. generateSameAsInstructions(): platform-specific step-by-step guidance.
- `lib/authority/citation-velocity-monitor.ts` — **NEW.** saveAuthoritySnapshot() UPSERT on (location_id, snapshot_month). computeCitationVelocity(): (current-prev)/prev×100, null on first run/zero-prev. checkAndAlertDecay(): threshold -20%, creates prompt_missing draft via Sprint 86 createDraft(). getAuthorityHistory(): 6-month window.
- `lib/authority/authority-recommendations.ts` — **NEW.** generateRecommendations(): 5 rules, max 5 recs, priority+score sort. buildTier1CitationRecommendation(): city-aware (Atlanta → AJC/Eater Atlanta). buildVelocityDecayRecommendation(): autopilot_trigger=true.
- `lib/authority/authority-service.ts` — **NEW.** runAuthorityMapping(): 14-step flow, upserts entity_authority_profiles. runAuthorityMappingForAllLocations(): sequential, 1s sleep. Growth+ gate.
- `app/api/authority/` — **NEW.** 3 routes: run, status (profile+6mo history), sameas (GET gaps + POST add with IndexNow ping).
- `app/api/cron/authority-mapping/route.ts` — **NEW.** 1st of month 5AM UTC. CRON_SECRET.
- `vercel.json` — **MODIFIED.** authority-mapping cron added.
- `app/dashboard/_components/AuthorityPanel.tsx` — **NEW.** Score (0–100) + letter grade + tier breakdown + velocity sparkline (inline SVG) + recommendations (max 5) + sameAs gap list + skeleton + plan gate.
- `app/dashboard/_components/SameAsAddModal.tsx` — **NEW.** Platform-specific instructions + URL input + https:// validation.
- `app/dashboard/page.tsx` — **MODIFIED.** AuthorityPanel added.
- Migration `[timestamp]_authority_mapping.sql` — **NEW.** entity_authority_citations, entity_authority_profiles, entity_authority_snapshots tables. authority_score + authority_last_run_at on locations.
- DB updates: prod_schema.sql, database.types.ts.
- Seed: authority profile (58/100), 2 historical snapshots (Jan/Feb 2026), 5 citations.
- `golden-tenant.ts`: MOCK_CITATION_SOURCES, MOCK_SAMEAS_GAPS, MOCK_AUTHORITY_DIMENSIONS, MOCK_AUTHORITY_PROFILE, MOCK_AUTHORITY_SNAPSHOTS.

**Tests added:**
- `citation-source-detector.test.ts` — **20 tests** (pure, zero mocks)
- `entity-authority-scorer.test.ts` — **15 tests** (pure, zero mocks)
- `sameas-enricher.test.ts` — **14 tests** (Wikidata + Supabase mocked)
- `citation-velocity-monitor.test.ts` — **13 tests** (Supabase mocked)
- `authority-recommendations.test.ts` — **12 tests** (pure, zero mocks)
- `authority-routes.test.ts` — **13 tests**
- `authority-panel.spec.ts` — **9 Playwright tests**
- **Total: 78 Vitest + 9 Playwright — all passing, zero regressions**

**Key decisions:**
- entity_authority_citations vs citation_source_intelligence: deliberately separate tables. Aggregate market data (Doc 18) is never touched by Sprint 108.
- Perplexity reused — no new HTTP client code
- MAX_QUERIES_PER_RUN=5: $0.025/location/month at current Perplexity pricing
- Wikidata API: public SPARQL endpoint, no key, 5s timeout, never throw
- Velocity sparkline: inline SVG — no new chart library dependency
- sameAs add: user-initiated only. Detector identifies gaps; owner decides what to add.
- Decay alert threshold: < -20% month-over-month → creates prompt_missing Autopilot draft
- Velocity score: first run = 5pts neutral baseline (not penalized for being new)
```

---

## 🔮 AI_RULES Update (Add Rule 46)

```markdown
## 46. 🏛️ Semantic Authority Mapping — Centralized in `lib/authority/` (Sprint 108)

Entity authority measurement, citation source detection, sameAs gap analysis, velocity monitoring, and recommendations live in `lib/authority/`.

* **entity_authority_citations ≠ citation_source_intelligence:** Never confuse them. `citation_source_intelligence` is aggregate market data (Doc 18 cron). `entity_authority_citations` is per-tenant, per-run citation tracking.
* **Perplexity reuse only:** Never rewrite the Perplexity Sonar HTTP call. Import from existing lib/sov/ or fear engine implementation.
* **MAX_QUERIES_PER_RUN = 5:** Hard cost limit. Never exceed 5 Perplexity queries per location per authority run.
* **sameAs: user-initiated only:** `detectSameAsGaps()` identifies gaps. Only `POST /api/authority/sameas` (explicit user action) adds URLs to schema. No auto-add.
* **Wikidata: 5s timeout, never throw:** The SPARQL endpoint can be slow. Always wrap in try-catch with timeout. Return { found: false } on any error.
* **Decay alert threshold: -20%:** checkAndAlertDecay() fires when velocity < -20%. Triggers prompt_missing Autopilot draft via lib/autopilot/create-draft.ts (Sprint 86).
* **Adding a new authority dimension:** Update AuthorityDimensions type, update computeAuthorityScore() weights (total must remain ≤ 100), update tests, update DEVLOG.
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| listing_platform_ids | Sprint 105 | Platform URLs for sameAs gap analysis |
| page_schemas.json_ld | Sprint 106 | Existing sameAs array for homepage |
| reviews.keywords | Sprint 107 | Entity keyword signals (informational) |
| createDraft() | Sprint 86 | Autopilot draft for decay alerts |
| IndexNow | Sprint 89 | IndexNow ping after sameAs update |
| Perplexity Sonar pattern | Fear Engine / SOV | Citation detection HTTP call |
| Plan Enforcer | Sprint 3 | Growth+ gating |
| Cron / CRON_SECRET | Sprints 105–107 | Pattern for monthly cron |

---

## 🧠 Edge Cases

1. **Perplexity returns the same business multiple times in one query:** Deduplicate by domain — one record per domain per monthly run. Tier assignment: highest tier wins if same domain appears with different tier signals.
2. **Business name is very common (e.g., "The Lounge"):** Queries include city and category to narrow results. Even so, accept that some detected citations may be false positives from similarly-named businesses. The `snippet` field lets the user verify — surface it in the panel.
3. **Wikidata SPARQL query returns multiple matches:** Take the first result with exact name match + correct city. If no exact match → `{ found: false }`. Never guess the wrong entity.
4. **sameAs URL added by user is not a known Tier 2 domain:** Accept it (user knows their own listings), classify as tier3/unknown. Still improves sameAs_count for the score. Log a note in `generation_notes`.
5. **Location has no published homepage schema:** `countSameAsUrls()` returns 0. sameAs_score = 0. Recommendations include "Publish homepage schema first" before sameAs advice. The `POST /api/authority/sameas` route returns an error: "No published homepage schema found — run Schema Expansion first."
6. **First run — no previous snapshot for velocity:** `citation_velocity` = null. velocity_score = 5 (neutral baseline). velocity_label = 'unknown'. Dashboard shows "First mapping — velocity data available next month."
7. **Cron processes 50+ locations:** Sequential with 1s sleep. At 50 locations × 5 Perplexity queries × ~0.5s/query = ~125 seconds. Well within Vercel 300s cron timeout. Monitor and add batching if location count grows past 200.
8. **Reddit citation found but it's negative:** `sentiment = 'negative'`. Still counted as tier2 for scoring (Reddit presence is valuable regardless). Recommendation engine notes negative sentiment separately.
9. **Business has no website:** `countSameAsUrls()` → page_schemas has no homepage row → 0. `brand_website` classification in `classifySourceTier()` returns null (no own domain to match against). This is handled gracefully — no crash, just zero score in that dimension.
10. **Velocity sparkline has only 1 data point:** Render as a single dot, not a line. No crash. Display "First month — trend visible from next month."

---

## 📚 Document Sync + Git Commit

### Step 1: Update `/docs`

**`docs/roadmap.md`** — Sprint 108 ✅ 100%.

**`docs/09-BUILD-PLAN.md`** — Sprint 108 checked off.

**`docs/18-CITATION-INTELLIGENCE.md`** — Add cross-reference: "Sprint 108 adds per-tenant citation tracking via `entity_authority_citations` table. `citation_source_intelligence` (this doc) remains aggregate market data only — not modified by Sprint 108."

### Step 2–5: DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES Rule 46

### Step 6: Git Commit

```bash
git add -A
git commit -m "Sprint 108: Semantic Authority Mapping Engine

- lib/authority/: citation source detector, authority scorer (5 dimensions), sameAs enricher, velocity monitor, recommendations engine, orchestrator
- Perplexity Sonar reuse: 5 queries/location/run ($0.025/location/month)
- classifySourceTier(): 15 Tier 2 domains, gov/edu/news Tier 1 patterns, brand site detection
- Authority score: Tier1 (30pts) + Tier2 (25pts) + Platform Breadth (20pts) + sameAs (15pts) + Velocity (10pts)
- sameAs enricher: 9 HIGH_VALUE_SAMEAS_PLATFORMS, Wikidata SPARQL (5s timeout), user-initiated add only
- Velocity: monthly snapshots, decay alert < -20% → Autopilot prompt_missing draft
- app/api/authority/: run, status, sameas (GET+POST with IndexNow ping)
- cron: authority-mapping 1st of month 5AM UTC
- AuthorityPanel: score + grade + tier breakdown + inline SVG sparkline + recommendations + sameAs gaps
- migration: entity_authority_citations, entity_authority_profiles, entity_authority_snapshots tables
- seed: authority profile (58/100) + 2 snapshots + 5 citations for golden tenant
- tests: 78 Vitest passing + 9 Playwright passing — zero regressions
- docs: roadmap, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES Rule 46, Doc 18 cross-ref

entity_authority_citations ≠ citation_source_intelligence (never confused).
MAX_QUERIES_PER_RUN=5 enforced. sameAs add user-initiated only.
Unblocks Sprint 109 (Voice Search Optimization)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 108, LocalVector answers a question no other local SEO tool asks: *"Does the internet's ecosystem of authoritative sources treat your business as a real, trusted entity — and is that getting better or worse?"*

A business owner sees their authority score (58/100), understands exactly why (no press coverage, Wikidata not linked, TripAdvisor not claimed), gets ranked recommendations with effort estimates, and can take action — either by creating a press-outreach content brief with one click (Autopilot integration) or by adding a Wikidata entity link directly from the dashboard.

And every month, the score updates. If it's declining, the system automatically creates a content draft to address it before the owner even notices. That's the loop: **map → score → recommend → act → remap**.

- **Semantic Authority Mapping: 0% → 100%**
- 78 Vitest + 9 Playwright tests
- 2 sprints remain: **109** (Voice Search Optimization), **110** (AI Answer Simulation Sandbox)
