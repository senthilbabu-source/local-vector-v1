# Sprint 74 — Google AI Overview Monitoring (Gemini + Search Grounding)

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Add **Google AI Overview monitoring** to the SOV Engine by introducing a third SOV query engine: Gemini with Google Search grounding. This simulates what appears at the top of 47% of Google commercial searches — the AI Overview answer box. It's fundamentally different from the existing isolated Gemini `truth-audit-gemini` model because search-grounded Gemini pulls from Google's live search index, Business Profile, Maps data, and reviews.

**Why this is the #1 gap:** When someone Googles "best hookah lounge Alpharetta," the AI Overview IS the answer. A restaurant could score well in isolated ChatGPT/Perplexity queries but be invisible in actual Google Search AI Overviews. This sprint closes that gap.

**Unique data unlock:** "Here's what appears when someone Googles your category. Your competitor is in the AI Overview. You're not. Here's why — and these are the sources Google cited."

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules (especially §5, §19.3, §36.2)
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — Canonical schema (§1) — sov_evaluations, model_provider enum
Read lib/supabase/database.types.ts            — TypeScript DB types (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read lib/ai/providers.ts                       — Model key registry (§19.3) — THIS IS WHERE THE NEW MODEL KEY GOES
Read lib/services/sov-engine.service.ts        — SOV query runner + multi-model pattern (§36.2)
Read lib/inngest/functions/sov-cron.ts         — Inngest SOV cron function
Read app/api/cron/sov/route.ts                 — SOV cron route (inline fallback)
Read lib/plan-enforcer.ts                      — canRunMultiModelSOV() (Growth+)
Read app/dashboard/ai-responses/               — "AI Says" page (Sprint 69) — renders sov_evaluations
```

---

## 🏗️ Architecture — What to Build

### Key Technical Decision: Vercel AI SDK Google Search Grounding

The `@ai-sdk/google` package supports two approaches for search grounding:

**Approach A — Model option (simpler, LocalVector V1 choice):**
```typescript
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

const model = google('gemini-2.0-flash', { useSearchGrounding: true });

const { text, sources, providerMetadata } = await generateText({
  model,
  prompt: 'Best hookah bar in Alpharetta GA',
});

// sources: Array<{ url: string; title: string }> — cited URLs
// providerMetadata?.google?.groundingMetadata — detailed grounding chunks
```

**Approach B — Tool-based (richer metadata, more complex):**
```typescript
const { text, sources } = await generateText({
  model: google('gemini-2.0-flash'),
  tools: { google_search: google.tools.googleSearch({}) },
  prompt: 'Best hookah bar in Alpharetta GA',
});
```

**Use Approach A** for V1 — it's simpler, the model option is well-tested, and it returns the `sources` array we need to show users which URLs Google cited. Approach B can be explored in a future sprint if richer metadata is needed.

---

### Component 1: New Model Key — `lib/ai/providers.ts`

Add a new model key to the provider registry:

```typescript
// ── New model key for Sprint 74 ──
'sov-query-google': google('gemini-2.0-flash', { useSearchGrounding: true }),
```

**Update AI_RULES §19.3 model key registry table** to include:

| Key | Provider | SDK Function | Purpose |
|-----|----------|-------------|---------|
| `sov-query-google` | Google Gemini 2.0 Flash + Search Grounding | `generateText` | SOV Engine — Google AI Overview simulation (search-grounded). |

**Environment variable:** Uses `GOOGLE_GENERATIVE_AI_API_KEY` (already in `.env` from truth-audit-gemini). No new env var needed.

**Fallback:** If `GOOGLE_GENERATIVE_AI_API_KEY` is absent, `hasApiKey('sov-query-google')` returns `false` — the engine is skipped. Same pattern as existing multi-model SOV (§36.2).

---

### Component 2: SOV Engine Extension — `lib/services/sov-engine.service.ts`

Extend the existing multi-model SOV pattern to support a third engine: `google-grounded`.

**Current state (§36.2):** `runMultiModelSOVQuery()` runs Perplexity + OpenAI in parallel via `Promise.allSettled`. Growth+ orgs get both; Starter/Trial get Perplexity only.

**New state:** Growth+ orgs now get up to 3 engines: Perplexity + OpenAI + Google (search-grounded). All three run in parallel.

#### 2A: New query runner function

```typescript
/**
 * Run a SOV query against Gemini with Google Search grounding.
 * Returns search-grounded response + cited source URLs.
 */
export async function runGoogleGroundedSOVQuery(
  queryText: string,
  businessName: string,
  city: string,
  state: string,
): Promise<SOVQueryResult> {
  const model = getModel('sov-query-google');

  const { text, sources, providerMetadata } = await generateText({
    model,
    prompt: buildSOVPrompt(queryText, businessName, city, state),
  });

  // Parse rank + competitors from response (same parser as Perplexity/OpenAI)
  const parsed = parseSOVResponse(text, businessName);

  return {
    engine: 'google' as const,
    rawResponse: text,
    rankPosition: parsed.rankPosition,
    mentionedCompetitors: parsed.mentionedCompetitors,
    // NEW: citation source URLs from Google Search grounding
    citedSources: sources?.map(s => ({ url: s.url, title: s.title })) ?? [],
  };
}
```

#### 2B: Extend `SOVQueryResult` type

```typescript
export interface SOVQueryResult {
  engine: 'perplexity' | 'openai' | 'google';  // ← add 'google'
  rawResponse: string;
  rankPosition: number | null;
  mentionedCompetitors: string[];
  citedSources?: { url: string; title: string }[];  // ← NEW: only populated for Google
}
```

**IMPORTANT:** The `citedSources` field is optional — only Google returns it. Perplexity and OpenAI return `undefined`. The AI Says page (Sprint 69) should display sources when present.

#### 2C: Extend `runMultiModelSOVQuery()`

```typescript
export async function runMultiModelSOVQuery(
  queryText: string,
  businessName: string,
  city: string,
  state: string,
): Promise<SOVQueryResult[]> {
  const promises: Promise<SOVQueryResult>[] = [
    runPerplexitySOVQuery(queryText, businessName, city, state),
    runOpenAISOVQuery(queryText, businessName, city, state),
  ];

  // Add Google engine if API key is available
  if (hasApiKey('sov-query-google')) {
    promises.push(runGoogleGroundedSOVQuery(queryText, businessName, city, state));
  }

  const settled = await Promise.allSettled(promises);
  return settled
    .filter((r): r is PromiseFulfilledResult<SOVQueryResult> => r.status === 'fulfilled')
    .map(r => r.value);
}
```

#### 2D: Extract shared prompt builder

If not already extracted, create a shared `buildSOVPrompt()` function used by all three engine runners. The prompt should be engine-agnostic:

```typescript
function buildSOVPrompt(
  queryText: string,
  businessName: string,
  city: string,
  state: string,
): string {
  return `You are answering a question from someone searching for local businesses.

Question: "${queryText}"

Provide a helpful, factual answer listing the top recommended options in ${city}, ${state}. Include specific business names, what makes each one notable, and any relevant details like specialties, ambiance, or popular items. Be specific and mention real businesses.`;
}
```

**NOTE:** Read the existing SOV prompt in `sov-engine.service.ts` and reuse it. Do NOT invent a new prompt — use whatever's already working for Perplexity/OpenAI.

---

### Component 3: Store Citation Sources — `sov_evaluations` Schema Extension

The `sov_evaluations.engine` column is `varchar(20)` — `'google'` fits fine, no enum change needed.

Add a new JSONB column to store Google's cited source URLs:

#### Migration: `supabase/migrations/20260227000003_sov_cited_sources.sql`

```sql
-- Sprint 74: Add cited_sources JSONB column to sov_evaluations
-- Stores the URLs that Google Search grounding cited in its response.
-- Only populated for engine='google'; NULL for other engines.
ALTER TABLE public.sov_evaluations
  ADD COLUMN IF NOT EXISTS cited_sources jsonb;

COMMENT ON COLUMN public.sov_evaluations.cited_sources IS
  'URLs cited by Google Search grounding. Array of {url, title} objects. NULL for non-Google engines.';
```

#### Update `writeSOVResults()` in `sov-engine.service.ts`

```typescript
await supabase.from('sov_evaluations').insert({
  org_id: orgId,
  location_id: locationId,
  query_id: queryId,
  engine: result.engine,
  rank_position: result.rankPosition,
  mentioned_competitors: result.mentionedCompetitors,
  raw_response: result.rawResponse,
  cited_sources: result.citedSources ?? null,  // ← NEW
});
```

#### Update `database.types.ts`

Add `cited_sources: Json | null` to `sov_evaluations` Row/Insert/Update types.

#### Update `prod_schema.sql`

Add `"cited_sources" "jsonb"` to the `sov_evaluations` CREATE TABLE definition.

---

### Component 4: Display Google Sources in "AI Says" — `app/dashboard/ai-responses/`

The "AI Says" Response Library (Sprint 69) displays `sov_evaluations.raw_response` per engine. Extend it to:

1. Show a **"Google AI Overview"** engine tab alongside ChatGPT and Perplexity.
2. When the Google tab is selected and `cited_sources` is non-null, show a **"Sources Google Cited"** section below the response text:

```
┌─────────────────────────────────────────────────────────────────┐
│  Query: "best hookah bar near Alpharetta"                       │
│                                                                   │
│  [ChatGPT]  [Perplexity]  [Google AI Overview]                  │
│                                                                   │
│  Google AI Overview:                                              │
│  "Based on recent reviews, several hookah bars serve the         │
│   Alpharetta area. Charcoal N Chill stands out for its           │
│   Indo-American fusion cuisine and premium hookah experience..." │
│                                                                   │
│  📎 Sources Google Cited:                                        │
│  1. yelp.com/biz/charcoal-n-chill-alpharetta                    │
│  2. google.com/maps (Google Business Profile)                    │
│  3. tripadvisor.com/Restaurant_Review-charcoal-n-chill           │
│                                                                   │
│  💡 Insight: Google's AI Overview cited 3 sources about your      │
│     business. Yelp is the primary citation — keep your Yelp       │
│     profile updated.                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Read the existing AI Says page code first (`app/dashboard/ai-responses/`).
- The engine label mapping: `'openai'` → "ChatGPT", `'perplexity'` → "Perplexity", `'google'` → "Google AI Overview".
- Citation sources section only renders when `cited_sources` is non-null and non-empty.
- Cast `cited_sources` from JSONB per AI_RULES §38.4: `evaluation.cited_sources as { url: string; title: string }[] | null`.
- Display source URLs as clickable links opening in new tab (`target="_blank" rel="noopener noreferrer"`).

---

### Component 5: Cron Integration

Both the Inngest function and inline fallback need updating:

#### `lib/inngest/functions/sov-cron.ts`

In the per-org processing step, where `canRunMultiModelSOV(plan)` branches:

```typescript
if (canRunMultiModelSOV(plan)) {
  // Existing: Perplexity + OpenAI
  // Updated: Perplexity + OpenAI + Google (if API key available)
  results = await runMultiModelSOVQuery(queryText, businessName, city, state);
} else {
  results = [await runPerplexitySOVQuery(queryText, businessName, city, state)];
}
```

No change needed here — `runMultiModelSOVQuery()` already handles the Google engine internally (Component 2C). The cron just calls the same function.

**Verify:** The `writeSOVResults()` call already iterates over all results and writes each to `sov_evaluations`. The new `cited_sources` field is included in the INSERT (Component 3).

#### `app/api/cron/sov/route.ts`

Same — the inline fallback calls `runMultiModelSOVQuery()` which now includes Google. Verify the inline fallback's `writeSOVResults()` path includes `cited_sources`.

---

### Component 6: Plan Gating

**Google AI Overview monitoring follows the same plan gate as multi-model SOV:** `canRunMultiModelSOV(plan)` (Growth+). No new plan enforcer function needed.

The Google engine is additive inside `runMultiModelSOVQuery()` — it's only called when `canRunMultiModelSOV` is true AND `hasApiKey('sov-query-google')` is true. Two gates, same as existing OpenAI SOV engine.

---

### Component 7: Golden Tenant Fixture — `src/__fixtures__/golden-tenant.ts`

Extend `MOCK_SOV_RESPONSE` to include a Google engine:

```typescript
// Add to MOCK_SOV_RESPONSE.engines array:
{
  engine: 'google',
  rankPosition: 1,
  rawResponse:
    'Based on recent reviews and Google Business Profile data, Charcoal N Chill is a highly-rated hookah lounge in Alpharetta, GA, known for its Indo-American fusion cuisine and premium hookah experience. Other options include Cloud 9 Lounge and Astra Hookah.',
  mentionedCompetitors: ['Cloud 9 Lounge', 'Astra Hookah'],
  citedSources: [
    { url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta', title: 'Charcoal N Chill - Alpharetta - Yelp' },
    { url: 'https://g.co/charcoal-n-chill', title: 'Charcoal N Chill - Google Business Profile' },
  ],
  createdAt: '2026-02-26T12:10:00.000Z',
},
```

Add standalone fixture:

```typescript
/**
 * Sprint 74 — Canonical Google-grounded SOV result fixture.
 * Use in all Google AI Overview tests.
 */
export const MOCK_GOOGLE_SOV_RESULT: import('@/lib/services/sov-engine.service').SOVQueryResult = {
  engine: 'google',
  rawResponse: 'Based on recent reviews and Google Business Profile data, Charcoal N Chill is a highly-rated hookah lounge in Alpharetta, GA.',
  rankPosition: 1,
  mentionedCompetitors: ['Cloud 9 Lounge', 'Astra Hookah'],
  citedSources: [
    { url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta', title: 'Charcoal N Chill - Yelp' },
    { url: 'https://g.co/charcoal-n-chill', title: 'Google Business Profile' },
  ],
};
```

---

### Component 8: Seed Data — `supabase/seed.sql`

Add Google engine `sov_evaluations` seed row for Charcoal N Chill:

```sql
-- Sprint 74: Google-grounded SOV evaluation
-- UUID: c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
INSERT INTO public.sov_evaluations (id, org_id, location_id, query_id, engine, rank_position, mentioned_competitors, raw_response, cited_sources, created_at) VALUES
  ('c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'google', 1,
   '["Cloud 9 Lounge", "Astra Hookah"]'::jsonb,
   'Based on recent reviews, Charcoal N Chill is a top-rated hookah lounge in Alpharetta.',
   '[{"url": "https://www.yelp.com/biz/charcoal-n-chill-alpharetta", "title": "Yelp"}, {"url": "https://g.co/charcoal-n-chill", "title": "Google Business Profile"}]'::jsonb,
   NOW());
```

Register UUID `c3eebc99-...` in the seed file's UUID reference card.

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/sov-google-grounded.test.ts`

**Target: `lib/services/sov-engine.service.ts` — Google-specific functions**

```
describe('runGoogleGroundedSOVQuery')
  1.  returns engine='google' in result
  2.  returns parsed rankPosition from response text
  3.  returns parsed mentionedCompetitors from response text
  4.  returns rawResponse containing full AI text
  5.  returns citedSources array from generateText sources
  6.  returns empty citedSources when sources is null/undefined
  7.  returns rankPosition=null when business not mentioned
  8.  falls back gracefully when GOOGLE_GENERATIVE_AI_API_KEY is absent (hasApiKey returns false)

describe('runMultiModelSOVQuery — with Google')
  9.  includes Google result when hasApiKey('sov-query-google') is true
  10. excludes Google result when hasApiKey('sov-query-google') is false
  11. returns all 3 engines when all API keys present
  12. handles Google failure gracefully (Promise.allSettled — other engines still return)
  13. handles all engines failing (returns empty array)

describe('writeSOVResults — cited_sources')
  14. writes cited_sources JSONB when present in result
  15. writes cited_sources as null when not present in result
  16. writes cited_sources as null for non-Google engines
```

**16 tests total.**

**Mock requirements (AI_RULES §4, §19.3):**
```typescript
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));
```

For Google-specific tests, mock `generateText` to return `{ text: '...', sources: [...], providerMetadata: { google: { groundingMetadata: {...} } } }`.

Use `MOCK_GOOGLE_SOV_RESULT` from golden-tenant for expected values.

### Test File 2: `src/__tests__/unit/sov-engine-service.test.ts` — Updates

**Existing file — update, don't recreate.** The existing 11 tests should continue passing. Add:

```
  17. SOVQueryResult type accepts engine='google'
  18. writeSOVResults handles citedSources field
