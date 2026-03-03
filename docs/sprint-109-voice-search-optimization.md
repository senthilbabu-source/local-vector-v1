# Sprint 109 — Voice Search & Conversational AI Optimization (VAIO)

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Build **VAIO — Voice & Conversational AI Optimization** — the layer of LocalVector that measures and improves a business's ability to be the single spoken answer when someone asks Siri, Alexa, Google Assistant, or a car navigation system a local question.

**Why voice is architecturally different from typed search:**

When a user types "best hookah lounge Alpharetta" into Google, they see 10 blue links. When they say "Hey Siri, find me a good hookah lounge near Alpharetta" — one answer is spoken aloud. Zero-click. No ranking #2. The business either wins that moment or it doesn't exist.

Voice queries are structurally different from typed queries in three ways:
1. **They're conversational and full-sentence:** "What hookah lounge near me stays open the latest?" not "late hookah lounge Alpharetta"
2. **They're action-oriented:** "Where can I book a private event with hookah and dinner?" — the user wants to DO something
3. **They're hyper-local and immediate:** Voice is triggered by proximity intent — the person is usually nearby or actively planning

The SOV Engine (Sprint 83) tracks typed search queries. Sprint 109 builds a parallel system for the *spoken* query universe — different query taxonomy, different content format requirements, different scoring.

**Important constraint established in prior research:** `Speakable` schema markup is **NOT applicable** to local business content. Google's Speakable is beta, restricted to news publishers enrolled in Google News Publisher Center, and is being deprecated as of early 2026. It does not work for LocalBusiness, Restaurant, FAQPage, or general business websites. Do not implement Speakable. Zero references to it anywhere in this sprint.

**What this sprint builds:**

1. **Voice Query Library** — A parallel SOV query library of conversational, spoken-word query templates distinct from the typed-query library. Seeded per category+city at onboarding, extendable by users.
2. **Voice Content Scorer** — Analyzes existing content (FAQ pages, GBP posts, llms.txt) against voice-friendliness criteria: sentence length, directness, spoken-answer format, local specificity, action-oriented language
3. **Spoken Answer Previewer** — Simulates how a business's answer would sound when spoken aloud at ~150 words/minute TTS cadence. Flags content that's too long, too visual (tables, bullets), or has unspoken characters (URLs, symbols)
4. **llms.txt Generator** — Auto-generates a complete, Ground Truth–derived `llms.txt` and `llms-full.txt` for each location, publishable to the tenant's Magic Menu subdomain. This is the single most impactful AI crawlability improvement for most tenants.
5. **AI Crawler Access Auditor** — Checks the business's website `robots.txt` for blocked AI crawlers (GPTBot, PerplexityBot, ClaudeBot, etc.) and surfaces which ones are blocked or missing
6. **Voice Gap Detector** — Identifies conversational query clusters where the business is getting zero citations — the voice-equivalent of the SOV prompt_missing trigger
7. **VAIO Dashboard Panel** — Single panel: voice score, llms.txt status, AI crawler health, spoken answer preview tool, voice gap alerts
8. **Voice-Optimized Content Brief Trigger** — When voice gaps are detected, integrates with Sprint 86 Autopilot to create voice-optimized content briefs

**What this sprint does NOT build:**
- Speakable schema (not applicable — see constraint above)
- Integration with actual voice assistants (Siri, Alexa APIs are not publicly accessible for business content injection)
- Text-to-speech audio playback (browser TTS simulation only — no audio file generation)
- A separate voice SOV cron (voice queries run as a tagged subset within the existing SOV cron from Sprint 83)

**Gap being closed:** Voice Search Optimization 0% → 100%. Unblocks Sprint 110 (AI Answer Simulation Sandbox), which simulates the full multi-modal AI answer experience including voice responses.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                           — All rules (46+ after Sprint 108)
Read CLAUDE.md                                                  — Implementation inventory
Read MEMORY.md                                                  — Architectural decisions
Read supabase/prod_schema.sql
  § FIND: sov_target_queries — query_text, query_category, is_active, citation_rate, last_run_at
  § FIND: locations — name, phone, website, primary_category, city, state, amenities
  § FIND: ground_truth (Sprint 105) — canonical NAP + hours + amenities
  § FIND: page_schemas (Sprint 106) — json_ld for homepage/faq
  § FIND: reviews (Sprint 107) — keywords column (voice content hints)
  § FIND: content_drafts (Sprint 86) — draft_content column for voice scoring
  § FIND: entity_authority_profiles (Sprint 108) — entity_authority_score, sameas_count
Read lib/supabase/database.types.ts                             — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                          — Golden Tenant (org_id: a0eebc99)
Read lib/nap-sync/types.ts                                      — GroundTruth type
Read lib/autopilot/types.ts                                     — DraftTriggerInput, DraftContext
Read lib/autopilot/create-draft.ts                              — createDraft() — used for voice gap trigger
Read lib/plan-enforcer.ts                                       — Plan gating
Read lib/supabase/server.ts                                     — createServiceRoleClient()
Read app/dashboard/page.tsx                                     — Dashboard — insert VAIOPanel
Read vercel.json                                                — Existing crons
```

**Specifically understand before writing code:**
- The `sov_target_queries` table structure: `query_category` values, `is_active`, `citation_rate`, `last_run_at` — Sprint 109 adds a `query_mode` column ('typed' | 'voice') to distinguish voice queries from existing typed queries. Do NOT modify the cron execution logic for typed queries.
- The `ground_truth` table: the NAP data + hours + amenities + description used to generate llms.txt
- The Magic Menu subdomain: tenants have a page at `menu.localvector.ai/{slug}` (Sprint 89). llms.txt is generated for the TENANT'S OWN WEBSITE domain, not for the Magic Menu subdomain — the llms.txt content is downloadable/copyable and the owner deploys it to their own site.
- The existing Perplexity Sonar call pattern: voice queries run through the same execution pipeline as typed SOV queries. The tagged `query_mode = 'voice'` is how voice results are separated.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/vaio/
  index.ts                                   — barrel export
  types.ts                                   — all shared types
  voice-query-library.ts                     — voice query taxonomy + seeding
  voice-content-scorer.ts                    — scores content for voice-friendliness
  spoken-answer-previewer.ts                 — simulates spoken answer + flags issues
  llms-txt-generator.ts                      — generates llms.txt + llms-full.txt
  ai-crawler-auditor.ts                      — checks robots.txt for AI crawler access
  voice-gap-detector.ts                      — detects voice query zero-citation clusters
  vaio-service.ts                            — orchestrator
```

---

### Component 1: Shared Types — `lib/vaio/types.ts`

```typescript
/**
 * Voice queries have four conversational categories.
 * These are PARALLEL to, but distinct from, the SOV typed query categories.
 * They reflect how humans speak to voice assistants, not how they type into search.
 */
export type VoiceQueryCategory =
  | 'discovery'       // "What's a good hookah lounge near Alpharetta?"
  | 'action'          // "Where can I make a reservation for hookah tonight?"
  | 'comparison'      // "Is Charcoal N Chill better than Cloud 9 for private events?"
  | 'information';    // "What time does Charcoal N Chill close on Fridays?"

/**
 * How human-like and spoken-word-friendly a piece of content is.
 * Voice assistants extract from content that sounds like a spoken answer.
 */
export interface VoiceContentScore {
  overall_score: number;          // 0–100 composite
  avg_sentence_words: number;     // Target: ≤ 20 words/sentence for voice
  direct_answer_score: number;    // 0–30: does content start with the answer?
  local_specificity_score: number; // 0–25: does it mention business name + city?
  action_language_score: number;   // 0–25: does it use action verbs for voice intent?
  spoken_length_score: number;     // 0–20: is it a speakable length (50–200 words)?
  issues: VoiceContentIssue[];
}

/**
 * A specific problem found in content that would hurt voice performance.
 */
export interface VoiceContentIssue {
  type: VoiceIssueType;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  fix: string;
}

export type VoiceIssueType =
  | 'too_long'              // Content > 300 words — too long for spoken answer
  | 'no_direct_answer'      // First sentence doesn't answer the implicit question
  | 'contains_markdown'     // Asterisks, bullets, headers — unspoken characters
  | 'contains_urls'         // Raw URLs read poorly aloud (e.g. "https colon slash slash...")
  | 'long_sentences'        // Sentences > 30 words — hard to parse when spoken
  | 'no_local_mention'      // City or area not mentioned
  | 'passive_voice_heavy'   // Passive constructions confuse voice parsing
  | 'no_business_name';     // Business name absent — AI can't attribute the answer

/**
 * A voice query tracked for citation performance.
 * Stored in sov_target_queries with query_mode = 'voice'.
 */
export interface VoiceQuery {
  id: string;
  location_id: string;
  org_id: string;
  query_text: string;
  query_category: VoiceQueryCategory;
  query_mode: 'voice';        // Always 'voice' for this table
  is_active: boolean;
  citation_rate: number | null;   // 0.0–1.0 from last SOV run
  last_run_at: string | null;
  is_system_seeded: boolean;      // true = seeded from voice taxonomy; false = user-added
}

/**
 * Spoken answer simulation result.
 */
export interface SpokenAnswerPreview {
  content: string;
  word_count: number;
  estimated_spoken_seconds: number;   // word_count / 2.5 (150 WPM ÷ 60)
  is_voice_ready: boolean;
  cleaned_content: string;            // Markdown stripped, URLs replaced, bullets → prose
  issues: VoiceContentIssue[];
  reading_grade_level: number;        // Flesch-Kincaid grade level (target: 6–8 for voice)
}

/**
 * Complete llms.txt content for a location.
 */
export interface LlmsTxtContent {
  standard: string;    // llms.txt — concise (~300–500 words)
  full: string;        // llms-full.txt — comprehensive (~800–1200 words)
  generated_at: string;
  version: number;
}

/**
 * Result of the AI crawler access audit.
 */
export interface AICrawlerAuditResult {
  website_url: string;
  robots_txt_found: boolean;
  robots_txt_url: string;
  crawlers: AICrawlerStatus[];
  overall_health: 'healthy' | 'partial' | 'blocked' | 'unknown';
  blocked_count: number;
  allowed_count: number;
  missing_count: number;          // Crawler not mentioned in robots.txt (probably allowed by wildcard but unconfirmed)
  last_checked_at: string;
}

/**
 * Access status for a single AI crawler.
 */
export interface AICrawlerStatus {
  name: string;                   // e.g. "GPTBot", "PerplexityBot"
  user_agent: string;             // e.g. "GPTBot"
  status: 'allowed' | 'blocked' | 'not_specified';
  used_by: string;                // e.g. "ChatGPT / OpenAI"
  impact: 'high' | 'medium' | 'low';
}

/**
 * A voice-specific gap: conversational queries with zero citations.
 */
export interface VoiceGap {
  category: VoiceQueryCategory;
  queries: string[];              // The specific zero-citation queries
  weeks_at_zero: number;
  suggested_content_type: 'faq_page' | 'gbp_post';
  suggested_query_answer: string; // One-sentence spoken answer to draft around
}

/**
 * Full VAIO profile for a location.
 */
export interface VAIOProfile {
  location_id: string;
  org_id: string;
  voice_readiness_score: number;  // 0–100 composite
  llms_txt_status: 'generated' | 'not_generated' | 'stale'; // stale = > 30 days old
  llms_txt_generated_at: string | null;
  crawler_health: AICrawlerAuditResult | null;
  voice_queries_tracked: number;
  voice_citation_rate: number;    // Average citation_rate across tracked voice queries
  voice_gaps: VoiceGap[];
  top_voice_score_issues: VoiceContentIssue[];
  last_run_at: string | null;
}

/**
 * Result of a full VAIO run.
 */
export interface VAIORRunResult {
  location_id: string;
  org_id: string;
  voice_readiness_score: number;
  voice_queries_seeded: number;
  voice_gaps_found: number;
  autopilot_drafts_triggered: number;
  llms_txt_generated: boolean;
  crawler_health: 'healthy' | 'partial' | 'blocked' | 'unknown';
  errors: string[];
  run_at: string;
}

/**
 * Voice readiness score weights.
 */
export const VOICE_SCORE_WEIGHTS = {
  llms_txt:         25,   // Is llms.txt generated and current?
  crawler_access:   25,   // Are major AI crawlers allowed on the website?
  voice_citation:   30,   // Are voice queries producing citations?
  content_quality:  20,   // Is published content voice-friendly?
} as const;
```

