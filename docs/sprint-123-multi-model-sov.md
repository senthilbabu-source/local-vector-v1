# Sprint 123 — Multi-Model SOV Expansion

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/ai/providers.ts`,
> `app/api/cron/sov/route.ts`, `lib/services/sov-engine.service.ts`
> (or wherever the SOV query logic lives — read CLAUDE.md to find it)

---

## Objective

Build **Multi-Model SOV Expansion** — extend the SOV engine from single-provider
(Perplexity Sonar) to query multiple AI models per target query, record per-model
citation results, surface model-level breakdowns in the dashboard, and expose a
"Which AI mentions you?" panel so orgs can see exactly which AI assistants cite them.

**What this sprint answers:** "ChatGPT doesn't mention us even though Perplexity does.
How do I know which AI I'm invisible to?"

**What Sprint 123 delivers:**
- `sov_model_results` table — stores per-model citation results per query per week
- SOV cron extended: queries 3 models per target query (Perplexity Sonar, GPT-4o-mini,
  Gemini Flash) in addition to existing logic; writes per-model rows
- `lib/services/multi-model-sov.ts` — orchestrator that runs a single query across
  all enabled models, normalizes results, deduplicates
- Model enablement config: plan-gated — Starter gets 1 model (Perplexity only),
  Growth gets 2 (+ GPT-4o-mini), Agency gets all 3 (+ Gemini Flash)
- `GET /api/sov/model-breakdown/[queryId]` — returns per-model citation results
  for a given target query
- `ModelBreakdownPanel` component — "Which AI mentions you?" panel on the SOV
  dashboard showing a model-by-model grid: cited / not cited / inconclusive
- Per-model SOV score: aggregate SOV% computed per model across all queries
  (existing overall SOV remains unchanged — new per-model metric is additive)
- Rate limiting: 500ms delay between model calls per query (respects existing
  AI_RULES rate limit patterns)

**What this sprint does NOT build:** querying Claude (Anthropic) directly for SOV
(conflict of interest risk — self-reference), querying Llama/open-source models
(no hosted API with consistent availability), custom model weighting, real-time
per-model streaming (batch cron only).

---

## Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                             — All rules (59 rules as of Sprint 121)
Read CLAUDE.md                               — Full implementation inventory
Read lib/ai/providers.ts                     — CRITICAL: all existing model registrations
Read app/api/cron/sov/route.ts               — Current SOV cron implementation
Read lib/services/sov-engine.service.ts      — (or equivalent — find via CLAUDE.md)
  FIND: how a single SOV query is run
  FIND: how sov_evaluations rows are written
  FIND: existing rate limiting between calls
Read supabase/prod_schema.sql
  FIND: sov_evaluations — exact columns (org_id, location_id, query_id/query_text,
        sov_score/share_of_voice, week_of, cited, citation_count — exact names)
  FIND: target_queries — exact columns
  FIND: sov_first_mover_alerts — exact columns
  FIND: organizations — plan_tier values (exact strings)
Read lib/supabase/database.types.ts          — All current types
Read src/__fixtures__/golden-tenant.ts       — Existing fixtures
Read vercel.json                             — Confirm existing cron schedules
Read .env.example                            — Which AI provider keys are already present
```

**Read before writing code:**

1. **Existing SOV query mechanism.** Read `sov-engine.service.ts` (or wherever
   the SOV query logic lives) completely before writing anything. Find: how the
   Perplexity Sonar call is structured, what the response shape is, how citations
   are detected in the response, how sov_evaluations rows are built. The multi-model
   version must produce identical data shapes — the new `sov_model_results` table
   is additive, not a replacement.

2. **Exact column names on `sov_evaluations`.** Before writing any SQL or TS that
   touches this table, read the schema. The column storing the score may be
   `sov_score`, `share_of_voice`, or something else. The query identifier may be
   `query_id` (FK to target_queries) or `query_text` (stored directly). Critical.

3. **Plan tier strings.** Find the exact values used for `organizations.plan_tier`
   (e.g., `'starter'`, `'growth'`, `'agency'` — or `'basic'`, `'pro'`, etc.).
   The model enablement config must use these exact strings.

4. **Existing rate limiting pattern.** Read the cron to find the existing delay
   between Perplexity calls (AI_RULES mentions 500ms). The multi-model cron must
   apply the SAME delay between each model call. Do not remove existing delays.

5. **Gemini Flash model string.** Check `lib/ai/providers.ts` for whether a Google
   Gemini provider is already configured. If yes: use the existing client. If no:
   add `@ai-sdk/google` following the same pattern as the existing providers.
   Read the file before deciding.

