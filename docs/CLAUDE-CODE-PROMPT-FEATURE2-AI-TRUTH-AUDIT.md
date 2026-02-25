# Claude Code Prompt #8 — Feature #2: AI Truth Audit (Multi-Engine)

## ⚠️ READ BEFORE ANYTHING ELSE

Read these files in order BEFORE writing any code:
1. `docs/AI_RULES.md` — coding standards (critical: §1 schema, §3 auth, §4 testing, §5 plan gating, §6 architecture, §7 UUID hex, §8 Zod v4)
2. `docs/DESIGN-SYSTEM.md` — visual tokens and component patterns
3. `supabase/prod_schema.sql` — database source of truth
4. `src/__fixtures__/golden-tenant.ts` — test fixture data
5. `lib/ai/providers.ts` — model registry (4 truth-audit keys already registered)
6. `lib/schemas/evaluations.ts` — existing Zod schemas (extend, don't replace)
7. `app/dashboard/hallucinations/page.tsx` — existing hallucinations page (you'll transform it)
8. `app/dashboard/hallucinations/actions.ts` — existing Server Actions (extend)
9. `app/dashboard/hallucinations/_components/EvaluationCard.tsx` — existing single-engine card (replace with multi-engine)
10. `lib/services/revenue-leak.service.ts` — Feature #1 service (import for teaser)

## What This Feature Does

The AI Truth Audit transforms the single-engine hallucination monitor into a multi-engine truth verification system. Instead of "OpenAI says X" or "Perplexity says Y" individually, the user sees:

> **Truth Score: 72/100**
> ChatGPT says ✅ Open | Perplexity says ❌ Permanently Closed | Gemini says ✅ Open | Claude says ✅ Open
> **Consensus: 3 of 4 engines agree you're open. Perplexity is wrong.**

The Truth Score is the product's credibility metric — a single number that tells the user "how truthfully does AI represent your business".

## What Already Exists (Don't Rebuild)

| Asset | Location | Status |
|-------|----------|--------|
| Model registry | `lib/ai/providers.ts` | ✅ 4 truth-audit keys registered |
| ai_evaluations table | `prod_schema.sql` | ✅ Has `engine varchar(20)`, `accuracy_score int 0-100`, `hallucinations_detected jsonb` |
| ai_hallucinations table | `prod_schema.sql` | ✅ Has `model_provider` enum with all 5 engines |
| Evaluation schemas | `lib/schemas/evaluations.ts` | ✅ Has `RunEvaluationSchema`, `EvaluationEngine` type |
| EvaluationCard | `_components/EvaluationCard.tsx` | 🟡 Shows OpenAI + Perplexity only — needs expansion |
| runAIEvaluation action | `hallucinations/actions.ts` | 🟡 Supports openai/perplexity — needs 4 engines |
| ai-audit.service.ts | `lib/services/ai-audit.service.ts` | 🟡 Single-engine only — needs multi-engine |
| Seed data | `supabase/seed.sql` | 🟡 Has 2 evaluations (openai, perplexity) — needs 4 |
| MSW handlers | `src/mocks/handlers.ts` | 🟡 Has openai + perplexity — needs anthropic + google |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Service: lib/services/truth-audit.service.ts (NEW)          │
│    ├─ auditWithEngine(engine, location) → EngineResult       │
│    ├─ runMultiEngineAudit(location) → MultiEngineResult      │
│    └─ calculateTruthScore(results[]) → 0-100                 │
├─────────────────────────────────────────────────────────────┤
│  Schema: lib/schemas/evaluations.ts (EXTEND)                 │
│    ├─ EVALUATION_ENGINES → add 'anthropic', 'gemini'         │
│    └─ RunMultiAuditSchema (new)                              │
├─────────────────────────────────────────────────────────────┤
│  Server Action: hallucinations/actions.ts (EXTEND)           │
│    ├─ runAIEvaluation → support 4 engines                    │
│    └─ runMultiEngineEvaluation (NEW) → parallel 4-engine run │
├─────────────────────────────────────────────────────────────┤
│  UI Components:                                              │
│    ├─ TruthScoreCard.tsx (NEW) — hero score 0-100            │
│    ├─ EngineComparisonGrid.tsx (NEW) — 4-engine side-by-side │
│    └─ EvaluationCard.tsx (MODIFY) — support 4 engines        │
├─────────────────────────────────────────────────────────────┤
│  Tests:                                                      │
│    ├─ truth-audit-service.test.ts — pure function tests       │
│    ├─ multi-engine-action.test.ts — server action tests       │
│    └─ E2E: 10-truth-audit.spec.ts — full flow                │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Extend Evaluation Schema

### 1A — Update `lib/schemas/evaluations.ts`

Extend `EVALUATION_ENGINES` to include all 4 truth-audit engines:

```typescript
export const EVALUATION_ENGINES = ['openai', 'perplexity', 'anthropic', 'gemini'] as const;
export type EvaluationEngine = (typeof EVALUATION_ENGINES)[number];
```

Add a new schema for multi-engine audit:
```typescript
export const RunMultiAuditSchema = z.object({
  location_id: z.string().uuid('A valid location ID is required'),
});
export type RunMultiAuditInput = z.infer<typeof RunMultiAuditSchema>;
```

**CRITICAL:** The existing `RunEvaluationSchema` engine enum must also be updated to accept `'anthropic'` and `'gemini'`. This is automatic because it references `EVALUATION_ENGINES`.

---

## Phase 2: Truth Audit Service (NEW)

Create `lib/services/truth-audit.service.ts`:

This is a **pure logic** service for Truth Score calculation. The actual AI API calls happen in the Server Action (which has access to env vars and the Vercel AI SDK), not in this service.

### Truth Score Model

The Truth Score (0-100) measures multi-engine consensus on business accuracy:

```
For each engine result:
  engine_score = accuracy_score from the evaluation (0-100)

truth_score = weighted_average(engine_scores)

Weights:
  openai:     0.30  (most used consumer AI)
  perplexity: 0.30  (search-augmented, most influential for local)
  gemini:     0.20  (Google ecosystem)
  anthropic:  0.20  (growing market share)

If fewer than 2 engines have results → truth_score = null (insufficient data)
If all engines agree (all scores >= 80) → bonus: min(truth_score + 5, 100)
If any engine reports "closed" hallucination → penalty: truth_score - 15 (floor 0)
```

### Consensus Detection

```typescript
export interface EngineVerdict {
  engine: EvaluationEngine;
  accuracy_score: number;
  is_closed_hallucination: boolean;  // critical: AI says business is closed
  hallucination_count: number;
  response_summary: string;  // first 200 chars of response_text
}

export interface TruthAuditResult {
  truth_score: number | null;
  verdicts: EngineVerdict[];
  consensus: {
    engines_agree: number;     // how many agree business is open
    engines_disagree: number;  // how many say closed/wrong
    total_engines: number;
    summary: string;           // e.g. "3 of 4 engines agree you're open"
  };
  worst_engine: string | null;  // engine with lowest accuracy
  best_engine: string | null;   // engine with highest accuracy
}
```

### Service Interface

```typescript
// lib/services/truth-audit.service.ts

export const ENGINE_WEIGHTS: Record<string, number> = {
  openai: 0.30,
  perplexity: 0.30,
  gemini: 0.20,
  anthropic: 0.20,
};

export function calculateTruthScore(verdicts: EngineVerdict[]): number | null { ... }

export function detectConsensus(verdicts: EngineVerdict[]): TruthAuditResult['consensus'] { ... }

export function buildTruthAuditResult(verdicts: EngineVerdict[]): TruthAuditResult { ... }
```

**CRITICAL:** Every number must be `Math.round()`. Use `Math.round(x * 100) / 100`.

---

## Phase 3: Unit Tests for Service (Write FIRST — AI_RULES §4)

Create `src/__tests__/unit/truth-audit-service.test.ts`:

```
describe('truth-audit.service')
  describe('calculateTruthScore')
    ✓ returns null when fewer than 2 engine verdicts
    ✓ calculates weighted average for 4 engines (95, 65, 88, 90 → ~84)
    ✓ applies +5 consensus bonus when all engines score >= 80
    ✓ applies -15 closed-hallucination penalty when any engine reports closed
    ✓ penalty floors at 0 (never negative)
    ✓ handles 2-engine scenario correctly (uses only available weights, renormalized)
    ✓ handles 3-engine scenario correctly

  describe('detectConsensus')
    ✓ returns 4/4 agree when no engine reports closed
    ✓ returns 3/4 agree when 1 engine reports closed
    ✓ returns 0/4 agree when all engines report closed
    ✓ generates correct summary string

  describe('buildTruthAuditResult')
    ✓ identifies worst_engine (lowest accuracy)
    ✓ identifies best_engine (highest accuracy)
    ✓ returns null worst/best when no verdicts
    ✓ golden tenant scenario: openai=95, perplexity=65, gemini=88, anthropic=90
```

Use explicit hand-calculated expected values for every test.

**Golden tenant expected calculation:**
```
openai:     95 × 0.30 = 28.50
perplexity: 65 × 0.30 = 19.50
gemini:     88 × 0.20 = 17.60
anthropic:  90 × 0.20 = 18.00
raw = 83.60
no bonus (perplexity < 80)
perplexity has 2 hallucinations but is_closed_hallucination = false for golden tenant
→ truth_score = 84 (rounded)
worst_engine = 'perplexity'
best_engine = 'openai'
consensus: 4 agree, 0 disagree (no closed hallucinations in golden tenant)
```

---

## Phase 4: Extend Server Actions

### 4A — Update `callEngine()` helper

In `app/dashboard/hallucinations/actions.ts`, replace/extend the engine-specific `callOpenAI()` and `callPerplexity()` functions with a unified helper that uses the Vercel AI SDK:

```typescript
import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';

// Map EvaluationEngine to model registry keys and API key providers
const ENGINE_MAP: Record<EvaluationEngine, { modelKey: ModelKey; apiKeyProvider: string }> = {
  openai:     { modelKey: 'truth-audit-openai',     apiKeyProvider: 'openai' },
  perplexity: { modelKey: 'truth-audit-perplexity', apiKeyProvider: 'perplexity' },
  anthropic:  { modelKey: 'truth-audit-anthropic',  apiKeyProvider: 'anthropic' },
  gemini:     { modelKey: 'truth-audit-gemini',      apiKeyProvider: 'google' },
};

async function callEngine(
  engine: EvaluationEngine,
  prompt: string,
): Promise<EvaluationResult> {
  const config = ENGINE_MAP[engine];
  if (!hasApiKey(config.apiKeyProvider as any)) {
    return mockResult(engine);
  }

  try {
    const { text } = await generateText({
      model: getModel(config.modelKey),
      prompt,
    });

    // Parse JSON response (same robust parsing as before)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      accuracy_score: Math.min(100, Math.max(0, Number(parsed.accuracy_score ?? 0))),
      hallucinations_detected: Array.isArray(parsed.hallucinations_detected)
        ? (parsed.hallucinations_detected as string[])
        : [],
      response_text: String(parsed.response_text ?? text),
    };
  } catch {
    return mockResult(engine);
  }
}
```

**IMPORTANT:** Keep the existing raw `callOpenAI()` and `callPerplexity()` functions as-is for backwards compatibility. Add `callEngine()` as a NEW unified helper. The existing `runAIEvaluation()` action should be updated to use `callEngine()` for all 4 engines.

### 4B — Add `runMultiEngineEvaluation()` Server Action

New Server Action that runs all 4 engines in parallel:

```typescript
export async function runMultiEngineEvaluation(
  input: RunMultiAuditInput
): Promise<MultiEngineActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = RunMultiAuditSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { location_id } = parsed.data;

  // Fetch location ground truth
  const supabase = (await createClient()) as any;
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('id, business_name, address_line1, city, state, zip, phone, website_url')
    .eq('id', location_id)
    .single();

  if (locError || !location) {
    return { success: false, error: 'Location not found' };
  }

  const prompt = buildPrompt(location);

  // Run all 4 engines in parallel
  const engines: EvaluationEngine[] = ['openai', 'perplexity', 'anthropic', 'gemini'];
  const results = await Promise.allSettled(
    engines.map(engine => callEngine(engine, prompt))
  );

  // Process results and insert into ai_evaluations
  const verdicts: EngineVerdict[] = [];

  for (let i = 0; i < engines.length; i++) {
    const engine = engines[i];
    const settled = results[i];
    const result = settled.status === 'fulfilled'
      ? settled.value
      : mockResult(engine);

    // Insert evaluation row
    await supabase.from('ai_evaluations').insert({
      org_id: ctx.orgId,
      location_id,
      engine,
      prompt_used: prompt,
      response_text: result.response_text,
      accuracy_score: result.accuracy_score,
      hallucinations_detected: result.hallucinations_detected,
    });

    // Build verdict for truth score calculation
    const isClosedHallucination = result.hallucinations_detected.some(
      (h: string) => h.toLowerCase().includes('closed') || h.toLowerCase().includes('permanently')
    );

    verdicts.push({
      engine,
      accuracy_score: result.accuracy_score,
      is_closed_hallucination: isClosedHallucination,
      hallucination_count: result.hallucinations_detected.length,
      response_summary: result.response_text.slice(0, 200),
    });
  }

  // Calculate truth score
  const truthResult = buildTruthAuditResult(verdicts);

  revalidatePath('/dashboard/hallucinations');
  return { success: true, data: truthResult };
}
```

### 4C — Update `mockResult()` function

Extend the mock to cover all 4 engines:

```typescript
function mockResult(engine: EvaluationEngine): EvaluationResult {
  const keyNames: Record<EvaluationEngine, string> = {
    openai: 'OPENAI_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
  };
  return {
    accuracy_score: 80,
    hallucinations_detected: [
      `Mock evaluation — no ${keyNames[engine]} is configured in .env.local.`,
    ],
    response_text: `[MOCK] Simulated ${engine} response. Configure the API key to run a real audit.`,
  };
}
```

---

## Phase 5: Dashboard UI Components

### 5A — Create TruthScoreCard (NEW)

Create `app/dashboard/hallucinations/_components/TruthScoreCard.tsx`:

The hero card showing the composite Truth Score:

```
┌─────────────────────────────────────────────────────┐
│  🔍 AI Truth Audit                                   │
│                                                       │
│          ┌──────────┐                                │
│          │    72    │  ← large circular gauge         │
│          │  /100    │                                │
│          └──────────┘                                │
│                                                       │
│  3 of 4 AI engines agree your business is accurate   │
│                                                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │ GPT  │ │ Pplx │ │ Gem  │ │ Clde │               │
│  │  95  │ │  65  │ │  88  │ │  90  │               │
│  │  ✅  │ │  ❌  │ │  ✅  │ │  ✅  │               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
│                                                       │
│  ⚠️ Perplexity reports 2 inaccuracies                │
│                                                       │
│  [Run Full Truth Audit ▶]                            │
└─────────────────────────────────────────────────────┘
```

Design tokens:
- Card: `bg-surface-dark border border-white/5 rounded-2xl`
- Score circle: Use SVG circle with stroke-dasharray for gauge effect
  - Score >= 80: `text-signal-green` / `stroke-signal-green`
  - Score 60-79: `text-alert-amber` / `stroke-alert-amber`
  - Score < 60: `text-alert-crimson` / `stroke-alert-crimson`
- Engine chips: `bg-midnight-slate rounded-xl px-3 py-2`
- "Run Full Truth Audit" button: `bg-electric-indigo hover:bg-electric-indigo/90 text-white rounded-lg px-4 py-2`

**Props:**
```typescript
interface TruthScoreCardProps {
  truthResult: TruthAuditResult | null;
  locationId: string;
  locationLabel: string;
  isLoading: boolean;
  onRunAudit: () => void;
}
```

### 5B — Create EngineComparisonGrid (NEW)

Create `app/dashboard/hallucinations/_components/EngineComparisonGrid.tsx`:

Side-by-side view of what each engine says. Each engine gets a column:

```typescript
interface EngineComparisonGridProps {
  verdicts: EngineVerdict[];
  evaluations: Record<string, EngineEval>;  // keyed by engine name
}
```

For each engine column:
- Engine name + badge
- Accuracy score (colored)
- Hallucinations list (if any)
- Response excerpt (first 200 chars)
- "ChatGPT says: Open ✅" or "Perplexity says: Permanently Closed ❌"

### 5C — Update EvaluationCard (MODIFY)

Update `app/dashboard/hallucinations/_components/EvaluationCard.tsx`:

Add `anthropic` and `gemini` engine rows alongside the existing `openai` and `perplexity` rows. Since `EvaluationEngine` is already updated to include all 4, the card just needs:

1. New props: `anthropicEval: EngineEval` and `geminiEval: EngineEval`
2. Two more `<EngineRow>` components for anthropic and gemini
3. Updated `ENGINE_CONFIG` object with labels for all 4 engines:

```typescript
const ENGINE_CONFIG: Record<EvaluationEngine, { label: string; badge: string; badgeClass: string }> = {
  openai: {
    label: 'OpenAI GPT-4o',
    badge: 'AI',
    badgeClass: 'bg-signal-green/15 text-signal-green',
  },
  perplexity: {
    label: 'Perplexity Sonar',
    badge: 'PX',
    badgeClass: 'bg-electric-indigo/15 text-electric-indigo',
  },
  anthropic: {
    label: 'Anthropic Claude',
    badge: 'CL',
    badgeClass: 'bg-purple-500/15 text-purple-400',
  },
  gemini: {
    label: 'Google Gemini',
    badge: 'GM',
    badgeClass: 'bg-blue-500/15 text-blue-400',
  },
};
```

**Add a "Run All Engines" button** at the top of the card that triggers `runMultiEngineEvaluation()`. Individual engine "Run Audit" buttons remain for targeted re-checks.

### 5D — Update Hallucinations Page Layout

Modify `app/dashboard/hallucinations/page.tsx`:

1. Fetch evaluations for all 4 engines (not just 2)
2. Add TruthScoreCard above the EvaluationCard
3. Add EngineComparisonGrid between TruthScoreCard and hallucinations table
4. Calculate truth score from latest evaluations using `buildTruthAuditResult()`

```typescript
// In fetchPageData, group evaluations by engine:
function latestPerEngine(evaluations: EvaluationRow[], locationId: string): Record<string, EngineEval> {
  const result: Record<string, EngineEval> = {};
  for (const engine of EVALUATION_ENGINES) {
    result[engine] = evaluations.find(
      e => e.location_id === locationId && e.engine === engine
    ) ?? null;
  }
  return result;
}
```

### 5E — Revenue Leak Teaser on Free Scan (OPTIONAL ENHANCEMENT)

In the existing `/scan` result page (`app/scan/_components/ScanDashboard.tsx`), add a teaser card:

```
┌─────────────────────────────────────────┐
│  💰 Revenue Impact Estimate              │
│                                          │
│  Based on this scan, AI inaccuracies     │
│  could be costing you                    │
│  $1,800 – $3,200/month                  │
│                                          │
│  [Get Full Revenue Report →]             │
│                                          │
│  🔒 Requires LocalVector account         │
└─────────────────────────────────────────┘
```

This uses `calculateHallucinationCost()` from Feature #1 with `DEFAULT_CONFIG` to give an estimate based only on the free scan result.

**IMPORTANT:** This is a teaser only — use `DEFAULT_CONFIG` (average restaurant), not real business data. The real number comes after signup.

---

## Phase 6: Seed Data Updates

### 6A — Add evaluation seed rows for Anthropic + Gemini

Add to `supabase/seed.sql` UUID reference card:
```
--   eval_anthropic : f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   eval_gemini    : f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
```

Insert 2 new evaluation rows for the golden tenant:

```sql
-- ── ANTHROPIC EVALUATION (Feature #2 — Multi-Engine Truth Audit) ─────────
INSERT INTO public.ai_evaluations (
  id, org_id, location_id, engine,
  prompt_used, response_text,
  accuracy_score, hallucinations_detected,
  created_at
)
SELECT
  'f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'anthropic',
  'Tell me about Charcoal N Chill restaurant in Alpharetta, GA.',
  'Charcoal N Chill is an Indian-fusion restaurant and hookah lounge located at 11950 Jones Bridge Road in Alpharetta, Georgia. They are open from 5 PM daily with extended hours on weekends. Known for their BBQ fusion menu, hookah, and lively atmosphere with live music.',
  90,
  '[]'::jsonb,
  NOW() - INTERVAL '2 hours'
FROM public.locations l WHERE l.slug = 'alpharetta' LIMIT 1
ON CONFLICT DO NOTHING;

-- ── GEMINI EVALUATION (Feature #2 — Multi-Engine Truth Audit) ────────────
INSERT INTO public.ai_evaluations (
  id, org_id, location_id, engine,
  prompt_used, response_text,
  accuracy_score, hallucinations_detected,
  created_at
)
SELECT
  'f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'gemini',
  'Tell me about Charcoal N Chill restaurant in Alpharetta, GA.',
  'Charcoal N Chill is a restaurant and hookah bar in Alpharetta, GA at 11950 Jones Bridge Rd. They serve Indian-American fusion cuisine. The restaurant is open Tuesday through Sunday from 5 PM. They offer hookah, live music on weekends, and private dining.',
  88,
  '["AI reports the restaurant is closed on Mondays, but hours data shows Monday 5-11 PM"]'::jsonb,
  NOW() - INTERVAL '1.5 hours'
FROM public.locations l WHERE l.slug = 'alpharetta' LIMIT 1
ON CONFLICT DO NOTHING;
```

### 6B — Update MSW Handlers

In `src/mocks/handlers.ts`, add handlers for Anthropic and Google APIs:

```typescript
// Anthropic Claude handler
const anthropicHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () => {
    return HttpResponse.json({
      id: 'anthropic-mock-0001',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: JSON.stringify({
        accuracy_score: 90,
        hallucinations_detected: [],
        response_text: '[MOCK] Charcoal N Chill is an Indian-fusion restaurant in Alpharetta, GA.',
      })}],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
    });
  }
);

// Google Gemini handler
const googleHandler = http.post(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  () => {
    return HttpResponse.json({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({
            accuracy_score: 88,
            hallucinations_detected: ['AI reports the restaurant is closed on Mondays'],
            response_text: '[MOCK] Charcoal N Chill serves Indian-American fusion cuisine in Alpharetta.',
          })}],
          role: 'model',
        },
        finishReason: 'STOP',
      }],
    });
  }
);

// Export all handlers
export const handlers = [openAiHandler, perplexityHandler, anthropicHandler, googleHandler, publicPlacesSearchHandler];
```

**IMPORTANT:** Check what actual URL the Vercel AI SDK sends requests to for each provider. The MSW handler URLs must match exactly. Use `console.log` in development to verify if unsure. Common patterns:
- OpenAI: `https://api.openai.com/v1/chat/completions`
- Perplexity: `https://api.perplexity.ai/chat/completions` (OpenAI-compatible)
- Anthropic: `https://api.anthropic.com/v1/messages`
- Google: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`

If using the Vercel AI SDK `generateText()`, the SDK handles the API format internally. The MSW handlers must intercept at the URL the SDK calls, not at a custom URL.

---

## Phase 7: Tests

### 7A — Unit tests for Truth Audit Service

Create `src/__tests__/unit/truth-audit-service.test.ts` — 15 tests covering:
- Truth score calculation with various engine combinations
- Consensus detection with agreement/disagreement
- Edge cases (1 engine, 0 engines, all engines agree, all disagree)
- Golden tenant scenario with hand-calculated expected values

### 7B — Server Action test

Create `src/__tests__/unit/multi-engine-action.test.ts` — 6 tests:
```
✓ returns error when unauthenticated
✓ returns error for invalid location_id
✓ runs all 4 engines in parallel and returns truth result
✓ handles individual engine failures gracefully (uses mock)
✓ inserts 4 evaluation rows into ai_evaluations
✓ revalidates /dashboard/hallucinations path
```

Mock patterns (AI_RULES §4):
- `vi.mock('@/lib/supabase/server')` for Supabase client
- `vi.mock('@/lib/auth')` for `getSafeAuthContext`
- `vi.mock('ai')` for `generateText` — return deterministic JSON responses
- `vi.useFakeTimers()` if mock delay is used

### 7C — E2E test

Create `tests/e2e/10-truth-audit.spec.ts`:

Uses dev@ golden tenant session. Tests:
```
describe('10 — AI Truth Audit: Multi-Engine')
  ✓ hallucinations page shows Truth Score card
  ✓ Truth Score displays numeric score (0-100)
  ✓ engine comparison shows 4 engine badges
  ✓ per-engine accuracy scores are visible
  ✓ "Run All Engines" button triggers parallel audit
  ✓ consensus summary text is displayed
```

**Seed dependency:** The 4 evaluation rows (openai=95, perplexity=65, anthropic=90, gemini=88) must be present in seed.sql.

---

## Phase 8: Verification Sequence

Run in this exact order:

```bash
# 1. Verify schema changes compile
npx tsc --noEmit 2>&1 | grep -v "DashboardShell\|onboarding-actions"

# 2. Run truth audit service tests
npm run test -- src/__tests__/unit/truth-audit-service.test.ts

# 3. Run multi-engine action tests
npm run test -- src/__tests__/unit/multi-engine-action.test.ts

# 4. Full test suite (must not regress)
npm run test

# 5. Build (may fail on Google Fonts in CI — check for real TS errors only)
npm run build

# 6. E2E (only if local Supabase + Playwright available)
# npx playwright test tests/e2e/10-truth-audit.spec.ts
```

---

## Commit Strategy

Split into 3 commits:

**Commit 1: Service + Schema + Seed**
```
feat: add Truth Audit service with multi-engine Truth Score (0-100)

- Created truth-audit.service.ts with weighted score, consensus detection
- Extended EVALUATION_ENGINES to include anthropic + gemini
- Added seed data for 4-engine golden tenant evaluations
- Added MSW handlers for Anthropic + Google AI APIs
- All unit tests passing
```

**Commit 2: Server Actions**
```
feat: multi-engine parallel evaluation Server Action

- Added runMultiEngineEvaluation() — runs 4 engines via Promise.allSettled
- Unified callEngine() helper using Vercel AI SDK generateText()
- Extended mockResult() for all 4 engines
- Server action tests passing
```

**Commit 3: Dashboard UI**
```
feat: Truth Audit dashboard — score card, engine grid, comparison view

- TruthScoreCard: circular gauge with weighted truth score
- EngineComparisonGrid: side-by-side 4-engine verdicts
- Updated EvaluationCard with anthropic + gemini rows
- "Run All Engines" parallel audit button
- E2E tests for truth audit display
```

---

## Rules

- Read AI_RULES.md and prod_schema.sql FIRST
- Tests FIRST, then implementation (Red-Green-Refactor — AI_RULES §4)
- Use `getSafeAuthContext()` in all Server Actions (AI_RULES §3)
- Use golden tenant fixture data for all tests (AI_RULES §4)
- All new UUIDs must be hex-only (AI_RULES §7)
- Zod v4: use `.issues[0]?.message` not `.errors[0]?.message` (AI_RULES §8)
- Use `generateText` from `ai` package + `getModel()` from `@/lib/ai/providers`
- Do NOT create new raw `fetch()` calls to AI APIs — use the Vercel AI SDK
- Do NOT modify `lib/ai/providers.ts` — model keys are already registered
- Do NOT modify `lib/utils.ts`, `lib/chartUtils.ts`, or any Tremor component
- Do NOT delete existing `callOpenAI()` or `callPerplexity()` — add `callEngine()` alongside
- Keep `runAIEvaluation()` working for single-engine runs (backwards compatibility)
- `npm run test` must pass before committing (existing tests must not regress)
- If any existing test breaks, STOP and fix the regression before continuing
- The `engine` column in `ai_evaluations` is `varchar(20)` — 'anthropic' (9 chars) and 'gemini' (6 chars) both fit