---

### Component 2: Voice Query Library — `lib/vaio/voice-query-library.ts`

```typescript
/**
 * The canonical voice query taxonomy for local hospitality businesses.
 * Voice queries are full-sentence, conversational, and action/intent-oriented.
 * They are DISTINCT from the typed SOV query templates in lib/prompt-intelligence/.
 *
 * Template variables:
 * {businessName} — replaced at seed time
 * {category}     — e.g. "hookah lounge"
 * {city}         — e.g. "Alpharetta"
 */

export interface VoiceQueryTemplate {
  template: string;
  category: VoiceQueryCategory;
  priority: 1 | 2 | 3;            // 1 = highest voice search volume
  intent: 'find' | 'reserve' | 'compare' | 'confirm';
}

/**
 * The authoritative voice query template library.
 * These represent how real humans speak to voice assistants.
 * NOT keyword-optimized phrases — full conversational sentences.
 */
export const VOICE_QUERY_TEMPLATES: VoiceQueryTemplate[] = [
  // DISCOVERY — "find me something" intent
  { template: "What's a good {category} near {city}?",
    category: 'discovery', priority: 1, intent: 'find' },
  { template: "Find me a {category} near {city} that's open right now",
    category: 'discovery', priority: 1, intent: 'find' },
  { template: "Is there a {category} in {city} with live entertainment?",
    category: 'discovery', priority: 1, intent: 'find' },
  { template: "What {category}s are near {city} Georgia?",
    category: 'discovery', priority: 2, intent: 'find' },
  { template: "Best {category} in the {city} area for a night out",
    category: 'discovery', priority: 2, intent: 'find' },
  { template: "Where can I find a {category} near {city} with good food?",
    category: 'discovery', priority: 2, intent: 'find' },

  // ACTION — "I want to do something" intent
  { template: "Where can I make a reservation at a {category} in {city}?",
    category: 'action', priority: 1, intent: 'reserve' },
  { template: "How do I book a private event at {businessName}?",
    category: 'action', priority: 1, intent: 'reserve' },
  { template: "Where can I go for a birthday party with hookah in {city}?",
    category: 'action', priority: 1, intent: 'reserve' },
  { template: "How do I get to {businessName} in {city}?",
    category: 'action', priority: 2, intent: 'find' },
  { template: "Where can I get hookah and dinner tonight near {city}?",
    category: 'action', priority: 2, intent: 'find' },
  { template: "Is {businessName} taking walk-ins tonight?",
    category: 'action', priority: 2, intent: 'confirm' },

  // COMPARISON — "which is better" intent
  { template: "Is {businessName} good for a date night in {city}?",
    category: 'comparison', priority: 1, intent: 'compare' },
  { template: "What's the best {category} in {city} for groups?",
    category: 'comparison', priority: 1, intent: 'compare' },
  { template: "Tell me about {businessName} in {city}",
    category: 'comparison', priority: 2, intent: 'compare' },
  { template: "What makes {businessName} different from other {category}s in {city}?",
    category: 'comparison', priority: 2, intent: 'compare' },

  // INFORMATION — "tell me the facts" intent
  { template: "What time does {businessName} close tonight?",
    category: 'information', priority: 1, intent: 'confirm' },
  { template: "What are {businessName}'s hours on Friday?",
    category: 'information', priority: 1, intent: 'confirm' },
  { template: "Does {businessName} in {city} have parking?",
    category: 'information', priority: 2, intent: 'confirm' },
  { template: "What food does {businessName} serve?",
    category: 'information', priority: 2, intent: 'confirm' },
  { template: "How many hookah flavors does {businessName} have?",
    category: 'information', priority: 2, intent: 'confirm' },
  { template: "What is the dress code at {businessName}?",
    category: 'information', priority: 3, intent: 'confirm' },
  { template: "Is {businessName} in {city} good for bachelorette parties?",
    category: 'information', priority: 2, intent: 'compare' },
  { template: "Does {businessName} allow kids or is it adults only?",
    category: 'information', priority: 3, intent: 'confirm' },
];

/**
 * Seeds voice queries for a location from the template library.
 * Replaces template variables with actual location data.
 * Inserts into sov_target_queries with query_mode = 'voice'.
 * Idempotent: skips templates already seeded (check by query_text UNIQUE per location).
 * Seeds all priority 1 queries + priority 2 queries for Growth+ locations.
 * Starter: priority 1 only (8 queries max).
 */
export async function seedVoiceQueriesForLocation(
  supabase: ReturnType<typeof createServiceRoleClient>,
  groundTruth: GroundTruth,
  locationId: string,
  orgId: string,
  planTier: string,
): Promise<{ seeded: number; skipped_dedup: number }> { ... }

/**
 * Instantiates a voice query template for a specific location.
 * Pure function.
 */
export function instantiateVoiceTemplate(
  template: VoiceQueryTemplate,
  businessName: string,
  category: string,
  city: string,
): string { ... }

/**
 * Returns the voice queries for a location from sov_target_queries.
 * Filters by query_mode = 'voice' and is_active = true.
 */
export async function getVoiceQueriesForLocation(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
): Promise<VoiceQuery[]> { ... }
```

---

### Component 3: Voice Content Scorer — `lib/vaio/voice-content-scorer.ts`

```typescript
/**
 * Scores a piece of text content for its voice-friendliness.
 * Pure function — no I/O.
 *
 * ── SCORING DIMENSIONS ──────────────────────────────────────────────
 *
 * 1. Direct Answer Score (max 30 pts)
 *    Does the first sentence answer a plausible question?
 *    Check: first sentence contains (businessName OR category) AND (city OR "we" OR action verb)
 *    30 pts: starts with concrete fact (name, location, hours, specific feature)
 *    15 pts: starts with "we" + claim ("We offer...", "We're open...")
 *    0 pts: starts with filler ("Welcome to...", "At {name}, we believe...")
 *
 * 2. Local Specificity Score (max 25 pts)
 *    Voice searches are hyper-local — AI must be able to attribute the answer geographically.
 *    25 pts: businessName + city both mentioned in first 50 words
 *    15 pts: only one of businessName/city in first 50 words
 *    5 pts: mentioned somewhere but not in opening
 *    0 pts: neither mentioned
 *
 * 3. Action Language Score (max 25 pts)
 *    Voice intent is usually action-oriented ("book", "visit", "try", "call")
 *    Count action verbs: book, reserve, visit, call, order, enjoy, experience, taste, find
 *    25 pts: 3+ action verbs
 *    15 pts: 1–2 action verbs
 *    0 pts: no action verbs (purely descriptive)
 *
 * 4. Spoken Length Score (max 20 pts)
 *    Voice answers are consumed in real-time — length matters critically.
 *    50–200 words: 20 pts (ideal voice answer)
 *    201–300 words: 10 pts (acceptable but borderline)
 *    > 300 words: 0 pts (too long — AI will truncate or skip)
 *    < 30 words: 5 pts (too short — may lack sufficient context)
 *
 * ────────────────────────────────────────────────────────────────────
 *
 * Issues detected (in addition to score):
 * - avg_sentence_words > 20 → 'long_sentences' (warning)
 * - avg_sentence_words > 30 → 'long_sentences' (critical)
 * - markdown characters found (*, #, -, [, ]) → 'contains_markdown' (critical for voice)
 * - raw URLs present → 'contains_urls' (critical for voice)
 * - businessName absent from content → 'no_business_name' (critical)
 * - city absent from content → 'no_local_mention' (warning)
 * - word_count > 300 → 'too_long' (warning for voice GBP posts; critical for FAQs)
 */
export function scoreVoiceContent(
  content: string,
  businessName: string,
  city: string,
  contentType: 'faq_page' | 'gbp_post' | 'faq_answer' | 'llms_txt',
): VoiceContentScore { ... }

/**
 * Counts action verbs in text (case-insensitive).
 * Pure function.
 */
export function countActionVerbs(text: string): number { ... }

/**
 * Calculates average sentence length in words.
 * Splits on . ! ? — handles abbreviations (Mr., U.S.) gracefully.
 * Pure function.
 */
export function avgSentenceWords(text: string): number { ... }

/**
 * Calculates a simplified Flesch-Kincaid Grade Level estimate.
 * Uses: 0.39 × (words/sentences) + 11.8 × (syllables/words) - 15.59
 * Syllable count approximation: count vowel groups per word.
 * Target for voice: 6–8 (readable by a 6th–8th grader).
 * Pure function.
 */
export function fleschKincaidGrade(text: string): number { ... }

/**
 * Detects markdown characters that would be read aloud awkwardly.
 * Returns true if markdown found.
 * Pure function.
 */
export function containsMarkdown(text: string): boolean { ... }

/**
 * Detects raw URLs in text.
 * Pure function.
 */
export function containsRawUrls(text: string): boolean { ... }

export const ACTION_VERBS = [
  'book', 'reserve', 'visit', 'call', 'order', 'enjoy', 'experience',
  'taste', 'find', 'try', 'discover', 'explore', 'dine', 'celebrate',
  'join', 'bring', 'host', 'plan', 'attend',
];
```

---

### Component 4: Spoken Answer Previewer — `lib/vaio/spoken-answer-previewer.ts`

```typescript
/**
 * Converts raw content into a voice-ready spoken answer preview.
 * Simulates what a voice assistant would speak when reading the content.
 * Pure function — no I/O.
 *
 * Cleaning pipeline:
 * 1. Strip markdown formatting: remove **, *, #, ##, ─, ═
 * 2. Replace bullet list items (- item or • item) → inline comma-joined prose
 *    (e.g. "- Yelp\n- Google\n- Facebook" → "Yelp, Google, and Facebook")
 * 3. Replace raw URLs:
 *    - http/https URLs → "[link]"
 *    - Email addresses → "[email]"
 * 4. Strip HTML tags if present
 * 5. Normalize multiple whitespace/newlines → single space
 * 6. Truncate at 250 words with "..." if content is very long
 *    (voice assistants don't read full pages — they extract and truncate)
 *
 * TTS word rate: 150 words/minute (Google Assistant standard)
 * Seconds estimate: (word_count / 150) × 60
 *
 * Returns SpokenAnswerPreview with original issues + cleaned content.
 */
export function generateSpokenPreview(
  content: string,
  businessName: string,
  city: string,
  contentType: 'faq_page' | 'gbp_post' | 'faq_answer' | 'llms_txt',
): SpokenAnswerPreview { ... }

/**
 * Strips markdown formatting from text.
 * Converts bullet lists to comma-separated prose.
 * Pure function.
 */
export function cleanForVoice(text: string): string { ... }

/**
 * Estimates spoken duration from word count.
 * At 150 WPM (standard Google Assistant cadence).
 * Returns seconds (e.g. 75 words → 30 seconds).
 * Pure function.
 */
export function estimateSpokenSeconds(wordCount: number): number { ... }

/**
 * The ideal voice answer window: 30–60 seconds spoken duration.
 * Corresponding to ~75–150 words at 150 WPM.
 * VOICE_IDEAL_MIN_WORDS = 75
 * VOICE_IDEAL_MAX_WORDS = 150
 * VOICE_ACCEPTABLE_MAX_WORDS = 250 (still useful, starts getting long)
 */
export const VOICE_IDEAL_MIN_WORDS = 75;
export const VOICE_IDEAL_MAX_WORDS = 150;
export const VOICE_ACCEPTABLE_MAX_WORDS = 250;
export const VOICE_TTS_WPM = 150;
```