6. **GPT-4o-mini model string.** Also check providers.ts. An OpenAI client likely
   exists already (for the Fear Engine). Reuse the same client — add
   `'sov-query-gpt': openai('gpt-4o-mini')` to the MODELS registry if not present.

---

## Architecture

```
lib/services/
  multi-model-sov.ts             — Orchestrator: run query across all enabled models
  sov-model-normalizer.ts        — Normalize different model response shapes to
                                   a common citation result format

lib/config/
  sov-models.ts                  — Model enablement config per plan tier

app/api/
  sov/
    model-breakdown/
      [queryId]/route.ts         — GET per-model results for a query

app/dashboard/
  share-of-voice/
    _components/
      ModelBreakdownPanel.tsx    — "Which AI mentions you?" grid
      ModelCitationBadge.tsx     — Per-model cited/not-cited/inconclusive badge
```

---

## Migration — `[ts]_sov_model_results.sql`

```sql
-- Sprint 123: Multi-Model SOV Expansion

-- ── sov_model_results table ──────────────────────────────────────────────────
-- Stores per-model citation results for each target query run.
-- Separate from sov_evaluations (which stores the aggregate/overall score).
-- sov_evaluations continues to be written as before — this is purely additive.

CREATE TABLE IF NOT EXISTS public.sov_model_results (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link to the org, location, and query
  org_id          uuid          NOT NULL
                                REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid          REFERENCES public.locations(id) ON DELETE SET NULL,
  query_id        uuid          REFERENCES public.target_queries(id) ON DELETE SET NULL,
  query_text      text          NOT NULL,   -- denormalized for query_id=null cases
  -- The model that ran this query
  model_provider  text          NOT NULL
                                CHECK (model_provider IN (
                                  'perplexity_sonar',
                                  'openai_gpt4o_mini',
                                  'gemini_flash'
                                )),
  -- Result
  cited           boolean       NOT NULL,
  citation_count  int           NOT NULL DEFAULT 0,
  ai_response     text,                    -- raw response excerpt (first 1000 chars)
  confidence      text          NOT NULL DEFAULT 'high'
                                CHECK (confidence IN ('high','medium','low')),
  -- Timing
  week_of         date          NOT NULL,
  run_at          timestamptz   NOT NULL DEFAULT NOW(),
  -- Deduplication guard
  UNIQUE (org_id, query_id, model_provider, week_of)
);

COMMENT ON TABLE public.sov_model_results IS
  'Per-model citation results for SOV queries. Sprint 123. \'
  'Additive to sov_evaluations (aggregate score). \'
  'Populated by the SOV cron when multi-model is enabled by plan.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sov_model_results_org_week
  ON public.sov_model_results (org_id, week_of DESC);

CREATE INDEX IF NOT EXISTS idx_sov_model_results_query
  ON public.sov_model_results (query_id, week_of DESC)
  WHERE query_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sov_model_results_model
  ON public.sov_model_results (org_id, model_provider, week_of DESC);

-- RLS
ALTER TABLE public.sov_model_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sov_model_results: members can read"
  ON public.sov_model_results FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "sov_model_results: service role full access"
  ON public.sov_model_results FOR ALL
  USING (auth.role() = 'service_role');
```

---

## Component 1: Model Config — `lib/config/sov-models.ts`

