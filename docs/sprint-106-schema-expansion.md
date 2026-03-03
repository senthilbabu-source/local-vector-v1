# Sprint 106 — Schema Expansion: Beyond Menus

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Extend LocalVector's schema generation layer beyond menus to cover every high-value page type on a client's website. The Magic Engine (Sprint 89) already handles `menu.localvector.ai/{slug}` — menus converted to AI-readable JSON-LD. But a business's menu is only one AI signal. Homepages, FAQ pages, event listings, blog posts, service pages, and about pages are often the *primary* sources AI engines cite. Without schema on those pages, AI answers are incomplete, inaccurate, or attribute the citation to a competitor.

This sprint wires the full pipeline:

1. **Website Crawler** — crawls the client's website, discovers pages, classifies each by type
2. **Schema Generators** — pure functions that produce JSON-LD for 7 page types: `LocalBusiness`, `FAQPage`, `Event`, `BlogPosting`, `Service`, `AboutPage`, and `BreadcrumbList`
3. **Schema Hosting Layer** — generated schemas published at `schema.localvector.ai/{slug}/{page-type}` as embeddable `<script>` snippets (same CDN pattern as Magic Menu)
4. **Schema Health Dashboard** — new dashboard panel showing coverage % per page type, embed instructions, and a per-page schema status table with one-click regeneration
5. **IndexNow Ping** — fires IndexNow after every schema publish to accelerate AI crawler re-indexing
6. **Monthly Schema Drift Cron** — re-crawls all active locations monthly to detect when site content has changed and schema has gone stale

**Why this matters:** NAP Sync (Sprint 105) ensures business data is accurate across platforms. Schema Expansion ensures the *website itself* is readable by AI engines — so when ChatGPT, Perplexity, or Google AI Overviews crawl the site, they can extract structured answers, not raw HTML. The combination of accurate NAP data + comprehensive website schema is the full upstream foundation for everything downstream (Review Engine, Authority Mapping, Voice Optimization).

**Gap being closed:** Schema Expansion identified as critical gap post-Sprint 105. Starts at 0% for non-menu pages → targeting 100%. Unblocks Sprint 107 (Review Engine) and Sprint 110 (Semantic Authority Mapping).

**Architectural boundary (CRITICAL — read before writing code):**
- **Magic Engine (Doc 04 / Sprint 89):** Handles `menu.localvector.ai/{slug}` — menu data → JSON-LD. DO NOT touch those files.
- **Content Grader (Doc 17 / `page_audits` table):** *Scores* pages on AEO readiness (0–100). This sprint does NOT duplicate the scoring logic. The Schema Expansion engine *generates and publishes schema* — a separate concern.
- **This sprint:** Crawls client's own website → generates JSON-LD per page type → hosts at `schema.localvector.ai/{slug}/` → provides embed snippets → tracks coverage in new `page_schemas` table.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                        — All engineering rules (currently 42+)
Read CLAUDE.md                                               — Project context, architecture, patterns
Read MEMORY.md                                               — Key decisions and constraints
Read supabase/prod_schema.sql                                — Canonical schema
  § Find: locations table (name, address, phone, website, hours_data, amenities)
  § Find: magic_menus table — understand the hosting/publish pattern (reuse it)
  § Find: page_audits table — understand existing structure (DO NOT duplicate)
  § Find: nap_discrepancies, listing_snapshots from Sprint 105
Read lib/supabase/database.types.ts                          — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                       — Golden Tenant fixtures (org_id: a0eebc99)
Read lib/gbp/gbp-data-mapper.ts                              — GBP mapper (Sprint 89) — NAP ground truth for schema population
Read lib/nap-sync/types.ts                                   — GroundTruth type (Sprint 105) — reuse for LocalBusiness schema generation
Read app/api/magic-menu/[id]/publish/route.ts                — Existing publish pattern (IndexNow ping lives here — reuse)
Read lib/indexnow.ts                                         — Existing IndexNow ping utility (DO NOT re-implement)
Read lib/plan-enforcer.ts                                    — Plan gating (Schema Expansion = Growth+ feature)
Read lib/supabase/server.ts                                  — createClient() vs createServiceRoleClient()
Read app/dashboard/page.tsx                                  — Dashboard page to insert SchemaHealthPanel
Read vercel.json                                             — Existing cron config (add schema drift cron)
Read app/api/cron/nap-sync/route.ts                         — Cron pattern from Sprint 105 (follow exactly)
Read app/dashboard/_components/ListingHealthPanel.tsx        — Dashboard panel pattern from Sprint 105 (follow for SchemaHealthPanel)
```

**Specifically understand before writing code:**
- The `magic_menus` table publish flow — `page_schemas` follows the same publish/host pattern
- The existing `page_audits` table columns — `page_schemas` is a sibling table, NOT a replacement
- How `lib/indexnow.ts` works — reuse it; do not re-implement IndexNow pinging
- The `GroundTruth` interface from `lib/nap-sync/types.ts` — `LocalBusiness` schema is populated from it
- The `createServiceRoleClient()` cron pattern from Sprint 105 — the drift cron follows it exactly

---

## 🏗️ Architecture — What to Build

### Page Type Reality Check (Read Before Coding)

Each page type maps to a specific Schema.org type. The crawler must detect which type each URL is.

| Page Type | Schema.org Type(s) | Detection Signal | Auto-populate from |
|-----------|-------------------|-----------------|-------------------|
| Homepage | `LocalBusiness` + `BreadcrumbList` | `url === websiteRoot` or path `/` | Ground Truth (NAP Sync Sprint 105) |
| About | `AboutPage` + `LocalBusiness` | Path contains `/about`, title contains "About" | Ground Truth + page content |
| FAQ | `FAQPage` + `BreadcrumbList` | Path contains `/faq`, H tags with "Q:" or "?" | Page content extraction |
| Event | `Event` + `BreadcrumbList` | Path contains `/events`, `/event/`, page contains date strings | Page content extraction |
| Blog Post | `BlogPosting` + `BreadcrumbList` | Path contains `/blog/`, `/post/`, has `<article>` tag | Page content extraction |
| Service | `Service` + `LocalBusiness` + `BreadcrumbList` | Path contains `/service`, `/hookah`, `/menu`, non-menu service pages | Ground Truth + page content |
| Menu (skip) | Already handled by Magic Engine | Path at `menu.localvector.ai` or matches magic_menu slug | **DO NOT generate — skip** |

**Detection must be heuristic + LLM-assisted for ambiguous pages.** If URL heuristics are inconclusive, use a GPT-4o-mini call with the page's `<title>` and first 500 chars of body text to classify.

---

### Component 1: Website Crawler — `lib/schema-expansion/website-crawler.ts`

**Discovers all pages on a client's website by crawling their sitemap or following internal links.**

```typescript
/**
 * Crawls a website to discover pages and their content for schema generation.
 *
 * Strategy (in order — stop when enough pages found):
 * 1. Fetch {websiteUrl}/sitemap.xml — extract all <loc> URLs
 * 2. If no sitemap, fetch {websiteUrl}/sitemap_index.xml and follow sub-sitemaps
 * 3. If no sitemap found, fetch the homepage and extract internal <a href> links
 * 4. Deduplicate URLs, filter to same-origin only, exclude query strings and fragments
 * 5. Cap at MAX_PAGES_PER_CRAWL = 50 (configurable per plan tier)
 *
 * Per page: fetch HTML, extract title, meta description, H1, body text (first 2000 chars),
 * and detect page type via classifyPageType().
 *
 * Respects robots.txt: fetch {websiteUrl}/robots.txt, skip Disallowed paths.
 * Never crawl more than once per URL per run.
 * Timeout: 10 seconds per page fetch. Skip timed-out pages.
 */

export const MAX_PAGES_PER_PLAN: Record<string, number> = {
  trial:   5,
  starter: 10,
  growth:  30,
  agency:  50,
};

export interface CrawledPage {
  url: string;
  page_type: PageType;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  body_excerpt: string;      // First 2000 chars of visible body text
  detected_faqs: FAQ[];      // Extracted from page if page_type === 'faq'
  detected_events: EventData[]; // Extracted from page if page_type === 'event'
  crawled_at: string;        // ISO timestamp
  http_status: number;
  error?: string;            // Set if fetch failed
}

export type PageType =
  | 'homepage'
  | 'about'
  | 'faq'
  | 'event'
  | 'blog_post'
  | 'service'
  | 'menu'      // Magic Engine — skip schema generation
  | 'other';    // Unknown — low priority, generate generic LocalBusiness only

export interface FAQ {
  question: string;
  answer: string;
}

export interface EventData {
  name: string;
  startDate?: string;      // ISO date or date string found on page
  endDate?: string;
  description?: string;
  location?: string;
}

/**
 * Main crawl entry point.
 * Returns all discovered pages with their content and classified type.
 * Never throws — returns partial results on error (some pages may have error set).
 */
export async function crawlWebsite(
  websiteUrl: string,
  planTier: string,
): Promise<{ pages: CrawledPage[]; sitemap_found: boolean; robots_respected: boolean }> { ... }

/**
 * Classifies a page's type from its URL path + content signals.
 * Heuristic first. Falls back to GPT-4o-mini if confidence < 0.7.
 *
 * @param url           — Full URL of the page
 * @param title         — Page <title> tag
 * @param bodyExcerpt   — First 500 chars of body text
 * @returns { type: PageType; confidence: number; method: 'heuristic' | 'llm' }
 */
