# Sprint 79 — Copilot/Bing Monitoring

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Add **Microsoft Copilot/Bing monitoring** as the fourth SOV query engine. Copilot uses Bing's index — a fundamentally different data source than Google (used by Gemini), Perplexity, or ChatGPT. A restaurant with a complete Google Business Profile but an empty Bing Places listing has a split personality across AI engines.

**Unique data unlock:** "You're visible in ChatGPT but invisible in Copilot. Your Bing Places listing is missing hours/photos — that's why Copilot doesn't recommend you."

**Effort: S (Small).** This sprint follows the exact pattern established in Sprint 74 (Google engine). It's a new model key, a new runner function inside the existing multi-model SOV, and a new engine tab in the "AI Says" page. No new tables, no new migrations, no new infrastructure.

**Implementation approach:** Use the OpenAI API with a Copilot-simulation system prompt. Copilot is powered by GPT-4o with Bing grounding. Since the Bing Search API was retired in August 2025 and the replacement ("Grounding with Bing Search") requires Azure AI Foundry at $35/1K transactions, the practical V1 approach is to use a GPT-4o model with a system prompt that instructs it to answer as Copilot would — emphasizing Bing Places, Yelp, and TripAdvisor data sources (the citation sources Copilot actually uses for local queries).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules (esp §19.3, §36.2)
Read CLAUDE.md                                 — Project context + architecture
Read lib/ai/providers.ts                       — Model key registry (§19.3) — ADD NEW KEY HERE
Read lib/services/sov-engine.service.ts        — SOV query runner + multi-model pattern
Read lib/plan-enforcer.ts                      — canRunMultiModelSOV() (Growth+)
Read app/dashboard/ai-responses/               — "AI Says" page — add Copilot tab
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read supabase/prod_schema.sql                  — sov_evaluations.engine is varchar(20)
```

---

## 🏗️ Architecture — What to Build

### Component 1: New Model Key — `lib/ai/providers.ts`

```typescript
// Sprint 79 — Copilot simulation via OpenAI GPT-4o
'sov-query-copilot': openai('gpt-4o'),
```

This uses the same OpenAI GPT-4o model as `sov-query-openai` but with a **different system prompt** (Component 2) that simulates Copilot's Bing-grounded behavior.

**No new env var.** Uses the existing `OPENAI_API_KEY`.

**Fallback:** `hasApiKey('sov-query-copilot')` delegates to the existing OpenAI API key check. If OpenAI is unavailable, the Copilot engine is skipped.

---

### Component 2: Copilot SOV Runner — `lib/services/sov-engine.service.ts`

Add `runCopilotSOVQuery()` alongside the existing runners.

```typescript
/**
 * Run a SOV query simulating Microsoft Copilot (Bing-grounded).
 * Uses GPT-4o with a system prompt that emphasizes Bing Places,
 * Yelp, and TripAdvisor data sources — the citation sources
 * Copilot actually uses for local business queries.
 */
export async function runCopilotSOVQuery(
  queryText: string,
  businessName: string,
  city: string,
  state: string,
): Promise<SOVQueryResult> {
  const model = getModel('sov-query-copilot');

  const { text } = await generateText({
    model,
    system: buildCopilotSystemPrompt(),
    prompt: buildSOVPrompt(queryText, businessName, city, state),
  });

  const parsed = parseSOVResponse(text, businessName);

  return {
    engine: 'copilot' as const,
    rawResponse: text,
    rankPosition: parsed.rankPosition,
    mentionedCompetitors: parsed.mentionedCompetitors,
  };
}
```

#### Copilot System Prompt

The key differentiator is the system prompt. Copilot draws from Bing's index, which for local businesses means Bing Places, Yelp, TripAdvisor, and local directory listings — fundamentally different from Google's data sources.

```typescript
function buildCopilotSystemPrompt(): string {
  return `You are Microsoft Copilot, an AI assistant powered by Bing search. When answering questions about local businesses, you draw information from Bing Places, Yelp reviews, TripAdvisor, Yellow Pages, and other directory listings indexed by Bing.

Your responses reflect what Bing's search index knows about local businesses. You prioritize:
- Bing Places business listings (hours, photos, descriptions)
- Yelp reviews and ratings
- TripAdvisor ratings and reviews
- Local directory listings and aggregator sites
- Social media presence discoverable through Bing

If a business has a strong Google Business Profile but limited presence on Bing Places, Yelp, or TripAdvisor, you may not have complete or accurate information about them.

Provide specific, factual recommendations with business names and details. If you're uncertain about a business's current status, note that.`;
}
```

#### Extend `runMultiModelSOVQuery()`

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

  // Sprint 74: Google engine
  if (hasApiKey('sov-query-google')) {
    promises.push(runGoogleGroundedSOVQuery(queryText, businessName, city, state));
  }

  // Sprint 79: Copilot engine
  if (hasApiKey('sov-query-copilot')) {
    promises.push(runCopilotSOVQuery(queryText, businessName, city, state));
  }

  const settled = await Promise.allSettled(promises);
  return settled
    .filter((r): r is PromiseFulfilledResult<SOVQueryResult> => r.status === 'fulfilled')
    .map(r => r.value);
}
```

