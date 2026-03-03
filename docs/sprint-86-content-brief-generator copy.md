# Sprint 86 — SOV Gap → Content Brief Generator (Autopilot Engine)

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Build the **Autopilot Engine** — LocalVector's closed-loop content pipeline that converts detected AI visibility gaps into human-approved, publish-ready content briefs. This is the sprint that transforms LocalVector from a *monitoring tool* into an *action tool*.

The pipeline is: **DETECT → DIAGNOSE → DRAFT → APPROVE → PUBLISH → MEASURE**

Every upstream engine now feeds this one:
- **SOV Engine** — zero-citation clusters → content brief
- **Greed Engine** — competitor gaps (high magnitude) → content brief
- **Review Engine (Sprint 107)** — top negative keywords → content brief targeting reputation repair
- **Schema Expansion (Sprint 106)** — low AEO score pages → content brief to fix the page
- **NAP Sync (Sprint 105)** — unclaimed platforms → GBP post to drive cross-platform presence
- **User-initiated** — business owner clicks "+ New Draft" for any custom topic

Five trigger types, one generation pipeline, one review UI, one publish flow. The `content_drafts` table already exists in `prod_schema.sql` (created in the Sprint 77 rescheduled migration). This sprint implements everything that writes to it and reads from it.

**What this sprint specifically builds:**
1. **`createDraft()` orchestrator** — the master function that accepts any trigger type and produces a draft
2. **`generateDraftBrief()` per trigger type** — GPT-4o-mini prompts customized per trigger context
3. **AEO scorer at draft time** — grades the generated content before the owner even sees it
4. **Draft deduplication** — idempotency checks so the same gap never produces two drafts
5. **Content Drafts Panel** — dashboard UI: list all drafts, review content, approve/reject/edit
6. **Draft approval API** — `POST /api/autopilot/:id/approve` — HITL gate
7. **Draft publish API** — `POST /api/autopilot/:id/publish` — two paths: GBP Post (direct API) or Web Snippet (copy-paste with embed instructions)
8. **Post-publish re-audit** — 48 hours after a draft is published, re-check citation rate for the target query
9. **Weekly autopilot cron** — scans all Growth+ locations for new triggered gaps and auto-creates drafts

**What this sprint does NOT build:**
- WordPress/CMS direct publish integration (post-launch roadmap)
- Email delivery of drafts (post-launch)
- Full occasion engine (30-occasion taxonomy) — that's Sprint 108 dependency

**Gap being closed:** Content Brief Generator 0% → 100%. Unblocks Sprint 108 (Semantic Authority Mapping) which relies on published content signals.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                              — All rules (44+ after Sprint 107)
Read CLAUDE.md                                                     — Project context, implementation inventory
Read MEMORY.md                                                     — Key architectural decisions
Read supabase/prod_schema.sql
  § FIND: content_drafts table (ALREADY EXISTS — do not recreate)
  § FIND: sov_target_queries table (trigger source for prompt_missing)
  § FIND: competitor_intercepts table (trigger source for competitor_gap)
  § FIND: reviews table (Sprint 107 — trigger source for review keyword gaps)
  § FIND: page_schemas table (Sprint 106 — trigger source for low AEO scores)
  § FIND: page_audits table (trigger source for low content scores)
  § FIND: locations table (category, city, amenities — used in prompt building)
Read lib/supabase/database.types.ts                                — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                             — Golden Tenant (org_id: a0eebc99)
Read lib/review-engine/types.ts                                    — ReviewStats, ReviewRecord (Sprint 107)
Read lib/schema-expansion/types.ts                                 — PageType, GeneratedSchema (Sprint 106)
Read lib/nap-sync/types.ts                                         — GroundTruth type (Sprint 105)
Read lib/plan-enforcer.ts                                          — Plan gating
Read lib/supabase/server.ts                                        — createClient() / createServiceRoleClient()
Read app/dashboard/page.tsx                                        — Dashboard — insert ContentDraftsPanel
Read app/api/cron/review-sync/route.ts                             — Sprint 107 cron pattern (follow exactly)
Read vercel.json                                                   — Existing crons
```

**Specifically understand before writing code:**
- The `content_drafts` table already exists — verify its exact column names and constraints from `prod_schema.sql` before writing any insert logic
- The `sov_target_queries` table structure — specifically: `citation_rate`, `last_run_at`, `is_cited` columns needed for zero-citation cluster detection
- The `competitor_intercepts` table — `gap_magnitude`, `winner`, `my_business_name`, `query_text`, `suggested_action` columns used in `competitor_gap` trigger
- The `reviews` table (Sprint 107) — `sentiment_label`, `keywords`, `response_status` columns used in review gap trigger
- The `page_schemas` table (Sprint 106) — `status`, `confidence`, `missing_fields` columns used in schema gap trigger

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/autopilot/
  index.ts                               — barrel export
  types.ts                               — all shared types
  triggers/
    competitor-gap-trigger.ts            — reads competitor_intercepts, detects high-magnitude gaps
    prompt-missing-trigger.ts            — reads sov_target_queries, detects zero-citation clusters
    review-gap-trigger.ts                — reads reviews, detects keyword reputation gaps
    schema-gap-trigger.ts                — reads page_schemas, detects low-coverage locations
    first-mover-trigger.ts               — handles user-initiated first_mover drafts
  generators/
    context-builders.ts                  — pure functions: build context block per trigger type
    brief-generator.ts                   — GPT-4o-mini call + response parsing
    aeo-scorer.ts                        — scores draft content before saving
  draft-deduplicator.ts                  — idempotency: checks for existing draft before creating
  create-draft.ts                        — master orchestrator: trigger → context → generate → score → save
  autopilot-service.ts                   — runAutopilot(): scans all locations for new gaps
```

---

### Component 1: Shared Types — `lib/autopilot/types.ts`

```typescript
import type { PageType } from '@/lib/schema-expansion/types';

/**
 * The five trigger types that can produce a content draft.
 * These match the content_drafts.trigger_type CHECK constraint in prod_schema.sql.
 */
export type DraftTriggerType =
  | 'competitor_gap'    // Greed Engine: competitor winning high-magnitude gap
  | 'prompt_missing'    // SOV: zero-citation cluster for 2+ consecutive weeks
  | 'review_gap'        // Review Engine: repeated negative keywords with no content response
  | 'schema_gap'        // Schema Expansion: location has low schema health score
  | 'first_mover'       // User-initiated: unclaimed AI query opportunity
  | 'manual';           // User-initiated: free-form topic

/**
 * The five publishable content types.
 * These match the content_drafts.content_type CHECK constraint in prod_schema.sql.
 */
export type ContentType =
  | 'faq_page'         // Best for: prompt_missing, review_gap, first_mover
  | 'occasion_page'    // Best for: occasion triggers (Sprint 108)
  | 'blog_post'        // Best for: long-form authority building
  | 'landing_page'     // Best for: competitor_gap (create a dedicated page)
  | 'gbp_post';        // Best for: quick wins, schema_gap, review reputation repair

/**
 * Context block passed to the brief generator.
 * Shape varies by trigger type — each trigger populates different fields.
 */
export interface DraftContext {
  // Shared across all trigger types
  businessName: string;
  category: string;
  city: string;
  state: string;

  // competitor_gap
  competitorName?: string;
  competitorWinningQuery?: string;
  winningFactor?: string;
  suggestedAction?: string;

  // prompt_missing
  zeroCitationQueries?: string[];    // The queries getting 0 citations
  consecutiveZeroWeeks?: number;     // How many weeks in a row

  // review_gap
  topNegativeKeywords?: string[];    // e.g. ["slow service", "wait time"]
  negativeReviewCount?: number;
  unansweredNegativeCount?: number;

  // schema_gap
  schemaHealthScore?: number;        // 0–100
  missingPageTypes?: PageType[];     // Which page types have no schema
  topMissingImpact?: string;         // e.g. "homepage schema missing (−30 points)"

  // first_mover / manual
  targetQuery?: string;
  additionalContext?: string;
  occasionName?: string;             // for occasion-driven first_mover
  daysUntilPeak?: number;
}

/**
 * The input to createDraft().
 */
export interface DraftTriggerInput {
  triggerType: DraftTriggerType;
  triggerId: string | null;          // FK to the source row (competitor_intercepts.id, etc.)
  orgId: string;
  locationId: string;
  context: DraftContext;
  preferredContentType?: ContentType; // Override auto-selection
}

/**
 * Output of the brief generator — before it's saved to DB.
 */
export interface GeneratedBrief {
  draft_title: string;
  draft_content: string;             // Full Answer-First formatted content (~400–600 words)
  target_prompt: string;             // The AI query this content is designed to win
  content_type: ContentType;
  aeo_score: number;                 // 0–100, calculated at generation time
  target_keywords: string[];         // Keywords woven into the content
  estimated_citations_gain: number;  // Estimated weekly citation improvement (rough estimate)
  generation_notes: string;          // Internal notes for debugging / transparency
}

/**
 * Full content draft record (mirrors the DB row).
 */
export interface ContentDraft {
  id: string;
  org_id: string;
  location_id: string | null;
  trigger_type: DraftTriggerType;
  trigger_id: string | null;
  draft_title: string;
  draft_content: string;
  target_prompt: string | null;
  content_type: ContentType;
  aeo_score: number | null;
  status: 'draft' | 'approved' | 'published' | 'rejected' | 'archived';
  human_approved: boolean;
  published_url: string | null;
  published_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Result of a full autopilot scan run.
 */
export interface AutopilotRunResult {
  org_id: string;
  location_id: string;
  drafts_created: number;
  drafts_skipped_dedup: number;      // Already had a draft for this gap
  drafts_skipped_limit: number;      // Monthly draft limit hit
  errors: string[];
  run_at: string;
}

/**
 * Monthly draft creation limits per plan tier.
 * Prevents runaway GPT-4o-mini costs.
 */
export const DRAFT_CREATION_LIMITS: Record<string, number> = {
  trial:   2,
  starter: 5,
  growth:  20,
  agency:  100,
};
```