export async function classifyPageType(
  url: string,
  title: string | null,
  bodyExcerpt: string,
): Promise<{ type: PageType; confidence: number; method: 'heuristic' | 'llm' }> { ... }

/**
 * Extracts FAQ question/answer pairs from page body text.
 * Looks for patterns: "Q: ...\nA: ...", "Question: ...\nAnswer: ...",
 * accordion/details HTML elements, and h3/h4 followed by paragraph patterns.
 * Returns up to MAX_FAQS_PER_PAGE = 10.
 */
export function extractFAQs(bodyText: string, htmlContent: string): FAQ[] { ... }

/**
 * Extracts event data from page body text.
 * Looks for date strings (ISO, US format, relative), event names from headings,
 * and Schema.org Event microdata if present.
 * Returns up to MAX_EVENTS_PER_PAGE = 20.
 */
export function extractEventData(bodyText: string, htmlContent: string): EventData[] { ... }

/**
 * Fetches and parses robots.txt for a domain.
 * Returns list of disallowed paths for user-agent *.
 */
export async function fetchRobotsTxt(websiteUrl: string): Promise<string[]> { ... }

/**
 * Parses a sitemap.xml and returns all <loc> URLs.
 * Handles sitemap index files (nested sitemaps) with max 3 levels of nesting.
 */
export async function parseSitemap(sitemapUrl: string): Promise<string[]> { ... }
```

---

### Component 2: Schema Generators — `lib/schema-expansion/generators/`

**Directory structure:**
```
lib/schema-expansion/generators/
  index.ts                     — barrel export + SchemaGeneratorRegistry
  types.ts                     — GeneratedSchema, SchemaGeneratorInput, all generator interfaces
  local-business.generator.ts  — LocalBusiness schema (homepage, about)
  faq-page.generator.ts        — FAQPage schema
  event.generator.ts           — Event schema
  blog-posting.generator.ts    — BlogPosting schema
  service.generator.ts         — Service schema
  breadcrumb.generator.ts      — BreadcrumbList (injected into all page types)
```

---

#### `lib/schema-expansion/generators/types.ts`

```typescript
import type { GroundTruth } from '@/lib/nap-sync/types';

/**
 * Input passed to every schema generator.
 */
export interface SchemaGeneratorInput {
  groundTruth: GroundTruth;      // Accurate business data from Sprint 105
  page: CrawledPage;             // Crawled page content
  orgId: string;
  locationId: string;
}

/**
 * Output from a schema generator.
 * The jsonLd field is the complete, valid Schema.org JSON-LD object (not stringified).
 */
export interface GeneratedSchema {
  page_type: PageType;
  schema_types: string[];         // e.g. ['LocalBusiness', 'BreadcrumbList']
  json_ld: Record<string, unknown>[];  // Array: one object per @type (can have multiple)
  confidence: number;             // 0–1: how confident we are this is correct
  missing_fields: string[];       // Fields we couldn't populate from available data
  generated_at: string;           // ISO timestamp
}

/**
 * Abstract base for all schema generators.
 */
export abstract class SchemaGenerator {
  abstract readonly supportsPageType: PageType[];

  abstract generate(input: SchemaGeneratorInput): Promise<GeneratedSchema>;

  /** Shared: build BreadcrumbList for any page */
  protected buildBreadcrumb(websiteUrl: string, pagePath: string, pageTitle: string) {
    return {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: websiteUrl },
        { '@type': 'ListItem', position: 2, name: pageTitle, item: `${websiteUrl}${pagePath}` },
      ],
    };
  }

  /** Shared: build opening hours spec from hours_data */
  protected buildOpeningHours(
    hoursData: Record<string, { open: string; close: string; closed: boolean }> | undefined,
  ): string[] { ... }
}
```

---

#### `lib/schema-expansion/generators/local-business.generator.ts`

```typescript
/**
 * Generates LocalBusiness (or Restaurant subtype) schema.
 * Used for: homepage, about page.
 * Populates from Ground Truth (Sprint 105 NAP data) — this is why Sprint 105 must come first.
 *
 * Schema.org type selection:
 * - If ground truth has hookah/lounge/bar keywords → 'BarOrPub'
 * - If ground truth has restaurant/food/dining keywords → 'Restaurant'
 * - Default → 'LocalBusiness'
 *
 * Fields populated:
 * - @type: (BarOrPub | Restaurant | LocalBusiness)
 * - name: groundTruth.name
 * - url: groundTruth.website
 * - telephone: groundTruth.phone
 * - address: PostalAddress from groundTruth
 * - geo: GeoCoordinates (from locations.latitude/longitude if available)
 * - openingHoursSpecification: from groundTruth.hours_data
 * - priceRange: from locations.price_range if available
 * - servesCuisine: extracted from page content or amenities
 * - amenityFeature: from groundTruth amenities (wifi, outdoor_seating, etc.)
 * - sameAs: GBP URL, Yelp URL (from listing_platform_ids if available)
 */
export class LocalBusinessGenerator extends SchemaGenerator {
  readonly supportsPageType = ['homepage', 'about'] as PageType[];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> { ... }
}
```

**Critical implementation rules:**
- Pull `sameAs` URLs from `listing_platform_ids` table (Sprint 105) — this links Google, Yelp, Apple Maps profiles into the schema, a strong GEO signal
- Never guess `geo` coordinates — only include if `locations.latitude` and `locations.longitude` are non-null
- `openingHoursSpecification` must use Schema.org `OpeningHoursSpecification` format with `dayOfWeek`, `opens`, `closes` — NOT just the string array format
- If `hours_data` is null, omit `openingHoursSpecification` entirely rather than guessing

---

#### `lib/schema-expansion/generators/faq-page.generator.ts`

```typescript
/**
 * Generates FAQPage schema from extracted FAQ pairs.
 *
 * If crawled page has detected_faqs.length > 0:
 *   → Use extracted FAQs directly (human-authored content is best)
 *
 * If crawled page has detected_faqs.length === 0 but page_type === 'faq':
 *   → Use GPT-4o-mini to generate 5 relevant FAQs based on:
 *     - Business category (from groundTruth / locations.primary_category)
 *     - Business name and city
 *     - Page body excerpt
 *     - Example prompt: "Generate 5 FAQ pairs for {businessName}, a {category} in {city}. Focus on questions customers ask AI assistants about local businesses in this category."
 *   → Mark as AI-generated in missing_fields: ['faqs_auto_generated']
 *   → Require human review before publishing (schema saved with status 'draft')
 *
 * Output structure:
 * {
 *   "@context": "https://schema.org",
 *   "@type": "FAQPage",
 *   "mainEntity": [
 *     {
 *       "@type": "Question",
 *       "name": "What are your hours?",
 *       "acceptedAnswer": {
 *         "@type": "Answer",
 *         "text": "We are open Tuesday through Thursday 5PM–1AM..."
 *       }
 *     }
 *   ]
 * }
 */
export class FAQPageGenerator extends SchemaGenerator {
  readonly supportsPageType = ['faq'] as PageType[];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> { ... }
}

/**
 * Generates 5 FAQs for a business using GPT-4o-mini when page extraction yields none.
 * Returns structured FAQ pairs. Uses generateText() from Vercel AI SDK.
 * Must be called only if detected_faqs.length === 0.
 */
async function generateFAQsWithLLM(
  businessName: string,
  category: string,
  city: string,
  bodyExcerpt: string,
): Promise<FAQ[]> { ... }
```

---

#### `lib/schema-expansion/generators/event.generator.ts`

```typescript
/**
 * Generates Event schema from extracted event data.
 *
 * If page has detected_events with sufficient data (name + startDate):
 *   → Generate one Event schema object per detected event (up to 5 per page)
 *
 * If events lack startDate:
 *   → Use EventSchedule subtype with a byDay recurrence pattern if the event
 *     appears to be recurring (e.g. "every Friday", "weekly belly dancing")
 *
 * Required fields (always populated):
 *   - name: event name
 *   - location: Place with groundTruth address
 *   - organizer: Organization with groundTruth name + website
 *
 * Optional fields (populate if detected):
 *   - startDate / endDate
 *   - description
 *   - eventStatus: EventScheduled (default)
 *   - eventAttendanceMode: OfflineEventAttendanceMode (default for local events)
 *
 * Output: array of Event JSON-LD objects (one per event) wrapped in @graph.
 */
export class EventGenerator extends SchemaGenerator {
  readonly supportsPageType = ['event'] as PageType[];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> { ... }
}
```

---

#### `lib/schema-expansion/generators/blog-posting.generator.ts`

```typescript
/**
 * Generates BlogPosting (or Article) schema.
 *
 * Fields:
 *   - headline: page <title> or <h1>
 *   - description: meta description
 *   - datePublished: extracted from page (look for <time datetime="..."> or
 *     common date patterns in first 500 chars)
 *   - dateModified: same as datePublished if not found separately
 *   - author: Organization (groundTruth.name) — not a person for business blogs
 *   - publisher: Organization with groundTruth.name + logo (if locations.logo_url exists)
 *   - url: page URL
 *   - mainEntityOfPage: WebPage (@id = page URL)
 *   - image: og:image if found in page HTML, otherwise omit
 *
 * IMPORTANT: Never fabricate datePublished if not found — omit the field.
 */