```

**2 new tests added to existing file.**

### Test File 3: `src/__tests__/unit/ai-responses-google.test.ts`

**Target: "AI Says" page — Google engine tab and citation display**

```
describe('AI Says — Google AI Overview')
  1. renders "Google AI Overview" tab when google engine data present
  2. shows response text for google engine
  3. shows "Sources Google Cited" section when citedSources is non-empty
  4. renders source URLs as clickable links
  5. hides citation section when citedSources is null
  6. hides citation section when citedSources is empty array
  7. does not show citation section for non-Google engines
```

**7 tests total.**

Mock requirements: Component tests with mock data. Import `MOCK_SOV_RESPONSE` (with new Google engine) from golden-tenant.

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/ai/providers.ts` | **MODIFY** | Add `sov-query-google` model key |
| 2 | `lib/services/sov-engine.service.ts` | **MODIFY** | Add `runGoogleGroundedSOVQuery()`, extend `runMultiModelSOVQuery()`, extend `SOVQueryResult` type, update `writeSOVResults()` |
| 3 | `supabase/migrations/20260227000003_sov_cited_sources.sql` | **CREATE** | Add `cited_sources` JSONB column to `sov_evaluations` |
| 4 | `supabase/prod_schema.sql` | **MODIFY** | Add `cited_sources` to `sov_evaluations` |
| 5 | `lib/supabase/database.types.ts` | **MODIFY** | Add `cited_sources` to `sov_evaluations` types |
| 6 | `app/dashboard/ai-responses/` | **MODIFY** | Add Google AI Overview tab + citation sources display |
| 7 | `supabase/seed.sql` | **MODIFY** | Add Google sov_evaluations seed row |
| 8 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Extend MOCK_SOV_RESPONSE, add MOCK_GOOGLE_SOV_RESULT |
| 9 | `src/__tests__/unit/sov-google-grounded.test.ts` | **CREATE** | 16 tests — Google SOV engine |
| 10 | `src/__tests__/unit/sov-engine-service.test.ts` | **MODIFY** | 2 new tests — type + citedSources |
| 11 | `src/__tests__/unit/ai-responses-google.test.ts` | **CREATE** | 7 tests — AI Says Google tab |