---

### Component 2: Trigger Detectors — `lib/autopilot/triggers/`

Each trigger detector is a pure async function that queries the DB and returns a list of `DraftTriggerInput` objects for gaps it has found. The orchestrator calls them all.

#### `competitor-gap-trigger.ts`

```typescript
/**
 * Detects competitor gaps that should generate content drafts.
 *
 * Query: select from competitor_intercepts where:
 *   - org_id = orgId AND location_id = locationId
 *   - gap_magnitude = 'high'
 *   - created_at > NOW() - INTERVAL '7 days'  (fresh — only last week's results)
 *   - No existing content_drafts row with trigger_type='competitor_gap'
 *     AND trigger_id = competitor_intercepts.id (idempotency check)
 *
 * Returns: DraftTriggerInput[] — one per qualifying gap
 * Content type: 'faq_page' (default) or 'landing_page' if gap involves a direct feature comparison
 */
export async function detectCompetitorGapTriggers(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
): Promise<DraftTriggerInput[]> { ... }
```

#### `prompt-missing-trigger.ts`

```typescript
/**
 * Detects zero-citation clusters that should generate content drafts.
 *
 * A zero-citation cluster = 3+ tracked queries that ALL have:
 *   - citation_rate = 0 (never cited)
 *   - last_run_at < NOW() - INTERVAL '14 days'  (ran at least twice)
 *   - is_active = true
 *
 * Groups by query_category — one draft per category cluster.
 * (Don't create 5 separate drafts for 5 individual zero-citation queries —
 * create 1 draft that targets the entire uncovered topic area.)
 *
 * Returns: DraftTriggerInput[] — one per zero-citation category cluster
 * Content type: 'faq_page'
 */
export async function detectPromptMissingTriggers(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
): Promise<DraftTriggerInput[]> { ... }
```

#### `review-gap-trigger.ts`

```typescript
/**
 * Detects review keyword patterns that suggest a content gap.
 *
 * Trigger condition:
 *   - 3+ reviews in last 90 days with sentiment_label = 'negative'
 *   - AND 2+ of those reviews share the same keyword (e.g. "slow service")
 *   - AND no content_draft exists with trigger_type = 'review_gap'
 *     created in the last 60 days for this location (throttle — don't re-draft same issue weekly)
 *
 * Content strategy: a review_gap draft is a GBP post or FAQ page that
 * proactively addresses the recurring complaint keyword.
 * e.g. "slow service" → FAQ: "How does Charcoal N Chill manage peak-hour wait times?"
 *
 * Returns: DraftTriggerInput[] — max 1 per location (highest-frequency keyword)
 * Content type: 'gbp_post' (fastest to publish) or 'faq_page' (more durable)
 */
export async function detectReviewGapTriggers(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
): Promise<DraftTriggerInput[]> { ... }
```

#### `schema-gap-trigger.ts`

```typescript
/**
 * Detects schema coverage gaps that need a content brief.
 *
 * Trigger condition:
 *   - locations.schema_health_score < 60 (Sprint 106)
 *   - AND locations.schema_last_run_at IS NOT NULL (has been scanned at least once)
 *   - AND no content_draft exists with trigger_type = 'schema_gap'
 *     in the last 30 days for this location
 *
 * The draft for schema_gap is not a new page — it's a GBP post that
 * adds structured, keyword-rich content immediately while the owner
 * works on the longer-term website schema fixes.
 * Target: homepage-level LocalBusiness facts in a 150-word GBP post.
 *
 * Returns: DraftTriggerInput[] — max 1 per location
 * Content type: 'gbp_post'
 */
export async function detectSchemaGapTriggers(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
): Promise<DraftTriggerInput[]> { ... }
```

#### `first-mover-trigger.ts`

```typescript
/**
 * Handles user-initiated first_mover and manual draft creation.
 * NOT called by the autopilot cron — called directly from the API route.
 *
 * Validates:
 * - targetQuery is present and non-empty
 * - content_type is valid
 * - No duplicate active draft for the same targetQuery + location
 *
 * Returns: DraftTriggerInput (single item)
 */
export async function buildFirstMoverTrigger(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
  targetQuery: string,
  contentType: ContentType,
  additionalContext?: string,
): Promise<DraftTriggerInput> { ... }
```

---

### Component 3: Context Builders — `lib/autopilot/generators/context-builders.ts`

**Pure functions — no I/O.** Take a `DraftTriggerInput` and return a formatted context block string for the GPT-4o-mini prompt.

```typescript
/**
 * Builds the context block for the GPT-4o-mini brief generation prompt.
 * Each trigger type gets a different framing of the problem.
 * Pure function — deterministic given same input.
 */
export function buildContextBlock(trigger: DraftTriggerInput): string { ... }

/**
 * Competitor gap context block.
 * Framing: "A competitor is winning this query. Here's what they're doing. Outdo them."
 *
 * Output format:
 * Business: {businessName} — {category} in {city}, {state}
 * Competitor winning: {competitorName}
 * For query: "{competitorWinningQuery}"
 * Why they're winning: {winningFactor}
 * Suggested action: {suggestedAction}
 */
export function buildCompetitorGapContext(ctx: DraftContext): string { ... }

/**
 * Prompt missing context block.
 * Framing: "AI engines aren't mentioning you for these queries. Create content that fills the gap."
 *
 * Output format:
 * Business: {businessName} — {category} in {city}, {state}
 * Zero-citation queries (2+ consecutive weeks of 0 mentions):
 *   - "{query1}"
 *   - "{query2}"
 *   - "{query3}"
 * Goal: Create content that AI engines can extract as a direct answer to these queries.
 */
export function buildPromptMissingContext(ctx: DraftContext): string { ... }

/**
 * Review gap context block.
 * Framing: "Customers keep mentioning this complaint. Create proactive content that addresses it."
 *
 * Output format:
 * Business: {businessName} — {category} in {city}, {state}
 * Recurring complaint keywords: {topNegativeKeywords.join(', ')}
 * Negative reviews mentioning these: {negativeReviewCount}
 * Goal: Create content that proactively addresses this concern, turning a weakness into a strength signal.
 */
export function buildReviewGapContext(ctx: DraftContext): string { ... }

/**
 * Schema gap context block.
 * Framing: "The business's website isn't readable by AI. Create a GBP post with the key facts."
 *
 * Output format:
 * Business: {businessName} — {category} in {city}, {state}
 * Schema health score: {schemaHealthScore}/100
 * Missing high-value schema: {missingPageTypes.join(', ')}
 * Goal: Create a concise GBP post with structured facts that AI engines can extract
 *       (hours, specialties, amenities, USPs) while the owner fixes their website.
 */
export function buildSchemaGapContext(ctx: DraftContext): string { ... }

/**
 * First mover / manual context block.
 * Framing: "No business is being cited for this query. Be first."
 */
export function buildFirstMoverContext(ctx: DraftContext): string { ... }
```

---

### Component 4: Brief Generator — `lib/autopilot/generators/brief-generator.ts`

```typescript
/**
 * Generates a content brief using GPT-4o-mini.
 *
 * Model: gpt-4o-mini
 * Temperature: 0.4 (lower than review responses — briefs need to be accurate, not creative)
 * Max tokens: 1500
 *
 * System prompt (constant):
 * "You are an expert AEO (Answer Engine Optimization) content strategist
 * for local businesses. You write content that AI search engines can
 * extract as direct, authoritative answers to local queries.
 * Always use Answer-First format: the most important fact in the first sentence.
 * Never use marketing fluff. Every sentence must contain a useful fact.
 * Never fabricate specifics (hours, prices, menu items) that aren't in the context."
 *
 * User message structure:
 * {contextBlock}
 *
 * Content Type: {contentType}
 * {contentTypeInstructions}
 *
 * Return ONLY valid JSON (no markdown, no backticks):
 * {
 *   "draft_title": "...",
 *   "draft_content": "...",
 *   "target_prompt": "...",
 *   "target_keywords": ["...", "..."],
 *   "estimated_citations_gain": number,
 *   "generation_notes": "..."
 * }
 */
export async function generateBrief(
  trigger: DraftTriggerInput,
): Promise<GeneratedBrief> { ... }

/**
 * Content type instructions injected into the user message.
 * Each type has a specific format requirement and word count target.
 */
export const CONTENT_TYPE_INSTRUCTIONS: Record<ContentType, string> = {
  faq_page: `Format: FAQ page with Answer-First intro paragraph (60–80 words) followed by
5–7 Q&A pairs. Each answer: 40–60 words, starts with a direct answer, includes
{businessName} and {city} naturally. Word count: 400–500 total.`,

  occasion_page: `Format: Occasion landing page with Answer-First paragraph (60–80 words),
3 key selling points as short paragraphs, a FAQ section (3–4 Q&A pairs about the occasion).
Include the occasion name, business name, city. Word count: 350–450 total.`,

  blog_post: `Format: Blog post with attention-grabbing title, Answer-First opening paragraph
(60–80 words), 3–4 body sections with H2 headings, closing CTA. Word count: 500–600 total.`,

  landing_page: `Format: Conversion-focused landing page with Answer-First hero paragraph (40–60 words),
key differentiators as short bullets (4–6 items), social proof section (reference real review
keywords from context if available), FAQ section (3–4 pairs), CTA. Word count: 400–500 total.`,

  gbp_post: `Format: Google Business Profile post — concise, keyword-rich, fact-dense.