---

### Component 5: llms.txt Generator — `lib/vaio/llms-txt-generator.ts`

```typescript
/**
 * Generates llms.txt and llms-full.txt for a location.
 * Uses Ground Truth data + page_schemas + reviews keywords as source material.
 *
 * llms.txt format (the emerging standard):
 * - Plain text, Markdown-formatted
 * - First line: "# {businessName}"
 * - Second line: "> {one-sentence description with category, city, key features}"
 * - Sections: About, Key Facts, Menu/Services, Events & Entertainment,
 *             FAQ, Location, Contact
 * - Each link: "- [Page Title](URL): Brief description"
 * - Total: ~300–500 words
 *
 * llms-full.txt format:
 * - Same structure as llms.txt but with expanded descriptions
 * - Includes top review keywords (Sprint 107) as "What customers say"
 * - Includes top positive content from published content_drafts
 * - Total: ~800–1200 words
 *
 * The generated content MUST use only Ground Truth data.
 * Never generate or infer business facts not present in ground_truth.
 * If a field is null/empty in ground_truth → omit that section from llms.txt.
 *
 * Pure function for the content generation — all DB reads happen in vaio-service.ts
 * before calling generateLlmsTxt().
 */
export function generateLlmsTxt(
  groundTruth: GroundTruth,
  topReviewKeywords: string[],     // From Sprint 107 — positive keywords
  pageUrls: LlmsPageUrl[],         // Known pages to link (from page_schemas)
): LlmsTxtContent { ... }

/**
 * A page URL entry for the llms.txt link section.
 */
export interface LlmsPageUrl {
  page_type: 'homepage' | 'menu' | 'events' | 'faq' | 'about' | 'contact' | 'blog';
  url: string;
  description: string;
}

/**
 * Builds the standard (concise) llms.txt content.
 * Pure function.
 *
 * Template (fill from groundTruth):
 *
 * # {name}
 * > {name} is a {category} in {city}, {state}, located at {address}.
 * > {description_first_sentence}
 *
 * ## Key Facts
 * - **Hours:** {formatted_hours}
 * - **Phone:** {phone}
 * - **Address:** {address}
 * - **Specialties:** {top_amenities, comma-joined, max 5}
 *
 * ## Menu & Services
 * - [Menu]({menu_url}): {menu_description}
 *
 * ## Events & Entertainment
 * - [Events]({events_url}): {events_description}
 *
 * ## FAQ
 * - [Frequently Asked Questions]({faq_url}): {faq_description}
 *
 * ## Location & Contact
 * - [Contact]({contact_url}): {address}, {city}, {state}
 */
export function buildStandardLlmsTxt(
  groundTruth: GroundTruth,
  pageUrls: LlmsPageUrl[],
): string { ... }

/**
 * Builds the full (comprehensive) llms-full.txt content.
 * Extends buildStandardLlmsTxt with review keywords + additional context.
 * Pure function.
 */
export function buildFullLlmsTxt(
  groundTruth: GroundTruth,
  pageUrls: LlmsPageUrl[],
  topReviewKeywords: string[],
): string { ... }

/**
 * Formats business hours for natural-language reading in llms.txt.
 * Input: groundTruth.hours (JSON object with day → open/close)
 * Output: "Tuesday–Thursday 5 PM–1 AM, Friday–Saturday 5 PM–2 AM"
 * Combines consecutive days with same hours into ranges.
 * Pure function.
 */
export function formatHoursForVoice(hours: Record<string, { open: string; close: string } | null>): string { ... }
```

---

### Component 6: AI Crawler Auditor — `lib/vaio/ai-crawler-auditor.ts`

```typescript
/**
 * Fetches the business's robots.txt and checks access for known AI crawlers.
 * This tells tenants whether the major AI engines can actually crawl their site.
 *
 * Fetch URL: {website}/robots.txt
 * Timeout: 8 seconds
 * Never throws — returns { robots_txt_found: false, overall_health: 'unknown' } on failure.
 *
 * PARSING LOGIC:
 * For each crawler in KNOWN_AI_CRAWLERS:
 * 1. Look for a "User-agent: {crawler.user_agent}" line
 * 2. If found: check subsequent lines for "Disallow: /" (blocked) or "Allow: /" (allowed)
 * 3. If not found: check "User-agent: *" wildcard rules
 * 4. Result: 'allowed' | 'blocked' | 'not_specified'
 *    - 'not_specified' = not in robots.txt, inherits wildcard (likely allowed but unconfirmed)
 *
 * Overall health:
 * - 'healthy': all HIGH impact crawlers are 'allowed' or 'not_specified' (no explicit blocks)
 * - 'partial': some HIGH impact crawlers explicitly blocked
 * - 'blocked': majority of HIGH impact crawlers explicitly blocked
 * - 'unknown': robots.txt not found or failed to fetch
 */
export async function auditAICrawlerAccess(websiteUrl: string): Promise<AICrawlerAuditResult> { ... }

/**
 * Parses a robots.txt string for a specific user-agent.
 * Pure function.
 * Returns: 'allowed' | 'blocked' | 'not_specified'
 */
export function parseRobotsTxtForAgent(
  robotsTxt: string,
  userAgent: string,
): 'allowed' | 'blocked' | 'not_specified' { ... }

/**
 * The AI crawlers LocalVector tracks.
 * Ordered by impact on AI citation visibility.
 */
export const KNOWN_AI_CRAWLERS: Array<{
  name: string;
  user_agent: string;
  used_by: string;
  impact: 'high' | 'medium' | 'low';
}> = [
  { name: 'GPTBot',            user_agent: 'GPTBot',           used_by: 'ChatGPT / OpenAI',           impact: 'high' },
  { name: 'PerplexityBot',     user_agent: 'PerplexityBot',    used_by: 'Perplexity AI',               impact: 'high' },
  { name: 'Google-Extended',   user_agent: 'Google-Extended',  used_by: 'Google Bard / Gemini',        impact: 'high' },
  { name: 'ClaudeBot',         user_agent: 'ClaudeBot',        used_by: 'Claude / Anthropic',          impact: 'medium' },
  { name: 'anthropic-ai',      user_agent: 'anthropic-ai',     used_by: 'Claude / Anthropic (alt)',    impact: 'medium' },
  { name: 'ChatGPT-User',      user_agent: 'ChatGPT-User',     used_by: 'ChatGPT browsing',            impact: 'medium' },
  { name: 'OAI-SearchBot',     user_agent: 'OAI-SearchBot',    used_by: 'OpenAI SearchBot',            impact: 'medium' },
  { name: 'Applebot-Extended', user_agent: 'Applebot-Extended',used_by: 'Apple Intelligence / Siri',  impact: 'medium' },
  { name: 'Amazonbot',         user_agent: 'Amazonbot',        used_by: 'Alexa / Amazon AI',           impact: 'low' },
  { name: 'Bytespider',        user_agent: 'Bytespider',       used_by: 'TikTok / ByteDance AI',       impact: 'low' },
];

/**
 * Generates the recommended robots.txt addition for blocked/missing crawlers.
 * Returns the exact text the tenant should add to their robots.txt.
 * Pure function.
 */
export function generateRobotsTxtFix(blockedOrMissingCrawlers: AICrawlerStatus[]): string { ... }
```

---

### Component 7: Voice Gap Detector — `lib/vaio/voice-gap-detector.ts`

```typescript
/**
 * Detects voice query gaps — conversational queries getting zero citations.
 *
 * Gap detection rules (same as prompt-missing trigger but for voice queries):
 * - 3+ voice queries in the same category with citation_rate = 0
 * - last_run_at < NOW() - INTERVAL '14 days' (has run at least twice)
 * - Groups by VoiceQueryCategory — one gap per category cluster
 *
 * For each gap detected:
 * - Build a suggested_query_answer (one sentence) from groundTruth
 *   e.g. for 'information' gaps: "Charcoal N Chill in Alpharetta is open
 *   Tuesday through Thursday from 5 PM to 1 AM, and Friday through
 *   Saturday from 5 PM to 2 AM."
 *
 * Voice gap → Autopilot trigger:
 * When a voice gap is detected for 'action' or 'discovery' category:
 * → createDraft() with trigger_type = 'prompt_missing'
 *   context.zeroCitationQueries = voice gap queries
 *   context.additionalContext = "These are VOICE SEARCH queries — write in
 *     spoken-word format: short sentences, no markdown, 50–150 words max,
 *     starts with the answer directly."
 *
 * Returns: VoiceGap[] — one per zero-citation category cluster.
 */
export async function detectVoiceGaps(
  supabase: ReturnType<typeof createServiceRoleClient>,
  groundTruth: GroundTruth,
  locationId: string,
  orgId: string,
): Promise<VoiceGap[]> { ... }

/**
 * Builds a suggested spoken answer for a voice gap.
 * Uses groundTruth data only — no fabrication.
 * Pure function.
 *
 * Rules per category:
 * 'information': "{businessName} in {city} is open {formattedHours}."
 * 'action': "{businessName} is located at {address} in {city}. Call {phone} or visit {website} to make a reservation."
 * 'discovery': "{businessName} is a {category} in {city}, offering {top_amenities_spoken}."
 * 'comparison': "{businessName} in {city} is known for {top_review_keywords_positive}."
 */
export function buildSuggestedAnswer(
  category: VoiceQueryCategory,
  groundTruth: GroundTruth,
  topReviewKeywords?: string[],
): string { ... }
```

---

### Component 8: VAIO Service Orchestrator — `lib/vaio/vaio-service.ts`

```typescript
/**
 * Runs the full VAIO scan for a single location.
 *
 * Flow:
 * 1. Fetch GroundTruth for locationId
 * 2. Seed voice queries if not yet seeded — seedVoiceQueriesForLocation()
 * 3. Fetch current voice query citation rates — getVoiceQueriesForLocation()
 * 4. Audit AI crawler access — auditAICrawlerAccess(groundTruth.website)
 *    (Skip if no website URL — return 'unknown')
 * 5. Generate llms.txt — generateLlmsTxt()
 *    Fetch top positive review keywords (Sprint 107) for llms-full.txt
 *    Fetch page_schemas for page URL list
 * 6. Detect voice gaps — detectVoiceGaps()
 *    For action/discovery gaps: createDraft() via Sprint 86 Autopilot
 * 7. Score top published voice content (GBP posts + FAQs from content_drafts)
 *    scoreVoiceContent() on up to 5 most recent published drafts
 * 8. Compute voice_readiness_score from VOICE_SCORE_WEIGHTS
 * 9. Build VAIOProfile and upsert to vaio_profiles table
 * 10. Update locations.voice_readiness_score + locations.vaio_last_run_at
 * 11. Return VAIORRunResult
 *
 * Uses createServiceRoleClient().
 * Never throws — returns partial results with errors.
 */
export async function runVAIO(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  orgId: string,
): Promise<VAIORRunResult> { ... }

/**
 * Computes the overall voice readiness score from the four weighted dimensions.
 * Pure function.
 *
 * llms_txt score (max 25 pts):
 *   generated + < 30 days old: 25 pts
 *   generated + > 30 days old (stale): 12 pts
 *   not generated: 0 pts
 *
 * crawler_access score (max 25 pts):
 *   'healthy': 25 pts
 *   'partial': 12 pts
 *   'blocked': 0 pts
 *   'unknown': 10 pts (no website or fetch failed)
 *
 * voice_citation score (max 30 pts):
 *   average citation_rate across all active voice queries × 30
 *   (e.g. avg 0.5 citation rate → 15 pts)
 *
 * content_quality score (max 20 pts):
 *   average voice content score across scored drafts ÷ 5
 *   (e.g. avg score 75/100 → 15 pts)
 */
export function computeVoiceReadinessScore(
  llmsTxtStatus: 'generated' | 'stale' | 'not_generated',
  crawlerHealth: 'healthy' | 'partial' | 'blocked' | 'unknown',
  avgVoiceCitationRate: number,
  avgContentScore: number,
): number { ... }

/**
 * Runs VAIO for all active Growth+ locations.
 * Called by the monthly VAIO cron.
 * Sequential, 1s sleep between locations.
 */
export async function runVAIOForAllLocations(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<{ processed: number; total_score_avg: number; errors: number }> { ... }
```