```typescript
/**
 * SOV model configuration by plan tier.
 * Determines which AI models are queried per target query in the SOV cron.
 *
 * This is a CODE constant — no DB column for model config.
 * Changing model availability requires a code deploy.
 */

export type SOVModelId =
  | 'perplexity_sonar'
  | 'openai_gpt4o_mini'
  | 'gemini_flash';

export interface SOVModelConfig {
  id: SOVModelId;
  display_name: string;   // shown in UI: "Perplexity", "ChatGPT (GPT-4o mini)", "Gemini"
  provider_key: string;   // key in MODELS registry from providers.ts
  max_tokens: number;
  // Rate limit: ms delay between calls to this provider
  // (shared with other calls to the same provider in the cron)
  call_delay_ms: number;
}

export const SOV_MODEL_CONFIGS: Record<SOVModelId, SOVModelConfig> = {
  perplexity_sonar: {
    id: 'perplexity_sonar',
    display_name: 'Perplexity',
    provider_key: 'sov-query',        // existing key in MODELS
    max_tokens: 512,
    call_delay_ms: 500,
  },
  openai_gpt4o_mini: {
    id: 'openai_gpt4o_mini',
    display_name: 'ChatGPT',
    provider_key: 'sov-query-gpt',    // add to MODELS if not present
    max_tokens: 512,
    call_delay_ms: 200,
  },
  gemini_flash: {
    id: 'gemini_flash',
    display_name: 'Gemini',
    provider_key: 'sov-query-gemini', // add to MODELS if not present
    max_tokens: 512,
    call_delay_ms: 200,
  },
};

/**
 * Models enabled per plan tier.
 * Starter: Perplexity only (existing behavior unchanged).
 * Growth: Perplexity + ChatGPT.
 * Agency: all three.
 *
 * READ prod_schema.sql to confirm exact plan_tier strings before using.
 */
export const PLAN_SOV_MODELS: Record<string, SOVModelId[]> = {
  trial:    ['perplexity_sonar'],
  starter:  ['perplexity_sonar'],
  growth:   ['perplexity_sonar', 'openai_gpt4o_mini'],
  agency:   ['perplexity_sonar', 'openai_gpt4o_mini', 'gemini_flash'],
};

/**
 * getEnabledModels(planTier): SOVModelId[]
 * Returns model IDs enabled for the given plan tier.
 * Fallback: ['perplexity_sonar'] for unknown plan tiers.
 */
export function getEnabledModels(planTier: string): SOVModelId[] {
  return PLAN_SOV_MODELS[planTier] ?? ['perplexity_sonar'];
}
```

---

## Component 2: Response Normalizer — `lib/services/sov-model-normalizer.ts`

```typescript
/**
 * Normalizes AI model responses into a common citation result format.
 * Different models structure their responses differently.
 * This module abstracts that away.
 *
 * NormalizedCitationResult: {
 *   cited: boolean;
 *   citation_count: number;
 *   ai_response_excerpt: string;  // first 1000 chars of raw response
 *   confidence: 'high' | 'medium' | 'low';
 * }
 *
 * detectCitation(responseText, orgName, locationName?): NormalizedCitationResult
 * PURE FUNCTION. No API calls.
 *
 * Detection logic (same approach as existing SOV engine — read it first):
 * 1. Normalize: responseText.toLowerCase()
 * 2. Check if orgName.toLowerCase() appears in response
 * 3. Also check common aliases: strip "The " prefix, check without punctuation
 * 4. citation_count: count occurrences of orgName in response (case-insensitive)
 * 5. confidence:
 *    - 'high': orgName appears verbatim (exact match)
 *    - 'medium': similar but not exact (e.g. "Charcoal & Chill" vs "Charcoal N Chill")
 *    - 'low': only location/category match, no org name
 *
 * cited = citation_count > 0 OR confidence === 'medium'
 *
 * IMPORTANT: Read the existing citation detection in sov-engine.service.ts
 * before writing this. The logic must be CONSISTENT with the existing approach —
 * not a new algorithm. Multi-model results must be comparable to Perplexity results.
 */
```

---

## Component 3: Multi-Model Orchestrator — `lib/services/multi-model-sov.ts`

```typescript
/**
 * Orchestrates running a single SOV query across all enabled models.
 *
 * runMultiModelQuery(params): Promise<MultiModelQueryResult>
 * params: {
 *   supabase: SupabaseClient;         // service role
 *   queryText: string;
 *   queryId: string | null;
 *   orgId: string;
 *   orgName: string;
 *   locationId: string | null;
 *   locationCity: string;
 *   planTier: string;
 *   weekOf: Date;
 * }
 *
 * Flow:
 * 1. enabledModels = getEnabledModels(planTier)
 * 2. For each model (SEQUENTIAL — not parallel. Respect rate limits):
 *    a. Wait call_delay_ms before each call (use existing delay utility or sleep())
 *    b. Call the model with the SOV query prompt
 *       Prompt: same prompt as existing SOV engine (read it — don't invent a new one)
 *    c. detectCitation(response, orgName, locationCity) → NormalizedCitationResult
 *    d. Upsert into sov_model_results (ON CONFLICT DO UPDATE) to handle re-runs
 *    e. Collect result
 * 3. Return MultiModelQueryResult:
 *    {
 *      models_run: SOVModelId[];
 *      results: Record<SOVModelId, NormalizedCitationResult>;
 *      cited_by_any: boolean;          // true if cited by at least one model
 *      cited_by_all: boolean;          // true if cited by ALL enabled models
 *      consensus_citation_count: number; // average across models
 *    }
 *
 * Error handling per model:
 * - If a model call throws: log warning, store as { cited: false, confidence: 'low' }
 *   with a note in ai_response_excerpt: '[error: {message}]'
 * - Never let one model failure abort the others
 * - The overall function should return partial results, never throw
 *
 * INTEGRATION WITH EXISTING SOV CRON:
 * Read app/api/cron/sov/route.ts to find where the per-query processing happens.
 * After the existing Perplexity query (which writes to sov_evaluations as before),
 * add:
 *   const multiResult = await runMultiModelQuery({ ... });
 * The existing sov_evaluations write is NOT replaced — it stays exactly as-is.
 * runMultiModelQuery writes ONLY to sov_model_results.
 *
 * For Starter/Trial plans (only Perplexity enabled):
 * runMultiModelQuery still runs but with only perplexity_sonar.
 * The result from sov_model_results should mirror the sov_evaluations result
 * for that model.
 */
```