export class BlogPostingGenerator extends SchemaGenerator {
  readonly supportsPageType = ['blog_post'] as PageType[];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> { ... }
}
```

---

#### `lib/schema-expansion/generators/service.generator.ts`

```typescript
/**
 * Generates Service schema for service-specific pages
 * (e.g. /hookah-service, /private-events, /vip-packages, /catering).
 *
 * Fields:
 *   - @type: Service
 *   - name: page <h1> or <title>
 *   - description: meta description or first paragraph of body
 *   - provider: Organization with groundTruth.name + address
 *   - areaServed: City + State from groundTruth
 *   - serviceType: extracted from page heading / title (e.g. "Hookah Service", "Private Events")
 *   - url: page URL
 *   - offers: If price detected on page (e.g. "$X per hookah"), include Offer schema
 */
export class ServiceGenerator extends SchemaGenerator {
  readonly supportsPageType = ['service'] as PageType[];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> { ... }
}
```

---

### Component 3: Schema Host Layer — `lib/schema-expansion/schema-host.ts`

**Generates the embeddable snippet and publishes it to the public schema CDN. Follows the Magic Menu publish pattern.**

```typescript
/**
 * Publishes a generated schema to the schema.localvector.ai CDN.
 *
 * This mirrors the magic_menu publish flow:
 * 1. Serialize json_ld as pretty JSON-LD <script> tag
 * 2. Store in Supabase Storage bucket 'schema-snippets' at path:
 *    {slug}/{page_type}/schema.json     — raw JSON-LD
 *    {slug}/{page_type}/embed.html      — embeddable <script> snippet (copy-paste)
 * 3. Public URL: https://schema.localvector.ai/{slug}/{page_type}/embed.html
 * 4. Ping IndexNow for the client's page URL after publish
 * 5. Update page_schemas row: status = 'published', published_at = now()
 *
 * Note on CDN URL: 'schema.localvector.ai' subdomain must be configured in Vercel
 * pointing to the Supabase Storage public bucket. Read vercel.json + check if
 * schema.localvector.ai is already configured (menu.localvector.ai pattern) —
 * if not, use the same rewrites pattern.
 */
export async function publishSchema(
  supabase: ReturnType<typeof createServiceRoleClient>,
  schemaId: string,
  slug: string,
  pageType: PageType,
  generatedSchema: GeneratedSchema,
  clientPageUrl: string,
): Promise<{ ok: boolean; public_url?: string; error?: string }> { ... }

/**
 * Generates the embed HTML snippet — the copy-pasteable <script> block.
 * Produces a complete, minified JSON-LD script tag with a human-readable comment.
 *
 * Output format:
 * <!-- LocalVector Schema — {page_type} — Generated {date} -->
 * <script type="application/ld+json">
 * {...json}
 * </script>
 */
export function generateEmbedSnippet(
  jsonLd: Record<string, unknown>[],
  pageType: PageType,
): string { ... }

/**
 * Validates generated JSON-LD against Schema.org constraints before publishing.
 * Uses a lightweight rule set (not a full validator) to catch common errors:
 * - Required fields missing for the @type
 * - Invalid URL formats
 * - Invalid date formats in Event/BlogPosting
 * - Empty mainEntity array in FAQPage
 * Returns { valid: boolean; errors: string[] }
 */
export function validateSchemaBeforePublish(
  jsonLd: Record<string, unknown>[],
): { valid: boolean; errors: string[] } { ... }
```

---

### Component 4: Schema Expansion Orchestrator — `lib/schema-expansion/schema-expansion-service.ts`

```typescript
/**
 * Runs a full schema expansion for a single location.
 *
 * Flow:
 * 1. Fetch Ground Truth from locations + listing_platform_ids (Sprint 105 tables)
 * 2. Determine plan tier → set crawl page limit
 * 3. Crawl the location's website (crawlWebsite())
 * 4. For each discovered page (skip page_type === 'menu'):
 *    a. Select the appropriate SchemaGenerator(s)
 *    b. Generate schema (GeneratedSchema)
 *    c. Validate schema (validateSchemaBeforePublish)
 *    d. Upsert page_schemas row with status 'draft'
 *    e. If validation passes AND no AI-generated FAQs → auto-publish
 *    f. If AI-generated FAQs → save as 'pending_review' (human must approve)
 *    g. Ping IndexNow for published pages
 * 5. Update schema_health_score on the locations row
 * 6. Return SchemaExpansionResult
 *
 * Always uses createServiceRoleClient() — runs in cron and on-demand API route contexts.
 */
export async function runSchemaExpansion(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
): Promise<SchemaExpansionResult> { ... }

export interface SchemaExpansionResult {
  location_id: string;
  org_id: string;
  pages_crawled: number;
  schemas_generated: number;
  schemas_published: number;
  schemas_pending_review: number;  // AI-generated FAQs awaiting human approval
  schema_health_score: number;     // 0–100
  page_results: PageSchemaResult[];
  run_at: string;
}

export interface PageSchemaResult {
  url: string;
  page_type: PageType;
  status: 'published' | 'pending_review' | 'failed' | 'skipped';
  schema_types: string[];
  public_url?: string;
  error?: string;
}

/**
 * Calculates the Schema Health Score (0–100) for a location.
 *
 * Scoring:
 * Base: 100
 * Deduct for each missing high-value page type:
 *   - No homepage schema:    -30 (critical — most AI citations start here)
 *   - No FAQ schema:         -25 (FAQ pages are top AI citation source)
 *   - No about schema:       -15
 *   - No event schema:       -10 (if location has events)
 *   - No blog schema:        -10 (if blog pages exist)
 *   - No service schema:     -10 (if service pages exist)
 * Deduct for pending_review schemas: -5 each (schema generated but not live)
 * Bonus: +5 if sameAs (platform links) populated in LocalBusiness schema
 */
export function calculateSchemaHealthScore(
  pageResults: PageSchemaResult[],
  hasBlog: boolean,
  hasEvents: boolean,
  hasServices: boolean,
): number { ... }

/**
 * Runs schema expansion for ALL active Growth+ locations.
 * Called by the monthly schema drift cron.
 * Processes sequentially to avoid rate limits.
 */