#### Extend `SOVQueryResult.engine` type

```typescript
export interface SOVQueryResult {
  engine: 'perplexity' | 'openai' | 'google' | 'copilot';  // ← add 'copilot'
  rawResponse: string;
  rankPosition: number | null;
  mentionedCompetitors: string[];
  citedSources?: { url: string; title: string }[];
}
```

---

### Component 3: "AI Says" — Copilot Tab

Update the "AI Says" Response Library (`app/dashboard/ai-responses/`) to display Copilot results.

**Engine label mapping update:**
```typescript
const ENGINE_LABELS: Record<string, string> = {
  perplexity: 'Perplexity',
  openai: 'ChatGPT',
  google: 'Google AI Overview',
  copilot: 'Microsoft Copilot',  // ← NEW
};
```

**Tab behavior:** The Copilot tab appears only when `sov_evaluations` rows with `engine='copilot'` exist for the selected query. Same conditional rendering pattern as the Google tab (Sprint 74).

**Copilot insight box (below response text):**
```
💡 Copilot Insight: Microsoft Copilot uses Bing's index,
   not Google's. If you're visible in ChatGPT but not here,
   check your Bing Places listing and Yelp profile.
```

This static insight text only shows on the Copilot tab. Render it as a styled info card below the raw response text, using the same layout pattern as the Google cited-sources card (Sprint 74).

---

### Component 4: Golden Tenant Fixture — `src/__fixtures__/golden-tenant.ts`

Add Copilot engine to `MOCK_SOV_RESPONSE.engines`:

```typescript
{
  engine: 'copilot',
  rankPosition: 2,
  rawResponse:
    'Based on Bing Places and Yelp reviews, Charcoal N Chill in Alpharetta is a well-reviewed hookah lounge offering Indo-American fusion cuisine. Cloud 9 Lounge is another popular option in the area.',
  mentionedCompetitors: ['Cloud 9 Lounge'],
  createdAt: '2026-02-26T12:15:00.000Z',
},
```

Add standalone fixture:

```typescript
/**
 * Sprint 79 — Canonical Copilot SOV result fixture.
 */
export const MOCK_COPILOT_SOV_RESULT: import('@/lib/services/sov-engine.service').SOVQueryResult = {
  engine: 'copilot',
  rawResponse: 'Based on Bing Places and Yelp reviews, Charcoal N Chill in Alpharetta is a well-reviewed hookah lounge.',
  rankPosition: 2,
  mentionedCompetitors: ['Cloud 9 Lounge'],
};
```

---

### Component 5: Seed Data — `supabase/seed.sql`

Add Copilot `sov_evaluations` seed row:

```sql
-- Sprint 79: Copilot SOV evaluation
-- UUID: c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
INSERT INTO public.sov_evaluations (id, org_id, location_id, query_id, engine, rank_position, mentioned_competitors, raw_response, created_at) VALUES
  ('c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'copilot', 2,
   '["Cloud 9 Lounge"]'::jsonb,
   'Based on Bing Places and Yelp reviews, Charcoal N Chill is a well-reviewed hookah lounge in Alpharetta.',
   NOW());
```

Register UUID `c4eebc99` in the seed file's UUID reference card.

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/sov-copilot.test.ts`

**Target: `lib/services/sov-engine.service.ts` — Copilot-specific functions**

```
describe('runCopilotSOVQuery')
  1.  returns engine='copilot' in result
  2.  returns parsed rankPosition from response text
  3.  returns parsed mentionedCompetitors from response text
  4.  returns rawResponse containing full text
  5.  returns rankPosition=null when business not mentioned
  6.  uses 'sov-query-copilot' model key

describe('buildCopilotSystemPrompt')
  7.  includes 'Bing' in system prompt
  8.  includes 'Yelp' in system prompt
  9.  includes 'TripAdvisor' in system prompt
  10. includes 'Bing Places' in system prompt