---

## Component 4: API Route — `GET /api/sov/model-breakdown/[queryId]/route.ts`

```typescript
/**
 * Returns per-model citation results for a given target query.
 * Auth: org member required.
 *
 * URL param: queryId (target_queries.id)
 * Query params: ?week_of=YYYY-MM-DD (optional, defaults to most recent week)
 *
 * Flow:
 * 1. Validate session + org membership
 * 2. Verify queryId belongs to this org (join target_queries → locations → org)
 *    If not: 404
 * 3. SELECT * FROM sov_model_results
 *    WHERE query_id = $queryId AND org_id = $orgId
 *    AND week_of = $weekOf (or MAX(week_of) if not specified)
 *    ORDER BY model_provider
 *
 * 4. Return:
 *    {
 *      query_id: string;
 *      query_text: string;
 *      week_of: string;
 *      models: Array<{
 *        model_provider: SOVModelId;
 *        display_name: string;
 *        cited: boolean;
 *        citation_count: number;
 *        confidence: string;
 *        ai_response_excerpt: string | null;
 *      }>;
 *      summary: {
 *        cited_by_count: number;        // how many models cited us
 *        total_models_run: number;
 *        all_models_agree: boolean;     // all cited OR all didn't cite
 *      };
 *    }
 *
 * Error codes:
 * 401: not authenticated
 * 404: query not found or not in this org
 */
```

---

## Component 5: Per-Org Model SOV Score — additive metric

```typescript
/**
 * Per-model aggregate SOV score across all queries for an org.
 * This is a new analytics metric, computed on the fly (not stored).
 *
 * Add to GET /api/sov/model-breakdown/[queryId] response OR
 * create a new GET /api/sov/model-scores endpoint:
 *
 * GET /api/sov/model-scores?week_of=YYYY-MM-DD
 * Auth: org member required.
 *
 * SELECT
 *   model_provider,
 *   COUNT(*) as total_queries,
 *   COUNT(*) FILTER (WHERE cited = true) as cited_count,
 *   ROUND(
 *     (COUNT(*) FILTER (WHERE cited = true)::numeric / COUNT(*)::numeric) * 100,
 *     1
 *   ) as sov_percent
 * FROM sov_model_results
 * WHERE org_id = $orgId AND week_of = $weekOf
 * GROUP BY model_provider
 * ORDER BY model_provider
 *
 * Returns: Array<{
 *   model_provider: SOVModelId;
 *   display_name: string;
 *   sov_percent: number;
 *   cited_count: number;
 *   total_queries: number;
 * }>
 */
```

---

## Component 6: Dashboard Components

### `ModelBreakdownPanel.tsx` — `app/dashboard/share-of-voice/_components/`

```typescript
/**
 * 'use client'
 * "Which AI mentions you?" panel — shows per-model citation grid for a query.
 *
 * Props: {
 *   queryId: string;
 *   queryText: string;
 *   orgName: string;
 *   weekOf?: string;   // ISO date, defaults to current week
 * }
 *
 * Fetches: GET /api/sov/model-breakdown/{queryId}
 *
 * UI layout:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  🤖 Which AI mentions you for this query?                        │
 * │  "best hookah lounge Alpharetta"                                 │
 * │  ──────────────────────────────────────────────────────────────  │
 * │  [ModelCitationBadge: Perplexity ✅ Cited]                       │
 * │  [ModelCitationBadge: ChatGPT    ❌ Not cited]                   │
 * │  [ModelCitationBadge: Gemini     ✅ Cited]                       │
 * │  ──────────────────────────────────────────────────────────────  │
 * │  2 of 3 AI models mention Charcoal N Chill for this query.       │
 * │  [View AI Response] (expands to show ai_response_excerpt)        │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * States: loading (skeleton), no data ("Run a scan to see per-model results"),
 *         error, populated
 *
 * Only shows models that have data (avoids showing Gemini badge for Starter plans).
 *
 * data-testid:
 *   "model-breakdown-panel"
 *   "model-badge-{model_provider}"
 *   "model-response-toggle-{model_provider}"
 *   "model-response-text-{model_provider}"
 *   "model-breakdown-summary"
 */
```