Answer-First: lead with the most important fact. Include business name, category, city.
1–3 paragraphs max. Word count: 100–200 total. NO hashtags. NO emojis unless specified.`,
};

/**
 * Selects the optimal content type for a given trigger type.
 * Called when the caller doesn't specify preferredContentType.
 */
export function selectContentType(triggerType: DraftTriggerType): ContentType {
  const defaults: Record<DraftTriggerType, ContentType> = {
    competitor_gap: 'faq_page',
    prompt_missing: 'faq_page',
    review_gap:     'gbp_post',
    schema_gap:     'gbp_post',
    first_mover:    'faq_page',
    manual:         'faq_page',
  };
  return defaults[triggerType];
}

/**
 * Parses the LLM response JSON safely.
 * Strips markdown fences if present (LLM sometimes adds them despite instructions).
 * Returns null on parse failure — caller must handle.
 */
export function parseBriefResponse(rawResponse: string): GeneratedBrief | null { ... }
```

---

### Component 5: AEO Scorer — `lib/autopilot/generators/aeo-scorer.ts`

```typescript
/**
 * Scores a generated draft on its AEO readiness before saving to DB.
 * Pure function — no I/O.
 * Simplified 4-dimension scoring (not the full 5-dimension Content Grader from Doc 17 —
 * that requires a live page fetch; this operates on raw draft text only).
 *
 * Dimensions (total 100 points):
 * 1. Answer-First (30 pts): Does the first sentence contain the business name + category?
 * 2. Keyword Density (25 pts): Are {businessName} + {city} mentioned ≥3× each?
 * 3. FAQ Presence (25 pts): Does the draft contain ≥3 Q&A pairs? (for faq_page type)
 *    For gbp_post: are there ≥3 distinct facts in the post?
 * 4. Entity Completeness (20 pts): Does the draft contain phone, hours, or address?
 *    (Even partial — "located in Alpharetta" counts)
 *
 * Returns: number 0–100
 */
export function scoreAEODraft(
  draftContent: string,
  contentType: ContentType,
  context: DraftContext,
): number { ... }

/**
 * Checks if the first sentence is Answer-First.
 * Criteria: first sentence (before first period) contains both:
 * - businessName or a close variant
 * - a category keyword (from context.category or known category synonyms)
 */
export function isAnswerFirst(firstSentence: string, context: DraftContext): boolean { ... }

/**
 * Counts how many times a term appears in text (case-insensitive).
 */
export function countMentions(text: string, term: string): number { ... }
```

---

### Component 6: Draft Deduplicator — `lib/autopilot/draft-deduplicator.ts`

```typescript
/**
 * Checks if a draft already exists for the given trigger.
 * Prevents the autopilot cron from creating duplicate drafts.
 *
 * Deduplication rules by trigger type:
 * - competitor_gap: exact trigger_id match (competitor_intercepts.id)
 * - prompt_missing: same location_id + trigger_type + same target_prompt text
 *   (queries grouped by category, so target_prompt is the category-level brief query)
 * - review_gap: same location_id + trigger_type + created_at > NOW() - INTERVAL '60 days'
 * - schema_gap: same location_id + trigger_type + created_at > NOW() - INTERVAL '30 days'
 * - first_mover / manual: same location_id + same target_query (case-insensitive) + status != 'rejected'
 *
 * Returns: true if a draft already exists (should skip creation)
 */
export async function draftExists(
  supabase: ReturnType<typeof createServiceRoleClient>,
  trigger: DraftTriggerInput,
): Promise<boolean> { ... }
```

---

### Component 7: Create Draft Orchestrator — `lib/autopilot/create-draft.ts`

```typescript
/**
 * Master function — takes a trigger, generates a brief, scores it, and saves to DB.
 *
 * Flow:
 * 1. Check plan draft limit (DRAFT_CREATION_LIMITS)
 * 2. Run draftExists() — return early if duplicate
 * 3. Build context block (buildContextBlock)
 * 4. Select content type (selectContentType or use preferredContentType)
 * 5. Call generateBrief() → GeneratedBrief
 * 6. Score with scoreAEODraft()
 * 7. Insert into content_drafts table
 * 8. Return ContentDraft
 *
 * Uses createServiceRoleClient() — runs in cron and API route contexts.
 * Never throws — returns { ok: false, error } on failure.
 */
export async function createDraft(
  supabase: ReturnType<typeof createServiceRoleClient>,
  trigger: DraftTriggerInput,
): Promise<{ ok: boolean; draft?: ContentDraft; error?: string }> { ... }

/**
 * Checks if the org has hit its monthly draft creation limit.
 * Counts content_drafts rows where org_id = orgId AND created_at > start of current month.
 */
export async function checkDraftLimit(
  supabase: ReturnType<typeof createServiceRoleClient>,
  orgId: string,
  planTier: string,
): Promise<{ allowed: boolean; current: number; limit: number }> { ... }
```

---

### Component 8: Autopilot Service — `lib/autopilot/autopilot-service.ts`

```typescript
/**
 * Runs the full autopilot scan for a single location.
 * Called by the autopilot cron AND the on-demand API route.
 *
 * Flow:
 * 1. Fetch plan tier for orgId
 * 2. Check draft limit — if at limit, skip all trigger detection
 * 3. Run all 4 trigger detectors in parallel (Promise.allSettled):
 *    - detectCompetitorGapTriggers()
 *    - detectPromptMissingTriggers()
 *    - detectReviewGapTriggers()
 *    - detectSchemaGapTriggers()
 * 4. Collect all DraftTriggerInput[] from detectors
 * 5. For each trigger (in priority order: competitor_gap > prompt_missing > review_gap > schema_gap):
 *    - Call createDraft()
 *    - Stop if draft limit is reached mid-run
 * 6. Return AutopilotRunResult
 *
 * Priority order rationale: competitor_gap has highest immediate ROI, schema_gap is lowest urgency.
 * Uses createServiceRoleClient().
 * Never throws.
 */
export async function runAutopilot(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
): Promise<AutopilotRunResult> { ... }

/**
 * Runs autopilot for ALL active Growth+ locations.
 * Called by the weekly autopilot cron.
 * Sequential processing — never parallel (DB and GPT-4o-mini rate limits).
 */
export async function runAutopilotForAllLocations(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<{ processed: number; drafts_created: number; errors: number }> { ... }

/**
 * Schedules a post-publish re-audit for a content draft.
 * Called after a draft is published.
 * Inserts a record into a 'post_publish_audits' queue table
 * that the autopilot cron will process 48 hours later.
 *
 * Re-audit checks: did the target_prompt's citation_rate improve?
 * (by re-running a Perplexity Sonar query for target_prompt and checking if the business is cited)
 */
export async function schedulePostPublishAudit(
  supabase: ReturnType<typeof createServiceRoleClient>,
  draftId: string,
  targetPrompt: string,
  locationId: string,
  orgId: string,
): Promise<void> { ... }
```

---

### Component 9: API Routes

#### `app/api/autopilot/run/route.ts`

```typescript
/**
 * POST /api/autopilot/run
 * On-demand autopilot scan for authenticated user's location.
 * Triggers all gap detectors and creates any new drafts found.
 *
 * Error codes:
 * - "unauthorized"            — no session
 * - "plan_upgrade_required"   — Starter plan (Growth+ only)
 * - "no_location"             — org has no location
 * - "draft_limit_reached"     — monthly limit already hit
 * - "run_failed"              — runAutopilot threw
 */
export async function POST(request: Request) { ... }
```

#### `app/api/autopilot/drafts/route.ts`

```typescript
/**
 * GET /api/autopilot/drafts
 * Returns paginated list of content_drafts for the authenticated user's org.
 * Query params: ?status=draft&page=1&limit=10
 * Default sort: created_at DESC
 * Includes: all fields + trigger source name (denormalized for display)
 *
 * POST /api/autopilot/drafts
 * Creates a manual or first_mover draft.
 * Body: { target_query, content_type, additional_context?, trigger_type: 'manual'|'first_mover' }
 * Calls buildFirstMoverTrigger() → createDraft()
 */
export async function GET(request: Request) { ... }
export async function POST(request: Request) { ... }
```

#### `app/api/autopilot/[id]/approve/route.ts`

```typescript
/**
 * POST /api/autopilot/:id/approve
 * Sets human_approved = true, status = 'approved', approved_at = now().
 * CRITICAL: This is the HITL gate. Server-side MUST verify:
 *   1. draft.org_id matches the authenticated user's org
 *   2. draft.status === 'draft' (not already approved/rejected)
 * Allows optional body: { edited_content: string } — user can edit before approving.
 * If edited_content provided: update draft_content before setting approved.
 *
 * Error codes:
 * - "not_found"               — draft ID not found or wrong org
 * - "already_processed"       — status is not 'draft'
 * - "unauthorized"            — session/org mismatch
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) { ... }
```

#### `app/api/autopilot/[id]/publish/route.ts`

```typescript
/**
 * POST /api/autopilot/:id/publish
 * Publishes an approved draft to the selected channel.
 * CRITICAL: Server-side MUST verify:
 *   1. draft.human_approved === true
 *   2. draft.status === 'approved'
 *   (Both conditions required — never publish if either fails)
 *
 * Body: { publish_channel: 'gbp_post' | 'web_snippet' }
 *
 * publish_channel = 'gbp_post':
 *   - Calls GBP Posts API: POST https://mybusiness.googleapis.com/v4/{parent}/localPosts
 *   - Uses existing gbp_connections token (same token refresh pattern as Sprint 89/107)
 *   - GBP Post body: { languageCode: 'en', summary: draft_content (max 1500 chars),
 *                      callToAction: { actionType: 'LEARN_MORE', url: location.website } }
 *   - On success: update draft status = 'published', published_url = GBP post URL, published_at = now()
 *   - Call schedulePostPublishAudit() for citation tracking
 *
 * publish_channel = 'web_snippet':
 *   - Does NOT post anywhere
 *   - Returns { ok: true, snippet: draft_content, copy_instructions: string }
 *   - Updates draft status = 'published', published_url = 'web_snippet:manual'
 *   - User copies the content and publishes it to their website manually
 *
 * Error codes:
 * - "not_approved"            — human_approved is false or status !== 'approved'
 * - "invalid_channel"         — unknown publish_channel
 * - "gbp_not_connected"       — no gbp_connections row for this location
 * - "gbp_post_failed"         — GBP API error
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) { ... }
```