**Expected test count: 25 new tests across 3 files (16 + 2 + 7).**

---

## 🚫 What NOT to Do

1. **DO NOT use raw `fetch()` to call the Gemini API** (AI_RULES §19.3). Use Vercel AI SDK `generateText()` with the registered model key.
2. **DO NOT create a new plan enforcer function.** Google AI Overview monitoring uses the existing `canRunMultiModelSOV()` gate (Growth+).
3. **DO NOT modify the `model_provider` enum** in PostgreSQL. `sov_evaluations.engine` is `varchar(20)`, not an enum — `'google'` works directly.
4. **DO NOT trigger AI calls on page load** (AI_RULES §5). Google queries only run via the SOV cron.
5. **DO NOT hardcode Google API responses** in the "AI Says" display (AI_RULES §20). If no Google evaluation exists, don't show the tab.
6. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
7. **DO NOT block on Google when other engines fail** — `Promise.allSettled` pattern must be preserved.
8. **DO NOT use `useSearchGrounding` AND `google.tools.googleSearch()` together** — pick one. We use the model option for V1.
9. **DO NOT create files under `supabase/functions/`** (AI_RULES §6).
10. **DO NOT add new env vars.** `GOOGLE_GENERATIVE_AI_API_KEY` is already configured.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `sov-query-google` model key registered in `lib/ai/providers.ts`
- [ ] `runGoogleGroundedSOVQuery()` function working with search grounding
- [ ] `runMultiModelSOVQuery()` includes Google engine when API key present
- [ ] `SOVQueryResult` type extended with `citedSources` optional field
- [ ] Migration adds `cited_sources` to `sov_evaluations`
- [ ] `prod_schema.sql` and `database.types.ts` updated
- [ ] `writeSOVResults()` writes `cited_sources` to DB
- [ ] "AI Says" page shows Google AI Overview tab with citation sources
- [ ] Seed data has Google sov_evaluation row
- [ ] Golden Tenant: `MOCK_SOV_RESPONSE` extended, `MOCK_GOOGLE_SOV_RESULT` added
- [ ] `npx vitest run src/__tests__/unit/sov-google-grounded.test.ts` — 16 tests passing
- [ ] `npx vitest run src/__tests__/unit/sov-engine-service.test.ts` — 13 tests passing (11 existing + 2 new)
- [ ] `npx vitest run src/__tests__/unit/ai-responses-google.test.ts` — 7 tests passing
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-27 — Sprint 74: Google AI Overview Monitoring — Gemini + Search Grounding (Completed)