describe('runMultiModelSOVQuery — with Copilot')
  11. includes Copilot result when hasApiKey('sov-query-copilot') is true
  12. excludes Copilot when hasApiKey('sov-query-copilot') is false
  13. returns all 4 engines when all API keys present (perplexity, openai, google, copilot)
  14. handles Copilot failure gracefully (Promise.allSettled)
  15. continues with other engines when Copilot fails
```

**15 tests total.**

**Mock requirements:**
```typescript
vi.mock('ai', () => ({ generateText: vi.fn() }));
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));
```

### Test File 2: `src/__tests__/unit/ai-responses-copilot.test.ts`

**Target: "AI Says" page — Copilot engine tab**

```
describe('AI Says — Microsoft Copilot')
  1.  renders "Microsoft Copilot" tab when copilot engine data present
  2.  does not render Copilot tab when no copilot evaluations exist
  3.  shows response text for copilot engine
  4.  shows Copilot insight box about Bing Places/Yelp
  5.  does not show insight box for non-copilot engines
```

**5 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/ai/providers.ts` | **MODIFY** | Add `sov-query-copilot` model key |
| 2 | `lib/services/sov-engine.service.ts` | **MODIFY** | Add `runCopilotSOVQuery()`, `buildCopilotSystemPrompt()`, extend `runMultiModelSOVQuery()`, extend `SOVQueryResult.engine` type |
| 3 | `app/dashboard/ai-responses/` | **MODIFY** | Add Copilot tab + insight box |
| 4 | `supabase/seed.sql` | **MODIFY** | Add Copilot sov_evaluation seed row |
| 5 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Extend MOCK_SOV_RESPONSE, add MOCK_COPILOT_SOV_RESULT |
| 6 | `src/__tests__/unit/sov-copilot.test.ts` | **CREATE** | 15 tests — Copilot SOV runner |
| 7 | `src/__tests__/unit/ai-responses-copilot.test.ts` | **CREATE** | 5 tests — AI Says Copilot tab |

**Expected test count: 20 new tests across 2 files.**

---

## 🚫 What NOT to Do