#### `app/api/autopilot/[id]/reject/route.ts`

```typescript
/**
 * POST /api/autopilot/:id/reject
 * Sets status = 'rejected'. Soft delete — row remains in DB for audit trail.
 * Optional body: { reason: string } — stored in a notes field if present.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) { ... }
```

#### `app/api/autopilot/status/route.ts`

```typescript
/**
 * GET /api/autopilot/status
 * Returns autopilot health summary for dashboard panel.
 *
 * Response:
 * {
 *   drafts_pending: number,        // status = 'draft'
 *   drafts_approved: number,       // status = 'approved' (approved but not yet published)
 *   drafts_published: number,      // total published
 *   drafts_this_month: number,     // created this calendar month
 *   draft_limit: number,           // plan limit
 *   last_run_at: string | null,    // last autopilot scan
 *   top_pending_draft: ContentDraft | null,  // highest-priority pending draft
 * }
 */
export async function GET(request: Request) { ... }
```

#### `app/api/cron/autopilot/route.ts`

```typescript
/**
 * GET /api/cron/autopilot
 * Weekly autopilot cron — runs gap detection and creates drafts for all Growth+ locations.
 * Also processes any post_publish_audits that are due (48h+ after publish).
 * Schedule: every Wednesday at 2 AM UTC (mid-week, distinct from Monday SOV/NAP croons)
 * Security: CRON_SECRET header.
 */
export async function GET(request: Request) { ... }
```

**Update `vercel.json`:**
```json
{
  "crons": [
    { "path": "/api/cron/sov",          "schedule": "0 2 * * 1" },
    { "path": "/api/cron/nap-sync",     "schedule": "0 3 * * 1" },
    { "path": "/api/cron/schema-drift", "schedule": "0 4 1 * *" },
    { "path": "/api/cron/review-sync",  "schedule": "0 1 * * 0" },
    { "path": "/api/cron/autopilot",    "schedule": "0 2 * * 3" }
  ]
}
```

---

### Component 10: Migration

**IMPORTANT:** The `content_drafts` table already exists. This migration adds only what's new.

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 86: Autopilot Engine — Additive Changes Only
-- content_drafts table ALREADY EXISTS — do not recreate
-- ══════════════════════════════════════════════════════════════