**Goal:** Add Google AI Overview monitoring to the SOV Engine using Gemini with Google Search grounding, enabling LocalVector to track what appears when someone Googles a tenant's business category — the #1 AI surface covering 47% of commercial searches.

**Scope:**
- `lib/ai/providers.ts` — **MODIFIED.** Added `sov-query-google` model key: `google('gemini-2.0-flash', { useSearchGrounding: true })`. Uses existing `GOOGLE_GENERATIVE_AI_API_KEY`.
- `lib/services/sov-engine.service.ts` — **MODIFIED.** Added `runGoogleGroundedSOVQuery()` — generates search-grounded SOV response with `citedSources` from `generateText().sources`. Extended `SOVQueryResult` type with optional `citedSources: { url, title }[]`. Extended `runMultiModelSOVQuery()` to include Google engine when `hasApiKey('sov-query-google')` is true. Updated `writeSOVResults()` to write `cited_sources` JSONB. Extracted shared `buildSOVPrompt()`.
- `supabase/migrations/20260227000003_sov_cited_sources.sql` — **NEW.** Adds `cited_sources JSONB` column to `sov_evaluations`.
- `supabase/prod_schema.sql` — **MODIFIED.** Added `cited_sources` column.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `cited_sources: Json | null` to sov_evaluations types.
- `app/dashboard/ai-responses/` — **MODIFIED.** Added "Google AI Overview" engine tab. Shows citation source URLs as clickable links below response text when `cited_sources` is non-null. Engine label mapping updated: `google` → "Google AI Overview".
- `supabase/seed.sql` — **MODIFIED.** Added Google sov_evaluation seed row (UUID c3eebc99). Updated UUID reference card.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Extended `MOCK_SOV_RESPONSE` with Google engine entry including `citedSources`. Added standalone `MOCK_GOOGLE_SOV_RESULT` fixture.