### `ModelCitationBadge.tsx`

```typescript
/**
 * Per-model cited / not-cited / inconclusive badge.
 *
 * Props: {
 *   model_provider: SOVModelId;
 *   display_name: string;
 *   cited: boolean;
 *   citation_count: number;
 *   confidence: 'high' | 'medium' | 'low';
 * }
 *
 * Renders:
 *   cited + high confidence:   "Perplexity ✅ Mentioned {N}x"     green
 *   cited + medium confidence: "Perplexity 🟡 Possibly mentioned" yellow
 *   not cited:                 "ChatGPT    ❌ Not mentioned"       red/gray
 *
 * data-testid: "model-badge-{model_provider}"
 */
```

### Wire into SOV dashboard

```typescript
/**
 * MODIFY the existing SOV query detail view in app/dashboard/share-of-voice/.
 * Read the existing component structure.
 * Add <ModelBreakdownPanel> below the per-query citation results.
 * Collapsed by default (disclosure pattern), expands on click.
 * Only shown when sov_model_results data exists for the query.
 * Minimum changes to existing code.
 */
```

---

## Component 7: Providers Update — `lib/ai/providers.ts`

```typescript
/**
 * MODIFY lib/ai/providers.ts to add:
 * 1. Google Gemini provider (if not present):
 *    import { createGoogleGenerativeAI } from '@ai-sdk/google';
 *    export const google = createGoogleGenerativeAI({
 *      apiKey: process.env.GOOGLE_AI_API_KEY,
 *    });
 *
 * 2. New model entries in MODELS:
 *    'sov-query-gpt':    openai('gpt-4o-mini'),
 *    'sov-query-gemini': google('gemini-2.0-flash'),
 *
 * READ the file first. If these already exist, do not duplicate.
 * Only add what is actually missing.
 * Do not change any existing model registrations.
 */
```

---

## Component 8: SOV Cron Update

```typescript
/**
 * MODIFY app/api/cron/sov/route.ts
 *
 * Read the file completely. Find the per-query processing block.
 * After the existing sov_evaluations write (UNCHANGED), add:
 *
 *   // Sprint 123: Multi-model SOV (additive — existing logic above is unchanged)
 *   void runMultiModelQuery({
 *     supabase: serviceClient,
 *     queryText,
 *     queryId,
 *     orgId,
 *     orgName,
 *     locationId,
 *     locationCity,
 *     planTier: org.plan_tier,
 *     weekOf: currentWeek,
 *   });
 *
 * Fire-and-forget (void). The multi-model query runs async after the
 * existing cron logic completes. It never blocks the cron response.
 *
 * IMPORTANT: The existing sov_evaluations write must NOT be changed.
 * runMultiModelQuery writes ONLY to sov_model_results.
 * The two tables are independent.
 *
 * This means the cron now has four fire-and-forget calls per org:
 * 1. void notifyOrg(...)             — Sprint 116
 * 2. void sendWeeklyDigest(...)      — Sprint 117
 * 3. void sendSlackAlert(...)        — Sprint 118 (conditional)
 * 4. void runMultiModelQuery(...)    — Sprint 123
 */
```

---

## Component 9: Golden Tenant Fixtures