---

### Component 9: Migration

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 109: VAIO — Voice Search & Conversational AI Optimization
-- ══════════════════════════════════════════════════════════════

-- 1. Add query_mode column to sov_target_queries
--    Distinguishes voice queries from typed queries in the existing query table.
--    Default 'typed' so all existing rows remain unchanged.
ALTER TABLE public.sov_target_queries
  ADD COLUMN IF NOT EXISTS query_mode text NOT NULL DEFAULT 'typed'
    CHECK (query_mode IN ('typed', 'voice'));

COMMENT ON COLUMN public.sov_target_queries.query_mode IS
  'Whether this is a typed search query (SOV engine) or a voice/conversational
   query (VAIO). Sprint 109.';

CREATE INDEX IF NOT EXISTS idx_sov_queries_mode
  ON public.sov_target_queries (location_id, query_mode, is_active);

-- 2. vaio_profiles — current VAIO state per location
CREATE TABLE IF NOT EXISTS public.vaio_profiles (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                   uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  voice_readiness_score    integer     NOT NULL DEFAULT 0
                                       CHECK (voice_readiness_score BETWEEN 0 AND 100),

  -- llms.txt
  llms_txt_standard        text,                -- Current llms.txt content
  llms_txt_full            text,                -- Current llms-full.txt content
  llms_txt_generated_at    timestamptz,
  llms_txt_status          text        NOT NULL DEFAULT 'not_generated'
                                       CHECK (llms_txt_status IN ('generated','stale','not_generated')),

  -- AI crawler audit (stored as JSONB)
  crawler_audit            jsonb,               -- AICrawlerAuditResult

  -- Voice query stats
  voice_queries_tracked    integer     NOT NULL DEFAULT 0,
  voice_citation_rate      numeric(4,3) NOT NULL DEFAULT 0,   -- 0.000–1.000

  -- Gaps + issues (stored as JSONB arrays)
  voice_gaps               jsonb       NOT NULL DEFAULT '[]'::jsonb,
  top_content_issues       jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  last_run_at              timestamptz,
  UNIQUE (location_id)
);

ALTER TABLE public.vaio_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vaio_profiles: org members read own"
  ON public.vaio_profiles FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "vaio_profiles: service role full access"
  ON public.vaio_profiles USING (auth.role() = 'service_role');

COMMENT ON TABLE public.vaio_profiles IS
  'Voice & Conversational AI Optimization state per location. Sprint 109.';