**Tests added:**
- `src/__tests__/unit/sov-google-grounded.test.ts` — **N Vitest tests.** Google SOV query runner, multi-model inclusion/exclusion, graceful failure, citedSources parsing, writeSOVResults with cited_sources.
- `src/__tests__/unit/sov-engine-service.test.ts` — **+2 tests (N total).** SOVQueryResult google type, citedSources in writeSOVResults.
- `src/__tests__/unit/ai-responses-google.test.ts` — **N Vitest tests.** Google AI Overview tab rendering, citation source display, hide when null/empty.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/sov-google-grounded.test.ts      # N tests passing
npx vitest run src/__tests__/unit/sov-engine-service.test.ts       # N tests passing
npx vitest run src/__tests__/unit/ai-responses-google.test.ts      # N tests passing
npx vitest run                                                      # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| Multi-model SOV pattern | Sprint 61 (§36.2) | `runMultiModelSOVQuery()`, `Promise.allSettled`, `canRunMultiModelSOV` |
| SOV Engine service | Sprint 41 | `writeSOVResults()`, `SOVQueryResult` type, prompt building |
| "AI Says" Response Library | Sprint 69 | Display page for `sov_evaluations.raw_response` per engine |
| Google provider in `lib/ai/providers.ts` | Sprint 60 | `truth-audit-gemini` model key already registered, `@ai-sdk/google` installed |
| `sov_evaluations` table | Migration `20260221000004` | Engine-specific SOV results storage |
| `GOOGLE_GENERATIVE_AI_API_KEY` env var | Sprint 60 | Already configured for truth-audit-gemini |
| Golden Tenant `MOCK_SOV_RESPONSE` | Sprint 69 | SOV response fixture with engine array |