```typescript
// Sprint 123 — multi-model SOV fixtures
import type { SOVModelId } from '@/lib/config/sov-models';

export const MOCK_SOV_MODEL_RESULTS = [
  {
    id: 'smr-001',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    location_id: null,
    query_id: 'query-001',
    query_text: 'best hookah lounge Alpharetta',
    model_provider: 'perplexity_sonar' as SOVModelId,
    cited: true,
    citation_count: 3,
    ai_response: 'Charcoal N Chill is a popular hookah lounge in Alpharetta...',
    confidence: 'high',
    week_of: '2026-03-01',
    run_at: '2026-03-02T02:15:00.000Z',
  },
  {
    id: 'smr-002',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    location_id: null,
    query_id: 'query-001',
    query_text: 'best hookah lounge Alpharetta',
    model_provider: 'openai_gpt4o_mini' as SOVModelId,
    cited: false,
    citation_count: 0,
    ai_response: 'There are several hookah lounges in the Alpharetta area...',
    confidence: 'high',
    week_of: '2026-03-01',
    run_at: '2026-03-02T02:16:00.000Z',
  },
  {
    id: 'smr-003',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    location_id: null,
    query_id: 'query-001',
    query_text: 'best hookah lounge Alpharetta',
    model_provider: 'gemini_flash' as SOVModelId,
    cited: true,
    citation_count: 1,
    ai_response: 'Charcoal N Chill offers premium hookah experiences...',
    confidence: 'high',
    week_of: '2026-03-01',
    run_at: '2026-03-02T02:17:00.000Z',
  },
];

export const MOCK_MODEL_BREAKDOWN_RESPONSE = {
  query_id: 'query-001',
  query_text: 'best hookah lounge Alpharetta',
  week_of: '2026-03-01',
  models: [
    { model_provider: 'perplexity_sonar', display_name: 'Perplexity',
      cited: true, citation_count: 3, confidence: 'high', ai_response_excerpt: '...' },
    { model_provider: 'openai_gpt4o_mini', display_name: 'ChatGPT',
      cited: false, citation_count: 0, confidence: 'high', ai_response_excerpt: '...' },
    { model_provider: 'gemini_flash', display_name: 'Gemini',
      cited: true, citation_count: 1, confidence: 'high', ai_response_excerpt: '...' },
  ],
  summary: { cited_by_count: 2, total_models_run: 3, all_models_agree: false },
};

export const MOCK_MODEL_SCORES = [
  { model_provider: 'perplexity_sonar', display_name: 'Perplexity',
    sov_percent: 67, cited_count: 8, total_queries: 12 },
  { model_provider: 'openai_gpt4o_mini', display_name: 'ChatGPT',
    sov_percent: 42, cited_count: 5, total_queries: 12 },
];
```

---

## Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/sov-model-normalizer.test.ts` — 14 tests

```
describe('detectCitation — pure function')
  1.  cited=true when orgName appears verbatim in response (case-insensitive)
  2.  cited=false when orgName absent from response
  3.  citation_count correctly counts occurrences
  4.  confidence='high' for exact match
  5.  confidence='medium' for near-match (fuzzy — define the threshold)
  6.  confidence='low' when location matches but not org name
  7.  ai_response_excerpt truncated to 1000 chars
  8.  handles empty response gracefully (cited=false, count=0)
  9.  handles null response (cited=false, count=0)
  10. strips punctuation from orgName for matching ("N" vs "&")
  11. does not false-positive on partial name overlap
  12. multiple occurrences in one sentence counted correctly
  13. case variations all count (UPPERCASE, MixedCase)
  14. cited=false when only similar (not same) business name appears
```

### Test File 2: `src/__tests__/unit/multi-model-sov.test.ts` — 14 tests

```
describe('getEnabledModels — pure')
  1.  starter plan → ['perplexity_sonar'] only
  2.  growth plan → ['perplexity_sonar', 'openai_gpt4o_mini']
  3.  agency plan → all 3 models
  4.  unknown plan → ['perplexity_sonar'] fallback

describe('runMultiModelQuery — AI + Supabase mocked')
  5.  runs only enabled models for the plan tier
  6.  runs models SEQUENTIALLY (not parallel)
  7.  inserts sov_model_results row for each model
  8.  uses ON CONFLICT DO UPDATE (upsert — safe for re-runs)
  9.  continues when one model throws (partial results returned)
  10. cited_by_any=true when any model cites
  11. cited_by_all=true only when all enabled models cite
  12. applies call_delay_ms between model calls
  13. never throws — always returns partial results on error
  14. respects existing SOV query prompt (same prompt as before)
```

### Test File 3: `src/__tests__/unit/model-breakdown-route.test.ts` — 10 tests

```
describe('GET /api/sov/model-breakdown/[queryId]')
  1.  returns 401 when not authenticated
  2.  returns 404 when queryId not in org
  3.  returns model results with display_name populated
  4.  defaults to most recent week_of when not specified
  5.  filters by week_of when provided
  6.  summary.cited_by_count correct
  7.  summary.all_models_agree true when unanimous
  8.  only returns models that have data (no empty model rows)

describe('GET /api/sov/model-scores')
  9.  returns per-model SOV percentages
  10. only returns models with data for the org/week
```

### Test File 4: `src/__tests__/unit/model-breakdown-component.test.ts` — 8 tests

