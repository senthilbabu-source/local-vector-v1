# Sprint 110 — AI Answer Simulation Sandbox (Capstone)

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Build the **AI Answer Simulation Sandbox** — LocalVector's capstone feature. The sandbox answers the question every business owner asks before hitting publish:

> *"If I publish this content today, what will AI say about my business tomorrow?"*

### The Problem

Every other LocalVector feature is retrospective: SOV tracks what AI said last week. The Fear Engine flags what AI is saying right now. Authority Mapping measures trust over time. The Sandbox is the only **prospective** tool — it tests content *before* it goes live, like a pre-flight checklist for the AI search era.

When a user writes a new FAQ answer, a GBP post, or an llms.txt page, they currently have no way to verify:
- Will AI extract the correct business facts from this content?
- Which queries will this content help me win — and which will it miss?
- Does this content introduce hallucination risk by leaving gaps AI will fill with guesses?
- Am I saying something that contradicts my Ground Truth (which will confuse AI engines)?

The Sandbox closes this loop.

### How the Simulation Works (Technically Honest)

**Critical architectural reality:** ChatGPT, Gemini, and other LLMs train on historical data with cutoffs. Publishing new content today does NOT affect what those models say tomorrow — training is a months-long process. Any product claiming to "simulate ChatGPT's future response" is misrepresenting how LLMs work.

**What LocalVector's Sandbox actually does — and why it's more useful:**