---

## 🧠 Edge Cases to Handle

1. **No Google API key:** `hasApiKey('sov-query-google')` returns `false` → engine skipped entirely. `runMultiModelSOVQuery()` returns Perplexity + OpenAI results only. No error, no partial result.
2. **Google rate limit or 500 error:** `Promise.allSettled` catches the rejection. Other engines still return successfully. Google result is omitted from that run.
3. **Google returns no sources:** Some queries may not trigger search grounding. `sources` may be `undefined` or empty array. `citedSources` is set to `[]` — the "Sources Google Cited" section is hidden in the UI.
4. **Starter/Trial plans:** `canRunMultiModelSOV()` returns `false` → `runMultiModelSOVQuery()` is never called → Google engine never runs. These plans use single-model Perplexity only.
5. **"AI Says" page with no Google evaluations:** The Google tab should not appear at all if no `engine='google'` evaluations exist for this query. Don't show an empty tab.
6. **Mixed evaluation dates:** Google may have been added mid-subscription. Older queries won't have Google results. The UI must handle per-query engine availability gracefully.
7. **`sov_evaluations.engine` varchar length:** `'google'` is 6 chars, well within `varchar(20)` limit.
8. **Cost:** Gemini 2.0 Flash is low-cost ($0.10/1M input tokens). Search grounding adds per-query search cost. Only Growth+ orgs (paying customers) run this engine, and it's gated behind the weekly SOV cron — not on-demand.

---

## 🔮 AI_RULES Update

Add to AI_RULES §19.3 model key registry table:

```
| `sov-query-google` | Google Gemini 2.0 Flash + Search Grounding | `generateText` | SOV Engine — Google AI Overview simulation. Uses `useSearchGrounding: true` for search-grounded responses with cited source URLs. |
```

Update §36.2 Multi-Model SOV:

```
Growth and Agency orgs run SOV queries against Perplexity, OpenAI, and Google (search-grounded) in parallel, tripling AI coverage. Starter/Trial orgs use single-model (Perplexity only).

- **Engine tracking:** `SOVQueryResult.engine` field (`'perplexity'` | `'openai'` | `'google'`).
- **Citation sources:** Google engine returns `citedSources: { url, title }[]` from search grounding. Stored in `sov_evaluations.cited_sources` JSONB. NULL for non-Google engines.
- **Model keys:** `'sov-query'` (Perplexity), `'sov-query-openai'` (OpenAI), `'sov-query-google'` (Google + Search Grounding).
```