1. **DO NOT use the Bing Search API or Azure AI Foundry.** Bing Search APIs were retired August 2025 and the replacement requires Azure infrastructure + $35/1K transactions. Use the OpenAI API simulation approach.
2. **DO NOT create a new model_provider enum value.** `microsoft-copilot` already exists in the enum (it's for `ai_hallucinations.model_provider`). `sov_evaluations.engine` is `varchar(20)` — `'copilot'` works directly.
3. **DO NOT create new tables or migrations.** This sprint only adds a new engine to existing tables.
4. **DO NOT duplicate the SOV prompt.** Reuse `buildSOVPrompt()` (the shared query prompt function). The Copilot differentiation is entirely in the system prompt.
5. **DO NOT create a new plan enforcer function.** Copilot uses the existing `canRunMultiModelSOV()` gate (Growth+).
6. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
7. **DO NOT block on Copilot when other engines fail** — `Promise.allSettled` pattern.
8. **DO NOT add new env vars.** Reuses `OPENAI_API_KEY`.
9. **DO NOT create files under `supabase/functions/`** (AI_RULES §6).

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `sov-query-copilot` model key registered in `lib/ai/providers.ts`
- [ ] `runCopilotSOVQuery()` function with Bing-focused system prompt
- [ ] `buildCopilotSystemPrompt()` emphasizes Bing Places, Yelp, TripAdvisor
- [ ] `runMultiModelSOVQuery()` includes Copilot when API key present
- [ ] `SOVQueryResult.engine` type includes `'copilot'`
- [ ] "AI Says" page shows "Microsoft Copilot" tab with insight box
- [ ] Seed data has Copilot sov_evaluation row (UUID c4eebc99)
- [ ] Golden Tenant: MOCK_SOV_RESPONSE extended, MOCK_COPILOT_SOV_RESULT added
- [ ] `npx vitest run src/__tests__/unit/sov-copilot.test.ts` — 15 tests passing
- [ ] `npx vitest run src/__tests__/unit/ai-responses-copilot.test.ts` — 5 tests passing
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 79: Copilot/Bing Monitoring (Completed)

**Goal:** Add Microsoft Copilot as the fourth SOV query engine, covering the Bing data ecosystem (Bing Places, Yelp, TripAdvisor) — a fundamentally different citation source set than Google/ChatGPT/Perplexity. +14% AI market coverage.

**Scope:**
- `lib/ai/providers.ts` — **MODIFIED.** Added `sov-query-copilot` model key: `openai('gpt-4o')`. Reuses existing `OPENAI_API_KEY`. No new env var.
- `lib/services/sov-engine.service.ts` — **MODIFIED.** Added `runCopilotSOVQuery()` with Copilot-simulation system prompt emphasizing Bing Places, Yelp, TripAdvisor data sources. Added `buildCopilotSystemPrompt()`. Extended `runMultiModelSOVQuery()` to include Copilot when `hasApiKey('sov-query-copilot')` is true. Extended `SOVQueryResult.engine` type to include `'copilot'`.
- `app/dashboard/ai-responses/` — **MODIFIED.** Added "Microsoft Copilot" engine tab. Copilot-specific insight box: "Copilot uses Bing's index, not Google's. If you're visible in ChatGPT but not here, check your Bing Places listing and Yelp profile." Engine label mapping: `copilot` → "Microsoft Copilot".
- `supabase/seed.sql` — **MODIFIED.** Added Copilot sov_evaluation seed row (UUID c4eebc99). Updated UUID reference card.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Extended `MOCK_SOV_RESPONSE` with Copilot engine entry. Added standalone `MOCK_COPILOT_SOV_RESULT` fixture.

**Tests added:**
- `src/__tests__/unit/sov-copilot.test.ts` — **N Vitest tests.** Copilot runner returns correct engine, parsed rank/competitors, system prompt contains Bing/Yelp/TripAdvisor. Multi-model includes/excludes Copilot based on API key. Graceful failure via Promise.allSettled.
- `src/__tests__/unit/ai-responses-copilot.test.ts` — **N Vitest tests.** Copilot tab rendering, insight box, conditional display.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/sov-copilot.test.ts              # N tests passing
npx vitest run src/__tests__/unit/ai-responses-copilot.test.ts     # N tests passing
npx vitest run                                                      # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| Multi-model SOV + `Promise.allSettled` | Sprint 61 (§36.2) | `runMultiModelSOVQuery()`, engine-aware fan-out |
| Google engine pattern | Sprint 74 | Template for adding new SOV engines |
| `sov-query-openai` model key | Sprint 61 | Same OpenAI provider, different system prompt |
| "AI Says" engine tabs | Sprint 69/74 | Tab pattern with conditional engine display |
| `sov_evaluations.engine` varchar(20) | Schema | Accepts `'copilot'` without migration |
| `canRunMultiModelSOV()` plan gating | Sprint 61 | Growth+ gate for multi-model SOV |

---

## 🧠 Edge Cases to Handle

1. **No OpenAI API key:** Both `sov-query-openai` and `sov-query-copilot` use the same key. If it's missing, both engines are skipped — Perplexity and Google still run.
2. **Copilot result similar to OpenAI result:** Expected in some cases since both use GPT-4o. The system prompt differentiation produces meaningfully different responses for local queries due to Bing vs. Google citation emphasis. The value is in the DIFFERENCE between engines.
3. **"AI Says" with no Copilot evaluations:** Copilot tab doesn't render. Older queries pre-Sprint 79 won't have Copilot data.
4. **Rate limiting:** Copilot runner shares the OpenAI rate limit with `sov-query-openai`. The cron runs weekly with concurrency limits (§30.4), so this is manageable.
5. **5 engines total (future):** With Perplexity, OpenAI, Google, Copilot, and potentially more in future sprints, `Promise.allSettled` handles any number of engines gracefully. No architectural changes needed.

---

## 🔮 AI_RULES Updates

Update §19.3 model key registry:

```
| `sov-query-copilot` | OpenAI GPT-4o (Copilot simulation) | `generateText` | SOV Engine — Microsoft Copilot simulation. Uses Bing-focused system prompt emphasizing Bing Places, Yelp, TripAdvisor citation sources. |
```

Update §36.2 Multi-Model SOV:

```
Growth and Agency orgs run SOV queries against Perplexity, OpenAI, Google (search-grounded), and Copilot (Bing-simulated) in parallel. Starter/Trial orgs use single-model (Perplexity only).

- **Engine tracking:** `SOVQueryResult.engine` field (`'perplexity'` | `'openai'` | `'google'` | `'copilot'`).
- **Model keys:** `'sov-query'` (Perplexity), `'sov-query-openai'` (OpenAI), `'sov-query-google'` (Google + Search Grounding), `'sov-query-copilot'` (OpenAI GPT-4o + Copilot system prompt).
```