The Sandbox uses Claude API (the same model powering LocalVector's intelligence layer) to act as a *neutral AI reader* that answers this question: **"Given only this content, what would a knowledgeable AI conclude about this business?"** This is precisely what matters — because Perplexity, ChatGPT Browsing, and Google AI Overviews all read actual web content at query time. The question is whether your content communicates clearly enough to produce accurate AI answers.

Three simulation modes:

1. **Content Ingestion Test** — "Can an AI extract the correct facts from this content?"
   Uses Claude API with the user's draft content and asks it to extract NAP, hours, amenities, category. Compares against Ground Truth to flag discrepancies and gaps.

2. **Query Response Simulation** — "Given this content, how would an AI answer our tracked queries?"
   Feeds the draft content + business context to Claude API and runs the user's top SOV/voice query set against it. Returns simulated AI answers per query, scored for accuracy and completeness.

3. **Hallucination Gap Analysis** — "Where will AI make things up because you didn't say it?"
   Identifies queries where the content provides NO answer — meaning an AI querying about this business will either hallucinate or return a blank. These are the content gaps that most urgently need addressing.

**What we do NOT claim:**
- We do NOT claim to predict what ChatGPT/Gemini will say (we don't control their training)
- We do NOT pretend to have real-time access to live AI model states
- We clearly label simulations as "simulated" using Claude API as the inference engine

**Why Claude API is the right choice:**
Claude is an honest proxy for AI reading comprehension. If Claude can correctly extract hours from your content, Perplexity likely can too. If Claude hallucinates your address, something is structurally wrong with how the content presents that fact. The simulation is a content quality gate, not a crystal ball.

### Sprint 110 as Capstone

This sprint closes the LocalVector product loop. The full chain is now:

```
Ground Truth (105) → Schema (106) → Reviews (107) → Authority (108) → Voice (109)
                                                                              ↓
Fear Engine ← SOV ← Autopilot ← Content Briefs ← [Sandbox: test before publish] ←→ Ground Truth
```

Every previous sprint feeds the Sandbox:
- **Sprint 105 (Ground Truth):** Baseline for all hallucination detection
- **Sprint 106 (Schema):** Published page_schemas as content source for ingestion test
- **Sprint 107 (Reviews):** Review keywords as voice signal training set
- **Sprint 108 (Authority):** Authority score as context signal for query weighting
- **Sprint 109 (VAIO):** Voice queries run as a query simulation set
- **Sprint 86 (Autopilot):** Content drafts are the primary input for the Sandbox
- **Sprint 83 (SOV):** sov_target_queries are the typed simulation queries

**What this sprint builds:**
1. **Content Ingestion Analyzer** — Extracts facts from submitted content using Claude API, diffs against Ground Truth
2. **Query Simulation Engine** — Runs SOV + voice queries against content using Claude API, returns per-query AI answers
3. **Hallucination Gap Scorer** — Identifies queries with zero content coverage → high hallucination risk
4. **Ground Truth Diffuser** — Compares any simulated AI answer against canonical Ground Truth facts
5. **Simulation Orchestrator** — Coordinates all three simulation modes, stores results
6. **Sandbox Dashboard Panel** — The interactive "pre-flight cockpit" UI where users paste/select content and run simulations
7. **Simulation History** — Per-location history of all sandbox runs with score trends
8. **Reality Score Integration** — Sandbox scores contribute to the Reality Score DataHealth dimension

**What this sprint does NOT build:**
- Real queries to live ChatGPT, Gemini, or Perplexity APIs using new/draft content (technically impossible — they can't preview future training)
- Audio playback of simulated answers (text-only)
- Scheduled/automated sandbox runs (user-initiated only — simulations cost API tokens)
- A/B content testing with live traffic

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                            — All rules (47+ after Sprint 109)
Read CLAUDE.md                                                   — Complete implementation inventory
Read MEMORY.md                                                   — Architectural decisions
Read supabase/prod_schema.sql
  § FIND: sov_target_queries — query_text, query_category, query_mode, citation_rate
  § FIND: ground_truth — ALL columns (the canonical NAP facts)
  § FIND: page_schemas — json_ld column, page_type, location_id
  § FIND: reviews — keywords (positive/negative signals)
  § FIND: content_drafts — draft_content, status, trigger_type (Sprint 86)
  § FIND: entity_authority_profiles — entity_authority_score (Sprint 108)
  § FIND: vaio_profiles — voice_readiness_score, llms_txt_standard (Sprint 109)
Read lib/supabase/database.types.ts                              — TypeScript DB types
Read src/__fixtures__/golden-tenant.ts                           — Golden Tenant (org_id: a0eebc99)
Read lib/nap-sync/types.ts                                       — GroundTruth type (all fields)
Read lib/plan-enforcer.ts                                        — Plan gating
Read lib/supabase/server.ts                                      — createServiceRoleClient()
Read app/dashboard/page.tsx                                      — Insert SandboxPanel
Read vercel.json                                                 — Existing crons (no new cron this sprint)
```

**Specifically understand before writing code:**
- The `ground_truth` table: every field name and type. The Sandbox diffs simulated answers against this table — you need to know every canonical fact field (name, phone, address, city, state, zip, website, hours JSON, category, description, amenities array).
- The `content_drafts` table from Sprint 86: `draft_content` is the primary text field. `status` values: 'draft' | 'approved' | 'published'. The Sandbox can test any draft, approved, or published draft, or accept freeform text input.
- The `sov_target_queries` table: `query_mode IN ('typed','voice')`. The Sandbox uses BOTH typed and voice queries as its simulation query set. Limit to `is_active = true` only.
- The Claude API call pattern from `anthropic_api_in_artifacts`: uses fetch to `https://api.anthropic.com/v1/messages` — but in server-side code, uses the `@anthropic-ai/sdk` package. The Sandbox server routes use the SDK, not raw fetch.
- The Reality Score: defined in an existing component. The Sandbox adds one new DataHealth dimension. Do NOT rewrite the Reality Score — add the new dimension cleanly.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/sandbox/
  index.ts                                     — barrel export
  types.ts                                     — all shared types
  content-ingestion-analyzer.ts               — extract facts from content, diff vs Ground Truth
  query-simulation-engine.ts                  — run queries against content via Claude API
  hallucination-gap-scorer.ts                 — identify content gaps → hallucination risk
  ground-truth-diffuser.ts                    — compare any text against Ground Truth facts
  simulation-orchestrator.ts                  — coordinate all three modes, persist results
```

---

### Component 1: Shared Types — `lib/sandbox/types.ts`

```typescript
/**
 * The three simulation modes available in the Sandbox.
 */
export type SimulationMode =
  | 'ingestion'    // Can AI extract the correct facts from this content?
  | 'query'        // How would AI answer our tracked queries given this content?
  | 'gap_analysis'; // Where will AI hallucinate because content doesn't answer the question?

/**
 * The input to a simulation run.
 */
export interface SimulationInput {
  location_id: string;
  org_id: string;
  content_text: string;          // The content being tested (paste or from draft)
  content_source: ContentSource; // Where the content came from
  draft_id?: string;             // If from content_drafts, the draft ID
  modes: SimulationMode[];       // Which modes to run (default: all three)
}

export type ContentSource =
  | 'freeform'      // User pasted content manually
  | 'draft'         // Content from a content_drafts row
  | 'llms_txt'      // The location's generated llms.txt (from vaio_profiles)
  | 'published_faq' // Published FAQ page content (from page_schemas json_ld)
  | 'published_homepage'; // Published homepage content

/**
 * The full result of a simulation run.
 */
export interface SimulationRun {
  id: string;
  location_id: string;
  org_id: string;
  content_source: ContentSource;
  draft_id: string | null;
  content_text: string;              // Stored for reference (truncated at 5000 chars if needed)
  content_word_count: number;
  modes_run: SimulationMode[];

  // Results per mode
  ingestion_result: IngestionResult | null;
  query_results: QuerySimulationResult[];
  gap_analysis: GapAnalysisResult | null;

  // Summary scores
  simulation_score: number;          // 0–100 composite score
  ingestion_accuracy: number;        // 0–100: how accurately AI extracted facts
  query_coverage_rate: number;       // 0.0–1.0: fraction of queries that got useful answers
  hallucination_risk: HallucinationRisk;

  run_at: string;
  claude_model: string;              // e.g. "claude-sonnet-4-6" — logged for reproducibility
  input_tokens_used: number;
  output_tokens_used: number;
  status: 'completed' | 'partial' | 'failed';
  errors: string[];
}

/**
 * Result of the Content Ingestion Test.
 * Did AI correctly extract the key facts from this content?
 */
export interface IngestionResult {
  extracted_facts: ExtractedFact[];
  accuracy_score: number;           // 0–100
  facts_correct: number;
  facts_incorrect: number;
  facts_missing: number;            // Facts in Ground Truth but not extractable from content
  critical_errors: IngestionError[]; // Name/address/phone/hours wrong = critical
  warnings: IngestionError[];       // Missing non-critical facts
}

/**
 * A single fact extracted by the AI from the content.
 */
export interface ExtractedFact {
  field: GroundTruthField;
  extracted_value: string;          // What AI extracted from the content
  ground_truth_value: string;       // What Ground Truth says it should be
  match_status: 'exact' | 'partial' | 'wrong' | 'missing';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * The Ground Truth fields we extract and compare.
 * Ordered by criticality (most critical first).
 */
export type GroundTruthField =
  | 'name'          // Business name
  | 'phone'         // Primary phone
  | 'address'       // Street address
  | 'city'
  | 'state'
  | 'zip'
  | 'website'
  | 'category'      // Primary category (e.g. "hookah lounge")
  | 'hours'         // Operating hours (formatted string)
  | 'description'   // One-line description
  | 'amenities';    // Top 5 amenities/features

/**
 * An ingestion error or warning.
 */
export interface IngestionError {
  field: GroundTruthField;
  severity: 'critical' | 'warning';
  extracted: string;
  expected: string;
  message: string;
}

/**
 * Result of simulating a single SOV or voice query against the content.
 */
export interface QuerySimulationResult {
  query_id: string;              // sov_target_queries.id
  query_text: string;
  query_category: string;        // e.g. 'discovery', 'information'
  query_mode: 'typed' | 'voice';
  simulated_answer: string;      // The AI's simulated answer given the content
  answer_quality: AnswerQuality;
  cites_business: boolean;       // Does the answer reference the business by name?
  facts_present: GroundTruthField[]; // Which Ground Truth facts appear in the answer
  facts_hallucinated: string[];  // Statements not supported by content OR Ground Truth
  word_count: number;
  ground_truth_alignment: number; // 0–100: how aligned the answer is with Ground Truth
}

/**
 * How well the simulated answer responds to the query.
 */
export type AnswerQuality =
  | 'complete'    // Fully answers the query with accurate information
  | 'partial'     // Partially answers but has gaps
  | 'wrong'       // Answers but with incorrect facts
  | 'no_answer';  // Content provides no basis for answering this query

/**
 * Full gap analysis result.
 */
export interface GapAnalysisResult {
  total_queries_tested: number;
  queries_with_no_answer: number;
  queries_with_partial_answer: number;
  queries_with_complete_answer: number;
  gap_clusters: GapCluster[];        // Grouped by query_category
  highest_risk_queries: string[];    // Up to 5 query_texts with highest hallucination risk
  recommended_additions: ContentAddition[]; // What to add to the content to close gaps
}

/**
 * A cluster of queries in the same category that have content gaps.
 */
export interface GapCluster {
  category: string;
  total_queries: number;
  answered_queries: number;
  unanswered_queries: number;
  gap_severity: 'critical' | 'high' | 'medium' | 'low';
  example_unanswered: string;  // One example query that got no answer
}

/**
 * A specific piece of information to add to close a content gap.
 */
export interface ContentAddition {
  priority: 1 | 2 | 3;
  field: GroundTruthField | 'general';
  suggestion: string;               // e.g. "Add your Friday closing time (currently 2 AM)"
  closes_queries: string[];         // Query texts this addition would close
}

/**
 * Overall hallucination risk level.
 */
export type HallucinationRisk =
  | 'low'       // < 20% of queries have no content basis
  | 'medium'    // 20–40% of queries have no content basis
  | 'high'      // 40–60% of queries have no content basis
  | 'critical'; // > 60% of queries have no content basis

/**
 * Simulation history entry (lightweight, for history list).
 */
export interface SimulationHistoryEntry {
  id: string;
  content_source: ContentSource;
  draft_id: string | null;
  simulation_score: number;
  hallucination_risk: HallucinationRisk;
  query_coverage_rate: number;
  run_at: string;
}

/**
 * The Claude API prompt types used in the Sandbox.
 * These are the system + user prompt templates — defined here for testability.
 */
export type SandboxPromptType =
  | 'fact_extraction'    // Ingestion test: extract Ground Truth fields from content
  | 'query_simulation'   // Query mode: answer a query given content
  | 'gap_detection';     // Gap mode: identify what queries the content cannot answer

/**
 * Cost guard constants.
 * The Sandbox is user-initiated and costs tokens.
 * These limits prevent runaway costs.
 */
export const SANDBOX_LIMITS = {
  MAX_CONTENT_WORDS: 1500,           // Truncate content above this length before sending to API
  MAX_QUERIES_PER_RUN: 10,           // Max queries to simulate per sandbox run
  MAX_RUNS_PER_DAY_PER_ORG: 20,     // Rate limit: 20 runs/day/org across all locations
  MAX_CONTENT_CHARS_STORED: 5000,    // Truncate stored content in simulation_runs table
  CLAUDE_MODEL: 'claude-sonnet-4-6', // The model used for all sandbox simulations
} as const;
```

---

### Component 2: Content Ingestion Analyzer — `lib/sandbox/content-ingestion-analyzer.ts`

```typescript
/**
 * Tests whether an AI can correctly extract key business facts from submitted content.
 *
 * ── HOW IT WORKS ──────────────────────────────────────────────────────────────
 *
 * Step 1: Build the extraction prompt
 *   System: "You are a fact extraction engine. Given a business's content, extract
 *            specific business facts. Respond ONLY with a JSON object. Never invent
 *            facts not present in the content. If a fact is not present, return null
 *            for that field."
 *   User: {content_text}
 *   Request: extract { name, phone, address, city, state, category, hours_summary,
 *                      description, top_amenities_list }
 *
 * Step 2: Call Claude API (claude-sonnet-4-6)
 *   max_tokens: 500 (extraction is short)
 *   temperature: 0 (deterministic extraction)
 *
 * Step 3: Parse extracted JSON
 *   Wrap in try/catch — if JSON parsing fails, return empty extraction + error
 *
 * Step 4: Diff extracted values against Ground Truth
 *   For each GroundTruthField:
 *   - Compare normalized values (lowercase, trim whitespace)
 *   - 'exact': values match after normalization
 *   - 'partial': extracted contains the truth value or vice versa (substring match)
 *   - 'wrong': both present but different
 *   - 'missing': field in Ground Truth but AI returned null
 *
 * Step 5: Compute accuracy_score
 *   Each field has a weight. Weights:
 *   name=20, phone=15, address=15, city=10, category=10,
 *   hours=15, website=5, zip=5, description=5
 *   Total possible = 100
 *   Score = Σ(field_weight × match_points)
 *   match_points: exact=1.0, partial=0.5, wrong=0, missing=0
 *
 * Critical fields: name, phone, address, city, hours
 * Any 'wrong' result on a critical field → IngestionError with severity 'critical'
 * Any 'missing' or 'wrong' on non-critical → severity 'warning'
 *
 * ── EDGE CASES ────────────────────────────────────────────────────────────────
 * - Content too short (< 20 words): return { accuracy_score: 0, facts_missing: all }
 *   without calling the API. This avoids burning tokens on content that has nothing.
 * - API error: return partial result with errors array populated
 * - Claude returns "N/A" or "not found": treat as null (missing)
 * - Phone number format variations: normalize to digits-only before comparing
 *   e.g. "(470) 546-4866" and "4705464866" are both compared as "4705464866"
 */

export async function analyzeContentIngestion(
  contentText: string,
  groundTruth: GroundTruth,
  anthropicClient: Anthropic,
): Promise<{ result: IngestionResult; tokensUsed: { input: number; output: number } }> { ... }

/**
 * Builds the fact extraction system prompt.
 * Pure function — fully deterministic.
 */
export function buildExtractionSystemPrompt(): string { ... }

/**
 * Builds the fact extraction user prompt.
 * Pure function.
 */
export function buildExtractionUserPrompt(contentText: string): string { ... }

/**
 * Compares an extracted fact value against the Ground Truth value.
 * Pure function — no API calls.
 */
export function compareFactValue(
  extracted: string | null,
  groundTruth: string | null,
  field: GroundTruthField,
): 'exact' | 'partial' | 'wrong' | 'missing' { ... }

/**
 * Normalizes a string for comparison:
 * - Trim whitespace
 * - Lowercase
 * - Remove punctuation for address/phone fields
 * Pure function.
 */
export function normalizeForComparison(value: string, field: GroundTruthField): string { ... }

/**
 * Field weights for accuracy score computation.
 * Sums to 100.
 */
export const FIELD_WEIGHTS: Record<GroundTruthField, number> = {
  name: 20,
  phone: 15,
  address: 15,
  city: 10,
  category: 10,
  hours: 15,
  website: 5,
  state: 5,
  zip: 0,         // Low weight — zip often omitted in content
  description: 5,
  amenities: 0,   // Not individually weighted — extracted as a group
};

export const CRITICAL_FIELDS: GroundTruthField[] = ['name', 'phone', 'address', 'city', 'hours'];
```

---

### Component 3: Query Simulation Engine — `lib/sandbox/query-simulation-engine.ts`

```typescript
/**
 * Simulates how an AI would answer a set of queries given the submitted content.
 *
 * ── HOW IT WORKS ──────────────────────────────────────────────────────────────
 *
 * For each query (up to SANDBOX_LIMITS.MAX_QUERIES_PER_RUN):
 *
 * System prompt:
 *   "You are an AI assistant answering a user's question about a local business.
 *    You have access ONLY to the business information provided below. Do not use
 *    any knowledge you may have about this business from other sources — use ONLY
 *    what is in the content. If the content does not provide enough information
 *    to answer the question, say so clearly. Do not fabricate business facts."
 *
 * User prompt:
 *   "Business information: {content_text}\n\nUser question: {query_text}"
 *
 * max_tokens: 250 per query (voice-friendly length)
 * temperature: 0.3 (slight variation to simulate real AI behavior)
 *
 * After getting the simulated answer, evaluate it:
 * 1. cites_business: does the answer mention the business name?
 * 2. facts_present: which GroundTruthField values appear verbatim in the answer?
 * 3. facts_hallucinated: scan for numerical/temporal facts not in content or GT
 * 4. ground_truth_alignment: % of statements checkable against Ground Truth that are correct
 * 5. answer_quality: 'complete'|'partial'|'wrong'|'no_answer'
 *    - 'no_answer': answer contains "I don't have" or "not provided" or "I cannot"
 *    - 'wrong': contains facts that contradict Ground Truth
 *    - 'complete': cites_business=true + ≥2 Ground Truth facts present
 *    - 'partial': everything else
 *
 * ── QUERY SELECTION ───────────────────────────────────────────────────────────
 * selectQueriesForSimulation():
 * Fetches from sov_target_queries for the location.
 * Priority:
 *   1. 5 lowest citation_rate typed queries (most at-risk)
 *   2. 3 lowest citation_rate voice queries
 *   3. 2 highest citation_rate queries (baseline — what's working)
 * Max total: 10 queries (SANDBOX_LIMITS.MAX_QUERIES_PER_RUN)
 * If < 10 queries exist, run all.
 *
 * ── HALLUCINATION DETECTION ───────────────────────────────────────────────────
 * detectHallucinatedFacts():
 * Look for specific data types not grounded in content or Ground Truth:
 * - Phone numbers (format: digits groups, parentheses, dashes)
 * - Prices and dollar amounts
 * - Specific dates or years
 * - Specific times NOT matching Ground Truth hours
 * - Star ratings or scores with specific numbers
 * These patterns in the answer that don't match content or GT = hallucinated.
 *
 * ── COST CONTROL ──────────────────────────────────────────────────────────────
 * Truncate content_text to SANDBOX_LIMITS.MAX_CONTENT_WORDS before including in prompt.
 * All queries run in sequence (not parallel) to avoid rate limit burst.
 * 200ms sleep between Claude API calls.
 *
 * Pure evaluation functions are testable without API calls.
 * Claude API call is isolated in simulateSingleQuery() for easy mocking.
 */

export async function simulateQueriesAgainstContent(
  contentText: string,
  queries: VoiceQuery[] | SovQuery[],
  groundTruth: GroundTruth,
  anthropicClient: Anthropic,
): Promise<{ results: QuerySimulationResult[]; tokensUsed: { input: number; output: number } }> { ... }

/**
 * Selects the optimal query set for simulation.
 * Pure after DB fetch.
 */
export async function selectQueriesForSimulation(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
): Promise<Array<{ id: string; query_text: string; query_category: string; query_mode: 'typed' | 'voice'; citation_rate: number | null }>> { ... }

/**
 * Builds the query simulation system prompt.
 * Pure function.
 */
export function buildQuerySimSystemPrompt(): string { ... }

/**
 * Builds the query simulation user prompt.
 * Pure function.
 */
export function buildQuerySimUserPrompt(contentText: string, queryText: string): string { ... }

/**
 * Evaluates a simulated answer for quality and accuracy.
 * Pure function — no API calls.
 */
export function evaluateSimulatedAnswer(
  simulatedAnswer: string,
  queryText: string,
  groundTruth: GroundTruth,
  contentText: string,
): Pick<QuerySimulationResult, 'answer_quality' | 'cites_business' | 'facts_present' | 'facts_hallucinated' | 'ground_truth_alignment' | 'word_count'> { ... }

/**
 * Detects hallucinated numeric/temporal facts in a simulated answer.
 * Pure function.
 */
export function detectHallucinatedFacts(
  simulatedAnswer: string,
  groundTruth: GroundTruth,
  contentText: string,
): string[] { ... }

/**
 * Checks which Ground Truth fields are verifiably present in the simulated answer.
 * Pure function.
 */
export function checkFactsPresent(
  simulatedAnswer: string,
  groundTruth: GroundTruth,
): GroundTruthField[] { ... }
```

---

### Component 4: Ground Truth Diffuser — `lib/sandbox/ground-truth-diffuser.ts`

```typescript
/**
 * Compares any text (content OR simulated answer) against Ground Truth.
 *
 * This is the core accuracy engine shared by both ingestion and query simulation.
 * Pure functions only — no API calls, no DB calls.
 *
 * PRIMARY USE: After a query simulation, check each simulated answer for
 * Ground Truth alignment. Every factual claim in the answer is compared
 * against what Ground Truth says it should be.
 *
 * SECONDARY USE: In ingestion test — compare extracted facts against GT fields.
 *
 * ── DIFF LOGIC ────────────────────────────────────────────────────────────────
 *
 * diffTextAgainstGroundTruth(text, groundTruth):
 *   Returns: { alignment_score: 0–100, discrepancies: Discrepancy[], supportedFacts: string[] }
 *
 *   For each Ground Truth field:
 *   1. Check if the field value is mentioned in text
 *   2. Check if any contradicting value is mentioned
 *   3. Record as: 'supported' | 'contradicted' | 'not_mentioned'
 *
 *   alignment_score:
 *   = (supported_count × 2 + not_mentioned_count × 1) /
 *     (total_ground_truth_facts × 2) × 100
 *   Reasoning: 'contradicted' facts score 0 (penalized); 'not_mentioned' scores
 *   partial credit (absence of a fact isn't wrong, just incomplete).
 *
 * ── CRITICAL CONSTRAINT ───────────────────────────────────────────────────────
 * DO NOT call Claude API in this module.
 * All comparison logic is deterministic string matching + normalization.
 * This makes the diffuser fully testable without any mocking.
 *
 * For phone: normalize to digits before comparing
 * For address: compare normalized lowercase
 * For hours: parse to { day, open, close } tuples, compare tuple by tuple
 * For amenities: set intersection — what % of GT amenities appear in text
 */

export interface Discrepancy {
  field: GroundTruthField;
  ground_truth_value: string;
  text_value: string;             // What the text says (the wrong/contradicting value)
  severity: 'critical' | 'warning';
}

export interface DiffResult {
  alignment_score: number;        // 0–100
  discrepancies: Discrepancy[];
  supported_facts: GroundTruthField[];
  not_mentioned_facts: GroundTruthField[];
  contradicted_facts: GroundTruthField[];
}

export function diffTextAgainstGroundTruth(
  text: string,
  groundTruth: GroundTruth,
): DiffResult { ... }

/**
 * Checks if a Ground Truth value appears in text.
 * Handles normalization differences.
 * Pure function.
 */
export function groundTruthValuePresentInText(
  groundTruthValue: string,
  text: string,
  field: GroundTruthField,
): boolean { ... }

/**
 * Checks if text contains a value that CONTRADICTS the Ground Truth value.
 * E.g. GT phone = (470) 546-4866, text says (404) 999-0000.
 * Extracts phone-like patterns from text and compares against GT.
 * Pure function.
 */
export function findContradictingValue(
  groundTruthValue: string,
  text: string,
  field: GroundTruthField,
): string | null { ... }

/**
 * Normalizes a phone number to digits only.
 * Pure function.
 * "(470) 546-4866" → "4705464866"
 */
export function normalizePhone(phone: string): string { ... }

/**
 * Extracts phone-like patterns from text.
 * Returns all found phone numbers (normalized to digits).
 * Pure function.
 */
export function extractPhonePatterns(text: string): string[] { ... }
```

---

### Component 5: Hallucination Gap Scorer — `lib/sandbox/hallucination-gap-scorer.ts`

```typescript
/**
 * Analyzes query simulation results to score overall hallucination risk
 * and identify specific content gaps.
 *
 * Pure function module — takes simulation results as input, returns analysis.
 * No API calls, no DB calls.
 *
 * ── GAP SCORING ───────────────────────────────────────────────────────────────
 *
 * computeHallucinationRisk(queryResults):
 *   no_answer_rate = count(answer_quality === 'no_answer') / total_queries
 *   'low':      no_answer_rate < 0.20
 *   'medium':   0.20 ≤ no_answer_rate < 0.40
 *   'high':     0.40 ≤ no_answer_rate < 0.60
 *   'critical': no_answer_rate ≥ 0.60
 *   Note: 'wrong' answers are separately flagged as ingestion errors, not counted here
 *
 * buildGapClusters(queryResults):
 *   Groups by query_category
 *   For each cluster:
 *   - gap_severity based on unanswered_rate:
 *     > 0.75 = 'critical', 0.5–0.75 = 'high', 0.25–0.5 = 'medium', else 'low'
 *   Returns sorted by gap_severity DESC
 *
 * generateContentAdditions(queryResults, groundTruth):
 *   For each 'no_answer' query: map to a ContentAddition suggestion
 *   Common patterns:
 *   - 'information' queries with no hours answer → ContentAddition for hours
 *   - 'action' queries with no reservation info → ContentAddition for booking method
 *   - 'discovery' queries with no category/amenities → ContentAddition for category statement
 *   Deduplicates by field (one suggestion per field max)
 *   Returns sorted by priority
 *
 * computeSimulationScore(ingestionResult, queryResults, hallucinationRisk):
 *   Composite 0–100 score:
 *   - Ingestion accuracy: 40% weight (max 40 pts = ingestion_accuracy × 0.40)
 *   - Query coverage: 40% weight (max 40 pts = query_coverage_rate × 40)
 *   - Hallucination risk penalty: 20% weight
 *     risk='low': 20 pts, 'medium': 12 pts, 'high': 6 pts, 'critical': 0 pts
 *   Total = ingestion_pts + coverage_pts + risk_pts
 *
 * ── HIGHEST RISK QUERIES ──────────────────────────────────────────────────────
 * findHighestRiskQueries(queryResults):
 *   Priority: answer_quality='wrong' first (worst), then 'no_answer'
 *   Among 'no_answer': those with high citation_rate (queries that SHOULD be answered)
 *   Return up to 5 query_text strings
 */

export function computeHallucinationRisk(queryResults: QuerySimulationResult[]): HallucinationRisk { ... }

export function buildGapClusters(queryResults: QuerySimulationResult[]): GapCluster[] { ... }

export function generateContentAdditions(
  queryResults: QuerySimulationResult[],
  groundTruth: GroundTruth,
): ContentAddition[] { ... }

export function computeSimulationScore(
  ingestionAccuracy: number,
  queryCoverageRate: number,
  hallucinationRisk: HallucinationRisk,
): number { ... }

export function findHighestRiskQueries(
  queryResults: QuerySimulationResult[],
): string[] { ... }

/**
 * Maps a unanswered query to a ContentAddition suggestion.
 * Pure function.
 */
export function mapQueryToContentSuggestion(
  query: QuerySimulationResult,
  groundTruth: GroundTruth,
): ContentAddition | null { ... }
```

---

### Component 6: Simulation Orchestrator — `lib/sandbox/simulation-orchestrator.ts`

```typescript
/**
 * Coordinates a full sandbox simulation run.
 *
 * ── FLOW ──────────────────────────────────────────────────────────────────────
 * 1. Validate input (content not empty, location exists, org has Growth+ plan)
 * 2. Check daily rate limit: MAX_RUNS_PER_DAY_PER_ORG
 *    Count simulation_runs for this org WHERE run_at > NOW() - INTERVAL '24 hours'
 *    If count ≥ 20: return error 'rate_limit_exceeded'
 * 3. Fetch Ground Truth for location
 * 4. Truncate contentText to MAX_CONTENT_WORDS (count words, not chars)
 * 5. Select queries for simulation: selectQueriesForSimulation()
 * 6. Initialize Anthropic client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
 * 7. Run modes in parallel (using Promise.all — they're independent):
 *    - If 'ingestion' in modes: analyzeContentIngestion()
 *    - If 'query' in modes: simulateQueriesAgainstContent()
 *    - Gap analysis is computed from query results — not an API call
 * 8. Build GapAnalysisResult from query results:
 *    computeHallucinationRisk(), buildGapClusters(), generateContentAdditions()
 * 9. Compute simulation_score from ingestion + query results
 * 10. Build SimulationRun record
 * 11. Save to simulation_runs table (UPSERT — no duplicates)
 * 12. Update locations.simulation_last_run_at and locations.last_simulation_score
 * 13. Return complete SimulationRun
 *
 * Note: Ingestion + Query API calls run in parallel (Promise.all) to minimize
 * latency. They're independent — each gets its own copy of contentText.
 * Typical run time: 8–15 seconds for all three modes.
 *
 * Uses createServiceRoleClient() for all DB operations.
 * Never throws — catches all errors and returns partial results.
 *
 * ── ANTHROPIC CLIENT INIT ─────────────────────────────────────────────────────
 * DO NOT import Anthropic at module level.
 * Import inside runSimulation() to keep the module testable without SDK installed.
 * Pattern: const { default: Anthropic } = await import('@anthropic-ai/sdk')
 * SDK must be in package.json dependencies (it already is — Fear Engine uses it).
 * Verify: grep @anthropic-ai/sdk package.json before assuming it's present.
 */

export async function runSimulation(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: SimulationInput,
): Promise<SimulationRun> { ... }

/**
 * Returns the simulation history for a location (last 20 runs, reverse chrono).
 */
export async function getSimulationHistory(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
  limit?: number,
): Promise<SimulationHistoryEntry[]> { ... }

/**
 * Returns the most recent complete SimulationRun for a location.
 * Returns null if no runs exist.
 */
export async function getLatestSimulationRun(
  supabase: ReturnType<typeof createServiceRoleClient>,
  locationId: string,
): Promise<SimulationRun | null> { ... }

/**
 * Checks the daily rate limit for an org.
 * Returns { allowed: boolean; runs_today: number; remaining: number }
 */
export async function checkDailyRateLimit(
  supabase: ReturnType<typeof createServiceRoleClient>,
  orgId: string,
): Promise<{ allowed: boolean; runs_today: number; remaining: number }> { ... }
```

---

### Component 7: Migration

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 110: AI Answer Simulation Sandbox (Capstone)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. simulation_runs — stores complete simulation results per run
CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                   uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,

  -- Input metadata
  content_source           text        NOT NULL
                                       CHECK (content_source IN (
                                         'freeform','draft','llms_txt','published_faq','published_homepage'
                                       )),
  draft_id                 uuid        REFERENCES public.content_drafts(id) ON DELETE SET NULL,
  content_text             text        NOT NULL,     -- Stored truncated at 5000 chars
  content_word_count       integer     NOT NULL DEFAULT 0,
  modes_run                text[]      NOT NULL DEFAULT '{}',

  -- Per-mode results (stored as JSONB)
  ingestion_result         jsonb,      -- IngestionResult | null
  query_results            jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- QuerySimulationResult[]
  gap_analysis             jsonb,      -- GapAnalysisResult | null

  -- Summary scores
  simulation_score         integer     NOT NULL DEFAULT 0
                                       CHECK (simulation_score BETWEEN 0 AND 100),
  ingestion_accuracy       integer     NOT NULL DEFAULT 0
                                       CHECK (ingestion_accuracy BETWEEN 0 AND 100),
  query_coverage_rate      numeric(4,3) NOT NULL DEFAULT 0,
  hallucination_risk       text        NOT NULL DEFAULT 'high'
                                       CHECK (hallucination_risk IN ('low','medium','high','critical')),

  -- API usage tracking
  claude_model             text        NOT NULL DEFAULT 'claude-sonnet-4-6',
  input_tokens_used        integer     NOT NULL DEFAULT 0,
  output_tokens_used       integer     NOT NULL DEFAULT 0,

  -- Status + errors
  status                   text        NOT NULL DEFAULT 'completed'
                                       CHECK (status IN ('completed','partial','failed')),
  errors                   text[]      NOT NULL DEFAULT '{}',

  run_at                   timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "simulation_runs: org members read own"
  ON public.simulation_runs FOR SELECT
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "simulation_runs: service role full access"
  ON public.simulation_runs USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_simulation_runs_location_run_at
  ON public.simulation_runs (location_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_org_run_at
  ON public.simulation_runs (org_id, run_at DESC);

COMMENT ON TABLE public.simulation_runs IS
  'AI Answer Simulation Sandbox results. Sprint 110.';

-- 2. Add simulation columns to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS last_simulation_score    integer CHECK (last_simulation_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS simulation_last_run_at   timestamptz;

COMMENT ON COLUMN public.locations.last_simulation_score IS
  'Most recent simulation sandbox score 0–100. NULL = never run. Sprint 110.';

COMMENT ON COLUMN public.locations.simulation_last_run_at IS
  'Timestamp of most recent simulation run. Sprint 110.';
```

**Update `prod_schema.sql`**, **`database.types.ts`** — add simulation_runs table, 2 new location columns.

---

### Component 8: API Routes

#### `app/api/sandbox/run/route.ts`

```typescript
/**
 * POST /api/sandbox/run
 * Runs a full simulation for the authenticated user's location.
 *
 * Body:
 * {
 *   content_text: string;            // Required: the content to test
 *   content_source: ContentSource;   // Required: where content came from
 *   draft_id?: string;               // Optional: if from content_drafts
 *   modes?: SimulationMode[];        // Optional: default ['ingestion','query','gap_analysis']
 * }
 *
 * Validation:
 * - content_text.trim().length === 0 → 422 'empty_content'
 * - Plan: Growth+ only → 403 'plan_upgrade_required'
 * - Rate limit: checkDailyRateLimit() → 429 'rate_limit_exceeded' with runs_today, remaining
 * - No location for org → 422 'no_location'
 *
 * Response on success: { ok: true; run: SimulationRun }
 * Response on failure: { ok: false; error: string; code: string }
 *
 * Expected latency: 10–20 seconds (multiple Claude API calls).
 * Route must NOT timeout at Vercel's default 10s limit.
 * Set: export const maxDuration = 60; (Vercel Fluid Functions)
 */
export const maxDuration = 60;
export async function POST(request: Request) { ... }
```

#### `app/api/sandbox/status/route.ts`

```typescript
/**
 * GET /api/sandbox/status
 * Returns the latest simulation run + history for the authenticated user's location.
 *
 * Response:
 * {
 *   latest_run: SimulationRun | null;
 *   history: SimulationHistoryEntry[];   // Last 10 runs (lightweight)
 *   rate_limit: { runs_today: number; remaining: number; max: number };
 * }
 */
export async function GET(request: Request) { ... }
```

#### `app/api/sandbox/draft/[draftId]/route.ts`

```typescript
/**
 * GET /api/sandbox/draft/[draftId]
 * Fetches the content_text from a specific content_draft for pre-loading into the sandbox.
 * Validates that the draft belongs to the authenticated user's org.
 * Response: { draft_id: string; content_text: string; status: string; trigger_type: string }
 */
export async function GET(request: Request, { params }: { params: { draftId: string } }) { ... }
```

---

### Component 9: Dashboard Panel — `app/dashboard/_components/SandboxPanel.tsx`

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  🧪 AI Answer Sandbox              Last run: 2 hours ago   Score: 68/100  B   │
│                                                             [Run New Test →]   │
├────────────────────────────────────────────────────────────────────────────────┤
│  What is this? Test your content before publishing — see exactly how an AI     │
│  would read and answer questions about your business based on what you've      │
│  written. Uses Claude as the simulation engine.                                 │
├─────────────────────────────────┬──────────────────────────────────────────────┤
│  TEST YOUR CONTENT              │  LAST RUN RESULTS (2 hr ago)                │
│  ─────────────────────────────  │  ──────────────────────────────────────────  │
│  Source:                        │  Ingestion Accuracy     82/100   ✅          │
│  [○ Paste text]                 │  Query Coverage         60%      ⚠️           │
│  [○ My latest draft ▾]          │  Hallucination Risk     Medium   ⚠️           │
│  [○ My llms.txt]                │  ──────────────────────────────────────────  │
│                                 │  3 of 5 queries got complete answers         │
│  ┌───────────────────────────┐  │  1 query returned a wrong answer ⚠️           │
│  │ Paste your content here   │  │  2 queries: AI had no basis to answer 🔴     │
│  │ to test how AI would      │  │                                              │
│  │ read and answer           │  │  Highest risk query:                         │
│  │ questions about your      │  │  "How do I book a private event at CNC?"     │
│  │ business...               │  │  → No booking instructions in content        │
│  └───────────────────────────┘  │                                              │
│                                 │  [View Full Results →]                       │
│  Modes: [✓] Facts  [✓] Queries  │                                              │
│  [Run Simulation →]             │                                              │
│  ⏱ Takes ~15 seconds            │                                              │
│  Runs today: 3 / 20             │                                              │
├─────────────────────────────────┴──────────────────────────────────────────────┤
│  SIMULATION HISTORY (last 5 runs)                                               │
│  Date          Source        Score  Risk      Queries                          │
│  Feb 28 10am   FAQ Draft     68/100 Medium    6/10 answered                   │
│  Feb 25 3pm    llms.txt      72/100 Low       8/10 answered                   │
│  Feb 22 11am   Freeform      41/100 Critical  2/10 answered                   │
│  Feb 20 9am    GBP Post      55/100 High      4/10 answered                   │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Implementation rules:**
- `'use client'` — data from `GET /api/sandbox/status`
- Plan gate: Growth+ only — Starter sees upgrade prompt
- Score colors: ≥80 green, 60–79 yellow, <60 red
- Letter grade: A/B/C/D/F
- Content source toggle: freeform textarea | draft selector (dropdown of recent drafts) | llms.txt (auto-loads from vaio_profiles)
- "Run Simulation →": calls `POST /api/sandbox/run`, shows loading state with "Simulating (this takes ~15 sec)..."
- Modes checkboxes: default all checked
- Rate limit counter: "Runs today: X / 20" — real-time from status endpoint
- All interactive elements: `data-testid` attributes
- Skeleton while loading
- On run success: navigate to SimulationResultsModal with full results

---

### Component 10: Simulation Results Modal — `app/dashboard/_components/SimulationResultsModal.tsx`

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  📊 Simulation Results                                  Score: 68/100  Grade B │
│  Tested: FAQ Draft · Feb 28, 2026 10:14 AM                              [✕]   │
├─────────────────────────────────┬──────────────────────────────────────────────┤
│  ① FACT EXTRACTION TEST         │  ② QUERY RESPONSE TEST                      │
│  ─────────────────────────────  │  ──────────────────────────────────────────  │
│  Accuracy: 82/100               │  Coverage: 60% (6 of 10 answered)           │
│                                 │                                              │
│  ✅ Name: Charcoal N Chill      │  ✅ "Good hookah lounge Alpharetta?"         │
│  ✅ Phone: (470) 546-4866       │     "Charcoal N Chill in Alpharetta..."      │
│  ✅ Address: 11950 Jones Br...  │                                              │
│  ✅ City: Alpharetta            │  ✅ "What time does CNC close?"              │
│  ✅ Category: hookah lounge     │     "Charcoal N Chill is open until..."      │
│  ⚠️  Hours: Extracted wrong     │                                              │
│     Got: "5PM-12AM daily"       │  🔴 "How to book private event at CNC?"     │
│     Expected: "Tue-Thu 5PM-1AM, │     NO BASIS — add booking instructions     │
│     Fri-Sat 5PM-2AM"           │                                              │
│  ✅ Description: extracted      │  🔴 "Is there parking at CNC?"              │
│  ⚠️  Website: Not mentioned     │     NO BASIS — no parking info in content   │
│                                 │                                              │
│  FIX: State your exact hours    │  ⚠️  "Is CNC good for date night?"          │
│  for each day of the week.      │     PARTIAL — missing specific detail       │
│                                 │                                              │
├─────────────────────────────────┤──────────────────────────────────────────────┤
│  ③ CONTENT GAPS & RISK          ← closes both columns                         │
│  ──────────────────────────────────────────────────────────────────────────── │
│  Hallucination Risk: MEDIUM (2 of 10 queries have no basis)                   │
│                                                                                │
│  PRIORITY ADDITIONS TO CLOSE GAPS:                                             │
│  1. Add booking/reservation instructions (closes 2 queries)                   │
│     e.g. "Call (470) 546-4866 to reserve a table or book a private event."    │
│  2. Add parking information (closes 1 query)                                  │
│     e.g. "Free parking available in the shopping center lot."                 │
│  3. State each day's hours explicitly (fixes ingestion error)                 │
│     e.g. "Open Tuesday–Thursday 5 PM–1 AM, Friday–Saturday 5 PM–2 AM."       │
│                                                                                │
│  [Create Content Brief →]   [Run Again with Updated Content →]                │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Implementation rules:**
- Two side-by-side columns for ingestion (left) + query results (right), gap analysis full-width below
- For each query result: show icon (✅/⚠️/🔴) + query text truncated + quality label + excerpt of simulated answer (max 100 chars)
- "Create Content Brief →": calls `POST /api/autopilot/drafts` with additionalContext from gap analysis recommendations + `trigger_type = 'prompt_missing'`
- "Run Again with Updated Content →": pre-loads the same content source type into the sandbox panel and sets focus to the textarea
- Factual errors in ingestion result shown as: got X / expected Y side-by-side
- `data-testid` on all result items

---

### Component 11: Seed Data — `supabase/seed.sql`

```sql
DO $$
DECLARE
  v_location_id uuid;
  v_org_id      uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_run_id      uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_location_id FROM public.locations WHERE org_id = v_org_id LIMIT 1;

  -- Seed one representative simulation run for the golden tenant
  INSERT INTO public.simulation_runs (
    id, location_id, org_id,
    content_source, draft_id, content_text, content_word_count, modes_run,
    ingestion_result, query_results, gap_analysis,
    simulation_score, ingestion_accuracy, query_coverage_rate, hallucination_risk,
    claude_model, input_tokens_used, output_tokens_used,
    status, errors, run_at
  ) VALUES (
    v_run_id, v_location_id, v_org_id,
    'llms_txt', null,
    E'# Charcoal N Chill\n> Charcoal N Chill is a premium hookah lounge and Indo-American fusion restaurant in Alpharetta, Georgia.\n\n## Key Facts\n- **Hours:** Tuesday–Thursday 5 PM–1 AM, Friday–Saturday 5 PM–2 AM\n- **Phone:** (470) 546-4866\n- **Address:** 11950 Jones Bridge Rd Ste 103, Alpharetta, GA 30005\n- **Specialties:** Premium hookah (50+ flavors), Indo-American fusion cuisine, live entertainment',
    89,
    ARRAY['ingestion', 'query', 'gap_analysis'],
    '{
      "extracted_facts": [
        { "field": "name", "extracted_value": "Charcoal N Chill", "ground_truth_value": "Charcoal N Chill", "match_status": "exact", "confidence": "high" },
        { "field": "phone", "extracted_value": "(470) 546-4866", "ground_truth_value": "(470) 546-4866", "match_status": "exact", "confidence": "high" },
        { "field": "address", "extracted_value": "11950 Jones Bridge Rd Ste 103, Alpharetta, GA 30005", "ground_truth_value": "11950 Jones Bridge Rd Ste 103", "match_status": "exact", "confidence": "high" },
        { "field": "city", "extracted_value": "Alpharetta", "ground_truth_value": "Alpharetta", "match_status": "exact", "confidence": "high" },
        { "field": "hours", "extracted_value": "Tue-Thu 5PM-1AM, Fri-Sat 5PM-2AM", "ground_truth_value": "Tuesday–Thursday 5 PM–1 AM, Friday–Saturday 5 PM–2 AM", "match_status": "partial", "confidence": "medium" },
        { "field": "category", "extracted_value": "hookah lounge", "ground_truth_value": "hookah lounge", "match_status": "exact", "confidence": "high" },
        { "field": "website", "extracted_value": null, "ground_truth_value": "https://charcoalnchill.com", "match_status": "missing", "confidence": "high" }
      ],
      "accuracy_score": 82,
      "facts_correct": 5,
      "facts_incorrect": 0,
      "facts_missing": 2,
      "critical_errors": [],
      "warnings": [
        { "field": "website", "severity": "warning", "extracted": "", "expected": "https://charcoalnchill.com", "message": "Website URL not mentioned in llms.txt content." }
      ]
    }'::jsonb,
    '[
      {
        "query_id": "sq-001",
        "query_text": "What is a good hookah lounge near Alpharetta?",
        "query_category": "discovery",
        "query_mode": "typed",
        "simulated_answer": "Charcoal N Chill is a premium hookah lounge and Indo-American fusion restaurant in Alpharetta, Georgia, featuring over 50 hookah flavors and live entertainment.",
        "answer_quality": "complete",
        "cites_business": true,
        "facts_present": ["name", "city", "category"],
        "facts_hallucinated": [],
        "word_count": 32,
        "ground_truth_alignment": 95
      },
      {
        "query_id": "sq-002",
        "query_text": "How do I book a private event at Charcoal N Chill?",
        "query_category": "action",
        "query_mode": "voice",
        "simulated_answer": "I do not have specific information about how to book a private event at Charcoal N Chill based on the provided content.",
        "answer_quality": "no_answer",
        "cites_business": true,
        "facts_present": [],
        "facts_hallucinated": [],
        "word_count": 26,
        "ground_truth_alignment": 0
      }
    ]'::jsonb,
    '{
      "total_queries_tested": 8,
      "queries_with_no_answer": 2,
      "queries_with_partial_answer": 2,
      "queries_with_complete_answer": 4,
      "gap_clusters": [
        {
          "category": "action",
          "total_queries": 3,
          "answered_queries": 1,
          "unanswered_queries": 2,
          "gap_severity": "critical",
          "example_unanswered": "How do I book a private event at Charcoal N Chill?"
        }
      ],
      "highest_risk_queries": [
        "How do I book a private event at Charcoal N Chill?",
        "Is there parking at Charcoal N Chill?"
      ],
      "recommended_additions": [
        {
          "priority": 1,
          "field": "amenities",
          "suggestion": "Add reservation and booking instructions, e.g. Call (470) 546-4866 to book a table or private event.",
          "closes_queries": ["How do I book a private event at Charcoal N Chill?"]
        }
      ]
    }'::jsonb,
    68, 82, 0.5, 'medium',
    'claude-sonnet-4-6', 2840, 680,
    'completed', '{}',
    NOW() - INTERVAL '2 hours'
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.locations
     SET last_simulation_score = 68,
         simulation_last_run_at = NOW() - INTERVAL '2 hours'
   WHERE id = v_location_id;

END $$;
```

---

### Component 12: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
// Sprint 110 — Sandbox fixtures

export const MOCK_SIMULATION_RUN: SimulationRun = {
  id: 'sim-run-001',
  location_id: 'loc-golden-tenant-id',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  content_source: 'llms_txt',
  draft_id: null,
  content_text: '# Charcoal N Chill\n> Premium hookah lounge in Alpharetta, GA...',
  content_word_count: 89,
  modes_run: ['ingestion', 'query', 'gap_analysis'],
  ingestion_result: {
    extracted_facts: [
      { field: 'name', extracted_value: 'Charcoal N Chill', ground_truth_value: 'Charcoal N Chill', match_status: 'exact', confidence: 'high' },
      { field: 'phone', extracted_value: '(470) 546-4866', ground_truth_value: '(470) 546-4866', match_status: 'exact', confidence: 'high' },
      { field: 'website', extracted_value: null, ground_truth_value: 'https://charcoalnchill.com', match_status: 'missing', confidence: 'high' },
    ],
    accuracy_score: 82,
    facts_correct: 5,
    facts_incorrect: 0,
    facts_missing: 2,
    critical_errors: [],
    warnings: [
      { field: 'website', severity: 'warning', extracted: '', expected: 'https://charcoalnchill.com', message: 'Website not mentioned in content.' }
    ],
  },
  query_results: [
    { query_id: 'sq-001', query_text: "What's a good hookah lounge near Alpharetta?",
      query_category: 'discovery', query_mode: 'typed',
      simulated_answer: 'Charcoal N Chill is a premium hookah lounge in Alpharetta, Georgia.',
      answer_quality: 'complete', cites_business: true,
      facts_present: ['name', 'city', 'category'], facts_hallucinated: [], word_count: 14, ground_truth_alignment: 95 },
    { query_id: 'sq-002', query_text: 'How do I book a private event at Charcoal N Chill?',
      query_category: 'action', query_mode: 'voice',
      simulated_answer: 'I do not have specific booking information in the provided content.',
      answer_quality: 'no_answer', cites_business: false,
      facts_present: [], facts_hallucinated: [], word_count: 13, ground_truth_alignment: 0 },
  ],
  gap_analysis: {
    total_queries_tested: 8,
    queries_with_no_answer: 2,
    queries_with_partial_answer: 2,
    queries_with_complete_answer: 4,
    gap_clusters: [
      { category: 'action', total_queries: 3, answered_queries: 1, unanswered_queries: 2,
        gap_severity: 'critical', example_unanswered: 'How do I book a private event at Charcoal N Chill?' },
    ],
    highest_risk_queries: ['How do I book a private event at Charcoal N Chill?'],
    recommended_additions: [
      { priority: 1, field: 'amenities', suggestion: 'Add booking instructions, e.g. Call (470) 546-4866.',
        closes_queries: ['How do I book a private event at Charcoal N Chill?'] },
    ],
  },
  simulation_score: 68,
  ingestion_accuracy: 82,
  query_coverage_rate: 0.5,
  hallucination_risk: 'medium',
  run_at: '2026-03-01T08:00:00.000Z',
  claude_model: 'claude-sonnet-4-6',
  input_tokens_used: 2840,
  output_tokens_used: 680,
  status: 'completed',
  errors: [],
};

export const MOCK_SIMULATION_HISTORY: SimulationHistoryEntry[] = [
  { id: 'sim-run-001', content_source: 'llms_txt', draft_id: null,
    simulation_score: 68, hallucination_risk: 'medium', query_coverage_rate: 0.5,
    run_at: '2026-03-01T08:00:00.000Z' },
  { id: 'sim-run-002', content_source: 'freeform', draft_id: null,
    simulation_score: 41, hallucination_risk: 'critical', query_coverage_rate: 0.2,
    run_at: '2026-02-22T11:00:00.000Z' },
];

export const MOCK_INGESTION_RESULT: IngestionResult = MOCK_SIMULATION_RUN.ingestion_result!;

export const MOCK_GAP_ANALYSIS: GapAnalysisResult = MOCK_SIMULATION_RUN.gap_analysis!;
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/content-ingestion-analyzer.test.ts`

**Claude API mocked. compareFactValue, normalizeForComparison, buildExtractionSystemPrompt, buildExtractionUserPrompt — pure, zero mocks.**

```
describe('compareFactValue — pure')
  1.  "(470) 546-4866" vs "(470) 546-4866" → 'exact'
  2.  "4705464866" vs "(470) 546-4866" (phone field) → 'exact' (normalized)
  3.  "Charcoal N Chill" vs "charcoal n chill" → 'exact' (case-insensitive)
  4.  "Alpharetta, GA" vs "Alpharetta" (city field) → 'partial'
  5.  "(404) 999-0000" vs "(470) 546-4866" → 'wrong'
  6.  null vs "(470) 546-4866" → 'missing'
  7.  "(470) 546-4866" vs null (no GT value) → 'exact' (no GT = not checkable, treat as match)

describe('normalizeForComparison — pure')
  8.  Phone field: removes parens, spaces, dashes → digits only
  9.  Non-phone field: lowercase + trim only
  10. empty string → empty string (no crash)

describe('buildExtractionSystemPrompt — pure')
  11. contains "JSON object"
  12. contains "Do not invent" or "not present"
  13. contains all 9 GroundTruthField names

describe('buildExtractionUserPrompt — pure')
  14. contains the contentText verbatim
  15. contains all 9 field names as extraction targets

describe('analyzeContentIngestion — Claude API mocked')
  16. returns IngestionResult with accuracy_score = MOCK_INGESTION_RESULT.accuracy_score (82)
  17. returns facts_missing = 2 when website and description not in content
  18. critical_errors empty when no critical fields wrong
  19. tokensUsed.input > 0
  20. when content < 20 words: returns accuracy_score = 0 WITHOUT calling API
  21. when API throws: returns partial result with error in errors array
  22. critical warning when address field 'wrong'
  23. non-critical warning when website field 'missing'
```

**23 tests.**

---

### Test File 2: `src/__tests__/unit/ground-truth-diffuser.test.ts`

**Pure functions — zero mocks. Zero API calls.**

```
describe('normalizePhone — pure')
  1.  "(470) 546-4866" → "4705464866"
  2.  "470-546-4866" → "4705464866"
  3.  "4705464866" → "4705464866"
  4.  "non-phone text" → "nophone text" (strips non-digits, but no crash)

describe('extractPhonePatterns — pure')
  5.  "Call us at (470) 546-4866 today" → ["4705464866"]
  6.  "Two phones: 404-999-0000 and (470) 546-4866" → ["4049990000","4705464866"]
  7.  "No phone here" → []

describe('groundTruthValuePresentInText — pure')
  8.  GT name "Charcoal N Chill" in text "Visit Charcoal N Chill" → true
  9.  GT name "Charcoal N Chill" not in text "Visit some lounge" → false
  10. GT phone "(470) 546-4866" in text "Call 4705464866" → true (normalized match)
  11. city "Alpharetta" in text "located in Alpharetta, GA" → true

describe('findContradictingValue — pure')
  12. GT phone "4705464866", text has "(404) 999-0000" → returns "(404) 999-0000"
  13. GT phone "4705464866", text has no other phone → returns null
  14. GT name "CNC", text has no business name mention → returns null

describe('diffTextAgainstGroundTruth — pure')
  15. content mentioning correct name/phone/address → those fields in supported_facts
  16. content with wrong phone → phone in contradicted_facts
  17. alignment_score = 100 when all GT facts present + correct
  18. alignment_score < 100 when some facts missing
  19. discrepancies array contains Discrepancy with severity 'critical' for name/phone/address wrong
  20. 'not_mentioned' facts contribute partial credit to alignment_score (not zero)
```

**20 tests. Zero mocks.**

---

### Test File 3: `src/__tests__/unit/hallucination-gap-scorer.test.ts`

**Pure functions — zero mocks.**

```
describe('computeHallucinationRisk — pure')
  1.  0/10 no_answer → 'low'
  2.  2/10 no_answer → 'low' (< 20%)
  3.  3/10 no_answer → 'medium' (30%)
  4.  5/10 no_answer → 'high' (50%)
  5.  7/10 no_answer → 'critical' (70%)
  6.  empty queryResults → 'low' (no queries = no risk)

describe('computeSimulationScore — pure')
  7.  ingestion=100, coverage=1.0, risk='low' → 100
  8.  ingestion=0, coverage=0, risk='critical' → 0
  9.  ingestion=82, coverage=0.5, risk='medium' → 68 (matches MOCK_SIMULATION_RUN)
  10. score always between 0 and 100

describe('buildGapClusters — pure')
  11. all queries answered → empty clusters array
  12. 3/3 unanswered in 'action' → severity 'critical' (100% gap rate)
  13. 1/4 unanswered in 'discovery' → severity 'low' (25% gap rate)
  14. clusters sorted by severity DESC

describe('findHighestRiskQueries — pure')
  15. 'wrong' quality queries appear before 'no_answer' in result
  16. returns max 5 queries
  17. empty results → empty array (no crash)

describe('generateContentAdditions — pure')
  18. 'action' no_answer queries → ContentAddition with field 'amenities' or 'general'
  19. deduplicates suggestions by field (max one per field)
  20. sorted by priority ASC
  21. closes_queries list contains the query text for each matched suggestion
```

**21 tests. Zero mocks.**

---

### Test File 4: `src/__tests__/unit/query-simulation-engine.test.ts`

**Claude API mocked for simulateSingleQuery. evaluateSimulatedAnswer, detectHallucinatedFacts, checkFactsPresent — pure.**

```
describe('buildQuerySimSystemPrompt — pure')
  1.  contains "ONLY to the business information"
  2.  contains "Do not fabricate"
  3.  does not instruct Claude to use external knowledge

describe('buildQuerySimUserPrompt — pure')
  4.  contains the content_text substring
  5.  contains the query_text
  6.  content and question clearly delimited

describe('evaluateSimulatedAnswer — pure')
  7.  "I do not have information about..." → answer_quality 'no_answer'
  8.  "I cannot find..." → answer_quality 'no_answer'
  9.  answer containing wrong phone number → hallucinated fact detected
  10. answer mentioning business name → cites_business = true
  11. answer with correct hours in it → facts_present includes 'hours'
  12. answer perfectly aligned with GT → ground_truth_alignment = 100
  13. word_count correctly counted

describe('detectHallucinatedFacts — pure')
  14. phone number in answer NOT in GT → hallucinated
  15. phone number matching GT → NOT hallucinated
  16. price "$15 per hookah" not in content or GT → hallucinated
  17. no numeric facts → empty hallucinated array

describe('checkFactsPresent — pure')
  18. GT name in answer → 'name' in returned array
  19. GT phone (normalized) in answer → 'phone' in returned array
  20. no GT facts in answer → empty array

describe('selectQueriesForSimulation — Supabase mocked')
  21. returns max 10 queries
  22. prioritizes lowest citation_rate typed queries (5 max)
  23. includes voice queries (3 max)
  24. includes high citation_rate baseline queries (2)
  25. returns empty array if no queries seeded (no crash)
```

**25 tests.**

---

### Test File 5: `src/__tests__/unit/simulation-orchestrator.test.ts`

**All external calls mocked (Claude API, Supabase).**

```
describe('checkDailyRateLimit — Supabase mocked')
  1.  0 runs today → { allowed: true, runs_today: 0, remaining: 20 }
  2.  19 runs today → { allowed: true, runs_today: 19, remaining: 1 }
  3.  20 runs today → { allowed: false, runs_today: 20, remaining: 0 }

describe('runSimulation — all mocked')
  4.  empty content_text → returns error, does NOT call Claude API
  5.  rate limit exceeded → returns error 'rate_limit_exceeded', does NOT call Claude API
  6.  successful run → status = 'completed'
  7.  successful run → simulation_score matches computeSimulationScore() math
  8.  successful run → saves to simulation_runs table
  9.  successful run → updates locations.last_simulation_score
  10. ingestion mode only → query_results = [], gap_analysis = null
  11. query mode only → ingestion_result = null
  12. all modes → all three results present
  13. Claude API error for ingestion → status = 'partial', errors non-empty
  14. content truncated at MAX_CONTENT_WORDS before sending to API

describe('getSimulationHistory — Supabase mocked')
  15. returns max 20 entries (or limit param)
  16. sorted reverse chronological (newest first)
  17. returns empty array if no runs exist (no crash)
```

**17 tests.**

---

### Test File 6: `src/__tests__/unit/sandbox-routes.test.ts`

```
describe('POST /api/sandbox/run')
  1.  returns 401 when not authenticated
  2.  returns 403 'plan_upgrade_required' for Starter plan
  3.  returns 422 'empty_content' when content_text is empty string
  4.  returns 422 'no_location' when org has no location
  5.  returns 429 'rate_limit_exceeded' with { runs_today, remaining } when daily limit hit
  6.  returns { ok: true, run: SimulationRun } on success
  7.  sets maxDuration = 60 (verify export exists)

describe('GET /api/sandbox/status')
  8.  returns { latest_run: SimulationRun } when run exists
  9.  returns { latest_run: null } when no runs exist (200, not 404)
  10. returns { rate_limit: { runs_today, remaining, max: 20 } }
  11. returns { history: SimulationHistoryEntry[] } with up to 10 entries

describe('GET /api/sandbox/draft/[draftId]')
  12. returns { draft_id, content_text, status, trigger_type } for valid draft
  13. returns 404 when draft_id does not belong to org
  14. returns 404 when draft not found
```

**14 tests.**

---

### Test File 7: `src/__tests__/e2e/sandbox-panel.spec.ts` — Playwright

```typescript
describe('AI Answer Sandbox Panel', () => {
  test('renders panel with last run score and grade', async ({ page }) => {
    // Mock GET /api/sandbox/status → { latest_run: MOCK_SIMULATION_RUN, history: [...], rate_limit: {...} }
    // Navigate to /dashboard
    // Assert: "AI Answer Sandbox" panel visible (data-testid="sandbox-panel")
    // Assert: "68/100" score visible
    // Assert: "Grade B" visible
  });

  test('rate limit counter shows correctly', async ({ page }) => {
    // Assert: "Runs today: 3 / 20" visible (data-testid="rate-limit-counter")
  });

  test('freeform content mode: textarea visible and accepts input', async ({ page }) => {
    // Assert: textarea visible (data-testid="sandbox-textarea")
    // Type content into textarea
    // Assert: textarea value updates
  });

  test('Run Simulation button triggers API call and shows loading state', async ({ page }) => {
    // Mock POST /api/sandbox/run → MOCK_SIMULATION_RUN (with 1s delay)
    // Type content into textarea
    // Click "Run Simulation →" (data-testid="run-simulation-btn")
    // Assert: loading state visible "Simulating..."
    // Assert: SimulationResultsModal opens after response
  });

  test('SimulationResultsModal shows ingestion results', async ({ page }) => {
    // [continues from previous test or open modal directly]
    // Assert: modal visible (data-testid="simulation-results-modal")
    // Assert: "Fact Extraction Test" section visible
    // Assert: "82/100" ingestion accuracy visible
    // Assert: ✅ name row visible
    // Assert: ⚠️ website row visible
  });

  test('SimulationResultsModal shows query results', async ({ page }) => {
    // Assert: "Query Response Test" section visible
    // Assert: "Coverage: 50% (1 of 2 answered)" visible (based on mock)
    // Assert: ✅ discovery query result visible
    // Assert: 🔴 action query "no basis" visible
  });

  test('SimulationResultsModal shows gap analysis and recommendations', async ({ page }) => {
    // Assert: "Content Gaps & Risk" section visible
    // Assert: "Hallucination Risk: MEDIUM" visible
    // Assert: priority 1 recommendation text visible
    // Assert: "Create Content Brief →" button visible (data-testid="create-brief-from-sandbox-btn")
  });

  test('Create Content Brief calls Autopilot with sandbox context', async ({ page }) => {
    // Mock POST /api/autopilot/drafts → { ok: true, draft: { id: 'draft-sandbox-001' } }
    // Click "Create Content Brief →"
    // Assert: success toast "Content brief created"
  });

  test('simulation history table renders with correct rows', async ({ page }) => {
    // Assert: history section visible (data-testid="simulation-history")
    // Assert: 2 rows visible (from MOCK_SIMULATION_HISTORY)
    // Assert: score column shows "68" and "41"
    // Assert: risk column shows "medium" and "critical"
  });

  test('Starter plan sees upgrade prompt, not sandbox', async ({ page }) => {
    // Mock GET /api/sandbox/status → 403
    // Assert: upgrade prompt visible, panel content hidden
  });
});
```

**10 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/content-ingestion-analyzer.test.ts     # 23 tests
npx vitest run src/__tests__/unit/ground-truth-diffuser.test.ts           # 20 tests
npx vitest run src/__tests__/unit/hallucination-gap-scorer.test.ts        # 21 tests
npx vitest run src/__tests__/unit/query-simulation-engine.test.ts         # 25 tests
npx vitest run src/__tests__/unit/simulation-orchestrator.test.ts         # 17 tests
npx vitest run src/__tests__/unit/sandbox-routes.test.ts                  # 14 tests
npx vitest run                                                              # ALL — zero regressions
npx playwright test src/__tests__/e2e/sandbox-panel.spec.ts               # 10 Playwright tests
npx tsc --noEmit                                                            # 0 type errors
```

**Total: 120 Vitest + 10 Playwright = 130 tests**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/sandbox/types.ts` | **CREATE** | All shared types + SANDBOX_LIMITS |
| 2 | `lib/sandbox/content-ingestion-analyzer.ts` | **CREATE** | Claude API fact extraction + GT diff |
| 3 | `lib/sandbox/query-simulation-engine.ts` | **CREATE** | Per-query Claude API simulation |
| 4 | `lib/sandbox/ground-truth-diffuser.ts` | **CREATE** | Pure GT comparison + hallucination detection |
| 5 | `lib/sandbox/hallucination-gap-scorer.ts` | **CREATE** | Gap analysis + simulation score computation |
| 6 | `lib/sandbox/simulation-orchestrator.ts` | **CREATE** | Full run orchestration + DB persistence |
| 7 | `lib/sandbox/index.ts` | **CREATE** | Barrel export |
| 8 | `app/api/sandbox/run/route.ts` | **CREATE** | On-demand simulation (maxDuration=60) |
| 9 | `app/api/sandbox/status/route.ts` | **CREATE** | Latest run + history + rate limit |
| 10 | `app/api/sandbox/draft/[draftId]/route.ts` | **CREATE** | Fetch draft for sandbox pre-load |
| 11 | `app/dashboard/_components/SandboxPanel.tsx` | **CREATE** | Main sandbox UI |
| 12 | `app/dashboard/_components/SimulationResultsModal.tsx` | **CREATE** | Full results view |
| 13 | `app/dashboard/page.tsx` | **MODIFY** | Add SandboxPanel (Growth+ gated) |
| 14 | `supabase/migrations/[timestamp]_sandbox.sql` | **CREATE** | simulation_runs table + 2 location columns |
| 15 | `supabase/prod_schema.sql` | **MODIFY** | simulation_runs + location columns |
| 16 | `lib/supabase/database.types.ts` | **MODIFY** | SimulationRun types |
| 17 | `supabase/seed.sql` | **MODIFY** | 1 simulation run seed for golden tenant |
| 18 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 4 sandbox fixtures |
| 19 | `src/__tests__/unit/content-ingestion-analyzer.test.ts` | **CREATE** | 23 tests |
| 20 | `src/__tests__/unit/ground-truth-diffuser.test.ts` | **CREATE** | 20 tests |
| 21 | `src/__tests__/unit/hallucination-gap-scorer.test.ts` | **CREATE** | 21 tests |
| 22 | `src/__tests__/unit/query-simulation-engine.test.ts` | **CREATE** | 25 tests |
| 23 | `src/__tests__/unit/simulation-orchestrator.test.ts` | **CREATE** | 17 tests |
| 24 | `src/__tests__/unit/sandbox-routes.test.ts` | **CREATE** | 14 tests |
| 25 | `src/__tests__/e2e/sandbox-panel.spec.ts` | **CREATE** | 10 Playwright tests |

**Total: 25 files** (no vercel.json update — no new cron this sprint)

---

## 🚫 What NOT to Do

1. **DO NOT claim to simulate ChatGPT, Gemini, or Perplexity responses** — the dashboard, API responses, and all user-facing copy must be clear: the sandbox uses Claude API as the simulation engine. Never say "see what ChatGPT will say" or "predict Perplexity's response." The correct phrasing: "Simulates how an AI would read your content."

2. **DO NOT call external ChatGPT/Gemini/Perplexity APIs** in the simulation — the simulation uses Claude only. This is both honest and architecturally consistent (LocalVector is already Claude-powered).

3. **DO NOT add a cron job** — the sandbox is user-initiated only. Automated simulations would drain tokens without user consent. No cron. No scheduled runs.

4. **DO NOT call Claude API in `ground-truth-diffuser.ts`** — the diffuser is pure string matching. Zero API calls in that module. This is intentional for testability and speed.

5. **DO NOT run more than MAX_QUERIES_PER_RUN = 10 queries** in a single simulation — this is a hard cost control limit.

6. **DO NOT run queries in parallel using Promise.all in the query simulation engine** — run sequentially with a 200ms sleep between calls to avoid hitting Anthropic rate limits. The ingestion + query modes can run in parallel (Promise.all) because they're separate API calls. Within the query mode, simulate one query at a time.

7. **DO NOT store full content_text without truncating at MAX_CONTENT_CHARS_STORED = 5000 chars** — content is stored for reference, not for re-processing.

8. **DO NOT import Anthropic SDK at module level** in simulation-orchestrator.ts — use dynamic import (`await import('@anthropic-ai/sdk')`) to keep the module testable. The SDK must be in package.json; verify before writing the import.

9. **DO NOT rewrite the Reality Score component** — the Reality Score exists. Sprint 110 does NOT add a new DataHealth dimension to it (this is a post-launch enhancement). The sandbox score is surfaced via the SandboxPanel only — do not modify the Reality Score formula or component.

10. **DO NOT auto-populate the Sandbox with the business's current published content at load time** — the user selects what to test. The panel can offer "Load my llms.txt" or "Load latest draft" as source options, but never auto-runs a simulation on page load.

11. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

12. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).

13. **DO NOT use `page.waitForTimeout()` in Playwright** — use event-driven waits.

14. **DO NOT edit `middleware.ts`** (AI_RULES §6).

15. **DO NOT exceed Vercel's default 10s function timeout** for the `/api/sandbox/run` route — set `export const maxDuration = 60;` in the route file (Vercel Fluid Functions pattern).

---

## ✅ Definition of Done

- [ ] `lib/sandbox/types.ts` — SimulationMode (3), ContentSource (5), SimulationRun (all fields), IngestionResult, ExtractedFact, GroundTruthField (11 values), IngestionError, QuerySimulationResult, AnswerQuality (4), GapAnalysisResult, GapCluster, ContentAddition, HallucinationRisk (4), SimulationHistoryEntry, SandboxPromptType, SANDBOX_LIMITS
- [ ] `content-ingestion-analyzer.ts` — analyzeContentIngestion(), buildExtractionSystemPrompt(), buildExtractionUserPrompt(), compareFactValue(), normalizeForComparison(), FIELD_WEIGHTS (sums to 100), CRITICAL_FIELDS. Short-circuit for <20 words. Partial result on API error.
- [ ] `ground-truth-diffuser.ts` — diffTextAgainstGroundTruth(), groundTruthValuePresentInText(), findContradictingValue(), normalizePhone(), extractPhonePatterns(). Zero API calls. Alignment score formula: (supported×2 + not_mentioned×1) / (total×2) × 100.
- [ ] `hallucination-gap-scorer.ts` — computeHallucinationRisk(), buildGapClusters(), generateContentAdditions(), computeSimulationScore(), findHighestRiskQueries(), mapQueryToContentSuggestion(). All pure.
- [ ] `query-simulation-engine.ts` — simulateQueriesAgainstContent() sequential 200ms sleep, selectQueriesForSimulation() (5 lowest typed + 3 lowest voice + 2 highest baseline), buildQuerySimSystemPrompt(), buildQuerySimUserPrompt(), evaluateSimulatedAnswer(), detectHallucinatedFacts(), checkFactsPresent(). Content truncated at MAX_CONTENT_WORDS.
- [ ] `simulation-orchestrator.ts` — runSimulation() with daily rate limit check, ingestion+query modes in Promise.all, gap analysis from query results, saves to simulation_runs, updates locations table. Dynamic Anthropic SDK import. getSimulationHistory(), getLatestSimulationRun(), checkDailyRateLimit().
- [ ] `app/api/sandbox/run/route.ts` — POST, Growth+ gate, 422/403/429 errors, maxDuration=60
- [ ] `app/api/sandbox/status/route.ts` — GET, returns latest_run + history + rate_limit
- [ ] `app/api/sandbox/draft/[draftId]/route.ts` — GET, validates org ownership
- [ ] `SandboxPanel.tsx` — source toggle (freeform | draft dropdown | llms.txt), modes checkboxes, rate limit counter, loading state "Simulating (~15 sec)...", run button → opens modal on success, simulation history table (last 5 rows), skeleton, plan gate
- [ ] `SimulationResultsModal.tsx` — two-column layout (ingestion left, queries right), gap analysis full-width, per-fact row with ✅/⚠️/🔴, per-query row with quality icon + answer excerpt, priority recommendations, "Create Content Brief →" (calls Autopilot), "Run Again →"
- [ ] `app/dashboard/page.tsx` updated with SandboxPanel
- [ ] Migration: simulation_runs table, last_simulation_score + simulation_last_run_at on locations
- [ ] `prod_schema.sql` updated
- [ ] `database.types.ts` updated
- [ ] Seed: 1 complete simulation run (score 68, risk medium, 2 queries) for golden tenant
- [ ] `golden-tenant.ts`: MOCK_SIMULATION_RUN, MOCK_SIMULATION_HISTORY, MOCK_INGESTION_RESULT, MOCK_GAP_ANALYSIS
- [ ] `data-testid` on all interactive elements (sandbox-panel, sandbox-textarea, run-simulation-btn, rate-limit-counter, simulation-results-modal, simulation-history, create-brief-from-sandbox-btn)
- [ ] `npx vitest run src/__tests__/unit/content-ingestion-analyzer.test.ts` — **23 tests passing**
- [ ] `npx vitest run src/__tests__/unit/ground-truth-diffuser.test.ts` — **20 tests passing**
- [ ] `npx vitest run src/__tests__/unit/hallucination-gap-scorer.test.ts` — **21 tests passing**
- [ ] `npx vitest run src/__tests__/unit/query-simulation-engine.test.ts` — **25 tests passing**
- [ ] `npx vitest run src/__tests__/unit/simulation-orchestrator.test.ts` — **17 tests passing**
- [ ] `npx vitest run src/__tests__/unit/sandbox-routes.test.ts` — **14 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/sandbox-panel.spec.ts` — **10 tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 48 written
- [ ] roadmap.md Sprint 110 marked ✅

---

## 📓 DEVLOG Entry Format

```markdown
## 2026-03-01 — Sprint 110: AI Answer Simulation Sandbox (Capstone — COMPLETED)

**Goal:** Close the LocalVector product loop with a pre-flight content testing sandbox.
Business owners can now test any content against their tracked queries BEFORE publishing —
seeing exactly how an AI would read it, which queries it helps answer, and where gaps
would cause AI hallucination.

**Scope:**
- `lib/sandbox/types.ts` — **NEW.** SimulationMode (3: ingestion/query/gap_analysis),
  ContentSource (5), SimulationRun (all fields), IngestionResult, ExtractedFact,
  GroundTruthField (11), QuerySimulationResult, AnswerQuality (4), GapAnalysisResult,
  GapCluster, ContentAddition, HallucinationRisk (4), SimulationHistoryEntry,
  SANDBOX_LIMITS (MAX_CONTENT_WORDS=1500, MAX_QUERIES=10, MAX_RUNS_PER_DAY=20,
  MAX_CONTENT_CHARS_STORED=5000, CLAUDE_MODEL='claude-sonnet-4-6').
- `lib/sandbox/content-ingestion-analyzer.ts` — **NEW.** Claude API fact extraction
  (structured JSON output). compareFactValue() pure: exact/partial/wrong/missing.
  normalizeForComparison(): phone→digits, else lowercase+trim. FIELD_WEIGHTS (sums to 100):
  name=20, phone=15, address=15, city=10, category=10, hours=15, website=5, state=5.
  Short-circuit for <20 word content. Partial result on API error.
- `lib/sandbox/ground-truth-diffuser.ts` — **NEW.** Pure string matching only. ZERO API calls.
  diffTextAgainstGroundTruth(): supported/not_mentioned/contradicted per field.
  alignment_score = (supported×2 + not_mentioned×1) / (total×2) × 100.
  extractPhonePatterns(): regex for all phone number formats.
  findContradictingValue(): phone-pattern extraction + GT comparison.
- `lib/sandbox/hallucination-gap-scorer.ts` — **NEW.** All pure functions.
  computeHallucinationRisk(): no_answer_rate thresholds (0.20/0.40/0.60).
  computeSimulationScore(): ingestion 40% + coverage 40% + risk-penalty 20%.
  buildGapClusters(): grouped by category, sorted by severity.
  generateContentAdditions(): deduplicated by field, sorted by priority.
- `lib/sandbox/query-simulation-engine.ts` — **NEW.** selectQueriesForSimulation():
  5 lowest typed + 3 lowest voice + 2 highest baseline = 10 max.
  simulateQueriesAgainstContent(): sequential with 200ms sleep.
  evaluateSimulatedAnswer(): 'no_answer' detection ("I do not have"/"I cannot").
  detectHallucinatedFacts(): phone/price/date/time/rating patterns not in content or GT.
  checkFactsPresent(): GT value substring match in answer.
- `lib/sandbox/simulation-orchestrator.ts` — **NEW.** runSimulation(): daily rate limit
  check (20/day/org), ingestion+query in Promise.all, gap analysis from query results.
  Dynamic Anthropic SDK import. Saves to simulation_runs, updates locations table.
- `app/api/sandbox/`: run (POST, maxDuration=60), status (GET), draft/[draftId] (GET)
- `app/dashboard/_components/SandboxPanel.tsx` — **NEW.** Source toggle: freeform/draft/llms_txt.
  Rate limit counter. Loading "Simulating (~15 sec)...". History table (5 rows).
  Skeleton. Growth+ gate.
- `app/dashboard/_components/SimulationResultsModal.tsx` — **NEW.** Two-column: ingestion
  (left) + queries (right). Gap analysis full-width. Per-fact ✅/⚠️/🔴 rows. Query answer
  excerpts. Recommendations list. "Create Content Brief →" (Autopilot). "Run Again →".
- `app/dashboard/page.tsx` — **MODIFIED.** SandboxPanel added (Growth+ gated).
- Migration `[timestamp]_sandbox.sql` — **NEW.** simulation_runs table. last_simulation_score
  + simulation_last_run_at on locations.
- `supabase/prod_schema.sql`, `database.types.ts` — **MODIFIED.**
- Seed: 1 simulation run (score=68, risk=medium, 2 queries seeded) for golden tenant.
- `golden-tenant.ts`: MOCK_SIMULATION_RUN, MOCK_SIMULATION_HISTORY,
  MOCK_INGESTION_RESULT, MOCK_GAP_ANALYSIS.

**Tests added:**
- `content-ingestion-analyzer.test.ts` — **23 tests**
- `ground-truth-diffuser.test.ts` — **20 tests** (pure, zero mocks)
- `hallucination-gap-scorer.test.ts` — **21 tests** (pure, zero mocks)
- `query-simulation-engine.test.ts` — **25 tests**
- `simulation-orchestrator.test.ts` — **17 tests**
- `sandbox-routes.test.ts` — **14 tests**
- `sandbox-panel.spec.ts` — **10 Playwright tests**
- **Total: 120 Vitest + 10 Playwright — all passing, zero regressions**

**Key decisions:**
- Claude API (claude-sonnet-4-6) is the simulation engine. Explicitly NOT ChatGPT/Gemini/Perplexity.
  User-facing copy: "Simulates how an AI would read your content." Never "predicts ChatGPT."
- ground-truth-diffuser.ts: pure string matching ONLY. No API calls for diffing. This is intentional —
  fast, deterministic, fully testable without any mocking.
- Sequential query simulation (200ms sleep): prevents Anthropic rate limit burst. 10 queries × 2s
  avg = ~20s per run. maxDuration=60 on the route covers this.
- Ingestion + query modes run in Promise.all (parallel): they're independent API calls.
  Total: ingestion (3s) + queries (20s) ≈ 20s wall time.
- No cron: user-initiated only. MAX_RUNS_PER_DAY_PER_ORG=20 prevents abuse.
- Dynamic Anthropic SDK import in orchestrator: keeps module testable in test environments
  that don't have ANTHROPIC_API_KEY set.
- Reality Score: NOT modified this sprint. Sandbox score surfaces in SandboxPanel only.
  Post-launch: add 'Sandbox' dimension to Reality Score DataHealth breakdown.
- computeSimulationScore() math: ingestion(82)×0.4 + coverage(0.5)×40 + risk(medium)=12 → 68
  This matches MOCK_SIMULATION_RUN exactly (regression test for golden path).

**What this closes:**
- LocalVector product loop: publish → measure (SOV/Fear) → optimize (Autopilot) → test (Sandbox) → publish
- The Sandbox is the only pre-publication AI readiness tool in the local business AEO/GEO market
- Every other sprint feeds into Sprint 110: GT(105), Schema(106), Reviews(107),
  Authority(108), Voice(109), Autopilot(86), SOV(83) — all integrate here
```

---

## 🔮 AI_RULES Update (Add Rule 48)

```markdown
## 48. 🧪 AI Answer Simulation Sandbox in `lib/sandbox/` (Sprint 110 — Capstone)

The Sandbox is LocalVector's pre-flight content testing system. All simulation logic lives
in `lib/sandbox/`. Core rules:

* **Simulation uses Claude API only.** Never ChatGPT, Gemini, or live Perplexity for
  simulation. User-facing copy: "Simulates how an AI would read your content." Never
  "predicts what ChatGPT will say."
* **ground-truth-diffuser.ts is pure string matching.** Zero API calls in that module.
  Never add Claude API calls to the diffuser — it must remain fast, deterministic, testable.
* **MAX_QUERIES_PER_RUN = 10.** Hard limit. Never exceed.
* **MAX_RUNS_PER_DAY_PER_ORG = 20.** Hard limit. Check before every run.
* **Sequential query simulation.** 200ms sleep between Claude API calls within
  simulateQueriesAgainstContent(). Never parallelize the query loop.
* **No cron for sandbox.** User-initiated only. No automated runs.
* **maxDuration = 60 on /api/sandbox/run.** Vercel Fluid Function. Required.
* **Dynamic Anthropic SDK import.** `const { default: Anthropic } = await import('@anthropic-ai/sdk')`
  in simulation-orchestrator.ts. Never import at module level.
* Adding a new simulation mode: add to SimulationMode union, add runner function,
  wire in runSimulation() Promise.all block, add result field to SimulationRun type.
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| Ground Truth | Sprint 105 | Canonical facts for all diffing and comparison |
| page_schemas | Sprint 106 | Published homepage/FAQ content as simulation source |
| reviews.keywords | Sprint 107 | Review keywords for query weighting |
| entity_authority_profiles | Sprint 108 | Entity authority score for context signal |
| vaio_profiles.llms_txt_standard | Sprint 109 | llms.txt as simulation input source |
| content_drafts + createDraft() | Sprint 86 | Draft input source + "Create Content Brief" trigger |
| sov_target_queries | Sprint 83 | Typed + voice queries for simulation query set |
| Anthropic SDK | Fear Engine | Already in package.json — verify before writing import |
| Plan Enforcer | Sprint 3 | Growth+ gate |

---

## 🧠 Edge Cases

1. **Business has no sov_target_queries seeded** — `selectQueriesForSimulation()` returns empty array. runSimulation() skips query mode entirely even if requested. Ingestion + gap analysis still run. Status = 'partial'. Error: "No queries seeded — add queries to run query simulation."

2. **Content is a raw URL** — User pastes "https://charcoalnchill.com" into the freeform box. Content word count = 1 (< 20 words). Short-circuit fires: ingestion returns accuracy_score = 0, error: "Content too short. Paste the actual page text, not a URL." Query mode skipped. Run recorded as 'partial'.

3. **Anthropic API returns non-JSON for fact extraction** — JSON.parse throws. Catch block: return IngestionResult with accuracy_score = 0, facts_missing = all, errors = ["Claude returned non-JSON: {response_snippet}..."]. Status = 'partial'. Do NOT re-try — log and return.

4. **User pastes content in a non-English language** — Claude API still runs. Extracted facts may not match English Ground Truth. Ingestion accuracy will be low (fields won't match). Dashboard note: "Simulation works best with English-language content." Not blocked — accuracy score naturally reflects the mismatch.

5. **Ground Truth is incomplete (e.g., null hours)** — compareFactValue() for hours: GT = null → skip comparison for that field (treat as 'not checkable'). Remove 'hours' from FIELD_WEIGHTS denominator for that run. Recalculate max_possible accordingly. Do NOT penalize content for missing a fact that isn't in Ground Truth.

6. **User runs simulation on draft that was deleted** — `/api/sandbox/draft/[draftId]` returns 404. SandboxPanel falls back to freeform mode with empty textarea. Shows toast: "Draft not found — paste content manually."

7. **Simulated answer contains the GT phone number in a wrong area code format** — e.g. answer says "call 4705464866" (no formatting) while GT is "(470) 546-4866". detectHallucinatedFacts() must normalize before comparing. "(470) 546-4866" normalized = "4705464866". If the digits match, it's NOT hallucinated even if the formatting differs.

8. **All 10 queries return 'no_answer'** — query_coverage_rate = 0. hallucination_risk = 'critical'. simulation_score is low but still computes without division by zero. buildGapClusters() returns all categories as gap clusters. generateContentAdditions() returns max 5 suggestions (capped). Dashboard shows prominent warning: "This content provides no basis for AI to answer any of your tracked queries."

9. **Claude API rate limit hit mid-run (429 from Anthropic)** — catch block in simulateSingleQuery() catches the rate limit error. Log it. Add 2s sleep. Retry once. If second attempt fails: mark that query as status='partial', push error string, continue to next query. Never hard-fail the entire run on a single query API error.

10. **User opens SimulationResultsModal from a 'partial' run** — status badge shows "Partial Run". Missing mode results render as empty panels with "Simulation incomplete for this section." Non-missing results render normally.

---

## 📚 Document Sync + Git Commit

### Step 1: Update `/docs`

**`docs/roadmap.md`** — Sprint 110 ✅ 100%. Add closing note:
> "Sprint 110 closes the LocalVector product loop. The full system is now live:
> Ground Truth → Schema → Reviews → Authority → Voice → Sandbox → SOV → Fear Engine → Autopilot → publish."

**`docs/09-BUILD-PLAN.md`** — Sprint 110 checked off. Add COMPLETED marker.

**`docs/CLAUDE.md`** — Add to Implementation Inventory: `lib/sandbox/` + 3 API routes + sandbox components.

### Step 2–5: DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES Rule 48

### Step 6: Git Commit

```bash
git add -A
git commit -m "Sprint 110 (Capstone): AI Answer Simulation Sandbox

- lib/sandbox/: content-ingestion-analyzer (Claude API fact extraction, FIELD_WEIGHTS),
  ground-truth-diffuser (pure, zero API calls, phone normalization, alignment scoring),
  hallucination-gap-scorer (risk thresholds, gap clusters, content additions, sim score),
  query-simulation-engine (sequential 200ms sleep, 10-query max, hallucination detection),
  simulation-orchestrator (rate limit 20/day/org, Promise.all ingestion+query, dynamic SDK import)
- app/api/sandbox/: run (maxDuration=60), status, draft/[draftId]
- SandboxPanel: source toggle, modes, rate limit counter, history table, Growth+ gate
- SimulationResultsModal: 2-col ingestion+queries, gap analysis, recommendations, Autopilot CTA
- migration: simulation_runs table, 2 location columns
- seed: 1 simulation run (score=68, medium risk) for golden tenant
- tests: 120 Vitest passing + 10 Playwright passing — zero regressions
- docs: roadmap, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES Rule 48

Claude API used as simulation engine. NOT ChatGPT/Gemini. Copy: 'Simulates how an AI
would read your content.' No cron. MAX_QUERIES=10. MAX_RUNS_PER_DAY=20. maxDuration=60.
ground-truth-diffuser: pure string matching, zero API calls.

LocalVector product loop: CLOSED.
Ground Truth → Schema → Reviews → Authority → Voice → Sandbox → SOV → Fear → Autopilot ✓

Sprint 83–110 complete. LocalVector AI Answer Layer: 100%."

git push origin main
```

---

## 🏆 Sprint 110 Outcome — Product Loop Closed

After Sprint 110, the LocalVector AI Answer Layer is architecturally complete.

A business owner sits down at the dashboard. They've just written a new FAQ answer about parking and private event booking. Before hitting publish, they:

1. Open the **AI Answer Sandbox**
2. Paste their FAQ text
3. Click "Run Simulation"
4. Watch as Claude reads their content and tries to answer "How do I book a private event?" — and gets "I do not have specific booking information"
5. See the gap: they forgot to include the phone number in the FAQ
6. Click "Create Content Brief" — Autopilot generates a draft that closes the gap
7. Revise. Re-run. Score goes from 68 → 84.
8. **Then they publish.**

That is the closed loop. That is the product.

---

## 🗺️ What Comes After Sprint 110

Sprint 110 completes the **LocalVector AI Answer Layer** as scoped. Post-110 opportunities (future roadmap):

- **Sprint 111+ — Multi-User Agency Accounts:** Multi-seat orgs, role-based access, white-label partner billing
- **Sprint 112+ — Multi-Model Expansion:** Extend SOV cron to query models beyond Perplexity Sonar (ChatGPT Browsing, Gemini API when available)
- **Reality Score DataHealth v2:** Add 'Sandbox' dimension (currently surfaces in SandboxPanel only)
- **Competitive Prompt Hijacking Alerts:** Detect when competitor content has been optimized to intercept your brand's queries
- **Agent-SEO Readiness:** Score the business's readiness to be discovered and transacted with by AI agents (not just humans)

**Sprint 110 is the capstone of the AI Answer Layer. The foundation is complete.**

```
Sprints 83–110: LocalVector AI Answer Layer
─────────────────────────────────────────
83  SOV Engine             ✅
84  Fear Engine            ✅
85  Greed Engine           ✅
86  Autopilot              ✅
87  NAP Sync Prep          ✅
88–104  [Platform sprints] ✅
105 NAP Sync               ✅
106 Schema Expansion       ✅
107 Review Intelligence    ✅
108 Authority Mapping      ✅
109 Voice Optimization     ✅
110 Simulation Sandbox     ✅ ← YOU ARE HERE
─────────────────────────────────────────
AI Answer Layer: COMPLETE ✓
```