```
describe('ModelBreakdownPanel — RTL')
  1.  loading state shows skeleton
  2.  no data state: "Run a scan to see per-model results"
  3.  renders one ModelCitationBadge per model in data
  4.  summary text: "2 of 3 AI models mention {orgName}"
  5.  "View AI Response" toggle expands response excerpt

describe('ModelCitationBadge — RTL')
  6.  cited + high → green checkmark + "Mentioned {N}x"
  7.  cited + medium → yellow + "Possibly mentioned"
  8.  not cited → gray/red + "Not mentioned"
```

### Test File 5: `src/__tests__/e2e/multi-model-sov.spec.ts` — 5 Playwright tests

```
1.  SOV query detail: ModelBreakdownPanel renders when data exists
2.  ModelBreakdownPanel: collapsed by default, expands on click
3.  Cited badge shown in green for cited model
4.  Not-cited badge shown for non-cited model
5.  "View AI Response" toggle shows/hides response excerpt
```

### Run Commands

```bash
npx vitest run src/__tests__/unit/sov-model-normalizer.test.ts
npx vitest run src/__tests__/unit/multi-model-sov.test.ts
npx vitest run src/__tests__/unit/model-breakdown-route.test.ts
npx vitest run src/__tests__/unit/model-breakdown-component.test.ts
npx vitest run
npx playwright test src/__tests__/e2e/multi-model-sov.spec.ts
npx tsc --noEmit
```

Total: 46 Vitest + 5 Playwright = 51 tests

---

## Files to Create/Modify — 20 files

| # | File | Action |
|---|------|--------|
| 1 | supabase/migrations/[ts]_sov_model_results.sql | CREATE |
| 2 | lib/config/sov-models.ts | CREATE |
| 3 | lib/services/sov-model-normalizer.ts | CREATE |
| 4 | lib/services/multi-model-sov.ts | CREATE |
| 5 | app/api/sov/model-breakdown/[queryId]/route.ts | CREATE |
| 6 | app/api/sov/model-scores/route.ts | CREATE |
| 7 | app/dashboard/share-of-voice/_components/ModelBreakdownPanel.tsx | CREATE |
| 8 | app/dashboard/share-of-voice/_components/ModelCitationBadge.tsx | CREATE |
| 9 | lib/ai/providers.ts | MODIFY (add Gemini + 2 new model keys if missing) |
| 10 | app/api/cron/sov/route.ts | MODIFY (add void runMultiModelQuery) |
| 11 | app/dashboard/share-of-voice/ (existing query detail) | MODIFY (add panel) |
| 12 | supabase/prod_schema.sql | MODIFY |
| 13 | lib/supabase/database.types.ts | MODIFY |
| 14 | src/__fixtures__/golden-tenant.ts | MODIFY (3 new fixtures) |
| 15 | src/__tests__/unit/sov-model-normalizer.test.ts | CREATE |
| 16 | src/__tests__/unit/multi-model-sov.test.ts | CREATE |
| 17 | src/__tests__/unit/model-breakdown-route.test.ts | CREATE |
| 18 | src/__tests__/unit/model-breakdown-component.test.ts | CREATE |
| 19 | src/__tests__/e2e/multi-model-sov.spec.ts | CREATE |
| 20 | .env.example | MODIFY (add GOOGLE_AI_API_KEY if missing) |

---

## What NOT to Do

1. DO NOT query Claude/Anthropic for SOV — conflict of interest (self-referential).
   The three supported models are Perplexity Sonar, GPT-4o-mini, Gemini Flash.

2. DO NOT replace or modify the existing sov_evaluations write logic.
   runMultiModelQuery is purely additive — sov_model_results only.
   The existing Perplexity query and sov_evaluations INSERT remain unchanged.

3. DO NOT run model queries in parallel. Sequential only, with call_delay_ms
   between each. The existing SOV cron has 500ms delays between Perplexity calls —
   the multi-model queries must respect the same discipline.

4. DO NOT block the SOV cron on multi-model results. void runMultiModelQuery()
   is fire-and-forget. The cron responds after the existing logic completes.

5. DO NOT charge Growth/Starter plans for Gemini calls. getEnabledModels()
   gates model access by plan tier. Gemini is Agency-only.

6. DO NOT invent a new citation detection algorithm. detectCitation() must use
   the same logic as the existing SOV engine. Read it first, replicate it.

7. DO NOT hardcode plan tier strings. Read exact values from prod_schema.sql
   before writing PLAN_SOV_MODELS. Wrong strings = all orgs fall back to starter.