export async function runSchemaExpansionForAllLocations(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<{ processed: number; errors: number }> { ... }
```

---

### Component 5: Schema Expansion API Route — `app/api/schema-expansion/run/route.ts`

```typescript
/**
 * POST /api/schema-expansion/run
 *
 * On-demand schema expansion for the authenticated user's location.
 *
 * Flow:
 * 1. Verify user session
 * 2. Resolve org_id and location_id
 * 3. Plan gate: Growth+ only (return 403 with "plan_upgrade_required" for Starter)
 * 4. Call runSchemaExpansion()
 * 5. Return { ok: true, result: SchemaExpansionResult }
 *
 * Error codes:
 * - "unauthorized"           — no valid session
 * - "plan_upgrade_required"  — Starter plan
 * - "no_location"            — org has no location
 * - "no_website"             — location has no website URL (can't crawl)
 * - "expansion_failed"       — runSchemaExpansion threw
 */
export async function POST(request: Request) { ... }
```

---

### Component 6: Schema Review API Route — `app/api/schema-expansion/[id]/approve/route.ts`

```typescript
/**
 * POST /api/schema-expansion/:id/approve
 *
 * Approves a 'pending_review' schema (AI-generated FAQs) and publishes it.
 * Human-in-the-loop gate: AI-generated FAQs must be approved before going live.
 *
 * Flow:
 * 1. Verify user session + org ownership of schema record
 * 2. Fetch page_schemas row by id — verify status === 'pending_review'
 * 3. Call publishSchema() to push to CDN + ping IndexNow
 * 4. Update page_schemas.status = 'published', human_approved = true
 *
 * Error codes:
 * - "not_found"              — schema ID not found
 * - "already_published"      — schema already published
 * - "publish_failed"         — CDN publish error
 */
export async function POST(request: Request, { params }: { params: { id: string } }) { ... }
```

---

### Component 7: Schema Drift Cron — `app/api/cron/schema-drift/route.ts`

```typescript
/**
 * GET /api/cron/schema-drift
 *
 * Monthly cron — re-crawls all active Growth+ locations and regenerates
 * schemas where page content has changed significantly since last run.
 *
 * Security: validates CRON_SECRET header (same as NAP sync cron).
 * Uses createServiceRoleClient().
 *
 * Change detection: compare new crawl's page title + body_excerpt hash
 * against stored page_schemas.content_hash. If hash differs → regenerate.
 *
 * Response: { processed: number, regenerated: number, errors: number, duration_ms: number }
 */
export async function GET(request: Request) { ... }
```

**Update `vercel.json`:**
```json
{
  "crons": [
    { "path": "/api/cron/sov",          "schedule": "0 2 * * 1"  },
    { "path": "/api/cron/nap-sync",     "schedule": "0 3 * * 1"  },
    { "path": "/api/cron/schema-drift", "schedule": "0 4 1 * *"  }
  ]
}
```
Schedule: 1st of each month at 4 AM UTC (1 hour after NAP sync cron — stagger load).

---

### Component 8: Schema Status API Route — `app/api/schema-expansion/status/route.ts`

```typescript
/**
 * GET /api/schema-expansion/status
 *
 * Returns the current schema health state for the dashboard panel.
 * Used by SchemaHealthPanel on load.
 *
 * Response:
 * {
 *   schema_health_score: number | null,    // null = never run
 *   pages: PageSchemaRecord[],             // all page_schemas rows for this location
 *   last_run_at: string | null,
 * }
 *
 * Auth: user session (createClient())
 * Plan gate: Growth+ only (return 403 for Starter)
 */
export async function GET(request: Request) { ... }
```

---

### Component 9: Migration — `supabase/migrations/YYYYMMDDHHMMSS_schema_expansion.sql`

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 106: Schema Expansion Engine — New Tables
-- ══════════════════════════════════════════════════════════════

-- 1. page_schemas — Generated JSON-LD schemas per page per location
--    IMPORTANT: This is a SIBLING to page_audits, not a replacement.
--    page_audits = AEO scores (Doc 17). page_schemas = generated JSON-LD (this sprint).
CREATE TABLE IF NOT EXISTS public.page_schemas (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id            uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  page_url          text        NOT NULL,
  page_type         text        NOT NULL CHECK (page_type IN
                    ('homepage','about','faq','event','blog_post','service','other')),
  schema_types      text[]      NOT NULL DEFAULT '{}',   -- e.g. ['LocalBusiness','BreadcrumbList']
  json_ld           jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- Array of schema objects
  embed_snippet     text,       -- The <script type="application/ld+json">...</script> HTML
  public_url        text,       -- https://schema.localvector.ai/{slug}/{page_type}/embed.html
  content_hash      text,       -- MD5/SHA256 of page title + body_excerpt for drift detection
  status            text        NOT NULL CHECK (status IN
                    ('draft','pending_review','published','failed','stale'))
                    DEFAULT 'draft',
  human_approved    boolean     NOT NULL DEFAULT false,
  confidence        numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
  missing_fields    text[]      NOT NULL DEFAULT '{}',
  validation_errors text[]      NOT NULL DEFAULT '{}',
  generated_at      timestamptz NOT NULL DEFAULT now(),
  published_at      timestamptz,
  last_crawled_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, page_url)   -- One schema record per page per location
);

ALTER TABLE public.page_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_schemas: org members can read own"
  ON public.page_schemas FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "page_schemas: org members can update own (approve)"
  ON public.page_schemas FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "page_schemas: service role full access"
  ON public.page_schemas
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_page_schemas_location_status
  ON public.page_schemas (location_id, status);

CREATE INDEX IF NOT EXISTS idx_page_schemas_location_page_type
  ON public.page_schemas (location_id, page_type);

CREATE INDEX IF NOT EXISTS idx_page_schemas_stale
  ON public.page_schemas (location_id, last_crawled_at)
  WHERE status IN ('published', 'stale');

COMMENT ON TABLE public.page_schemas IS
  'Generated JSON-LD schemas per page per location. Sibling to page_audits (which scores pages). Sprint 106.';

-- ──────────────────────────────────────────────────────────────

-- 2. Add schema health columns to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS schema_health_score    integer CHECK (schema_health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS schema_last_run_at     timestamptz,
  ADD COLUMN IF NOT EXISTS website_slug           text UNIQUE;  -- For schema.localvector.ai/{slug} routing

CREATE INDEX IF NOT EXISTS idx_locations_schema_health
  ON public.locations (org_id, schema_health_score)
  WHERE schema_health_score IS NOT NULL;

COMMENT ON COLUMN public.locations.schema_health_score IS
  'Composite 0–100 schema coverage score across all page types. NULL = never run. Sprint 106.';
COMMENT ON COLUMN public.locations.website_slug IS
  'URL-safe slug for schema.localvector.ai/{slug}/ routing. Auto-derived from business name. Sprint 106.';
```

**Update `prod_schema.sql`:** Add `page_schemas` table + 3 new columns on `locations`.

**Update `database.types.ts`:** Add types for `page_schemas` and the new `locations` columns.

---

### Component 10: Seed Data — `supabase/seed.sql`

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 106: Schema Expansion seed data for golden tenant
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_location_id uuid;
BEGIN
  SELECT id INTO v_location_id
    FROM public.locations
   WHERE org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
   LIMIT 1;

  -- Set slug on golden tenant location
  UPDATE public.locations
     SET website_slug = 'charcoal-n-chill',
         schema_health_score = 55,
         schema_last_run_at = NOW() - INTERVAL '5 days'
   WHERE id = v_location_id;

  -- Seed realistic page_schemas for Charcoal N Chill
  INSERT INTO public.page_schemas (
    location_id, org_id, page_url, page_type, schema_types,
    json_ld, status, human_approved, confidence, published_at,
    public_url, last_crawled_at
  ) VALUES
  (
    v_location_id,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'https://charcoalnchill.com',
    'homepage',
    ARRAY['BarOrPub', 'BreadcrumbList'],
    '[{"@context":"https://schema.org","@type":"BarOrPub","name":"Charcoal N Chill","telephone":"+14705550123","url":"https://charcoalnchill.com","address":{"@type":"PostalAddress","streetAddress":"11950 Jones Bridge Rd","addressLocality":"Alpharetta","addressRegion":"GA","postalCode":"30005"}}]'::jsonb,
    'published',
    true,
    0.95,
    NOW() - INTERVAL '5 days',
    'https://schema.localvector.ai/charcoal-n-chill/homepage/embed.html',
    NOW() - INTERVAL '5 days'
  ),
  (
    v_location_id,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'https://charcoalnchill.com/faq',
    'faq',
    ARRAY['FAQPage', 'BreadcrumbList'],
    '[{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What are your hookah flavors?","acceptedAnswer":{"@type":"Answer","text":"We offer over 50 premium hookah flavors."}}]}]'::jsonb,
    'pending_review',  -- AI-generated FAQs awaiting approval
    false,
    0.78,
    NULL,
    NULL,
    NOW() - INTERVAL '5 days'
  ),
  (
    v_location_id,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'https://charcoalnchill.com/events',
    'event',
    ARRAY['Event', 'BreadcrumbList'],
    '[]'::jsonb,
    'failed',
    false,
    0.45,
    NULL,
    NULL,
    NOW() - INTERVAL '5 days'
  )
  ON CONFLICT (location_id, page_url) DO NOTHING;
END $$;
```

---

### Component 11: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
/**
 * Sprint 106 — Schema Expansion fixtures for golden tenant (Charcoal N Chill).
 */

/** Mock CrawledPage for homepage */
export const MOCK_CRAWLED_HOMEPAGE: import('@/lib/schema-expansion/website-crawler').CrawledPage = {
  url: 'https://charcoalnchill.com',
  page_type: 'homepage',
  title: 'Charcoal N Chill — Premium Hookah Lounge & Indo-American Restaurant | Alpharetta, GA',
  meta_description: 'Charcoal N Chill is Alpharetta\'s premier hookah lounge and Indo-American fusion restaurant. Open Tue–Sat with live entertainment, belly dancing shows, and over 50 hookah flavors.',
  h1: 'Alpharetta\'s #1 Hookah Lounge & Restaurant',
  body_excerpt: 'Welcome to Charcoal N Chill — the premier hookah lounge and Indo-American fusion restaurant in Alpharetta, Georgia. We offer premium shisha service with over 50 flavors, authentic Indian cuisine, and live entertainment including belly dancing shows every weekend.',
  detected_faqs: [],
  detected_events: [],
  crawled_at: '2026-03-01T04:00:00.000Z',
  http_status: 200,
};

/** Mock CrawledPage for FAQ page */
export const MOCK_CRAWLED_FAQ: import('@/lib/schema-expansion/website-crawler').CrawledPage = {
  url: 'https://charcoalnchill.com/faq',
  page_type: 'faq',
  title: 'Frequently Asked Questions | Charcoal N Chill',
  meta_description: 'Find answers to common questions about Charcoal N Chill hookah lounge.',
  h1: 'Frequently Asked Questions',
  body_excerpt: 'Q: What are your hookah flavors?\nA: We offer over 50 premium hookah flavors...\nQ: Do you take reservations?\nA: Yes, you can book a table via our website or call us.',
  detected_faqs: [
    { question: 'What are your hookah flavors?', answer: 'We offer over 50 premium hookah flavors including fruit, mint, and specialty blends.' },
    { question: 'Do you take reservations?', answer: 'Yes, reservations are available via our website or by calling (470) 555-0123.' },
  ],
  detected_events: [],
  crawled_at: '2026-03-01T04:00:00.000Z',
  http_status: 200,
};

/** Mock CrawledPage for events page */
export const MOCK_CRAWLED_EVENTS: import('@/lib/schema-expansion/website-crawler').CrawledPage = {
  url: 'https://charcoalnchill.com/events',
  page_type: 'event',
  title: 'Events | Charcoal N Chill',
  meta_description: 'Live entertainment, themed nights, and belly dancing at Charcoal N Chill.',
  h1: 'Upcoming Events',
  body_excerpt: 'Every Friday: Belly Dancing Show at 9PM. Every Saturday: Afrobeats Night. Themed cultural nights including Latino Night, Punjabi Night, and more.',
  detected_faqs: [],
  detected_events: [
    { name: 'Belly Dancing Show', startDate: undefined, description: 'Live belly dancing performance every Friday at 9PM' },
    { name: 'Afrobeats Night', startDate: undefined, description: 'Saturday night Afrobeats themed DJ event' },
  ],
  crawled_at: '2026-03-01T04:00:00.000Z',
  http_status: 200,
};

/** Expected LocalBusiness schema output for homepage */
export const MOCK_EXPECTED_HOMEPAGE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BarOrPub',
  name: 'Charcoal N Chill',
  url: 'https://charcoalnchill.com',
  telephone: '+14705550123',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '11950 Jones Bridge Rd',
    addressLocality: 'Alpharetta',
    addressRegion: 'GA',
    postalCode: '30005',
    addressCountry: 'US',
  },
} as const;
```

---

### Component 12: Schema Health Panel — `app/dashboard/_components/SchemaHealthPanel.tsx`

**Client component.** Displays schema coverage and status per page, with embed instructions and approve/generate CTAs.

```
┌────────────────────────────────────────────────────────────────────┐
│  🗂️  Schema Coverage                     Schema Score: 55/100       │
│  Last run: 5 days ago   [Scan My Website →]                        │
├────────────────────────────────────────────────────────────────────┤
│  PAGE TYPE       STATUS            SCHEMA TYPES       ACTION        │
│  ─────────────────────────────────────────────────────────────────  │
│  🏠 Homepage     ✅ Published       BarOrPub, Breadcrumb  [View ↗]  │
│  ❓ FAQ Page     ⏳ Review Needed   FAQPage, Breadcrumb   [Approve] │
│     AI generated 2 FAQs — please review before publishing           │
│  🎭 Events       ❌ Failed          —                   [Retry]     │
│  ℹ️  About        ⚫ Not Found      —                   —           │
│  📝 Blog         ⚫ Not Found      —                   —           │
├────────────────────────────────────────────────────────────────────┤
│  💡 Add 2 more page types to reach 80+ schema score:               │
│     → Create an About page (improves AI recognition of your brand)  │
│     → Fix your Events schema (event listings boost AI citations)    │
└────────────────────────────────────────────────────────────────────┘
```

**Implementation rules:**
- `'use client'` — data loaded via `useEffect` calling `GET /api/schema-expansion/status`
- Plan gate: Growth+ only — render upgrade prompt for Starter
- "Scan My Website" triggers `POST /api/schema-expansion/run` with inline loading state
- "Approve" button for `pending_review` rows calls `POST /api/schema-expansion/{id}/approve`
- "View ↗" opens the public embed URL in a new tab
- "Retry" calls the run endpoint (the service will re-attempt the failed page)
- Bottom recommendations: derive from missing high-value page types (homepage -30, faq -25, about -15)
- Skeleton loading state while data fetches
- All interactive elements: `data-testid` attributes required
- "View Embed Code" expandable section per published row (shows the `embed_snippet` in a `<code>` block with copy button)

---

### Component 13: Schema Embed Code Modal — `app/dashboard/_components/SchemaEmbedModal.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Embed This Schema on Your FAQ Page                          │
│                                                                  │
│  Paste this code snippet inside your FAQ page's <head> tag:     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ <!-- LocalVector Schema — FAQPage — Generated 2026-03-01 │   │
│  │ <script type="application/ld+json">                      │   │
│  │ { "@context": "https://schema.org",                      │   │
│  │   "@type": "FAQPage", ... }                              │   │
│  │ </script>                                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                [Copy to Clipboard]│
│                                                                  │
│  Or link this file directly in your <head>:                      │
│  https://schema.localvector.ai/charcoal-n-chill/faq/embed.html  │
│                                                [Copy URL]         │
│                                                                  │
│  After embedding, verify at:                                     │
│  → Google Rich Results Test                                      │
│  → schema.org Validator                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/website-crawler.test.ts`

**Target: `lib/schema-expansion/website-crawler.ts`**
**All HTTP calls mocked via `vi.fn()` on `global.fetch`.**

```
describe('crawlWebsite')
  1.  fetches sitemap.xml first and extracts all <loc> URLs
  2.  falls back to homepage link extraction when no sitemap found
  3.  deduplicates URLs (same URL appearing twice in sitemap)
  4.  filters to same-origin URLs only (strips external links)
  5.  strips query strings and fragment identifiers from URLs
  6.  respects MAX_PAGES_PER_PLAN cap (growth = 30 URLs max)
  7.  skips pages that timeout (10s timeout) — returns partial results
  8.  never crawls a URL twice per run
  9.  includes http_status on each CrawledPage

describe('classifyPageType')
  10. '/' path → 'homepage' (heuristic, confidence 1.0)
  11. '/faq' path → 'faq' (heuristic)
  12. '/about-us' path → 'about' (heuristic)
  13. '/events/belly-dancing-night' path → 'event' (heuristic)
  14. '/blog/top-10-hookah-flavors' path → 'blog_post' (heuristic)
  15. '/vip-packages' with title "VIP Hookah Service" → 'service' (heuristic)
  16. '/m/charcoal-n-chill' → 'menu' (Magic Engine — skip)
  17. ambiguous path '/info' → calls LLM classifier (mock GPT call)
  18. LLM classifies correctly when heuristic confidence < 0.7

describe('extractFAQs')
  19. extracts "Q:\nA:" pattern pairs
  20. extracts "Question:\nAnswer:" pattern pairs
  21. extracts h3 + following paragraph patterns
  22. returns max 10 FAQs even if more exist
  23. returns empty array when no FAQ patterns found
  24. handles HTML entities in question/answer text

describe('extractEventData')
  25. extracts event name from h2/h3 headings near date strings
  26. parses ISO date format "2026-03-15"
  27. parses US date format "March 15, 2026"
  28. returns max 20 events per page
  29. returns empty array when no event patterns found

describe('fetchRobotsTxt')
  30. parses Disallow: /admin/ correctly
  31. returns empty array when robots.txt returns 404
  32. only returns rules for user-agent * (ignores Googlebot-specific rules)

describe('parseSitemap')
  33. parses standard sitemap.xml <loc> tags
  34. follows sitemap index to nested sitemaps (max 3 levels)
  35. deduplicates URLs across nested sitemaps
```

**35 tests total.**

---

### Test File 2: `src/__tests__/unit/schema-generators.test.ts`

**Target: all generators in `lib/schema-expansion/generators/`**
**Pure function tests — LLM calls mocked.**

```
describe('LocalBusinessGenerator')
  1.  @type is 'BarOrPub' when groundTruth name contains 'Chill' / amenities contain 'bar'
  2.  @type is 'Restaurant' when category contains 'restaurant' / 'dining'
  3.  @type defaults to 'LocalBusiness' for unknown categories
  4.  telephone populated from groundTruth.phone
  5.  address PostalAddress populated from groundTruth (all 5 fields)
  6.  openingHoursSpecification built from hours_data (7 days)
  7.  openingHoursSpecification omitted when hours_data is null
  8.  geo omitted when latitude/longitude are null
  9.  sameAs includes GBP URL when listing_platform_ids has google entry
  10. sameAs includes Yelp URL when listing_platform_ids has yelp entry
  11. BreadcrumbList included in output json_ld array
  12. MOCK_CRAWLED_HOMEPAGE → matches MOCK_EXPECTED_HOMEPAGE_SCHEMA structure

describe('FAQPageGenerator')
  13. uses extracted detected_faqs when available (no LLM call)
  14. generates 5 FAQs via LLM when detected_faqs is empty (LLM mocked)
  15. LLM-generated FAQs set status to 'pending_review' (not auto-published)
  16. non-LLM FAQs can be auto-published (human_approved not required)
  17. mainEntity array has correct Question/Answer structure
  18. returns missing_fields: ['faqs_auto_generated'] for LLM path
  19. MOCK_CRAWLED_FAQ → generates correct FAQPage schema with 2 mainEntity items

describe('EventGenerator')
  20. generates Event schema for each detected_event (up to 5)
  21. location is Place with groundTruth address
  22. organizer is Organization with groundTruth.name + website
  23. startDate included when EventData.startDate is present
  24. EventSchedule used when startDate is absent + recurring pattern detected
  25. uses @graph wrapper when multiple events generated

describe('BlogPostingGenerator')
  26. headline populated from page title
  27. description populated from meta_description
  28. datePublished extracted from <time datetime="..."> pattern
  29. datePublished omitted when not found — never fabricated
  30. author is Organization, not Person
  31. mainEntityOfPage is WebPage @id = page URL

describe('ServiceGenerator')
  32. @type is 'Service'
  33. name from page h1
  34. provider is Organization with groundTruth address
  35. areaServed is City + State from groundTruth
  36. serviceType extracted from page heading

describe('validateSchemaBeforePublish')
  37. returns valid: true for complete LocalBusiness schema
  38. returns valid: false when @type missing
  39. returns valid: false when FAQPage has empty mainEntity
  40. returns valid: false when Event has no name
  41. returns valid: false when BlogPosting has no headline

describe('generateEmbedSnippet')
  42. output starts with <!-- LocalVector Schema comment
  43. output contains <script type="application/ld+json">
  44. output is valid HTML (tags properly closed)
  45. JSON inside script tag is pretty-printed (indented)
```

**45 tests total.**

---

### Test File 3: `src/__tests__/unit/schema-expansion-service.test.ts`

**Target: `lib/schema-expansion/schema-expansion-service.ts`**

```
describe('runSchemaExpansion')
  1.  returns SchemaExpansionResult with correct pages_crawled count
  2.  skips pages with page_type === 'menu' (Magic Engine owns those)
  3.  upserts page_schemas row for each non-menu page
  4.  auto-publishes schemas that pass validation and have no AI-generated content
  5.  saves as 'pending_review' for AI-generated FAQs
  6.  returns expansion_failed error code when website URL is null
  7.  calls pingIndexNow for each published schema
  8.  handles crawl failure gracefully — returns partial results

describe('calculateSchemaHealthScore')
  9.  score = 100 when all page types published
  10. deducts 30 when homepage schema missing
  11. deducts 25 when FAQ schema missing
  12. deducts 15 when about schema missing
  13. score minimum is 0 (never negative)
  14. score = 55 for golden tenant seed scenario (homepage published, FAQ pending, events failed)
  15. pending_review schemas deduct 5 each

describe('POST /api/schema-expansion/run')
  16. returns 401 when not authenticated
  17. returns 403 with 'plan_upgrade_required' for Starter plan
  18. returns 422 with 'no_website' when location has no website URL
  19. returns { ok: true, result } on success
  20. returns 500 with 'expansion_failed' on service error
```

**20 tests total.**

---

### Test File 4: `src/__tests__/e2e/schema-health-panel.spec.ts` — Playwright

```typescript
const MOCK_STATUS_RESPONSE = {
  schema_health_score: 55,
  last_run_at: '2026-02-24T04:00:00.000Z',
  pages: [
    { id: 'schema-1', page_url: 'https://charcoalnchill.com', page_type: 'homepage', status: 'published', schema_types: ['BarOrPub', 'BreadcrumbList'], public_url: 'https://schema.localvector.ai/charcoal-n-chill/homepage/embed.html' },
    { id: 'schema-2', page_url: 'https://charcoalnchill.com/faq', page_type: 'faq', status: 'pending_review', schema_types: ['FAQPage', 'BreadcrumbList'], public_url: null, missing_fields: ['faqs_auto_generated'] },
    { id: 'schema-3', page_url: 'https://charcoalnchill.com/events', page_type: 'event', status: 'failed', schema_types: [], public_url: null },
  ],
};

describe('Schema Health Dashboard Panel', () => {
  test('renders panel with schema score and page list', async ({ page }) => {
    // Mock GET /api/schema-expansion/status → MOCK_STATUS_RESPONSE
    // Navigate to /dashboard
    // Assert: "Schema Coverage" panel visible
    // Assert: "55/100" score visible
    // Assert: 3 page rows rendered
  });

  test('homepage row shows Published status with View link', async ({ page }) => {
    // Assert: data-testid="schema-row-homepage" shows green ✅ Published
    // Assert: "View ↗" link points to schema.localvector.ai URL
  });

  test('FAQ row shows pending review with Approve CTA', async ({ page }) => {
    // Assert: data-testid="schema-row-faq" shows ⏳ Review Needed
    // Assert: "AI generated" warning text visible
    // Assert: "Approve" button visible with data-testid="approve-faq-btn"
  });

  test('Approve button publishes FAQ schema', async ({ page }) => {
    // Mock POST /api/schema-expansion/schema-2/approve → { ok: true }
    // Click "Approve" button
    // Assert: loading state shows
    // Assert: row updates to Published after response (optimistic or refetch)
  });

  test('events row shows Failed status with Retry CTA', async ({ page }) => {
    // Assert: data-testid="schema-row-event" shows ❌ Failed
    // Assert: "Retry" button visible
  });

  test('Scan My Website triggers expansion and updates panel', async ({ page }) => {
    // Mock POST /api/schema-expansion/run → updated status response
    // Click "Scan My Website" button
    // Assert: loading spinner shows
    // Assert: panel refreshes after response
  });

  test('View Embed Code shows embed snippet for published schema', async ({ page }) => {
    // Click "View ↗" on homepage row (or expand embed code section)
    // Assert: SchemaEmbedModal opens
    // Assert: modal contains <script type="application/ld+json">
    // Assert: "Copy to Clipboard" button visible
  });

  test('Starter plan user sees upgrade prompt, not panel', async ({ page }) => {
    // Mock GET /api/schema-expansion/status → 403
    // Assert: SchemaHealthPanel not rendered (or upgrade prompt shown)
  });

  test('empty state when no schemas generated yet', async ({ page }) => {
    // Mock GET /api/schema-expansion/status → { schema_health_score: null, pages: [], last_run_at: null }
    // Assert: "No schema generated yet" empty state
    // Assert: "Scan My Website" primary CTA visible
  });
});
```

**Total Playwright tests: 9**

**Critical Playwright rules:**
- Always mock `/api/schema-expansion/status` and `/api/schema-expansion/run` — never hit real website crawlers or LLMs
- `data-testid` attributes required: `"schema-health-panel"`, `"schema-score"`, `"schema-row-{page_type}"`, `"scan-website-btn"`, `"approve-{page_type}-btn"`, `"embed-modal"`, `"copy-embed-btn"`
- Use `page.waitForSelector()` — never `page.waitForTimeout()`
- Auth: use existing `loginAsGoldenTenant()` helper

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/website-crawler.test.ts          # 35 tests
npx vitest run src/__tests__/unit/schema-generators.test.ts        # 45 tests
npx vitest run src/__tests__/unit/schema-expansion-service.test.ts # 20 tests
npx vitest run                                                       # ALL unit tests — zero regressions
npx playwright test src/__tests__/e2e/schema-health-panel.spec.ts  # 9 e2e tests
npx tsc --noEmit                                                     # 0 new type errors
```

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/schema-expansion/types.ts` | **CREATE** | GeneratedSchema, PageType, SchemaExpansionResult |
| 2 | `lib/schema-expansion/website-crawler.ts` | **CREATE** | Sitemap parser, page fetcher, type classifier |
| 3 | `lib/schema-expansion/generators/types.ts` | **CREATE** | SchemaGeneratorInput, SchemaGenerator base class |
| 4 | `lib/schema-expansion/generators/local-business.generator.ts` | **CREATE** | LocalBusiness / BarOrPub / Restaurant schema |
| 5 | `lib/schema-expansion/generators/faq-page.generator.ts` | **CREATE** | FAQPage schema + LLM FAQ generation |
| 6 | `lib/schema-expansion/generators/event.generator.ts` | **CREATE** | Event / EventSchedule schema |
| 7 | `lib/schema-expansion/generators/blog-posting.generator.ts` | **CREATE** | BlogPosting / Article schema |
| 8 | `lib/schema-expansion/generators/service.generator.ts` | **CREATE** | Service schema |
| 9 | `lib/schema-expansion/generators/breadcrumb.generator.ts` | **CREATE** | BreadcrumbList (shared helper) |
| 10 | `lib/schema-expansion/generators/index.ts` | **CREATE** | Barrel + SchemaGeneratorRegistry |
| 11 | `lib/schema-expansion/schema-host.ts` | **CREATE** | CDN publish, embed snippet gen, IndexNow ping |
| 12 | `lib/schema-expansion/schema-expansion-service.ts` | **CREATE** | Orchestrator + health score + cron runner |
| 13 | `lib/schema-expansion/index.ts` | **CREATE** | Module barrel export |
| 14 | `app/api/schema-expansion/run/route.ts` | **CREATE** | On-demand expansion API route |
| 15 | `app/api/schema-expansion/status/route.ts` | **CREATE** | Dashboard status route |
| 16 | `app/api/schema-expansion/[id]/approve/route.ts` | **CREATE** | Human approval route |
| 17 | `app/api/cron/schema-drift/route.ts` | **CREATE** | Monthly drift detection cron |
| 18 | `app/dashboard/_components/SchemaHealthPanel.tsx` | **CREATE** | Dashboard schema coverage panel |
| 19 | `app/dashboard/_components/SchemaEmbedModal.tsx` | **CREATE** | Embed code display modal |
| 20 | `app/dashboard/page.tsx` | **MODIFY** | Add SchemaHealthPanel (Growth+ gated) |
| 21 | `vercel.json` | **MODIFY** | Add schema-drift cron (1st of month, 4 AM UTC) |
| 22 | `supabase/migrations/[timestamp]_schema_expansion.sql` | **CREATE** | page_schemas table + 3 columns on locations |
| 23 | `supabase/prod_schema.sql` | **MODIFY** | Add page_schemas + columns |
| 24 | `lib/supabase/database.types.ts` | **MODIFY** | Add PageSchema types + new location columns |
| 25 | `supabase/seed.sql` | **MODIFY** | Seed page_schemas + website_slug for golden tenant |
| 26 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add 3 MOCK_CRAWLED_* fixtures + MOCK_EXPECTED_HOMEPAGE_SCHEMA |
| 27 | `src/__tests__/unit/website-crawler.test.ts` | **CREATE** | 35 unit tests |
| 28 | `src/__tests__/unit/schema-generators.test.ts` | **CREATE** | 45 unit tests |
| 29 | `src/__tests__/unit/schema-expansion-service.test.ts` | **CREATE** | 20 unit tests |
| 30 | `src/__tests__/e2e/schema-health-panel.spec.ts` | **CREATE** | 9 Playwright e2e tests |

---

## 🚫 What NOT to Do

1. **DO NOT touch Magic Engine files** (`lib/gbp/`, `app/api/magic-menu/`, `menu.localvector.ai` routes) — the menu schema pipeline is complete and separate. Sprint 106 covers the client's *own website* pages only.
2. **DO NOT duplicate the `page_audits` logic** — `page_audits` scores pages (AEO grading, Doc 17). `page_schemas` generates and hosts JSON-LD. These are sibling tables with different purposes.
3. **DO NOT auto-publish AI-generated FAQs** — any schema where `missing_fields` includes `'faqs_auto_generated'` MUST be saved as `'pending_review'` and require `human_approved = true` before publishing. This is a HITL (human-in-the-loop) requirement.
4. **DO NOT fabricate schema fields** — if a field can't be populated from Ground Truth or page content, omit it. Never guess or invent values for `geo`, `datePublished`, or `telephone`.
5. **DO NOT re-implement IndexNow** — import and call `lib/indexnow.ts` directly. Zero new IndexNow code.
6. **DO NOT crawl more pages than the plan allows** — enforce `MAX_PAGES_PER_PLAN[planTier]` strictly.
7. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
8. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12) — literal class strings for status colors.
9. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.
10. **DO NOT call real external websites in tests** — all `fetch` calls are mocked via `vi.fn()`.
11. **DO NOT attempt to crawl `menu.localvector.ai` domains** — if a discovered URL's hostname matches the magic menu CDN, skip it entirely (page_type = 'menu', skip generation).
12. **DO NOT edit `middleware.ts`** (AI_RULES §6) — all middleware logic lives in `proxy.ts`.
13. **DO NOT store raw HTML in the database** — only structured extracted data (`CrawledPage`) and generated schema (`GeneratedSchema.json_ld`). Raw HTML is ephemeral.
14. **DO NOT skip robots.txt** — always fetch and respect `Disallow` rules before crawling any page.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `lib/schema-expansion/website-crawler.ts` — sitemap parsing, homepage link extraction, page type classification (heuristic + LLM fallback), FAQ/event extraction, robots.txt compliance
- [ ] `lib/schema-expansion/generators/` — 5 generators implemented (LocalBusiness, FAQPage, Event, BlogPosting, Service) + shared BreadcrumbList helper + SchemaGeneratorRegistry
- [ ] `lib/schema-expansion/schema-host.ts` — CDN publish, embed snippet generation, validateSchemaBeforePublish, IndexNow reuse
- [ ] `lib/schema-expansion/schema-expansion-service.ts` — runSchemaExpansion(), calculateSchemaHealthScore(), runSchemaExpansionForAllLocations()
- [ ] `app/api/schema-expansion/run/route.ts` — auth, plan gate, no_website error, 5 error codes
- [ ] `app/api/schema-expansion/status/route.ts` — returns pages + health score
- [ ] `app/api/schema-expansion/[id]/approve/route.ts` — HITL approval → publish → IndexNow
- [ ] `app/api/cron/schema-drift/route.ts` — CRON_SECRET auth, content_hash change detection, sequential processing
- [ ] `vercel.json` — schema-drift cron added at `0 4 1 * *`
- [ ] `app/dashboard/_components/SchemaHealthPanel.tsx` — score display, per-page-type rows, severity colors, approve/retry CTAs, scan trigger, skeleton loading, empty state, Growth+ plan gate
- [ ] `app/dashboard/_components/SchemaEmbedModal.tsx` — embed snippet display, copy-to-clipboard, public URL
- [ ] `app/dashboard/page.tsx` — SchemaHealthPanel added (Growth+ gated)
- [ ] Migration `[timestamp]_schema_expansion.sql` — page_schemas table + 3 location columns + indexes + RLS + comments
- [ ] `prod_schema.sql` updated — page_schemas table + new location columns
- [ ] `database.types.ts` updated — PageSchema Row/Insert/Update + new location column types
- [ ] `seed.sql` updated — website_slug + schema_health_score + 3 page_schemas rows for golden tenant
- [ ] `golden-tenant.ts` — 3 MOCK_CRAWLED_* fixtures + MOCK_EXPECTED_HOMEPAGE_SCHEMA added
- [ ] `data-testid` attributes on all interactive elements in SchemaHealthPanel and SchemaEmbedModal
- [ ] `npx vitest run src/__tests__/unit/website-crawler.test.ts` — **35 tests passing**
- [ ] `npx vitest run src/__tests__/unit/schema-generators.test.ts` — **45 tests passing**
- [ ] `npx vitest run src/__tests__/unit/schema-expansion-service.test.ts` — **20 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/schema-health-panel.spec.ts` — **9 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written (see format below)

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-03-01 — Sprint 106: Schema Expansion — Beyond Menus (Completed)

**Goal:** Extend LocalVector's schema generation from menus only (Magic Engine, Sprint 89) to every high-value page type on a client's website. AI engines need structured data on homepages, FAQ pages, event listings, blog posts, and service pages — not just menus. This sprint closes that gap.

**Scope:**
- `lib/schema-expansion/website-crawler.ts` — **NEW.** Crawls client website via sitemap or link extraction. Page type classification (heuristic + GPT-4o-mini fallback). FAQ/event content extraction. robots.txt compliance. Per-plan page limits.
- `lib/schema-expansion/generators/` — **NEW.** 5 generators: LocalBusinessGenerator (BarOrPub/Restaurant/LocalBusiness type selection, sameAs from Sprint 105 listing_platform_ids), FAQPageGenerator (extract from page OR generate via LLM — pending_review gate), EventGenerator (Event + EventSchedule for recurring), BlogPostingGenerator (never fabricates dates), ServiceGenerator. Shared BreadcrumbList helper. SchemaGeneratorRegistry.
- `lib/schema-expansion/schema-host.ts` — **NEW.** CDN publish to Supabase Storage. Embed snippet generation. validateSchemaBeforePublish() rule set. IndexNow reuse (lib/indexnow.ts — zero new IndexNow code).
- `lib/schema-expansion/schema-expansion-service.ts` — **NEW.** runSchemaExpansion() orchestrator. calculateSchemaHealthScore() (homepage -30, faq -25, about -15, pending -5 each). runSchemaExpansionForAllLocations() for cron. Skips page_type === 'menu' (Magic Engine owns those).
- `app/api/schema-expansion/run/route.ts` — **NEW.** Auth + Growth+ gate + no_website error.
- `app/api/schema-expansion/status/route.ts` — **NEW.** Dashboard status endpoint.
- `app/api/schema-expansion/[id]/approve/route.ts` — **NEW.** HITL approval → publish → IndexNow.
- `app/api/cron/schema-drift/route.ts` — **NEW.** Monthly drift cron (1st of month, 4 AM UTC). content_hash comparison for change detection.
- `vercel.json` — **MODIFIED.** schema-drift cron at `0 4 1 * *`.
- `app/dashboard/_components/SchemaHealthPanel.tsx` — **NEW.** Score + per-page-type rows + approve/retry/scan CTAs. Growth+ plan gate. Skeleton loading + empty state.
- `app/dashboard/_components/SchemaEmbedModal.tsx` — **NEW.** Embed snippet + copy button + public URL.
- `app/dashboard/page.tsx` — **MODIFIED.** SchemaHealthPanel added.
- `supabase/migrations/[timestamp]_schema_expansion.sql` — **NEW.** page_schemas table + schema_health_score, schema_last_run_at, website_slug on locations.
- `supabase/prod_schema.sql` — **MODIFIED.**
- `lib/supabase/database.types.ts` — **MODIFIED.**
- `supabase/seed.sql` — **MODIFIED.** Golden tenant: website_slug='charcoal-n-chill', schema_health_score=55, 3 page_schemas rows (homepage published, faq pending_review, events failed).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** MOCK_CRAWLED_HOMEPAGE, MOCK_CRAWLED_FAQ, MOCK_CRAWLED_EVENTS, MOCK_EXPECTED_HOMEPAGE_SCHEMA.

**Tests added:**
- `src/__tests__/unit/website-crawler.test.ts` — **35 tests** (all fetch mocked)
- `src/__tests__/unit/schema-generators.test.ts` — **45 tests** (pure + LLM mocked)
- `src/__tests__/unit/schema-expansion-service.test.ts` — **20 tests**
- `src/__tests__/e2e/schema-health-panel.spec.ts` — **9 Playwright tests**
- **Total: 100 Vitest + 9 Playwright — all passing, zero regressions**

**Key decisions:**
- HITL gate for AI-generated FAQs: pending_review status, human_approved required before publish
- Never fabricate schema fields: missing fields are omitted, not guessed
- Magic Engine boundary preserved: page_type === 'menu' skipped entirely
- sameAs populated from Sprint 105 listing_platform_ids (GBP, Yelp URLs) — strong GEO signal
- content_hash for drift detection: avoids regenerating unchanged schemas monthly
- Sequential cron processing to avoid hitting Supabase + external crawl rate limits
```

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 43. 🗂️ Schema Expansion Engine — Centralized in `lib/schema-expansion/` (Sprint 106)

All website crawling, page classification, and JSON-LD schema generation for non-menu pages lives in `lib/schema-expansion/`.

* **Boundary:** Magic Engine (`lib/gbp/`, `app/api/magic-menu/`) owns menu schema. Schema Expansion owns all other page types. Never cross this boundary.
* **HITL requirement:** AI-generated FAQs (when page extraction yields zero FAQs) MUST save as `status: 'pending_review'`. Never auto-publish AI-generated FAQ content. `human_approved` must be `true` before publishSchema() is called.
* **Never fabricate schema fields:** If a value can't be sourced from Ground Truth or page content, omit the field. Zero tolerance for guessed values in `geo`, `datePublished`, or `telephone`.
* **IndexNow reuse:** Always use `lib/indexnow.ts`. Never write new IndexNow HTTP calls.
* **Robots.txt:** Always fetch and respect before crawling. Skip disallowed paths.
* **Adding a new page type:** Add to `PageType` union, create a new generator extending `SchemaGenerator`, register in `SchemaGeneratorRegistry`, add to `calculateSchemaHealthScore()` deduction table, add to migration page_type CHECK constraint.
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| NAP Sync Engine | Sprint 105 | `GroundTruth` type, `listing_platform_ids` table (sameAs URLs), accurate business data for LocalBusiness schema |
| GBP Data Mapper | Sprint 89 | `mapGBPToLocation()` — `openingHoursSpecification` builder logic can be adapted from `mapHours()` |
| Magic Engine | Sprint 89 | Publish pattern for CDN hosting (`magic_menus` → `page_schemas` follows same pattern) |
| IndexNow utility | Sprint 89 | `lib/indexnow.ts` reused for all schema publishes |
| Plan Enforcer | Sprint 3 | Growth+ plan gate |
| SOV + NAP cron pattern | Sprints 83+, 105 | `vercel.json` cron structure, `CRON_SECRET` auth |
| Golden tenant fixtures | All sprints | Additive only — do not break existing exports |

---

## 🧠 Edge Cases to Handle

1. **Website has no sitemap and blocks crawler (403 on all pages):** `crawlWebsite()` returns `{ pages: [], sitemap_found: false }`. Route returns `no_website` error (same as null URL). Surface in dashboard: "We couldn't crawl your website. Ensure your site is publicly accessible."
2. **Page returns 301/302 redirect:** Follow the redirect (up to 3 hops). Record the final URL in `CrawledPage.url`. Do not generate schema for the redirect URL itself.
3. **JavaScript-only pages (SPA — no content in raw HTML):** If fetched HTML has `<body>` with < 100 chars of text content, mark as `page_type: 'other'`, `status: 'failed'`, `error: 'js_rendered_only'`. Surface guidance: "This page requires JavaScript to render. Add server-side rendering or static generation to make it crawlable."
4. **Very large sitemaps (10,000+ URLs):** Only process the first `MAX_PAGES_PER_PLAN[tier]` URLs in sitemap order. Log how many were skipped.
5. **Duplicate content across pages (same body text):** If two pages have identical `body_excerpt`, only generate schema for the first one found. Dedup by content hash, not URL.
6. **Website URL changes (location.website updated):** When `website_slug` stays the same but `website` URL changes, re-crawl and regenerate all schemas. Old schemas go to `'stale'` status until new ones publish.
7. **AI generates FAQs that are factually wrong:** The HITL gate (pending_review) is the defense here — never auto-publish. Ensure the approval UI shows the FAQ question+answer clearly so the business owner can verify accuracy.
8. **IndexNow fails for a published schema:** Log the failure to DEVLOG (DB event log), but do NOT roll back the schema publish. IndexNow is best-effort — the schema is still hosted correctly.
9. **Cron timeout (Vercel 60s or 300s limit):** Process locations in batches of 5 per cron run. Track progress in `locations.schema_last_run_at` — only reprocess locations where `schema_last_run_at < NOW() - INTERVAL '25 days'` (monthly with 5-day buffer).
10. **schema.localvector.ai subdomain not yet configured:** If the publish to Supabase Storage succeeds but the public URL is not accessible, save `status: 'published'` with the storage path and set `public_url` to null. Surface in dashboard as "Published (CDN pending configuration)" — not a failure.

---

## 📚 Document Sync + Git Commit (Run After All Tests Pass)

### Step 1: Update `/docs` files

**`docs/roadmap.md`** — Add Sprint 106 (Schema Expansion) as ✅ 100%.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 106 to completed sprints. Check off all checkboxes.

**`docs/04-INTELLIGENCE-ENGINE-SPEC.md`** — Add: "Schema Expansion Engine added at `lib/schema-expansion/`. Covers 6 page types (LocalBusiness, FAQPage, Event, BlogPosting, Service, AboutPage). Sibling to Magic Engine (menu schema) and Content Grader (page scoring, Doc 17)."

**`docs/17-CONTENT-GRADER.md`** — Add cross-reference note: "Sprint 106 (Schema Expansion) generates and publishes JSON-LD for pages. Content Grader (this doc) *scores* those pages. The two systems are complementary: Schema Expansion ensures the schema exists; Content Grader measures how well the page content itself performs for AEO."

### Step 2: Update `DEVLOG.md`

Paste the DEVLOG entry from the **📓 DEVLOG Entry Format** section above. Replace `[timestamp]` with the actual migration filename. Replace all "N" placeholders with verified test counts via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).

### Step 3: Update `CLAUDE.md`

```markdown
### Sprint 106 — Schema Expansion: Beyond Menus (2026-03-01)
- `lib/schema-expansion/` — website crawler, 5 schema generators, CDN host layer, orchestrator
- `app/api/schema-expansion/` — run, status, approve routes; schema-drift cron
- `app/dashboard/_components/SchemaHealthPanel.tsx` — coverage panel + embed modal
- DB: page_schemas table; schema_health_score, schema_last_run_at, website_slug on locations
- Tests: 100 Vitest + 9 Playwright
- Magic Engine boundary preserved: page_type === 'menu' skipped, Magic Engine untouched
```

### Step 4: Update `MEMORY.md`

```markdown
## Decision: Schema Expansion Architecture (Sprint 106 — 2026-03-01)
- Hard boundary with Magic Engine: Schema Expansion does not touch menu.localvector.ai or magic_menus table
- HITL gate for AI FAQs: pending_review → human_approved required before publish (no exceptions)
- Never fabricate schema field values — omit rather than guess
- CDN hosting pattern mirrors magic_menus: Supabase Storage → schema.localvector.ai subdomain
- content_hash for drift detection: MD5 of page title + body_excerpt
- sameAs populated from Sprint 105 listing_platform_ids — links GBP/Yelp profiles into schema
- IndexNow: reuse lib/indexnow.ts, zero new HTTP call code
- Monthly drift cron: 1st of month, 4 AM UTC (staggers after NAP sync)
```

### Step 5: Update `AI_RULES.md`

Append Rule 43 from the **🔮 AI_RULES Update** section above.

### Step 6: Verify all files are in sync

- [ ] `DEVLOG.md` has Sprint 106 entry with actual test counts
- [ ] `CLAUDE.md` has Sprint 106 in implementation inventory
- [ ] `MEMORY.md` has Schema Expansion architecture decision
- [ ] `AI_RULES.md` has Rule 43
- [ ] `docs/roadmap.md` shows Schema Expansion as ✅ 100%
- [ ] `docs/09-BUILD-PLAN.md` has Sprint 106 checked off
- [ ] `docs/04-INTELLIGENCE-ENGINE-SPEC.md` updated with Schema Expansion note
- [ ] `docs/17-CONTENT-GRADER.md` updated with cross-reference note

### Step 7: Git Commit

```bash
git add -A
git status
git commit -m "Sprint 106: Schema Expansion — Beyond Menus

- lib/schema-expansion/website-crawler.ts: sitemap parser, type classifier (heuristic + LLM), FAQ/event extractor, robots.txt compliance
- lib/schema-expansion/generators/: 5 generators (LocalBusiness, FAQPage, Event, BlogPosting, Service) + BreadcrumbList + SchemaGeneratorRegistry
- lib/schema-expansion/schema-host.ts: CDN publish, embed snippet, validateSchemaBeforePublish, IndexNow reuse
- lib/schema-expansion/schema-expansion-service.ts: orchestrator, health score, cron runner
- app/api/schema-expansion/: run, status, approve routes; schema-drift cron (1st/month 4AM UTC)
- vercel.json: schema-drift cron added
- SchemaHealthPanel: coverage score, per-page rows, approve/retry/scan CTAs, embed modal
- migration: page_schemas table + schema_health_score/schema_last_run_at/website_slug on locations
- seed: golden tenant website_slug + schema_health_score=55 + 3 page_schemas rows
- tests: 100 Vitest passing + 9 Playwright passing — zero regressions
- docs: roadmap, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES Rule 43, Doc 04 + Doc 17 cross-refs

Magic Engine boundary preserved: menu pages skipped, magic_menus untouched.
HITL gate enforced: AI-generated FAQs require human_approved before publish.
Unblocks Sprint 107 (Review Engine) and Sprint 110 (Semantic Authority Mapping)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 106 completes:

- **Schema Expansion: 0% → 100%** — Every major page type on a client's website now has AI-readable JSON-LD
- A business owner can see — in one dashboard panel — exactly which pages have schema, which are pending their review, and which failed
- The `sameAs` property in the LocalBusiness schema links to the GBP and Yelp profiles confirmed accurate by Sprint 105 — closing the loop between listing accuracy and website schema
- AI-generated FAQs are gated behind human approval — no accidental false information goes live without the business owner seeing it first
- Monthly drift detection ensures schemas stay current as website content evolves
- 100 Vitest + 9 Playwright tests protect the crawler, all 5 generators, the CDN host layer, and the dashboard UI
- Sprint 107 (Review Engine) and Sprint 110 (Semantic Authority Mapping) are now unblocked