-- 1. Add missing columns to content_drafts (if not already present)
ALTER TABLE public.content_drafts
  ADD COLUMN IF NOT EXISTS target_keywords  text[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS generation_notes text;

COMMENT ON COLUMN public.content_drafts.target_keywords IS
  'Keywords woven into the draft by the generator. Sprint 86.';
COMMENT ON COLUMN public.content_drafts.rejection_reason IS
  'Optional reason when status = rejected. Sprint 86.';

-- 2. post_publish_audits — tracks pending citation re-checks after publish
CREATE TABLE IF NOT EXISTS public.post_publish_audits (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id       uuid        NOT NULL REFERENCES public.content_drafts(id) ON DELETE CASCADE,
  location_id    uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id         uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  target_prompt  text        NOT NULL,   -- The query to re-run after publish
  scheduled_for  timestamptz NOT NULL,   -- publish_at + 48 hours
  run_at         timestamptz,            -- NULL = pending
  citation_before numeric(3,2),          -- Citation rate before publish
  citation_after  numeric(3,2),          -- Citation rate after publish
  improved       boolean,                -- citation_after > citation_before
  status         text        NOT NULL CHECK (status IN ('pending','completed','failed'))
                             DEFAULT 'pending',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_publish_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_publish_audits: org members read own"
  ON public.post_publish_audits FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "post_publish_audits: service role full access"
  ON public.post_publish_audits USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_post_publish_audits_pending
  ON public.post_publish_audits (scheduled_for)
  WHERE status = 'pending';

COMMENT ON TABLE public.post_publish_audits IS
  'Tracks 48-hour post-publish citation re-checks. Closes the feedback loop. Sprint 86.';

-- 3. Add autopilot columns to locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS autopilot_last_run_at  timestamptz,
  ADD COLUMN IF NOT EXISTS drafts_pending_count   integer DEFAULT 0;

COMMENT ON COLUMN public.locations.autopilot_last_run_at IS
  'Last time autopilot ran for this location. Sprint 86.';
```

**Update `prod_schema.sql`:** Add the 2 new columns on `content_drafts`, `post_publish_audits` table, and 2 new columns on `locations`.

**Update `database.types.ts`:** Add new types for the new columns and `post_publish_audits`.

---

### Component 11: Seed Data — `supabase/seed.sql`

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 86: Autopilot Engine seed data for golden tenant
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_location_id uuid;
  v_org_id      uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  SELECT id INTO v_location_id
    FROM public.locations
   WHERE org_id = v_org_id
   LIMIT 1;

  -- Seed 3 realistic content drafts for Charcoal N Chill

  -- 1. Competitor gap draft (approved, ready to publish)
  INSERT INTO public.content_drafts (
    org_id, location_id, trigger_type, draft_title, draft_content,
    target_prompt, content_type, aeo_score, status, human_approved,
    target_keywords
  ) VALUES (
    v_org_id, v_location_id,
    'competitor_gap',
    'Hookah Lounge with Live Entertainment in Alpharetta | Charcoal N Chill',
    E'Charcoal N Chill is Alpharetta''s premier hookah lounge, offering over 50 premium hookah flavors alongside authentic Indo-American fusion cuisine and live entertainment every weekend.\n\n**What makes Charcoal N Chill different?**\nUnlike other hookah bars in the Alpharetta area, Charcoal N Chill combines a full-service restaurant with weekly live events including belly dancing shows, Afrobeats nights, and themed cultural evenings.\n\n**Frequently Asked Questions**\n\nQ: What hookah flavors does Charcoal N Chill offer?\nA: We offer over 50 premium hookah flavors including fruit blends, mint varieties, and signature specialty mixes. Our shisha is refreshed weekly.\n\nQ: Do you serve food at Charcoal N Chill?\nA: Yes — we serve authentic Indo-American fusion cuisine including clay oven breads, tandoori platters, and fusion appetizers alongside our hookah service.\n\nQ: What live entertainment does Charcoal N Chill have?\nA: We feature weekly belly dancing shows on Fridays, Afrobeats DJ nights on Saturdays, and rotating themed cultural evenings including Latino Night and Punjabi Night.\n\nQ: Where is Charcoal N Chill located?\nA: We are located at 11950 Jones Bridge Rd, Suite 103, Alpharetta, GA 30005, serving Alpharetta, Johns Creek, Roswell, and the greater North Atlanta area.\n\nQ: What are Charcoal N Chill''s hours?\nA: Tuesday–Thursday 5PM–1AM, Friday–Saturday 5PM–2AM. Closed Sunday and Monday.',
    'best hookah lounge with live entertainment Alpharetta',
    'faq_page',
    82,
    'approved',
    true,
    ARRAY['premium hookah', 'Indo-American fusion', 'live entertainment', 'belly dancing', 'Alpharetta']
  )
  ON CONFLICT DO NOTHING;

  -- 2. Prompt missing draft (draft, pending review)
  INSERT INTO public.content_drafts (
    org_id, location_id, trigger_type, draft_title, draft_content,
    target_prompt, content_type, aeo_score, status, human_approved,
    target_keywords
  ) VALUES (
    v_org_id, v_location_id,
    'prompt_missing',
    'Private Event Venue in Alpharetta — Hookah & Dinner Packages | Charcoal N Chill',
    E'Charcoal N Chill offers private event packages in Alpharetta combining premium hookah service, Indo-American fusion catering, and customizable entertainment for corporate events, birthday parties, and celebrations.\n\nPrivate events at Charcoal N Chill include reserved VIP sections, dedicated hookah hosts, custom menu selections, and optional live entertainment add-ons. We accommodate groups of 10–80 guests.\n\nQ: Does Charcoal N Chill host private events?\nA: Yes — we host private corporate events, birthday parties, bachelorette parties, and group celebrations with customized packages.\n\nQ: How do I book a private event at Charcoal N Chill?\nA: Contact us at info@charcoalnchill.com or call (470) 555-0123 to discuss available dates and package options.\n\nQ: What is included in a private event package?\nA: Packages include a reserved venue section, hookah service for the group, a curated food menu, and optional live entertainment. Pricing varies by group size and selections.',
    'private event venue hookah dinner Alpharetta',
    'faq_page',
    74,
    'draft',
    false,
    ARRAY['private event', 'VIP section', 'hookah packages', 'group celebrations', 'Alpharetta']
  )
  ON CONFLICT DO NOTHING;

  -- 3. Review gap draft (GBP post addressing slow service keyword)
  INSERT INTO public.content_drafts (
    org_id, location_id, trigger_type, draft_title, draft_content,
    target_prompt, content_type, aeo_score, status, human_approved,
    target_keywords
  ) VALUES (
    v_org_id, v_location_id,
    'review_gap',
    'Our Commitment to Service at Charcoal N Chill',
    E'At Charcoal N Chill in Alpharetta, every guest deserves premium hookah service and attentive hospitality from the moment they arrive. We''ve recently expanded our service team on Friday and Saturday evenings to ensure faster hookah setup and more responsive table service during our busiest nights.\n\nWe take every piece of feedback seriously. If you''ve ever experienced a wait that didn''t meet your expectations, we''d love the chance to make it right — contact us directly at info@charcoalnchill.com.',
    'hookah lounge good service fast Alpharetta',
    'gbp_post',
    68,
    'draft',
    false,
    ARRAY['premium hookah service', 'attentive hospitality', 'Alpharetta', 'Friday Saturday']
  )
  ON CONFLICT DO NOTHING;

  -- Update location autopilot state
  UPDATE public.locations
     SET autopilot_last_run_at = NOW() - INTERVAL '2 days',
         drafts_pending_count  = 2
   WHERE id = v_location_id;
END $$;
```

---

### Component 12: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
/**
 * Sprint 86 — Autopilot Engine fixtures for golden tenant (Charcoal N Chill).
 */
import type {
  DraftTriggerInput,
  DraftContext,
  ContentDraft,
  GeneratedBrief,
} from '@/lib/autopilot/types';

export const MOCK_COMPETITOR_GAP_CONTEXT: DraftContext = {
  businessName: 'Charcoal N Chill',
  category: 'Hookah Bar',
  city: 'Alpharetta',
  state: 'GA',
  competitorName: 'Cloud 9 Hookah Lounge',
  competitorWinningQuery: 'best hookah lounge with live entertainment Alpharetta',
  winningFactor: 'Dedicated "Entertainment" page with FAQ schema targeting live event queries',
  suggestedAction: 'Create an FAQ page targeting entertainment + hookah queries',
};

export const MOCK_PROMPT_MISSING_CONTEXT: DraftContext = {
  businessName: 'Charcoal N Chill',
  category: 'Hookah Bar',
  city: 'Alpharetta',
  state: 'GA',
  zeroCitationQueries: [
    'private event venue hookah dinner Alpharetta',
    'corporate hookah party Alpharetta',
    'birthday hookah lounge north Atlanta',
  ],
  consecutiveZeroWeeks: 3,
};

export const MOCK_REVIEW_GAP_CONTEXT: DraftContext = {
  businessName: 'Charcoal N Chill',
  category: 'Hookah Bar',
  city: 'Alpharetta',
  state: 'GA',
  topNegativeKeywords: ['slow service', 'wait time'],
  negativeReviewCount: 4,
  unansweredNegativeCount: 1,
};

export const MOCK_COMPETITOR_GAP_TRIGGER: DraftTriggerInput = {
  triggerType: 'competitor_gap',
  triggerId: 'intercept-abc123',
  orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  locationId: 'loc-golden-tenant-id',
  context: MOCK_COMPETITOR_GAP_CONTEXT,
};

export const MOCK_GENERATED_BRIEF: GeneratedBrief = {
  draft_title: 'Hookah Lounge with Live Entertainment in Alpharetta | Charcoal N Chill',
  draft_content: 'Charcoal N Chill is Alpharetta\'s premier hookah lounge...',
  target_prompt: 'best hookah lounge with live entertainment Alpharetta',
  content_type: 'faq_page',
  aeo_score: 82,
  target_keywords: ['premium hookah', 'Indo-American fusion', 'live entertainment'],
  estimated_citations_gain: 3,
  generation_notes: 'competitor_gap trigger — targeting Cloud 9 entertainment gap',
};
```

---

### Component 13: Content Drafts Dashboard Panel — `app/dashboard/_components/ContentDraftsPanel.tsx`

```
┌────────────────────────────────────────────────────────────────────┐
│  ✍️  Content Drafts                     2 pending  |  1 approved   │
│  [Run Autopilot →]                 Monthly: 3/20 drafts used       │
├────────────────────────────────────────────────────────────────────┤
│  🔴 ACTION NEEDED                                                    │
│  You have 1 approved draft ready to publish.                        │
├────────────────────────────────────────────────────────────────────┤
│  TITLE                          TRIGGER        TYPE    AEO  STATUS  │
│  ────────────────────────────────────────────────────────────────  │
│  Hookah Lounge with Live Ent... Competitor Gap FAQ     82   Approved [Publish →] │
│  Private Event Venue Alphare... Prompt Missing FAQ     74   Draft   [Review]     │
│  Our Commitment to Service...   Review Gap     GBP     68   Draft   [Review]     │
├────────────────────────────────────────────────────────────────────┤
│  [+ Create New Draft]                                               │
└────────────────────────────────────────────────────────────────────┘
```

**Implementation rules:**
- `'use client'` — loads via `GET /api/autopilot/status` + `GET /api/autopilot/drafts`
- Plan gate: Growth+ only — Starter sees upgrade prompt
- Priority sort: `approved` first, then `draft` by `aeo_score DESC`
- **"Publish →" (approved):** Opens `PublishDraftModal` with channel selection (GBP Post / Web Snippet)
- **"Review" (draft):** Opens `DraftReviewModal` with full draft content, editable, approve/reject CTAs
- **"Run Autopilot":** Calls `POST /api/autopilot/run`, shows loading + result count toast
- **"+ Create New Draft":** Opens `NewDraftModal` — free-form query input + content type picker
- AEO score colored: ≥80 green, 60–79 yellow, <60 red
- Trigger type badges: Competitor Gap (orange), Prompt Missing (blue), Review Gap (red), Schema Gap (gray), Manual (purple)
- Monthly usage bar: `drafts_this_month / draft_limit`
- All interactive elements: `data-testid` attributes required
- Skeleton loading while data fetches

---

### Component 14: Draft Review Modal — `app/dashboard/_components/DraftReviewModal.tsx`

```
┌─────────────────────────────────────────────────────────────────────┐
│  📄 Review Draft — FAQ Page                          AEO Score: 74  │
│  Triggered by: Prompt Missing (3 zero-citation queries)             │
│  Target query: "private event venue hookah dinner Alpharetta"       │
│  ────────────────────────────────────────────────────────────────── │
│  Title:                                                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Private Event Venue in Alpharetta — Hookah & Dinner Packages  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  Content:                                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Charcoal N Chill offers private event packages in Alpharetta │  │
│  │ combining premium hookah service, Indo-American fusion...    │  │
│  │                                                              │  │
│  │ [editable textarea — full draft content]                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  Keywords woven in: private event · VIP section · hookah packages  │
│  ────────────────────────────────────────────────────────────────── │
│  [Reject]              [Save Edits]         [✅ Approve Draft]       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Component 15: Publish Draft Modal — `app/dashboard/_components/PublishDraftModal.tsx`

```
┌─────────────────────────────────────────────────────────────────────┐
│  🚀 Publish Draft                                                    │
│  "Hookah Lounge with Live Entertainment in Alpharetta"              │
│  ────────────────────────────────────────────────────────────────── │
│  Choose publish channel:                                             │
│                                                                      │
│  ◉ Post to Google Business Profile                                  │
│    Publishes immediately as a GBP post. Visible in Google Maps      │
│    and search results within 24 hours.                               │
│                                                                      │
│  ○ Copy for Website                                                  │
│    Get a formatted snippet to paste onto your FAQ page or blog.     │
│    You'll publish it yourself on your website.                       │
│  ────────────────────────────────────────────────────────────────── │
│  [Cancel]                                    [Publish Now →]         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/autopilot-context-builders.test.ts`

**Target: `lib/autopilot/generators/context-builders.ts`**
**Pure functions — zero mocks.**

```
describe('buildCompetitorGapContext')
  1.  includes businessName in output
  2.  includes competitorName in output
  3.  includes competitorWinningQuery in output
  4.  includes winningFactor in output
  5.  includes suggestedAction in output
  6.  uses MOCK_COMPETITOR_GAP_CONTEXT → produces deterministic output

describe('buildPromptMissingContext')
  7.  includes all zeroCitationQueries as bullet list
  8.  includes consecutiveZeroWeeks in output
  9.  includes businessName and city

describe('buildReviewGapContext')
  10. includes topNegativeKeywords joined as string
  11. includes negativeReviewCount in output

describe('buildSchemaGapContext')
  12. includes schemaHealthScore in output
  13. includes missingPageTypes joined

describe('selectContentType')
  14. 'competitor_gap' → 'faq_page'
  15. 'review_gap' → 'gbp_post'
  16. 'schema_gap' → 'gbp_post'
  17. 'prompt_missing' → 'faq_page'
  18. 'first_mover' → 'faq_page'
  19. 'manual' → 'faq_page'

describe('parseBriefResponse')
  20. parses clean JSON string correctly
  21. strips ```json fences before parsing
  22. returns null for malformed JSON
  23. returns null for empty string
```

**23 tests total. Zero mocks.**

---

### Test File 2: `src/__tests__/unit/autopilot-aeo-scorer.test.ts`

**Target: `lib/autopilot/generators/aeo-scorer.ts`**
**Pure functions — zero mocks.**

```
describe('isAnswerFirst')
  1.  true when first sentence contains businessName
  2.  false when first sentence is generic ("Welcome to our page...")
  3.  true when first sentence contains category synonym

describe('countMentions')
  4.  returns 3 for term appearing 3 times (case-insensitive)
  5.  returns 0 for term not present

describe('scoreAEODraft')
  6.  MOCK_GENERATED_BRIEF.draft_content → score ≥ 80
  7.  draft with no business name mentions → score < 60
  8.  gbp_post type with 3+ distinct facts → higher fact density score
  9.  faq_page with 5 Q&A pairs → full FAQ presence score
  10. faq_page with 2 Q&A pairs → partial FAQ score
  11. draft missing city mention → lower entity completeness score
  12. score is always between 0 and 100
```

**12 tests total. Zero mocks.**

---

### Test File 3: `src/__tests__/unit/autopilot-deduplicator.test.ts`

**Target: `lib/autopilot/draft-deduplicator.ts`**

```
describe('draftExists')
  1.  returns true when competitor_gap trigger_id already has a draft
  2.  returns false when no draft exists for trigger_id
  3.  returns true for review_gap within 60-day throttle window
  4.  returns false for review_gap outside 60-day window
  5.  returns true for schema_gap within 30-day throttle window
  6.  returns false for schema_gap outside 30-day window
  7.  returns true for manual with same target_query (case-insensitive)
  8.  returns false for manual with different target_query
  9.  ignores 'rejected' status drafts in dedup check (rejected drafts can be re-triggered)
```

**9 tests total.**

---

### Test File 4: `src/__tests__/unit/autopilot-triggers.test.ts`

**Target: all trigger detectors.**
**Supabase mocked.**

```
describe('detectCompetitorGapTriggers')
  1.  returns DraftTriggerInput for high-magnitude intercept from last 7 days
  2.  skips intercepts older than 7 days
  3.  skips medium/low magnitude intercepts
  4.  skips intercept that already has a content_draft (idempotency)
  5.  returns empty array when no qualifying intercepts

describe('detectPromptMissingTriggers')
  6.  returns trigger when 3+ queries have citation_rate = 0 for 2+ weeks
  7.  groups queries by category — one trigger per category
  8.  skips categories with < 3 zero-citation queries
  9.  includes zeroCitationQueries array in context
  10. returns empty array when no zero-citation clusters

describe('detectReviewGapTriggers')
  11. returns trigger when 2+ reviews share same negative keyword in 90 days
  12. selects highest-frequency keyword
  13. respects 60-day throttle — no trigger if recent draft exists
  14. returns empty array when fewer than 3 negative reviews in 90 days

describe('detectSchemaGapTriggers')
  15. returns trigger when schema_health_score < 60
  16. skips when schema_health_score >= 60
  17. skips when schema_last_run_at IS NULL (never scanned)
  18. respects 30-day throttle

describe('checkDraftLimit')
  19. returns allowed: true when under limit
  20. returns allowed: false when at or over limit
  21. counts only current calendar month drafts
```

**21 tests total.**

---

### Test File 5: `src/__tests__/unit/autopilot-routes.test.ts`

**Target: `app/api/autopilot/` routes.**

```
describe('POST /api/autopilot/run')
  1.  returns 401 when not authenticated
  2.  returns 403 with 'plan_upgrade_required' for Starter
  3.  returns 422 with 'draft_limit_reached' when monthly limit hit
  4.  returns { ok: true, result: AutopilotRunResult } on success

describe('POST /api/autopilot/:id/approve')
  5.  sets human_approved = true and status = 'approved'
  6.  returns 404 when draft not found or wrong org
  7.  returns 422 with 'already_processed' when status != 'draft'
  8.  accepts edited_content in body — updates draft_content before approving
  9.  returns 401 when session org does not match draft org

describe('POST /api/autopilot/:id/publish')
  10. returns 403 with 'not_approved' when human_approved is false
  11. returns 403 with 'not_approved' when status != 'approved'
  12. gbp_post channel: calls GBP Posts API with correct body
  13. gbp_post channel: updates status = 'published' on success
  14. gbp_post channel: calls schedulePostPublishAudit() after success
  15. web_snippet channel: does NOT call GBP API
  16. web_snippet channel: returns { ok: true, snippet: string }
  17. web_snippet channel: sets published_url = 'web_snippet:manual'
  18. returns 422 with 'gbp_not_connected' when no GBP connection

describe('POST /api/autopilot/:id/reject')
  19. sets status = 'rejected'
  20. stores rejection_reason when provided in body

describe('POST /api/autopilot/drafts — manual creation')
  21. calls buildFirstMoverTrigger() with correct args
  22. returns 422 when target_query is empty
  23. returns { ok: true, draft } on success
```

**23 tests total.**

---

### Test File 6: `src/__tests__/e2e/content-drafts-panel.spec.ts` — Playwright

```typescript
const MOCK_DRAFTS_RESPONSE = {
  drafts: [
    {
      id: 'draft-001',
      trigger_type: 'competitor_gap',
      draft_title: 'Hookah Lounge with Live Entertainment in Alpharetta',
      content_type: 'faq_page',
      aeo_score: 82,
      status: 'approved',
      human_approved: true,
      target_prompt: 'best hookah lounge with live entertainment Alpharetta',
    },
    {
      id: 'draft-002',
      trigger_type: 'prompt_missing',
      draft_title: 'Private Event Venue in Alpharetta',
      content_type: 'faq_page',
      aeo_score: 74,
      status: 'draft',
      human_approved: false,
      target_prompt: 'private event venue hookah dinner Alpharetta',
    },
    {
      id: 'draft-003',
      trigger_type: 'review_gap',
      draft_title: 'Our Commitment to Service at Charcoal N Chill',
      content_type: 'gbp_post',
      aeo_score: 68,
      status: 'draft',
      human_approved: false,
      target_prompt: 'hookah lounge good service Alpharetta',
    },
  ],
  pagination: { total: 3, page: 1, limit: 10 },
};

describe('Content Drafts Panel', () => {
  test('renders panel with draft list and stats', async ({ page }) => {
    // Mock GET /api/autopilot/status + GET /api/autopilot/drafts
    // Navigate to /dashboard
    // Assert: "Content Drafts" panel visible (data-testid="content-drafts-panel")
    // Assert: "2 pending | 1 approved" counter visible
    // Assert: 3 draft rows rendered
  });

  test('approved draft shows Publish CTA first in list', async ({ page }) => {
    // Assert: draft-001 (approved) is first row
    // Assert: "Publish →" CTA visible (data-testid="publish-btn-draft-001")
    // Assert: AEO score badge shows 82 in green
  });

  test('Publish modal opens with channel selection', async ({ page }) => {
    // Click "Publish →" on draft-001
    // Assert: PublishDraftModal opens (data-testid="publish-draft-modal")
    // Assert: "Post to Google Business Profile" radio visible
    // Assert: "Copy for Website" radio visible
    // Assert: "Publish Now" button visible
  });

  test('GBP post publish calls approve API and shows success', async ({ page }) => {
    // Mock POST /api/autopilot/draft-001/publish → { ok: true, published: true }
    // Select "Post to Google Business Profile"
    // Click "Publish Now"
    // Assert: loading state shows
    // Assert: success toast visible after response
    // Assert: draft row status updates to "Published"
  });

  test('draft Review modal opens with editable content', async ({ page }) => {
    // Click "Review" on draft-002
    // Assert: DraftReviewModal opens (data-testid="draft-review-modal")
    // Assert: draft title in input
    // Assert: draft content in editable textarea
    // Assert: "Approve Draft" and "Reject" buttons visible
  });

  test('approving draft calls approve API and updates row', async ({ page }) => {
    // Mock POST /api/autopilot/draft-002/approve → { ok: true }
    // Open review modal for draft-002
    // Click "Approve Draft"
    // Assert: row status updates to Approved
    // Assert: "Publish →" CTA appears
  });

  test('Run Autopilot triggers scan and shows result', async ({ page }) => {
    // Mock POST /api/autopilot/run → { ok: true, result: { drafts_created: 1 } }
    // Click "Run Autopilot"
    // Assert: loading spinner on button
    // Assert: toast "1 new draft created" after response
  });

  test('New Draft modal allows manual draft creation', async ({ page }) => {
    // Click "+ Create New Draft"
    // Assert: NewDraftModal opens (data-testid="new-draft-modal")
    // Fill in target query input
    // Select content type from dropdown
    // Mock POST /api/autopilot/drafts → { ok: true, draft: {...} }
    // Click "Generate Draft"
    // Assert: new row appears in list
  });

  test('Starter plan sees upgrade prompt instead of panel', async ({ page }) => {
    // Mock GET /api/autopilot/status → 403
    // Assert: upgrade prompt visible, panel content not rendered
  });
});
```

**Total Playwright tests: 9**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/autopilot-context-builders.test.ts  # 23 tests
npx vitest run src/__tests__/unit/autopilot-aeo-scorer.test.ts        # 12 tests
npx vitest run src/__tests__/unit/autopilot-deduplicator.test.ts      # 9 tests
npx vitest run src/__tests__/unit/autopilot-triggers.test.ts          # 21 tests
npx vitest run src/__tests__/unit/autopilot-routes.test.ts            # 23 tests
npx vitest run                                                          # ALL — zero regressions
npx playwright test src/__tests__/e2e/content-drafts-panel.spec.ts    # 9 e2e tests
npx tsc --noEmit                                                        # 0 type errors
```

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/autopilot/types.ts` | **CREATE** | All shared types |
| 2 | `lib/autopilot/triggers/competitor-gap-trigger.ts` | **CREATE** | Competitor gap detector |
| 3 | `lib/autopilot/triggers/prompt-missing-trigger.ts` | **CREATE** | Zero-citation cluster detector |
| 4 | `lib/autopilot/triggers/review-gap-trigger.ts` | **CREATE** | Review keyword gap detector |
| 5 | `lib/autopilot/triggers/schema-gap-trigger.ts` | **CREATE** | Schema coverage gap detector |
| 6 | `lib/autopilot/triggers/first-mover-trigger.ts` | **CREATE** | User-initiated trigger builder |
| 7 | `lib/autopilot/generators/context-builders.ts` | **CREATE** | Pure context block builders |
| 8 | `lib/autopilot/generators/brief-generator.ts` | **CREATE** | GPT-4o-mini brief generation |
| 9 | `lib/autopilot/generators/aeo-scorer.ts` | **CREATE** | Draft AEO scoring |
| 10 | `lib/autopilot/draft-deduplicator.ts` | **CREATE** | Idempotency checks |
| 11 | `lib/autopilot/create-draft.ts` | **CREATE** | Master createDraft() orchestrator |
| 12 | `lib/autopilot/autopilot-service.ts` | **CREATE** | runAutopilot(), post-publish audit scheduler |
| 13 | `lib/autopilot/index.ts` | **CREATE** | Barrel export |
| 14 | `app/api/autopilot/run/route.ts` | **CREATE** | On-demand scan route |
| 15 | `app/api/autopilot/drafts/route.ts` | **CREATE** | List + create drafts |
| 16 | `app/api/autopilot/status/route.ts` | **CREATE** | Dashboard status |
| 17 | `app/api/autopilot/[id]/approve/route.ts` | **CREATE** | HITL approval gate |
| 18 | `app/api/autopilot/[id]/publish/route.ts` | **CREATE** | GBP post + web snippet publish |
| 19 | `app/api/autopilot/[id]/reject/route.ts` | **CREATE** | Soft reject |
| 20 | `app/api/cron/autopilot/route.ts` | **CREATE** | Weekly cron |
| 21 | `app/dashboard/_components/ContentDraftsPanel.tsx` | **CREATE** | Main drafts panel |
| 22 | `app/dashboard/_components/DraftReviewModal.tsx` | **CREATE** | Review + edit + approve modal |
| 23 | `app/dashboard/_components/PublishDraftModal.tsx` | **CREATE** | Channel selection + publish |
| 24 | `app/dashboard/_components/NewDraftModal.tsx` | **CREATE** | Manual draft creation form |
| 25 | `app/dashboard/page.tsx` | **MODIFY** | Add ContentDraftsPanel (Growth+ gated) |
| 26 | `vercel.json` | **MODIFY** | Add autopilot cron (Wed 2 AM UTC) |
| 27 | `supabase/migrations/[timestamp]_autopilot_engine.sql` | **CREATE** | New columns + post_publish_audits |
| 28 | `supabase/prod_schema.sql` | **MODIFY** | content_drafts columns + new table + location columns |
| 29 | `lib/supabase/database.types.ts` | **MODIFY** | Add PostPublishAudit + new column types |
| 30 | `supabase/seed.sql` | **MODIFY** | 3 seeded drafts + autopilot location state |
| 31 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add 4 autopilot fixtures |
| 32 | `src/__tests__/unit/autopilot-context-builders.test.ts` | **CREATE** | 23 tests |
| 33 | `src/__tests__/unit/autopilot-aeo-scorer.test.ts` | **CREATE** | 12 tests |
| 34 | `src/__tests__/unit/autopilot-deduplicator.test.ts` | **CREATE** | 9 tests |
| 35 | `src/__tests__/unit/autopilot-triggers.test.ts` | **CREATE** | 21 tests |
| 36 | `src/__tests__/unit/autopilot-routes.test.ts` | **CREATE** | 23 tests |
| 37 | `src/__tests__/e2e/content-drafts-panel.spec.ts` | **CREATE** | 9 Playwright tests |

---

## 🚫 What NOT to Do

1. **DO NOT recreate the `content_drafts` table** — it already exists in `prod_schema.sql`. Only add the 3 new columns via `ADD COLUMN IF NOT EXISTS`.
2. **DO NOT auto-publish any draft** — `publishDraft()` is called only from the `/publish` route, and only after verifying `human_approved === true` AND `status === 'approved'`. Both conditions must be true on the server side. No exceptions.
3. **DO NOT auto-approve drafts** — the autopilot creates `status = 'draft'` rows only. Approval is always human-initiated via the review modal.
4. **DO NOT build WordPress/CMS direct publish** — that's a post-launch feature. Sprint 86 publish channels are: GBP Post (direct API) and Web Snippet (copy-paste). No other channels.
5. **DO NOT use LLM for trigger detection** — all 4 trigger detectors are pure SQL queries. LLM is only called in `generateBrief()`.
6. **DO NOT call all triggers in series** — use `Promise.allSettled()` in `runAutopilot()` so one failing trigger doesn't block others.
7. **DO NOT re-implement GBP token refresh** — reuse `isTokenExpired()` + `refreshGBPToken()` from `lib/gbp/gbp-token-refresh.ts`.
8. **DO NOT exceed DRAFT_CREATION_LIMITS** — check limit in `createDraft()` before every GPT-4o-mini call.
9. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
10. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
11. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.
12. **DO NOT edit `middleware.ts`** (AI_RULES §6).
13. **DO NOT fabricate content fields in drafts** — the GPT-4o-mini prompt explicitly states "never fabricate specifics (hours, prices, menu items) not in context." The system prompt must include this instruction verbatim.
14. **DO NOT process post-publish audits in the same cron run as gap detection** — process them as a separate step at the end of `runAutopilotForAllLocations()` to avoid one timing out the other.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `lib/autopilot/types.ts` — All types defined: DraftTriggerType, ContentType, DraftContext, DraftTriggerInput, GeneratedBrief, ContentDraft, AutopilotRunResult, DRAFT_CREATION_LIMITS
- [ ] 4 trigger detectors — competitor_gap, prompt_missing, review_gap, schema_gap — with correct SQL queries, dedup logic, throttle windows
- [ ] `first-mover-trigger.ts` — validates input, checks for duplicate by target_query
- [ ] `context-builders.ts` — 5 context builders, all pure functions, `selectContentType()`, `parseBriefResponse()`
- [ ] `brief-generator.ts` — GPT-4o-mini call, CONTENT_TYPE_INSTRUCTIONS per type, temp=0.4, safe JSON parsing
- [ ] `aeo-scorer.ts` — 4 dimensions, pure functions, score always 0–100
- [ ] `draft-deduplicator.ts` — all 6 dedup rules implemented correctly
- [ ] `create-draft.ts` — plan limit check → dedup → context → generate → score → insert
- [ ] `autopilot-service.ts` — runAutopilot() with Promise.allSettled triggers, priority ordering, schedulePostPublishAudit()
- [ ] All 6 API routes — run, drafts (GET+POST), status, approve, publish, reject
- [ ] `app/api/cron/autopilot/route.ts` — CRON_SECRET, Wednesday 2 AM UTC, processes pending post_publish_audits
- [ ] `vercel.json` updated with autopilot cron
- [ ] `/publish` route: server-side verifies `human_approved === true` AND `status === 'approved'` (both conditions)
- [ ] GBP Post publish: token refresh reuse, correct API endpoint, schedules post-publish audit
- [ ] Web Snippet publish: no API call, returns snippet, sets `published_url = 'web_snippet:manual'`
- [ ] `ContentDraftsPanel.tsx` — stats header, priority-sorted rows, trigger badges, AEO score colors, skeleton, empty state, plan gate
- [ ] `DraftReviewModal.tsx` — editable title + content, approve + reject buttons, keywords display
- [ ] `PublishDraftModal.tsx` — GBP + web snippet channel selection
- [ ] `NewDraftModal.tsx` — target query input + content type dropdown + generate CTA
- [ ] `app/dashboard/page.tsx` updated with ContentDraftsPanel
- [ ] Migration: 3 new columns on content_drafts, post_publish_audits table, 2 columns on locations
- [ ] `prod_schema.sql` updated
- [ ] `database.types.ts` updated
- [ ] Seed: 3 realistic drafts + autopilot location state
- [ ] `golden-tenant.ts`: 4 autopilot fixtures added
- [ ] All `data-testid` attributes on interactive elements
- [ ] `npx vitest run src/__tests__/unit/autopilot-context-builders.test.ts` — **23 tests passing**
- [ ] `npx vitest run src/__tests__/unit/autopilot-aeo-scorer.test.ts` — **12 tests passing**
- [ ] `npx vitest run src/__tests__/unit/autopilot-deduplicator.test.ts` — **9 tests passing**
- [ ] `npx vitest run src/__tests__/unit/autopilot-triggers.test.ts` — **21 tests passing**
- [ ] `npx vitest run src/__tests__/unit/autopilot-routes.test.ts` — **23 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/content-drafts-panel.spec.ts` — **9 tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-03-01 — Sprint 86: SOV Gap → Content Brief Generator / Autopilot Engine (Completed)

**Goal:** Build the closed-loop content pipeline that converts detected AI visibility gaps into human-approved, publish-ready content briefs. Transform LocalVector from monitoring tool to action tool: DETECT → DIAGNOSE → DRAFT → APPROVE → PUBLISH → MEASURE.

**Scope:**
- `lib/autopilot/types.ts` — **NEW.** DraftTriggerType (6), ContentType (5), DraftContext, DraftTriggerInput, GeneratedBrief, ContentDraft, AutopilotRunResult, DRAFT_CREATION_LIMITS.
- `lib/autopilot/triggers/` — **NEW.** 4 trigger detectors:
  - `competitor-gap-trigger.ts`: high_magnitude intercepts from last 7 days, idempotent by trigger_id
  - `prompt-missing-trigger.ts`: 3+ zero-citation queries, grouped by category, 2+ weeks
  - `review-gap-trigger.ts`: 2+ reviews sharing negative keyword in 90 days, 60-day throttle
  - `schema-gap-trigger.ts`: schema_health_score < 60, 30-day throttle
  - `first-mover-trigger.ts`: user-initiated, validates target_query, deduplicates by query text
- `lib/autopilot/generators/context-builders.ts` — **NEW.** 5 pure context builders per trigger type. selectContentType() defaults. parseBriefResponse() with markdown fence stripping.
- `lib/autopilot/generators/brief-generator.ts` — **NEW.** GPT-4o-mini at temp=0.4. CONTENT_TYPE_INSTRUCTIONS per type (faq_page 400–500w, gbp_post 100–200w, etc.). Never fabricates specifics.
- `lib/autopilot/generators/aeo-scorer.ts` — **NEW.** 4-dimension scorer (Answer-First 30pts, Keyword Density 25pts, FAQ Presence 25pts, Entity Completeness 20pts). Pure. Always 0–100.
- `lib/autopilot/draft-deduplicator.ts` — **NEW.** 6 dedup rules by trigger type. Ignores 'rejected' drafts.
- `lib/autopilot/create-draft.ts` — **NEW.** Plan limit check → dedup → context → generate → score → insert. checkDraftLimit() counts current-month drafts.
- `lib/autopilot/autopilot-service.ts` — **NEW.** runAutopilot() with Promise.allSettled triggers + priority ordering. schedulePostPublishAudit() inserts into post_publish_audits queue. runAutopilotForAllLocations() sequential.
- `app/api/autopilot/` — **NEW.** 6 routes: run, drafts, status, approve, publish, reject.
  - `/approve`: HITL gate — sets human_approved=true + status='approved'. Accepts edited_content.
  - `/publish`: Double-checks human_approved AND status before any action. GBP Post or Web Snippet.
- `app/api/cron/autopilot/route.ts` — **NEW.** Wednesday 2 AM UTC. CRON_SECRET. Processes pending post_publish_audits after gap detection.
- `vercel.json` — **MODIFIED.** autopilot cron added.
- `app/dashboard/_components/ContentDraftsPanel.tsx` — **NEW.** Stats, priority-sorted rows, trigger badges, AEO colors, skeleton, plan gate.
- `app/dashboard/_components/DraftReviewModal.tsx` — **NEW.** Editable title + content, approve/reject.
- `app/dashboard/_components/PublishDraftModal.tsx` — **NEW.** GBP + web snippet channels.
- `app/dashboard/_components/NewDraftModal.tsx` — **NEW.** Manual draft creation.
- `app/dashboard/page.tsx` — **MODIFIED.** ContentDraftsPanel added.
- Migration `[timestamp]_autopilot_engine.sql` — **NEW.** 3 columns on content_drafts (target_keywords, rejection_reason, generation_notes). post_publish_audits table. autopilot_last_run_at + drafts_pending_count on locations.
- `supabase/prod_schema.sql` — **MODIFIED.**
- `lib/supabase/database.types.ts` — **MODIFIED.**
- `supabase/seed.sql` — **MODIFIED.** 3 seeded drafts (approved competitor_gap, draft prompt_missing, draft review_gap). Location autopilot state.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** 4 autopilot fixtures.

**Tests added:**
- `autopilot-context-builders.test.ts` — **23 tests** (pure, zero mocks)
- `autopilot-aeo-scorer.test.ts` — **12 tests** (pure, zero mocks)
- `autopilot-deduplicator.test.ts` — **9 tests**
- `autopilot-triggers.test.ts` — **21 tests** (Supabase mocked)
- `autopilot-routes.test.ts` — **23 tests**
- `content-drafts-panel.spec.ts` — **9 Playwright tests**
- **Total: 88 Vitest + 9 Playwright — all passing, zero regressions**

**Key decisions:**
- content_drafts table not recreated — already existed. Added 3 columns via ADD COLUMN IF NOT EXISTS.
- Trigger detection: pure SQL, no LLM — LLM reserved for brief generation only
- Promise.allSettled for parallel trigger detection — one failure doesn't block others
- Priority ordering: competitor_gap > prompt_missing > review_gap > schema_gap
- Rejected drafts excluded from deduplication — a rejected draft can be triggered again
- Both human_approved AND status checks enforced server-side on /publish — belt-and-suspenders
- GBP Post: max 1500 chars for summary field. Web Snippet: returns raw text, user publishes manually.
- post_publish_audits: processed as final step in cron run (separate from gap detection to avoid timeout)
- temp=0.4 for brief generation (lower than review responses — accuracy > creativity)
```

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 45. ✍️ Autopilot Engine — Centralized in `lib/autopilot/` (Sprint 86)

The content brief generation pipeline lives in `lib/autopilot/`. All trigger detectors, brief generators, and publish flows route through this module.

* **HITL is absolute:** `createDraft()` only creates status='draft'. `/publish` route requires BOTH `human_approved === true` AND `status === 'approved'` — server-side, every time. No configuration can bypass this.
* **No auto-approval:** Trigger detectors create drafts. Only a human clicking "Approve Draft" in the UI changes status to 'approved'.
* **content_drafts table already exists:** Never recreate it. Add columns via `ADD COLUMN IF NOT EXISTS` only.
* **LLM only in brief generation:** Trigger detection is pure SQL. Only `generateBrief()` calls GPT-4o-mini.
* **Fabrication rule:** The brief-generator system prompt must always include: "Never fabricate specifics (hours, prices, menu items) not present in the context block."
* **GBP publish:** Reuse lib/gbp/gbp-token-refresh.ts token refresh pattern. Posts to GBP localPosts API v4.
* **Adding a new trigger type:** Add to DraftTriggerType union, create detector in lib/autopilot/triggers/, add context builder, register in runAutopilot() trigger array, add dedup rule in draftExists().
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| content_drafts table | Sprint 77 (rescheduled) | Table DDL already in prod_schema.sql |
| competitor_intercepts | Sprint 83 (Greed Engine) | competitor_gap trigger source |
| sov_target_queries | Sprint 83+ (SOV Engine) | prompt_missing trigger source |
| reviews table | Sprint 107 | review_gap trigger source |
| page_schemas table | Sprint 106 | schema_gap trigger source |
| GBP OAuth + token refresh | Sprints 57B + 89 | GBP Post publish + token refresh |
| Ground Truth type | Sprint 105 | Business context in prompt building |
| Plan Enforcer | Sprint 3 | Growth+ gating + DRAFT_CREATION_LIMITS |
| Cron patterns | Sprints 105–107 | vercel.json structure, CRON_SECRET |

---

## 🧠 Edge Cases to Handle

1. **GPT-4o-mini returns invalid JSON for brief:** `parseBriefResponse()` returns null. `generateBrief()` retries once. If second attempt also fails: save a minimal fallback draft with `draft_content = context_block` + `aeo_score = 0` + `generation_notes = 'llm_parse_failed'`. Never fail silently.
2. **Draft limit hit mid-autopilot run:** Stop processing remaining triggers gracefully. Return `drafts_skipped_limit` count in `AutopilotRunResult`. Dashboard shows "Monthly limit reached" banner.
3. **GBP post publish fails (token issue, rate limit, content policy):** Set `status = 'approved'` (revert — draft is still approvable, publish didn't happen). Set `rejection_reason = 'gbp_publish_failed: {error}'`. Surface error in PublishDraftModal. Never leave status as 'published' if the GBP call failed.
4. **Same competitor_intercept fires twice before dedup check runs:** The UNIQUE constraint on content_drafts `(trigger_type, trigger_id)` at DB level (if added) prevents duplicate rows. If no DB-level constraint, the dedup function must be the safety net — always check before insert.
5. **Zero-citation cluster queries change weekly:** When a previously zero-citation query gets its first citation, it should no longer contribute to the cluster. Re-run cluster detection each time from fresh `sov_target_queries` data — don't cache stale cluster results.
6. **User edits draft content to near-zero quality before approving:** The `/approve` route does not re-score. The `scoreAEODraft()` on the final approved content would help — consider running it at approve time and storing it. At minimum, don't block approval on low score (it's HITL — trust the human's judgment).
7. **post_publish_audit: target_prompt is too specific to re-run cleanly:** Some prompts may be very long or oddly formatted. Normalize to max 200 characters before storing in `post_publish_audits`. Truncate at word boundary.
8. **Location has no GBP connection but user tries to publish to GBP:** Return `{ ok: false, error: 'gbp_not_connected' }` with a helpful message: "Connect your Google Business Profile in Settings to enable GBP post publishing."
9. **Cron runs while user is mid-review of a draft:** The cron only creates new drafts — it never modifies existing ones. No race condition on existing review flows.
10. **Multiple locations in one org:** Each location's autopilot runs independently. `runAutopilotForAllLocations()` loops by location, not org. One location hitting its draft limit doesn't affect another location's run.

---

## 📚 Document Sync + Git Commit

### Step 1: Update `/docs`

**`docs/roadmap.md`** — Sprint 86 ✅ 100%.

**`docs/09-BUILD-PLAN.md`** — Sprint 86 checked off. Note: Sprint 86 was rescheduled from its original position (SOV Gap closure) to Sprint 86 in the final roadmap, following Sprints 105–107. The rescheduling allowed NAP/Schema/Review signals to be established first, feeding richer trigger context into the Autopilot Engine.

**`docs/19-AUTOPILOT-ENGINE.md`** (existing doc) — Add implementation note: "Built in Sprint 86. `lib/autopilot/` is the canonical implementation. `createDraft()` in `lib/autopilot/create-draft.ts` is the master entry point. `content_drafts` table columns extended with `target_keywords`, `rejection_reason`, `generation_notes`."

### Step 2–5: Standard updates to `DEVLOG.md`, `CLAUDE.md`, `MEMORY.md`, `AI_RULES.md` (Rule 45)

### Step 6: Git Commit

```bash
git add -A
git commit -m "Sprint 86: SOV Gap → Content Brief Generator (Autopilot Engine)

- lib/autopilot/: 4 trigger detectors, context builders, GPT-4o-mini brief gen, AEO scorer, dedup, orchestrator
- 6 trigger types: competitor_gap, prompt_missing, review_gap, schema_gap, first_mover, manual
- createDraft(): plan limit → dedup → context → generate (temp=0.4) → score → insert
- app/api/autopilot/: run, drafts, status, approve, publish (GBP Post + Web Snippet), reject
- HITL: human_approved AND status=approved both required server-side before publish
- cron: autopilot Wednesday 2AM UTC — gap detection + post_publish_audits processing
- migration: 3 new content_drafts columns, post_publish_audits table, 2 location columns
- ContentDraftsPanel: priority sort, trigger badges, AEO score colors, 4 modals
- seed: 3 realistic drafts (approved competitor_gap, draft prompt_missing, draft review_gap)
- tests: 88 Vitest passing + 9 Playwright passing — zero regressions
- docs: roadmap, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES Rule 45, Doc 19 updated

content_drafts table not recreated — additive columns only.
Fabrication guard in all GPT-4o-mini system prompts.
Unblocks Sprint 108 (Semantic Authority Mapping)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 86 completes, LocalVector crosses a fundamental product threshold: it stops being a *dashboard of problems* and becomes a *machine that solves them*.

Every signal from every prior sprint now feeds a single action surface. A business owner logs in Monday morning and sees: "2 content drafts ready for your review. 1 already approved — ready to post to Google." They review the draft, click Approve, click Publish — and a keyword-rich, Answer-First FAQ page goes live on their Google Business Profile in under 60 seconds. Forty-eight hours later, LocalVector checks whether AI engines are now citing them for the target query.

That's the closed loop: detect the gap → draft the fix → human approves → publish → measure improvement. Sprint 86 closes it.

- **Content Brief Generator: 0% → 100%**
- 88 Vitest + 9 Playwright tests protect all trigger detectors, the generation pipeline, the HITL gate, and the publish flow
- Sprint 108 (Semantic Authority Mapping) is now unblocked