8. DO NOT show empty model badges. ModelBreakdownPanel only renders badges for
   models that have actual data in sov_model_results — not all 3 models always.

9. DO NOT use page.waitForTimeout() in Playwright.
10. DO NOT use as any on Supabase clients (AI_RULES §38.2).

---

## Definition of Done

- [ ] Migration: sov_model_results table, 3 indexes, 2 RLS policies
- [ ] sov-models.ts: 3 SOVModelId values, SOV_MODEL_CONFIGS, PLAN_SOV_MODELS, getEnabledModels()
- [ ] sov-model-normalizer.ts: detectCitation() pure function (14 test cases)
- [ ] multi-model-sov.ts: runMultiModelQuery() sequential, upsert per model, never throws
- [ ] providers.ts MODIFIED: Gemini provider + sov-query-gpt + sov-query-gemini if missing
- [ ] GET /api/sov/model-breakdown/[queryId]: auth, 404 guard, week_of default, summary
- [ ] GET /api/sov/model-scores: per-model SOV% aggregate
- [ ] ModelBreakdownPanel: 4 states, summary text, response toggle
- [ ] ModelCitationBadge: 3 visual states (cited/medium/not-cited)
- [ ] SOV dashboard modified: panel wired into query detail
- [ ] SOV cron modified: void runMultiModelQuery() as 4th fire-and-forget call
- [ ] 46 Vitest + 5 Playwright = 51 tests passing
- [ ] npx vitest run — ALL passing, zero regressions
- [ ] npx tsc --noEmit — 0 errors
- [ ] DEVLOG.md entry, AI_RULES Rule 60, roadmap Sprint 123 marked done

---

## Edge Cases

1. GOOGLE_AI_API_KEY not set in local dev — Gemini calls will fail. The
   runMultiModelQuery error handler catches this: stores { cited:false,
   ai_response:'[error: API key missing]', confidence:'low' }. Doesn't crash.

2. Same query run twice in one week — UNIQUE(org_id, query_id, model_provider, week_of)
   prevents duplicate rows. ON CONFLICT DO UPDATE updates the result. Safe for
   re-runs and cron double-fires.

3. Starter plan org with only 1 model — ModelBreakdownPanel shows 1 badge only
   (Perplexity). No empty slots for Growth/Agency models. Clean UI.

4. org_name contains special regex chars (e.g. "Tom's Diner & Bar") — detectCitation
   must NOT use regex for the org name match. Use string .includes() after
   normalization. Regex special chars in org names will cause errors.

5. Very long AI responses (>1000 chars) — ai_response_excerpt is truncated to
   first 1000 chars before storage. The DB column is TEXT with no hard limit,
   but the excerpt is capped in the normalizer.

6. Model returns no text (empty response) — detectCitation handles this:
   cited=false, count=0, confidence='low'. Never null-dereferences.

7. The 4th fire-and-forget call in the SOV cron — the cron now has 4 void calls
   per org. Add a comment: "Sprint 116-123 fire-and-forget calls" with a list.
   Makes it clear this pattern is intentional.

---

## AI_RULES Update (Add Rule 60)

60. Multi-Model SOV in lib/services/multi-model-sov.ts + lib/config/sov-models.ts (Sprint 123)

- runMultiModelQuery() is ADDITIVE. Never modifies sov_evaluations.
  Writes to sov_model_results only. Existing SOV logic unchanged.
- Sequential model calls only. call_delay_ms between each provider.
  Never run model queries in parallel (rate limit discipline).
- getEnabledModels() gates by plan tier. Agency=3, Growth=2, Starter/Trial=1.
  Read exact plan_tier strings from prod_schema.sql.
- detectCitation() is PURE and consistent with existing SOV engine logic.
  No regex on org name — use .includes() after normalization.
- Never query Anthropic/Claude for SOV (self-reference conflict).
- sov_model_results has UNIQUE constraint on (org_id, query_id, model_provider, week_of).
  Use upsert (ON CONFLICT DO UPDATE) everywhere.
- runMultiModelQuery() never throws. Partial results on error, all errors logged.
- SOV cron now has 4 fire-and-forget void calls per org (116,117,118,123).
  Document all 4 with a comment block.

---

## What Comes Next

Sprint 124 — Reality Score DataHealth v2: Extend the Reality Score metric with
data freshness signals, NAP (Name/Address/Phone) consistency checking across
online sources, and a DataHealth dashboard section showing which data fields
AI models are most likely to get wrong.