-- 3. Add voice columns to locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS voice_readiness_score  integer CHECK (voice_readiness_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS vaio_last_run_at        timestamptz;

COMMENT ON COLUMN public.locations.voice_readiness_score IS
  'Voice readiness score 0–100. NULL = never run. Sprint 109.';
```

**Update `prod_schema.sql`**, **`database.types.ts`** — add `query_mode` to sov_target_queries, `vaio_profiles` table, 2 new location columns.

---

### Component 10: API Routes

#### `app/api/vaio/run/route.ts`

```typescript
/**
 * POST /api/vaio/run
 * On-demand VAIO scan.
 * Error codes: "unauthorized", "plan_upgrade_required", "no_location", "run_failed"
 */
export async function POST(request: Request) { ... }
```

#### `app/api/vaio/status/route.ts`

```typescript
/**
 * GET /api/vaio/status
 * Returns the current VAIOProfile for the authenticated user's location.
 *
 * Response:
 * {
 *   profile: VAIOProfile | null,
 *   voice_queries: VoiceQuery[],      // All active voice queries
 *   last_run_at: string | null,
 * }
 */
export async function GET(request: Request) { ... }
```

#### `app/api/vaio/llms-txt/route.ts`

```typescript
/**
 * GET /api/vaio/llms-txt
 * Returns the generated llms.txt and llms-full.txt for the authenticated location.
 * Response: { standard: string; full: string; generated_at: string | null }
 *
 * POST /api/vaio/llms-txt
 * Regenerates llms.txt + llms-full.txt on demand.
 * Calls generateLlmsTxt() with latest Ground Truth data.
 * Updates vaio_profiles.llms_txt_standard + llms_txt_full + llms_txt_generated_at.
 * Response: { ok: true, standard: string; full: string }
 */
export async function GET(request: Request) { ... }
export async function POST(request: Request) { ... }
```

#### `app/api/vaio/preview/route.ts`

```typescript
/**
 * POST /api/vaio/preview
 * Generates a spoken answer preview for submitted text.
 * Body: { content: string; content_type: 'faq_page' | 'gbp_post' | 'faq_answer' | 'llms_txt' }
 * Response: SpokenAnswerPreview
 *
 * No plan gate — available to all plans (it's a client-side analysis tool).
 * Rate limit: 20 requests/minute per org (uses basic in-memory rate limiting).
 */
export async function POST(request: Request) { ... }
```

#### `app/api/cron/vaio/route.ts`

```typescript
/**
 * GET /api/cron/vaio
 * Monthly VAIO cron — seeds voice queries, generates llms.txt, detects voice gaps
 * for all Growth+ locations. Also refreshes AI crawler audits.
 * Schedule: 1st of month, 6 AM UTC (after authority-mapping at 5AM)
 * Security: CRON_SECRET header.
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
    { "path": "/api/cron/authority-mapping", "schedule": "0 5 1 * *" },
    { "path": "/api/cron/vaio",              "schedule": "0 6 1 * *" }
  ]
}
```

---

### Component 11: Seed Data — `supabase/seed.sql`

```sql
DO $$
DECLARE
  v_location_id uuid;
  v_org_id      uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  SELECT id INTO v_location_id FROM public.locations WHERE org_id = v_org_id LIMIT 1;

  -- Seed 8 voice queries (priority 1 templates instantiated for Charcoal N Chill)
  INSERT INTO public.sov_target_queries
    (location_id, org_id, query_text, query_category, query_mode, is_active, is_system_seeded)
  VALUES
    (v_location_id, v_org_id, 'What''s a good hookah lounge near Alpharetta?',
     'discovery', 'voice', true, true),
    (v_location_id, v_org_id, 'Find me a hookah lounge near Alpharetta that''s open right now',
     'discovery', 'voice', true, true),
    (v_location_id, v_org_id, 'Is there a hookah lounge in Alpharetta with live entertainment?',
     'discovery', 'voice', true, true),
    (v_location_id, v_org_id, 'Where can I make a reservation at a hookah lounge in Alpharetta?',
     'action', 'voice', true, true),
    (v_location_id, v_org_id, 'How do I book a private event at Charcoal N Chill?',
     'action', 'voice', true, true),
    (v_location_id, v_org_id, 'Where can I go for a birthday party with hookah in Alpharetta?',
     'action', 'voice', true, true),
    (v_location_id, v_org_id, 'What time does Charcoal N Chill close tonight?',
     'information', 'voice', true, true),
    (v_location_id, v_org_id, 'What are Charcoal N Chill''s hours on Friday?',
     'information', 'voice', true, true)
  ON CONFLICT DO NOTHING;

  -- Seed VAIO profile
  INSERT INTO public.vaio_profiles (
    location_id, org_id,
    voice_readiness_score,
    llms_txt_standard,
    llms_txt_full,
    llms_txt_generated_at,
    llms_txt_status,
    crawler_audit,
    voice_queries_tracked,
    voice_citation_rate,
    voice_gaps,
    top_content_issues,
    last_run_at
  ) VALUES (
    v_location_id, v_org_id,
    48,   -- Realistic starting score — llms.txt not yet deployed, some crawler issues
    E'# Charcoal N Chill\n> Charcoal N Chill is a premium hookah lounge and Indo-American fusion restaurant in Alpharetta, Georgia, serving North Atlanta since 2021.\n\n## Key Facts\n- **Hours:** Tuesday–Thursday 5 PM–1 AM, Friday–Saturday 5 PM–2 AM\n- **Phone:** (470) 546-4866\n- **Address:** 11950 Jones Bridge Rd Ste 103, Alpharetta, GA 30005\n- **Specialties:** Premium hookah (50+ flavors), Indo-American fusion cuisine, live entertainment, private events, VIP sections\n\n## Menu & Services\n- [Menu](https://charcoalnchill.com/menu): Over 50 premium hookah flavors, Indo-American fusion cuisine including tandoori, curry, and clay oven breads, craft cocktails.\n\n## Events & Entertainment\n- [Events](https://charcoalnchill.com/events): Weekly belly dancing shows, Afrobeats DJ nights, Latino Night, Punjabi Night, themed cultural evenings every weekend.\n\n## FAQ\n- [FAQ](https://charcoalnchill.com/faq): Answers about reservations, dress code, hookah, menu, parking, and private events.\n\n## Contact\n- [Contact](https://charcoalnchill.com/contact): 11950 Jones Bridge Rd Ste 103, Alpharetta, GA 30005 · (470) 546-4866',
    null,   -- llms-full.txt seeded separately in practice
    NOW() - INTERVAL '5 days',
    'generated',
    '{
      "website_url": "https://charcoalnchill.com",
      "robots_txt_found": true,
      "robots_txt_url": "https://charcoalnchill.com/robots.txt",
      "crawlers": [
        { "name": "GPTBot", "user_agent": "GPTBot", "status": "not_specified", "used_by": "ChatGPT / OpenAI", "impact": "high" },
        { "name": "PerplexityBot", "user_agent": "PerplexityBot", "status": "allowed", "used_by": "Perplexity AI", "impact": "high" },
        { "name": "Google-Extended", "user_agent": "Google-Extended", "status": "not_specified", "used_by": "Google Gemini", "impact": "high" },
        { "name": "ClaudeBot", "user_agent": "ClaudeBot", "status": "not_specified", "used_by": "Claude / Anthropic", "impact": "medium" },
        { "name": "Applebot-Extended", "user_agent": "Applebot-Extended", "status": "not_specified", "used_by": "Apple Intelligence / Siri", "impact": "medium" }
      ],
      "overall_health": "partial",
      "blocked_count": 0,
      "allowed_count": 1,
      "missing_count": 4,
      "last_checked_at": "2026-03-01T06:00:00Z"
    }'::jsonb,
    8,
    0.25,   -- 25% average citation rate across voice queries
    '[
      {
        "category": "action",
        "queries": [
          "Where can I make a reservation at a hookah lounge in Alpharetta?",
          "How do I book a private event at Charcoal N Chill?"
        ],
        "weeks_at_zero": 2,
        "suggested_content_type": "faq_page",
        "suggested_query_answer": "Charcoal N Chill in Alpharetta accepts reservations and private event bookings by calling (470) 546-4866 or visiting charcoalnchill.com."
      }
    ]'::jsonb,
    '[
      {
        "type": "contains_markdown",
        "severity": "critical",
        "description": "GBP post contains asterisk markdown formatting that reads poorly aloud.",
        "fix": "Remove ** bold markers and use plain sentence structure instead."
      }
    ]'::jsonb,
    NOW() - INTERVAL '1 day'
  )
  ON CONFLICT (location_id) DO NOTHING;

  UPDATE public.locations
     SET voice_readiness_score = 48,
         vaio_last_run_at = NOW() - INTERVAL '1 day'
   WHERE id = v_location_id;
END $$;
```

---

### Component 12: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
// Sprint 109 — VAIO fixtures

export const MOCK_VOICE_QUERIES: VoiceQuery[] = [
  { id: 'vq-001', location_id: 'loc-golden-tenant-id', org_id: 'a0eebc99-...',
    query_text: "What's a good hookah lounge near Alpharetta?",
    query_category: 'discovery', query_mode: 'voice', is_active: true,
    citation_rate: 0.4, last_run_at: '2026-02-24T02:00:00Z', is_system_seeded: true },
  { id: 'vq-002', location_id: 'loc-golden-tenant-id', org_id: 'a0eebc99-...',
    query_text: 'What time does Charcoal N Chill close tonight?',
    query_category: 'information', query_mode: 'voice', is_active: true,
    citation_rate: 0.6, last_run_at: '2026-02-24T02:00:00Z', is_system_seeded: true },
  { id: 'vq-003', location_id: 'loc-golden-tenant-id', org_id: 'a0eebc99-...',
    query_text: 'How do I book a private event at Charcoal N Chill?',
    query_category: 'action', query_mode: 'voice', is_active: true,
    citation_rate: 0.0, last_run_at: '2026-02-24T02:00:00Z', is_system_seeded: true },
];

export const MOCK_VOICE_CONTENT_SCORE: VoiceContentScore = {
  overall_score: 74,
  avg_sentence_words: 18,
  direct_answer_score: 30,
  local_specificity_score: 20,
  action_language_score: 15,
  spoken_length_score: 20,
  issues: [
    { type: 'contains_markdown', severity: 'critical',
      description: 'Content contains markdown formatting (**bold**) that reads poorly aloud.',
      fix: 'Replace **bold markers** with plain text for voice-friendliness.' },
  ],
};

export const MOCK_SPOKEN_PREVIEW: SpokenAnswerPreview = {
  content: '**Charcoal N Chill** in Alpharetta offers premium hookah service and live entertainment. Visit us at 11950 Jones Bridge Rd.',
  word_count: 22,
  estimated_spoken_seconds: 9,
  is_voice_ready: false,
  cleaned_content: 'Charcoal N Chill in Alpharetta offers premium hookah service and live entertainment. Visit us at 11950 Jones Bridge Rd.',
  issues: [
    { type: 'contains_markdown', severity: 'critical',
      description: 'Found markdown bold markers (**)', fix: 'Remove ** markers.' },
    { type: 'too_long', severity: 'info',
      description: 'Only 22 words — too brief for a complete spoken answer.',
      fix: 'Expand to 75–150 words for an ideal voice answer.' },
  ],
  reading_grade_level: 7.2,
};

export const MOCK_LLMS_TXT: LlmsTxtContent = {
  standard: '# Charcoal N Chill\n> Charcoal N Chill is a premium hookah lounge...',
  full: '# Charcoal N Chill\n> ...\n\n## What Customers Say\n...',
  generated_at: '2026-03-01T06:00:00.000Z',
  version: 1,
};

export const MOCK_CRAWLER_AUDIT: AICrawlerAuditResult = {
  website_url: 'https://charcoalnchill.com',
  robots_txt_found: true,
  robots_txt_url: 'https://charcoalnchill.com/robots.txt',
  crawlers: [
    { name: 'GPTBot', user_agent: 'GPTBot', status: 'not_specified', used_by: 'ChatGPT / OpenAI', impact: 'high' },
    { name: 'PerplexityBot', user_agent: 'PerplexityBot', status: 'allowed', used_by: 'Perplexity AI', impact: 'high' },
  ],
  overall_health: 'partial',
  blocked_count: 0, allowed_count: 1, missing_count: 4,
  last_checked_at: '2026-03-01T06:00:00.000Z',
};

export const MOCK_VAIO_PROFILE: VAIOProfile = {
  location_id: 'loc-golden-tenant-id',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  voice_readiness_score: 48,
  llms_txt_status: 'generated',
  llms_txt_generated_at: '2026-03-01T06:00:00.000Z',
  crawler_health: MOCK_CRAWLER_AUDIT,
  voice_queries_tracked: 8,
  voice_citation_rate: 0.25,
  voice_gaps: [
    { category: 'action', queries: ['How do I book a private event at Charcoal N Chill?'],
      weeks_at_zero: 2, suggested_content_type: 'faq_page',
      suggested_query_answer: 'Charcoal N Chill in Alpharetta accepts reservations by calling (470) 546-4866.' }
  ],
  top_voice_score_issues: MOCK_VOICE_CONTENT_SCORE.issues,
  last_run_at: '2026-03-01T06:00:00.000Z',
};
```

---

### Component 13: VAIO Dashboard Panel — `app/dashboard/_components/VAIOPanel.tsx`

```
┌────────────────────────────────────────────────────────────────────┐
│  🎙️  Voice Readiness                    Score: 48/100   Grade: D  │
│  Last scan: yesterday   [Re-scan Now →]                            │
├────────────────────────────────────────────────────────────────────┤
│  ⚠️  AI CRAWLERS: GPTBot (ChatGPT) not explicitly allowed          │
│  4 crawlers not specified in your robots.txt. [See Fix →]          │
├─────────────────────────────────┬──────────────────────────────────┤
│  SCORE BREAKDOWN                │  AI CRAWLER STATUS               │
│  ─────────────────────────────  │  ──────────────────────────────  │
│  llms.txt             25/25 ✅  │  ✅ PerplexityBot    Allowed     │
│  Crawler Access       12/25 ⚠️  │  ⚠️  GPTBot          Not listed  │
│  Voice Citations       8/30 🔴  │  ⚠️  Google-Extended Not listed  │
│  Content Quality      12/20 ⚠️  │  ⚠️  Applebot-Ext.   Not listed  │
├─────────────────────────────────┼──────────────────────────────────┤
│  VOICE QUERIES (8 tracked)      │  TOP VOICE GAPS                  │
│  ─────────────────────────────  │  ──────────────────────────────  │
│  Discovery: 40% cited   ⚠️       │  🔴 Action queries (2 gaps)     │
│  Information: 60% cited ✅       │  "How to book private events?"   │
│  Action: 0% cited       🔴       │  Suggested answer:               │
│  Comparison: 20% cited  ⚠️       │  "Call (470) 546-4866..."        │
│                                 │  [Create Voice Brief →]          │
├─────────────────────────────────┴──────────────────────────────────┤
│  llms.txt                              [Copy llms.txt]             │
│  Generated 5 days ago — current                                     │
│  Add to your website: Place in public/ as /llms.txt                │
│  [View Standard]  [View Full]  [Regenerate]                        │
├────────────────────────────────────────────────────────────────────┤
│  SPOKEN ANSWER PREVIEW TOOL                                         │
│  Test any content for voice-friendliness:                           │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Paste content here to hear how it would sound as a           │ │
│  │ spoken AI answer...                                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  [Analyze for Voice]                                                │
└────────────────────────────────────────────────────────────────────┘
```

**Implementation rules:**
- `'use client'` — loads via `GET /api/vaio/status`
- Plan gate: Growth+ only — Starter sees upgrade prompt
- Score colored: ≥80 green, 60–79 yellow, <60 red
- Letter grade: A (90+), B (80–89), C (60–79), D (40–59), F (<40)
- Crawler status icons: ✅ Allowed, ⚠️ Not specified, 🔴 Blocked
- "See Fix →" link on crawler warning: opens `CrawlerFixModal` with the exact `robots.txt` snippet to add
- "Create Voice Brief →": calls `POST /api/autopilot/drafts` with voice-specific context
- "Copy llms.txt": copies `llms_txt_standard` to clipboard
- "View Standard / View Full": opens a modal showing the full llms.txt content
- "Regenerate": calls `POST /api/vaio/llms-txt`, shows new generated_at timestamp
- **Spoken Answer Preview Tool**: textarea + "Analyze for Voice" button → calls `POST /api/vaio/preview` → renders `SpokenPreviewCard` with score, word count, spoken seconds estimate, cleaned content, and issues list
- All interactive elements: `data-testid` attributes required
- Skeleton while data fetches

---

### Component 14: Spoken Answer Preview Card — `app/dashboard/_components/SpokenPreviewCard.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  🎙️ Spoken Answer Analysis                                       │
│  ──────────────────────────────────────────────────────────────  │
│  Voice Score: 74/100                                              │
│  Word count: 22 words · Estimated spoken: 9 seconds              │
│  ⚠️ Too brief — ideal voice answer is 75–150 words (30–60 sec)   │
│  ──────────────────────────────────────────────────────────────  │
│  As it would sound:                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ "Charcoal N Chill in Alpharetta offers premium hookah     │   │
│  │ service and live entertainment. Visit us at 11950 Jones   │   │
│  │ Bridge Rd."                                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  Issues found:                                                    │
│  🔴 Markdown formatting removed (** markers) — read poorly aloud │
│  ⚠️  Too brief — expand to 75+ words for complete voice answer   │
└──────────────────────────────────────────────────────────────────┘
```

---

### Component 15: Crawler Fix Modal — `app/dashboard/_components/CrawlerFixModal.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  🤖 Allow AI Crawlers in robots.txt                              │
│  ──────────────────────────────────────────────────────────────  │
│  4 AI crawlers are not explicitly allowed on your website.       │
│  Add these lines to your robots.txt file:                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ # Allow AI search crawlers                               │   │
│  │ User-agent: GPTBot                                       │   │
│  │ Allow: /                                                 │   │
│  │                                                           │   │
│  │ User-agent: Google-Extended                              │   │
│  │ Allow: /                                                 │   │
│  │                                                           │   │
│  │ User-agent: Applebot-Extended                            │   │
│  │ Allow: /                                                 │   │
│  │                                                           │   │
│  │ User-agent: ClaudeBot                                    │   │
│  │ Allow: /                                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ──────────────────────────────────────────────────────────────  │
│  [Copy to Clipboard]     [Re-audit after updating →]             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/voice-content-scorer.test.ts`

**Pure functions — zero mocks.**

```
describe('scoreVoiceContent')
  1.  MOCK_SPOKEN_PREVIEW.content → overall_score 74 (matches fixture)
  2.  Content with direct answer in first sentence → direct_answer_score = 30
  3.  Content starting with "Welcome to..." → direct_answer_score = 0
  4.  businessName + city in first 50 words → local_specificity_score = 25
  5.  Neither businessName nor city present → local_specificity_score = 0
  6.  3+ action verbs → action_language_score = 25
  7.  0 action verbs → action_language_score = 0
  8.  100-word content → spoken_length_score = 20
  9.  350-word content → spoken_length_score = 0
  10. 20-word content → spoken_length_score = 5
  11. overall score always 0–100

describe('countActionVerbs')
  12. "book a reservation and visit us" → 2
  13. "The lounge is located near Alpharetta" → 0
  14. case-insensitive: "BOOK" counted

describe('avgSentenceWords')
  15. "Hello. World test." → 2.0 average (2 sentences: 1 + 2 words)
  16. correctly handles sentences ending in ? and !
  17. returns 0 for empty string (no throw)

describe('fleschKincaidGrade')
  18. returns number between 0 and 20 for typical text
  19. simple text ("Cat sat.") → lower grade than complex text

describe('containsMarkdown')
  20. "**bold** text" → true
  21. "## Header" → true
  22. "plain text only" → false

describe('containsRawUrls')
  23. "visit https://example.com today" → true
  24. "visit our website today" → false
```

**24 tests. Zero mocks.**

---

### Test File 2: `src/__tests__/unit/spoken-answer-previewer.test.ts`

**Pure functions — zero mocks.**

```
describe('cleanForVoice')
  1.  strips ** markdown bold markers
  2.  strips ## heading markers
  3.  converts bullet list "- Item A\n- Item B" → "Item A, Item B"
  4.  replaces https URLs with "[link]"
  5.  strips HTML tags
  6.  normalizes multiple spaces to single space

describe('estimateSpokenSeconds')
  7.  150 words → 60 seconds
  8.  75 words → 30 seconds
  9.  word_count = 0 → 0 seconds

describe('generateSpokenPreview')
  10. MOCK_SPOKEN_PREVIEW.content → matches fixture is_voice_ready: false
  11. cleaned_content has no ** markers
  12. contains_markdown issue detected for ** content
  13. word_count < VOICE_IDEAL_MIN_WORDS → too_long issue with severity 'info'
  14. word_count > VOICE_ACCEPTABLE_MAX_WORDS → too_long issue with severity 'critical'
  15. missing businessName → no_business_name issue
  16. missing city → no_local_mention issue (warning)
  17. content > 250 words → cleaned_content truncated at 250 words

describe('VOICE constants')
  18. VOICE_IDEAL_MIN_WORDS = 75
  19. VOICE_IDEAL_MAX_WORDS = 150
  20. VOICE_TTS_WPM = 150
```

**20 tests. Zero mocks.**

---

### Test File 3: `src/__tests__/unit/voice-query-library.test.ts`

**Pure + Supabase mocked.**

```
describe('instantiateVoiceTemplate')
  1.  replaces {businessName} correctly
  2.  replaces {category} correctly
  3.  replaces {city} correctly
  4.  handles template with all three variables

describe('VOICE_QUERY_TEMPLATES')
  5.  contains at least 1 template per VoiceQueryCategory
  6.  all templates contain at least one of: {businessName}, {category}, {city}
  7.  all priority 1 templates are 'discovery' or 'action' (highest voice intent)

describe('seedVoiceQueriesForLocation — Supabase mocked')
  8.  inserts priority 1 + 2 templates for Growth plan
  9.  inserts only priority 1 templates for Starter plan (max 8 queries)
  10. idempotent — same query not inserted twice (ON CONFLICT DO NOTHING)
  11. all inserted rows have query_mode = 'voice'
  12. returns { seeded: N, skipped_dedup: M } correctly
```

**12 tests.**

---

### Test File 4: `src/__tests__/unit/llms-txt-generator.test.ts`

**Pure functions — zero mocks.**

```
describe('generateLlmsTxt')
  1.  standard output contains businessName in first line
  2.  standard output contains city + state in description line
  3.  standard output contains phone number
  4.  standard output contains formatted hours
  5.  standard output contains menu link URL
  6.  full output is longer than standard output
  7.  full output contains review keywords section when keywords provided
  8.  full output contains "What customers say" when keywords present
  9.  standard output is 300–500 words
  10. full output is 800–1200 words
  11. null phone → phone section omitted (no "null" in output)
  12. null website → links section omitted

describe('formatHoursForVoice')
  13. consecutive days same hours → range: "Tuesday–Thursday 5 PM–1 AM"
  14. different hours each day → individual: "Friday 5 PM–2 AM, Saturday..."
  15. closed day → "Closed Sunday and Monday"
  16. all null hours → "Hours not available"

describe('buildStandardLlmsTxt')
  17. starts with "# {businessName}"
  18. second line starts with ">"
  19. contains ## section headers for Key Facts, Menu, Events, FAQ, Contact
```

**19 tests. Zero mocks.**

---

### Test File 5: `src/__tests__/unit/ai-crawler-auditor.test.ts`

**HTTP mocked (fetch intercepted).**

```
describe('parseRobotsTxtForAgent')
  1.  "User-agent: GPTBot\nAllow: /" → 'allowed'
  2.  "User-agent: GPTBot\nDisallow: /" → 'blocked'
  3.  "User-agent: *\nAllow: /" + no GPTBot entry → 'not_specified'
  4.  empty robots.txt → 'not_specified'
  5.  case-insensitive user-agent matching
  6.  GPTBot entry after wildcard takes precedence over wildcard

describe('auditAICrawlerAccess — fetch mocked')
  7.  returns robots_txt_found: false when 404
  8.  returns robots_txt_found: false on network error (never throw)
  9.  returns all KNOWN_AI_CRAWLERS in crawlers array
  10. overall_health 'healthy' when all HIGH impact crawlers allowed/not_specified
  11. overall_health 'partial' when some HIGH impact crawlers blocked
  12. blocked_count correctly counts 'blocked' status crawlers
  13. allowed_count correctly counts 'allowed' status crawlers

describe('generateRobotsTxtFix')
  14. includes "User-agent: GPTBot\nAllow: /" for GPTBot not_specified
  15. includes comment "# Allow AI search crawlers"
  16. does not include already-allowed crawlers in fix
  17. returns empty string when no crawlers to fix
```

**17 tests.**

---

### Test File 6: `src/__tests__/unit/voice-gap-detector.test.ts`

**Supabase mocked.**

```
describe('buildSuggestedAnswer')
  1.  'information' category → includes business hours in answer
  2.  'action' category → includes phone number and website
  3.  'discovery' category → includes businessName + city + category
  4.  'comparison' category → includes review keywords when provided
  5.  never includes null values (hours null → omitted gracefully)

describe('detectVoiceGaps — Supabase mocked')
  6.  3+ zero-citation voice queries in same category → gap returned
  7.  groups queries by category — one gap per category
  8.  requires last_run_at < 14 days ago (ran at least twice)
  9.  < 3 zero-citation queries in a category → no gap returned
  10. triggers createDraft() for 'action' gap (high-value voice intent)
  11. triggers createDraft() for 'discovery' gap
  12. does NOT trigger createDraft() for 'information' gap (fact queries — no content needed)
  13. drafted content has "VOICE SEARCH queries" in additionalContext
```

**13 tests.**

---

### Test File 7: `src/__tests__/unit/vaio-routes.test.ts`

```
describe('POST /api/vaio/run')
  1.  returns 401 when not authenticated
  2.  returns 403 'plan_upgrade_required' for Starter
  3.  returns { ok: true, result: VAIORRunResult } on success

describe('GET /api/vaio/status')
  4.  returns { profile, voice_queries, last_run_at }
  5.  returns profile: null when never run (200, not 404)

describe('GET /api/vaio/llms-txt')
  6.  returns { standard, full, generated_at } when llms.txt exists
  7.  returns standard: null, full: null, generated_at: null when not generated

describe('POST /api/vaio/llms-txt')
  8.  regenerates and saves new llms.txt to vaio_profiles
  9.  returns { ok: true, standard: string, full: string }

describe('POST /api/vaio/preview')
  10. returns SpokenAnswerPreview for valid content
  11. returns 422 when content is empty string
  12. accepts all four content_type values
  13. no plan gate required (available to all plans)
```

**13 tests.**

---

### Test File 8: `src/__tests__/e2e/vaio-panel.spec.ts` — Playwright

```typescript
describe('VAIO Panel', () => {
  test('renders panel with score and breakdown', async ({ page }) => {
    // Mock GET /api/vaio/status → { profile: MOCK_VAIO_PROFILE, voice_queries: MOCK_VOICE_QUERIES }
    // Navigate to /dashboard
    // Assert: "Voice Readiness" panel visible (data-testid="vaio-panel")
    // Assert: "48/100" score visible
    // Assert: "Grade: D" visible
  });

  test('AI crawler warning banner shown', async ({ page }) => {
    // Assert: warning banner about unspecified AI crawlers visible
    // Assert: "See Fix →" link visible (data-testid="crawler-fix-link")
  });

  test('Crawler Fix Modal opens with correct robots.txt snippet', async ({ page }) => {
    // Click "See Fix →"
    // Assert: CrawlerFixModal opens (data-testid="crawler-fix-modal")
    // Assert: "User-agent: GPTBot" visible in code block
    // Assert: "Copy to Clipboard" button visible
  });

  test('llms.txt section shows status and copy button', async ({ page }) => {
    // Assert: "llms.txt" section visible
    // Assert: "Generated 5 days ago" text visible
    // Assert: "Copy llms.txt" button (data-testid="copy-llms-txt")
    // Assert: "View Standard" link visible
  });

  test('llms.txt Regenerate updates generated_at', async ({ page }) => {
    // Mock POST /api/vaio/llms-txt → { ok: true, standard: '# CNC...', full: '...' }
    // Click "Regenerate"
    // Assert: loading state on button
    // Assert: "generated_at" timestamp updates
  });

  test('Voice gap shows with Create Voice Brief CTA', async ({ page }) => {
    // Assert: "Action queries (2 gaps)" visible
    // Assert: suggested answer text visible
    // Assert: "Create Voice Brief →" button (data-testid="create-voice-brief-btn")
  });

  test('Create Voice Brief calls Autopilot with voice context', async ({ page }) => {
    // Mock POST /api/autopilot/drafts → { ok: true, draft: { id: 'draft-voice-001' } }
    // Click "Create Voice Brief →"
    // Assert: success toast "Voice brief created"
  });

  test('Spoken Answer Preview Tool analyzes content', async ({ page }) => {
    // Type content into preview textarea
    // Mock POST /api/vaio/preview → { ...MOCK_SPOKEN_PREVIEW }
    // Click "Analyze for Voice"
    // Assert: SpokenPreviewCard renders (data-testid="spoken-preview-card")
    // Assert: voice score visible
    // Assert: "As it would sound:" section visible with cleaned content
    // Assert: issues list rendered
  });

  test('Starter plan sees upgrade prompt', async ({ page }) => {
    // Mock GET /api/vaio/status → 403
    // Assert: upgrade prompt visible, panel content hidden
  });
});
```

**9 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/voice-content-scorer.test.ts     # 24 tests
npx vitest run src/__tests__/unit/spoken-answer-previewer.test.ts  # 20 tests
npx vitest run src/__tests__/unit/voice-query-library.test.ts      # 12 tests
npx vitest run src/__tests__/unit/llms-txt-generator.test.ts       # 19 tests
npx vitest run src/__tests__/unit/ai-crawler-auditor.test.ts       # 17 tests
npx vitest run src/__tests__/unit/voice-gap-detector.test.ts       # 13 tests
npx vitest run src/__tests__/unit/vaio-routes.test.ts              # 13 tests
npx vitest run                                                       # ALL — zero regressions
npx playwright test src/__tests__/e2e/vaio-panel.spec.ts           # 9 e2e tests
npx tsc --noEmit                                                     # 0 type errors
```

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/vaio/types.ts` | **CREATE** | All shared types |
| 2 | `lib/vaio/voice-query-library.ts` | **CREATE** | Voice query taxonomy (24 templates) + seeder |
| 3 | `lib/vaio/voice-content-scorer.ts` | **CREATE** | Voice-friendliness scorer + issue detector |
| 4 | `lib/vaio/spoken-answer-previewer.ts` | **CREATE** | Spoken answer simulation + markdown cleaner |
| 5 | `lib/vaio/llms-txt-generator.ts` | **CREATE** | llms.txt + llms-full.txt generator |
| 6 | `lib/vaio/ai-crawler-auditor.ts` | **CREATE** | robots.txt fetch + AI crawler parse |
| 7 | `lib/vaio/voice-gap-detector.ts` | **CREATE** | Voice gap detection + Autopilot trigger |
| 8 | `lib/vaio/vaio-service.ts` | **CREATE** | Orchestrator + score computation + cron runner |
| 9 | `lib/vaio/index.ts` | **CREATE** | Barrel export |
| 10 | `app/api/vaio/run/route.ts` | **CREATE** | On-demand VAIO scan |
| 11 | `app/api/vaio/status/route.ts` | **CREATE** | Dashboard status + voice queries |
| 12 | `app/api/vaio/llms-txt/route.ts` | **CREATE** | Get + regenerate llms.txt |
| 13 | `app/api/vaio/preview/route.ts` | **CREATE** | Spoken answer preview tool |
| 14 | `app/api/cron/vaio/route.ts` | **CREATE** | Monthly cron |
| 15 | `app/dashboard/_components/VAIOPanel.tsx` | **CREATE** | Main VAIO panel |
| 16 | `app/dashboard/_components/SpokenPreviewCard.tsx` | **CREATE** | Voice analysis result card |
| 17 | `app/dashboard/_components/CrawlerFixModal.tsx` | **CREATE** | robots.txt fix snippet modal |
| 18 | `app/dashboard/page.tsx` | **MODIFY** | Add VAIOPanel (Growth+ gated) |
| 19 | `vercel.json` | **MODIFY** | Add vaio cron (1st of month, 6 AM UTC) |
| 20 | `supabase/migrations/[timestamp]_vaio.sql` | **CREATE** | query_mode column + vaio_profiles table + location columns |
| 21 | `supabase/prod_schema.sql` | **MODIFY** | query_mode on sov_target_queries + vaio_profiles + location columns |
| 22 | `lib/supabase/database.types.ts` | **MODIFY** | Add VAIOProfile + query_mode types |
| 23 | `supabase/seed.sql` | **MODIFY** | 8 voice queries + vaio_profiles seed |
| 24 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 5 VAIO fixtures |
| 25 | `src/__tests__/unit/voice-content-scorer.test.ts` | **CREATE** | 24 tests |
| 26 | `src/__tests__/unit/spoken-answer-previewer.test.ts` | **CREATE** | 20 tests |
| 27 | `src/__tests__/unit/voice-query-library.test.ts` | **CREATE** | 12 tests |
| 28 | `src/__tests__/unit/llms-txt-generator.test.ts` | **CREATE** | 19 tests |
| 29 | `src/__tests__/unit/ai-crawler-auditor.test.ts` | **CREATE** | 17 tests |
| 30 | `src/__tests__/unit/voice-gap-detector.test.ts` | **CREATE** | 13 tests |
| 31 | `src/__tests__/unit/vaio-routes.test.ts` | **CREATE** | 13 tests |
| 32 | `src/__tests__/e2e/vaio-panel.spec.ts` | **CREATE** | 9 Playwright tests |

---

## 🚫 What NOT to Do

1. **DO NOT implement Speakable schema markup** — Speakable is restricted to news publishers enrolled in Google News Publisher Center, not applicable to local business content, and is being deprecated. Never reference Speakable anywhere in this sprint. This constraint is absolute.
2. **DO NOT modify the SOV cron execution logic** — voice queries run as a tagged subset of `sov_target_queries` (via `query_mode = 'voice'`). The existing typed-query cron execution is NOT touched. The `query_mode` column is additive; it does not change how the cron processes rows (it processes all `is_active = true` rows regardless of mode).
3. **DO NOT integrate with voice assistant APIs** — Siri, Alexa, and Google Assistant do not offer public APIs for injecting business content into spoken answers. This sprint optimizes *content* for voice; it does not interface with voice platforms directly.
4. **DO NOT generate audio files** — the Spoken Answer Preview simulates spoken output as cleaned text + word count + seconds estimate. No Web Speech API, no TTS synthesis, no audio file generation.
5. **DO NOT fabricate business data in llms.txt** — `generateLlmsTxt()` uses only Ground Truth data. If a field is null, omit that section entirely. Never infer or invent hours, phone numbers, or amenities.
6. **DO NOT store the business's website in `vaio_profiles`** — it's already in Ground Truth / locations. Don't duplicate it.
7. **DO NOT auto-deploy llms.txt** to the business's website — LocalVector does not have write access to tenants' websites. The llms.txt is generated and stored in `vaio_profiles.llms_txt_standard`; the owner copies it and deploys it manually. The dashboard provides copy-to-clipboard and deployment instructions.
8. **DO NOT re-implement the GroundTruth fetch** — use the existing pattern from Sprint 105 to fetch ground truth data for a location.
9. **DO NOT re-implement Autopilot createDraft()** — use `lib/autopilot/create-draft.ts` from Sprint 86 for voice gap triggers.
10. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
11. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
12. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.
13. **DO NOT edit `middleware.ts`** (AI_RULES §6).
14. **DO NOT trigger createDraft() for 'information' category voice gaps** — information queries (hours, address, phone) are answered from Ground Truth data, not from new content. Only 'action' and 'discovery' gaps warrant content creation.

---

## ✅ Definition of Done

- [ ] `lib/vaio/types.ts` — All types: VoiceQueryCategory, VoiceContentScore, VoiceContentIssue, VoiceIssueType, VoiceQuery, SpokenAnswerPreview, LlmsTxtContent, AICrawlerAuditResult, AICrawlerStatus, VoiceGap, VAIOProfile, VAIORRunResult, VOICE_SCORE_WEIGHTS
- [ ] `voice-query-library.ts` — 24 templates covering 4 categories, instantiateVoiceTemplate(), seedVoiceQueriesForLocation() with plan-tier limits (Starter: priority 1 only), getVoiceQueriesForLocation()
- [ ] `voice-content-scorer.ts` — 4 dimensions, countActionVerbs(), avgSentenceWords(), fleschKincaidGrade(), containsMarkdown(), containsRawUrls(), ACTION_VERBS list, issue detection
- [ ] `spoken-answer-previewer.ts` — cleanForVoice() with bullet→prose conversion, estimateSpokenSeconds(), generateSpokenPreview(), 250-word truncation, VOICE constants
- [ ] `llms-txt-generator.ts` — generateLlmsTxt(), buildStandardLlmsTxt() 300–500 words, buildFullLlmsTxt() 800–1200 words, formatHoursForVoice() with range compression, null-field omission
- [ ] `ai-crawler-auditor.ts` — auditAICrawlerAccess() with 8s timeout + never-throw, parseRobotsTxtForAgent() pure, KNOWN_AI_CRAWLERS (10 entries), generateRobotsTxtFix(), overall_health logic
- [ ] `voice-gap-detector.ts` — detectVoiceGaps() with 3-query threshold + 14-day run requirement, buildSuggestedAnswer() per category, createDraft() for action/discovery only, voice context in additionalContext
- [ ] `vaio-service.ts` — runVAIO() 11-step flow, computeVoiceReadinessScore() pure, runVAIOForAllLocations() sequential
- [ ] All 4 API routes + cron implemented
- [ ] `POST /api/vaio/preview`: no plan gate, rate-limited 20 req/min/org
- [ ] `vercel.json` updated with vaio cron (1st of month 6 AM UTC)
- [ ] `VAIOPanel.tsx` — score + grade + 4-dimension breakdown + crawler status table + voice query by category + gaps + llms.txt section + spoken preview tool + skeleton + plan gate
- [ ] `SpokenPreviewCard.tsx` — score, word count, spoken seconds, cleaned content, issues list
- [ ] `CrawlerFixModal.tsx` — dynamic robots.txt snippet for blocked/unspecified crawlers, copy button
- [ ] `app/dashboard/page.tsx` updated with VAIOPanel
- [ ] Migration: query_mode on sov_target_queries, vaio_profiles table, 2 location columns
- [ ] `prod_schema.sql` updated
- [ ] `database.types.ts` updated
- [ ] Seed: 8 voice queries (priority 1 templates) + vaio_profiles (score 48) + crawler audit
- [ ] `golden-tenant.ts`: 5 VAIO fixtures (MOCK_VOICE_QUERIES, MOCK_VOICE_CONTENT_SCORE, MOCK_SPOKEN_PREVIEW, MOCK_LLMS_TXT, MOCK_CRAWLER_AUDIT, MOCK_VAIO_PROFILE)
- [ ] `data-testid` on all interactive elements
- [ ] `npx vitest run src/__tests__/unit/voice-content-scorer.test.ts` — **24 tests passing**
- [ ] `npx vitest run src/__tests__/unit/spoken-answer-previewer.test.ts` — **20 tests passing**
- [ ] `npx vitest run src/__tests__/unit/voice-query-library.test.ts` — **12 tests passing**
- [ ] `npx vitest run src/__tests__/unit/llms-txt-generator.test.ts` — **19 tests passing**
- [ ] `npx vitest run src/__tests__/unit/ai-crawler-auditor.test.ts` — **17 tests passing**
- [ ] `npx vitest run src/__tests__/unit/voice-gap-detector.test.ts` — **13 tests passing**
- [ ] `npx vitest run src/__tests__/unit/vaio-routes.test.ts` — **13 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/vaio-panel.spec.ts` — **9 tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format

```markdown
## 2026-03-01 — Sprint 109: Voice Search & Conversational AI Optimization / VAIO (Completed)

**Goal:** Build the voice-optimized AI layer — measure and improve the business's ability to be
the single spoken answer when someone queries a voice assistant. Parallel query system,
spoken-answer content scoring, llms.txt generation, AI crawler access audit.

**Scope:**
- `lib/vaio/types.ts` — **NEW.** VoiceQueryCategory (4), VoiceContentScore, VoiceIssueType (8),
  SpokenAnswerPreview, LlmsTxtContent, AICrawlerAuditResult (10 crawlers), VoiceGap, VAIOProfile,
  VAIORRunResult, VOICE_SCORE_WEIGHTS (4 dimensions: llms_txt 25 + crawler 25 + citations 30 + content 20).
- `lib/vaio/voice-query-library.ts` — **NEW.** 24 VOICE_QUERY_TEMPLATES across 4 categories.
  instantiateVoiceTemplate(): replaces {businessName}/{category}/{city}. seedVoiceQueriesForLocation():
  plan-gated (Starter: priority 1 only), ON CONFLICT idempotent, query_mode='voice'.
- `lib/vaio/voice-content-scorer.ts` — **NEW.** 4 dimensions: Direct Answer (30pts), Local
  Specificity (25pts), Action Language (25pts), Spoken Length (20pts). ACTION_VERBS (19 terms).
  fleschKincaidGrade(): syllable approximation. Issue detection: 8 VoiceIssueType.
- `lib/vaio/spoken-answer-previewer.ts` — **NEW.** cleanForVoice(): strips **, #, bullets→prose,
  URLs→[link], HTML tags. estimateSpokenSeconds(): 150 WPM. generateSpokenPreview(): 250-word
  truncation cap. VOICE constants defined.
- `lib/vaio/llms-txt-generator.ts` — **NEW.** buildStandardLlmsTxt(): 300–500 words with
  Key Facts/Menu/Events/FAQ/Contact sections. buildFullLlmsTxt(): 800–1200 words + review keywords
  "What customers say" section. formatHoursForVoice(): consecutive-day range compression,
  closed-day handling, null-safe. Null-field omission throughout.
- `lib/vaio/ai-crawler-auditor.ts` — **NEW.** KNOWN_AI_CRAWLERS (10 entries, impact-ordered).
  auditAICrawlerAccess(): 8s timeout, never-throw. parseRobotsTxtForAgent(): wildcard + specific
  agent precedence. generateRobotsTxtFix(): exact snippet for blocked/unspecified crawlers.
- `lib/vaio/voice-gap-detector.ts` — **NEW.** detectVoiceGaps(): 3-query threshold, 14-day
  run requirement, grouped by category. buildSuggestedAnswer(): per-category Ground Truth facts.
  createDraft() for action/discovery only — not for information (fact queries).
- `lib/vaio/vaio-service.ts` — **NEW.** runVAIO(): 11-step flow. computeVoiceReadinessScore()
  pure. runVAIOForAllLocations() sequential 1s sleep.
- `app/api/vaio/` — **NEW.** 4 routes: run, status, llms-txt (GET+POST), preview (no plan gate).
- `app/api/cron/vaio/route.ts` — **NEW.** 1st of month 6AM UTC. CRON_SECRET.
- `vercel.json` — **MODIFIED.** vaio cron added.
- `app/dashboard/_components/VAIOPanel.tsx` — **NEW.** Score + grade + 4 dimensions + crawler
  status table + voice queries by category + gaps + llms.txt + Spoken Preview Tool (inline).
- `app/dashboard/_components/SpokenPreviewCard.tsx` — **NEW.** Score, WPM, seconds, cleaned text, issues.
- `app/dashboard/_components/CrawlerFixModal.tsx` — **NEW.** Dynamic robots.txt snippet, copy button.
- `app/dashboard/page.tsx` — **MODIFIED.** VAIOPanel added.
- Migration `[timestamp]_vaio.sql` — **NEW.** query_mode TEXT DEFAULT 'typed' on sov_target_queries.
  vaio_profiles table. voice_readiness_score + vaio_last_run_at on locations.
- `supabase/prod_schema.sql`, `database.types.ts` — **MODIFIED.**
- Seed: 8 voice queries (4 categories, priority 1 templates) + vaio_profiles (score 48,
  crawler_audit partial, 1 action gap) for golden tenant.
- `golden-tenant.ts`: MOCK_VOICE_QUERIES, MOCK_VOICE_CONTENT_SCORE, MOCK_SPOKEN_PREVIEW,
  MOCK_LLMS_TXT, MOCK_CRAWLER_AUDIT, MOCK_VAIO_PROFILE.

**Tests added:**
- `voice-content-scorer.test.ts` — **24 tests** (pure, zero mocks)
- `spoken-answer-previewer.test.ts` — **20 tests** (pure, zero mocks)
- `voice-query-library.test.ts` — **12 tests**
- `llms-txt-generator.test.ts` — **19 tests** (pure, zero mocks)
- `ai-crawler-auditor.test.ts` — **17 tests** (HTTP mocked)
- `voice-gap-detector.test.ts` — **13 tests** (Supabase mocked)
- `vaio-routes.test.ts` — **13 tests**
- `vaio-panel.spec.ts` — **9 Playwright tests**
- **Total: 109 Vitest + 9 Playwright — all passing, zero regressions**

**Key decisions:**
- NO Speakable schema — explicitly rejected. News publishers only. Deprecated. Not applicable.
- query_mode column on sov_target_queries: additive, default 'typed'. Zero change to cron behavior.
- llms.txt: generated, stored in vaio_profiles, copy-to-clipboard deployment. No auto-deploy (no write access to tenant websites).
- Spoken answer preview: text simulation only — no Web Speech API, no TTS audio. Browser TTS would require user permission and doesn't reflect AI voice assistant behavior.
- Voice gap triggers: action + discovery categories only. Information queries (hours/address/phone) answered from Ground Truth — no content needed.
- AI crawler auditor: fetch with 8s timeout. overall_health based only on HIGH-impact crawlers.
- formatHoursForVoice(): consecutive-day range compression ("Tue–Thu 5 PM–1 AM") rather than listing each day — how voice assistants actually speak hours.
- 150 WPM TTS standard: Google Assistant / Siri typical cadence. Used for spoken-seconds estimate.
```

---

## 🔮 AI_RULES Update (Add Rule 47)

```markdown
## 47. 🎙️ VAIO — Voice & Conversational AI Optimization in `lib/vaio/` (Sprint 109)

Voice query optimization lives in `lib/vaio/`. All voice query seeding, spoken content scoring,
llms.txt generation, and AI crawler auditing routes through this module.

* **SPEAKABLE SCHEMA: NEVER IMPLEMENT.** Speakable is restricted to news publishers enrolled
  in Google News Publisher Center. It does not work for LocalBusiness or restaurant content.
  It is deprecated as of early 2026. Do not reference it, suggest it, or implement it.
* **query_mode='voice' on sov_target_queries:** Voice queries are stored in the same table as
  typed queries with query_mode='voice'. Never modify the SOV cron to skip or specially treat
  these rows — the cron processes all is_active=true rows regardless of mode.
* **llms.txt: copy-to-clipboard only.** LocalVector stores the generated content in vaio_profiles.
  The owner deploys it to their website. Never attempt to write to tenant websites.
* **No audio generation.** Spoken answer preview is text simulation only.
* **Voice gap triggers: action + discovery categories only.** Information gaps (hours, address)
  are answered from Ground Truth — do not trigger content drafts for them.
* **Adding a new voice query category:** Add to VoiceQueryCategory type, add templates to
  VOICE_QUERY_TEMPLATES, add case to buildSuggestedAnswer(), add to VAIOPanel category display.
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| Ground Truth / NAP data | Sprint 105 | Business facts for llms.txt + suggested answers |
| page_schemas.json_ld | Sprint 106 | Page URLs for llms.txt link sections |
| reviews.keywords | Sprint 107 | Positive keywords for llms-full.txt "What customers say" |
| createDraft() | Sprint 86 | Autopilot draft for voice gap triggers |
| sov_target_queries | Sprint 83 | Table extended with query_mode column |
| Plan Enforcer | Sprint 3 | Growth+ gating + query limits |
| Cron patterns | Sprints 105–108 | vercel.json structure, CRON_SECRET |

---

## 🧠 Edge Cases

1. **Business has no website URL in Ground Truth:** `auditAICrawlerAccess()` returns `{ robots_txt_found: false, overall_health: 'unknown' }` immediately. Crawler score = 10pts (unknown baseline). Panel shows "No website detected — add your website URL in Settings to enable crawler audit."
2. **robots.txt uses wildcards only ("User-agent: *\nAllow: /"): All AI crawlers inherit the wildcard → all return 'not_specified' (not 'blocked'). overall_health = 'healthy' (no explicit blocks). Panel shows "All crawlers allowed via wildcard" rather than flagging as an issue.
3. **llms.txt regenerated but Ground Truth not changed:** The new generation produces identical content to the previous one. This is fine — update `llms_txt_generated_at` and reset status to 'generated'. The idempotent behavior is intentional.
4. **Voice query citation_rate is null (never run):** `avgVoiceCitationRate` = 0 when null rates are coalesced. Panel shows "Voice queries seeded — data available after next SOV run."
5. **Business hours span midnight (e.g. 9 PM–2 AM):** `formatHoursForVoice()` handles cross-midnight by keeping the times as-is. Output: "Friday–Saturday 5 PM–2 AM" (AM is correct for next-day close). Never say "14:00" — always 12-hour format with AM/PM.
6. **Location has no review keywords (Sprint 107 not run):** `topReviewKeywords = []`. `buildFullLlmsTxt()` omits the "What customers say" section entirely. Never fabricates keywords.
7. **Voice gap detector called but no voice queries seeded yet:** Returns empty VoiceGap[] immediately. The gap detection requires `last_run_at IS NOT NULL` — if queries were just seeded but never run, there's no citation data to analyze.
8. **More than 20 preview requests/minute from one org:** Rate limiter returns 429 with "rate_limit_exceeded". Client shows "Too many preview requests — try again in a minute." Simple in-memory counter reset every 60 seconds.
9. **llms.txt standard exceeds 500 words:** This happens if the business has many amenities or a very long description. Truncate the amenities list to 5 items and use the first two sentences of the description. Log a warning in `generation_notes`.
10. **Spoken preview tool receives content with tables (HTML \<table\> tags):** `cleanForVoice()` strips HTML tags. The table content is lost. This is intentional — tables are fundamentally unspoken. The issue `contains_markdown` (or a new `contains_tables`) is surfaced to the user.

---

## 📚 Document Sync + Git Commit

### Step 1: Update `/docs`

**`docs/roadmap.md`** — Sprint 109 ✅ 100%.

**`docs/09-BUILD-PLAN.md`** — Sprint 109 checked off.

**`docs/CLAUDE.md`** — Add to Implementation Inventory: `lib/vaio/` + 4 API routes + VAIO cron + VAIO fixtures.

### Step 2–5: DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES Rule 47

### Step 6: Git Commit

```bash
git add -A
git commit -m "Sprint 109: Voice Search & Conversational AI Optimization (VAIO)

- lib/vaio/: voice query library (24 templates, 4 categories), content scorer
  (4 dimensions, 8 issue types), spoken answer previewer (150 WPM simulation),
  llms.txt generator (standard 300–500w, full 800–1200w), AI crawler auditor
  (10 crawlers, robots.txt parse), voice gap detector (action/discovery triggers)
- query_mode TEXT DEFAULT 'typed' added to sov_target_queries (additive, zero behavior change)
- app/api/vaio/: run, status, llms-txt (GET+POST), preview (no plan gate)
- cron: vaio 1st of month 6AM UTC
- VAIOPanel: score + grade + 4 dimensions + crawler status + voice queries by category +
  gaps + llms.txt section + inline spoken preview tool
- SpokenPreviewCard, CrawlerFixModal components
- migration: vaio_profiles table, query_mode column, 2 location columns
- seed: 8 voice queries + vaio_profiles (score 48, 1 action gap)
- tests: 109 Vitest passing + 9 Playwright passing — zero regressions
- docs: roadmap, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES Rule 47

NO Speakable schema (news publishers only, deprecated). No audio generation.
Voice gaps trigger Autopilot for action/discovery only. llms.txt copy-only.
Unblocks Sprint 110 (AI Answer Simulation Sandbox)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 109, LocalVector has a fully operational voice optimization layer — the only feature of its kind in the local business AEO/GEO market.

A business owner opens their dashboard and for the first time sees: their voice readiness score is 48/100 because GPTBot isn't explicitly allowed (easily fixed in 2 minutes), their action queries are getting zero citations, and their llms.txt is ready to copy to their website. They paste the robots.txt fix. They copy and deploy llms.txt. They paste a GBP post into the Spoken Preview tool and discover it has markdown asterisks that would be read aloud as "asterisk asterisk premium hookah asterisk asterisk" — they fix it in 60 seconds.

Three interactions. Fifteen minutes. Their voice readiness score jumps from 48 to 73.

That measurable, visible improvement — with a concrete score and immediate actions — is what Sprint 109 delivers.

- **Voice & Conversational AI Optimization: 0% → 100%**
- 109 Vitest + 9 Playwright tests
- **1 sprint remains: Sprint 110 (AI Answer Simulation Sandbox) — the capstone**
