# Sprint 81 — AI Sentiment Tracker

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **AI Sentiment Tracker** — not just "does AI mention you?" but "HOW does AI describe you?" Track the emotional tone and specific descriptors AI engines use when discussing the business.

**Why it's different from SOV:** SOV tells you frequency. Sentiment tells you quality. A restaurant mentioned in 60% of queries but described as "mediocre" or "overpriced" has a sentiment problem that SOV alone won't reveal.

**The killer insight:** "ChatGPT describes your competitor as 'premium and trendy.' It describes you as 'affordable but inconsistent.' Here's a content strategy to shift that narrative."

**Architecture:** Lightweight AI extraction pass (`gpt-4o-mini` via `generateObject`) runs on `sov_evaluations.raw_response` during the SOV cron. Extracts descriptors, sentiment score, and tone. Stores results in new JSONB columns on `sov_evaluations`. Dashboard page shows per-engine sentiment, descriptor word cloud, and trend over time. No new tables.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules (esp §19.3, §4, §30)
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — sov_evaluations table, visibility_analytics.sentiment_gap
Read lib/supabase/database.types.ts            — Full Database type (§38)
Read lib/ai/providers.ts                       — Model key registry (§19.3)
Read lib/ai/schemas.ts                         — Zod schema + zodSchema() pattern (§19.3)
Read lib/services/sov-engine.service.ts        — SOV query runner (extraction hooks here)
Read lib/inngest/functions/sov-cron.ts         — SOV cron fan-out (add sentiment step here)
Read app/api/cron/sov/route.ts                 — SOV cron route (inline fallback)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read app/dashboard/ai-responses/               — "AI Says" page (sentiment integrates here)
```

---

## 🏗️ Architecture — What to Build

### Data Flow

```
SOV cron runs weekly
    │
    ├── runMultiModelSOVQuery() → SOVQueryResult[] (existing)
    │
    ├── writeSOVResults() → INSERT into sov_evaluations (existing)
    │
    └── NEW: extractSentiment(rawResponse, businessName) per result
              │
              ├── generateObject({ schema: SentimentSchema }) via gpt-4o-mini
              │
              └── UPDATE sov_evaluations SET sentiment_data = { ... }
                    WHERE id = <evaluation_id>

Dashboard page: /dashboard/sentiment
    │
    ├── Per-engine sentiment breakdown
    ├── Descriptor word display (positive / negative / neutral)
    ├── Sentiment trend over time (from visibility_analytics.sentiment_gap)
    └── Competitor sentiment comparison (from competitor_intercepts)
```

---

### Component 1: Migration — `supabase/migrations/20260226000010_sentiment_data.sql`

Add `sentiment_data` JSONB column to `sov_evaluations`.

```sql
-- Sprint 81: Add sentiment analysis data to SOV evaluations
ALTER TABLE public.sov_evaluations
  ADD COLUMN IF NOT EXISTS sentiment_data JSONB;

-- Index for querying sentiment by org over time
CREATE INDEX IF NOT EXISTS idx_sov_evaluations_sentiment
  ON public.sov_evaluations (org_id, created_at DESC)
  WHERE sentiment_data IS NOT NULL;

COMMENT ON COLUMN public.sov_evaluations.sentiment_data IS 'Extracted sentiment analysis from raw_response: { score, label, descriptors, tone }';
```

**Update `database.types.ts`:** Add `sentiment_data: Json | null` to `sov_evaluations` Row/Insert/Update types. Follow the exact pattern of existing nullable JSONB columns.

---

### Component 2: Sentiment Schema — `lib/ai/schemas.ts`

Add Zod schema for structured sentiment extraction.

```typescript
import { z } from 'zod';

/**
 * Sprint 81 — Sentiment extraction schema.
 * Used with generateObject() to extract sentiment from SOV raw_response.
 */
export const SentimentExtractionSchema = z.object({
  /** Overall sentiment score: -1.0 (very negative) to 1.0 (very positive) */
  score: z.number().min(-1).max(1),

  /** Sentiment label */
  label: z.enum(['very_positive', 'positive', 'neutral', 'negative', 'very_negative']),

  /** Descriptors used about the business, categorized */
  descriptors: z.object({
    positive: z.array(z.string()).describe('Positive adjectives/phrases used about the business (e.g., "popular", "premium", "highly rated")'),
    negative: z.array(z.string()).describe('Negative adjectives/phrases used about the business (e.g., "inconsistent", "overpriced", "slow service")'),
    neutral: z.array(z.string()).describe('Neutral descriptors (e.g., "located in", "offers", "serves")'),
  }),

  /** Overall tone of how AI presents the business */
  tone: z.enum([
    'enthusiastic',     // Strong recommendation with superlatives
    'positive',         // Clear recommendation, good description
    'matter_of_fact',   // Factual, no strong opinion
    'mixed',            // Both positive and negative elements
    'cautious',         // Hedging, uncertain language
    'negative',         // Discouraging, negative framing
  ]),

  /** Is the business the primary recommendation or an also-mentioned? */
  recommendation_strength: z.enum(['primary', 'secondary', 'mentioned', 'not_mentioned']),
});

export type SentimentExtraction = z.infer<typeof SentimentExtractionSchema>;
```

**IMPORTANT:** Wrap with `zodSchema()` when passing to `generateObject` — per §19.3 note about Zod v4 compatibility:
```typescript
import { zodSchema } from '@/lib/ai/schemas';

const { object } = await generateObject({
  model: getModel('sentiment-extract'),
  schema: zodSchema(SentimentExtractionSchema),
  prompt: ...,
});
```

---

### Component 3: New Model Key — `lib/ai/providers.ts`

```typescript
// Sprint 81 — Sentiment extraction (cheap, structured output)
'sentiment-extract': openai('gpt-4o-mini'),
```

Uses `gpt-4o-mini` — cheap ($0.15/1M input) and fast. Sentiment extraction is a lightweight classification task that doesn't need frontier reasoning.

---

### Component 4: Sentiment Extractor Service — `lib/services/sentiment.service.ts`

```typescript
import { generateObject } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { SentimentExtractionSchema, zodSchema, type SentimentExtraction } from '@/lib/ai/schemas';

/**
 * Extract sentiment from an AI engine's raw response about a business.
 * Uses gpt-4o-mini for cheap, fast structured output.
 *
 * Returns null if:
 * - No API key available
 * - rawResponse is null/empty
 * - Business not mentioned in response
 * - Extraction fails
 */
export async function extractSentiment(
  rawResponse: string | null,
  businessName: string,
): Promise<SentimentExtraction | null> {
  if (!rawResponse || rawResponse.trim().length === 0) return null;
  if (!hasApiKey('sentiment-extract')) return null;

  // Quick check: is the business even mentioned?
  if (!rawResponse.toLowerCase().includes(businessName.toLowerCase())) {
    return {
      score: 0,
      label: 'neutral',
      descriptors: { positive: [], negative: [], neutral: [] },
      tone: 'matter_of_fact',
      recommendation_strength: 'not_mentioned',
    };
  }

  try {
    const { object } = await generateObject({
      model: getModel('sentiment-extract'),
      schema: zodSchema(SentimentExtractionSchema),
      system: buildSentimentSystemPrompt(),
      prompt: buildSentimentPrompt(rawResponse, businessName),
    });

    return object;
  } catch (err) {
    console.error('[sentiment] Extraction failed:', err);
    return null;
  }
}

function buildSentimentSystemPrompt(): string {
  return `You are a sentiment analysis specialist for local business AI mentions. You analyze how AI engines describe businesses and extract the emotional tone, specific descriptors, and recommendation strength.

Focus on:
- Adjectives and phrases used specifically about the target business
- Whether the business is recommended enthusiastically, matter-of-factly, or cautiously
- Whether any negative language or caveats are used
- The overall emotional framing (positive, neutral, negative)

Be precise with descriptors — extract the actual words used, not paraphrases.`;
}

function buildSentimentPrompt(rawResponse: string, businessName: string): string {
  return `Analyze the sentiment toward "${businessName}" in this AI-generated response:

---
${rawResponse}
---

Extract:
1. An overall sentiment score from -1.0 (very negative) to 1.0 (very positive)
2. A sentiment label (very_positive, positive, neutral, negative, very_negative)
3. Specific descriptors used about "${businessName}" categorized as positive, negative, or neutral
4. The overall tone of presentation
5. Whether "${businessName}" is the primary recommendation, secondary, merely mentioned, or not mentioned`;
}

// ── Aggregate helpers (pure functions) ────────────────

export interface SentimentSummary {
  /** Average sentiment score across all evaluations */
  averageScore: number;
  /** Most common sentiment label */
  dominantLabel: SentimentExtraction['label'];
  /** Most common tone */
  dominantTone: SentimentExtraction['tone'];
  /** All positive descriptors (deduplicated, sorted by frequency) */
  topPositive: string[];
  /** All negative descriptors (deduplicated, sorted by frequency) */
  topNegative: string[];
  /** Per-engine breakdown */
  byEngine: Record<string, {
    averageScore: number;
    label: SentimentExtraction['label'];
    tone: SentimentExtraction['tone'];
    descriptors: { positive: string[]; negative: string[] };
  }>;
  /** Evaluation count */
  evaluationCount: number;
}

/**
 * Aggregate sentiment data from multiple evaluations into a summary.
 * Pure function — no I/O.
 */
export function aggregateSentiment(
  evaluations: Array<{
    engine: string;
    sentiment_data: SentimentExtraction | null;
  }>,
): SentimentSummary {
  const withSentiment = evaluations.filter(
    (e): e is typeof e & { sentiment_data: SentimentExtraction } => e.sentiment_data !== null,
  );

  if (withSentiment.length === 0) {
    return {
      averageScore: 0,
      dominantLabel: 'neutral',
      dominantTone: 'matter_of_fact',
      topPositive: [],
      topNegative: [],
      byEngine: {},
      evaluationCount: 0,
    };
  }

  // Average score
  const averageScore = withSentiment.reduce((sum, e) => sum + e.sentiment_data.score, 0) / withSentiment.length;

  // Frequency counts for labels and tones
  const labelCounts = countFrequencies(withSentiment.map(e => e.sentiment_data.label));
  const toneCounts = countFrequencies(withSentiment.map(e => e.sentiment_data.tone));

  // Descriptor aggregation
  const allPositive: string[] = [];
  const allNegative: string[] = [];
  for (const e of withSentiment) {
    allPositive.push(...e.sentiment_data.descriptors.positive);
    allNegative.push(...e.sentiment_data.descriptors.negative);
  }

  // Per-engine breakdown
  const byEngine: SentimentSummary['byEngine'] = {};
  const engineGroups = groupBy(withSentiment, e => e.engine);
  for (const [engine, evals] of Object.entries(engineGroups)) {
    const engineAvg = evals.reduce((s, e) => s + e.sentiment_data.score, 0) / evals.length;
    const engineLabels = countFrequencies(evals.map(e => e.sentiment_data.label));
    const engineTones = countFrequencies(evals.map(e => e.sentiment_data.tone));
    const enginePositive: string[] = [];
    const engineNegative: string[] = [];
    for (const e of evals) {
      enginePositive.push(...e.sentiment_data.descriptors.positive);
      engineNegative.push(...e.sentiment_data.descriptors.negative);
    }
    byEngine[engine] = {
      averageScore: Math.round(engineAvg * 100) / 100,
      label: topKey(engineLabels) as SentimentExtraction['label'],
      tone: topKey(engineTones) as SentimentExtraction['tone'],
      descriptors: {
        positive: dedupeByFrequency(enginePositive).slice(0, 10),
        negative: dedupeByFrequency(engineNegative).slice(0, 10),
      },
    };
  }

  return {
    averageScore: Math.round(averageScore * 100) / 100,
    dominantLabel: topKey(labelCounts) as SentimentExtraction['label'],
    dominantTone: topKey(toneCounts) as SentimentExtraction['tone'],
    topPositive: dedupeByFrequency(allPositive).slice(0, 15),
    topNegative: dedupeByFrequency(allNegative).slice(0, 15),
    byEngine,
    evaluationCount: withSentiment.length,
  };
}

// ── Utility helpers ───────────────────────────────────

function countFrequencies<T extends string>(items: T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

function topKey<T extends string>(counts: Record<T, number>): T {
  return Object.entries(counts).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] as T;
}

function dedupeByFrequency(items: string[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const lower = item.toLowerCase();
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([word]) => word);
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    (groups[key] ??= []).push(item);
  }
  return groups;
}
```

---

### Component 5: Sentiment Integration into SOV Pipeline

#### 5A. SOV Engine Service — `lib/services/sov-engine.service.ts`

After `runMultiModelSOVQuery()` returns results, add a sentiment extraction step. **Do not modify `runMultiModelSOVQuery` itself** — add a new export:

```typescript
import { extractSentiment } from '@/lib/services/sentiment.service';

/**
 * Run sentiment extraction on SOV results.
 * Call this AFTER writeSOVResults() so we have evaluation IDs.
 * Returns a map of evaluation_id → SentimentExtraction.
 * Side-effect resilient: failures return null per evaluation.
 */
export async function extractSOVSentiment(
  results: Array<{ evaluationId: string; rawResponse: string | null; engine: string }>,
  businessName: string,
): Promise<Map<string, SentimentExtraction | null>> {
  const entries = await Promise.allSettled(
    results.map(async (r) => {
      const sentiment = await extractSentiment(r.rawResponse, businessName);
      return [r.evaluationId, sentiment] as const;
    }),
  );

  const map = new Map<string, SentimentExtraction | null>();
  for (const entry of entries) {
    if (entry.status === 'fulfilled') {
      map.set(entry.value[0], entry.value[1]);
    }
  }
  return map;
}
```

#### 5B. Data Writer — Extend `writeSOVResults()` or add `writeSentimentData()`

```typescript
/**
 * Update sov_evaluations with extracted sentiment data.
 * Called after extractSOVSentiment().
 * Side-effect resilient: individual failures don't abort the batch.
 */
export async function writeSentimentData(
  supabase: SupabaseClient<Database>,
  sentimentMap: Map<string, SentimentExtraction | null>,
): Promise<void> {
  for (const [evaluationId, sentiment] of sentimentMap) {
    if (sentiment === null) continue;
    await supabase
      .from('sov_evaluations')
      .update({ sentiment_data: sentiment as unknown as Json })
      .eq('id', evaluationId)
      .then(({ error }) => {
        if (error) console.error(`[sentiment] Write failed for ${evaluationId}:`, error);
      });
  }
}
```

#### 5C. Inngest SOV Cron — `lib/inngest/functions/sov-cron.ts`

Add a new step after the SOV write step:

```typescript
// Existing: step.run('write-sov-results', ...)
// The write step should return evaluation IDs

// NEW: step.run('extract-sentiment', ...)
await step.run(`sentiment-${org.id}`, async () => {
  const supabase = createServiceRoleClient();
  // evaluationResults should include { evaluationId, rawResponse, engine }
  const sentimentMap = await extractSOVSentiment(evaluationResults, businessName);
  await writeSentimentData(supabase, sentimentMap);
});
```

**IMPORTANT:** The sentiment step is a **separate Inngest step** after the SOV write. This means:
1. SOV results are persisted BEFORE sentiment extraction starts
2. If sentiment extraction fails entirely, the SOV data is still safe
3. Per §17, individual extraction failures don't abort the batch

Read `lib/inngest/functions/sov-cron.ts` carefully to understand the exact step structure and where to add this. The sentiment step must come AFTER `writeSOVResults` returns the inserted evaluation IDs.

Similarly update the inline fallback in `app/api/cron/sov/route.ts`.

---

### Component 6: Data Fetcher — `lib/data/sentiment.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { aggregateSentiment, type SentimentSummary, type SentimentExtraction } from '@/lib/services/sentiment.service';

/**
 * Fetch sentiment data for the dashboard.
 * Returns aggregated sentiment across all recent evaluations.
 */
export async function fetchSentimentSummary(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  options?: { dayRange?: number },
): Promise<SentimentSummary> {
  const dayRange = options?.dayRange ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayRange);

  const { data: evaluations } = await supabase
    .from('sov_evaluations')
    .select('engine, sentiment_data')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .not('sentiment_data', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false });

  return aggregateSentiment(
    (evaluations ?? []).map(e => ({
      engine: e.engine,
      sentiment_data: e.sentiment_data as SentimentExtraction | null,
    })),
  );
}

/**
 * Fetch sentiment trend over time for charting.
 * Groups evaluations by week and computes average score per week.
 */
export async function fetchSentimentTrend(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  options?: { weekCount?: number },
): Promise<Array<{ weekStart: string; averageScore: number; evaluationCount: number }>> {
  const weekCount = options?.weekCount ?? 12;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weekCount * 7);

  const { data: evaluations } = await supabase
    .from('sov_evaluations')
    .select('created_at, sentiment_data')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .not('sentiment_data', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true });

  // Group by ISO week
  const weeks = new Map<string, { scores: number[]; count: number }>();
  for (const e of evaluations ?? []) {
    const sentiment = e.sentiment_data as SentimentExtraction | null;
    if (!sentiment) continue;

    const date = new Date(e.created_at);
    const weekStart = getWeekStart(date).toISOString().split('T')[0];

    const week = weeks.get(weekStart) ?? { scores: [], count: 0 };
    week.scores.push(sentiment.score);
    week.count++;
    weeks.set(weekStart, week);
  }

  return [...weeks.entries()].map(([weekStart, { scores, count }]) => ({
    weekStart,
    averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
    evaluationCount: count,
  }));
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
```

---

### Component 7: Dashboard Page — `app/dashboard/sentiment/page.tsx`

Server Component displaying sentiment analysis.

```
Page Layout:
┌─────────────────────────────────────────────┐
│ AI Sentiment Analysis                       │
│ How AI engines describe your business       │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─── Overall Sentiment ──────────────────┐  │
│ │ Score: 0.65 (Positive)                 │  │
│ │ Tone: Enthusiastic                     │  │
│ │ Based on 24 evaluations (30 days)      │  │
│ └────────────────────────────────────────┘  │
│                                             │
│ ┌─── What AI Says About You ─────────────┐  │
│ │ ✅ popular, premium, unique atmosphere  │  │
│ │    highly rated, Indo-American fusion   │  │
│ │                                         │  │
│ │ ⚠️ limited parking (1 mention)          │  │
│ └─────────────────────────────────────────┘  │
│                                             │
│ ┌─── Per-Engine Breakdown ───────────────┐  │
│ │ Perplexity:  0.72 ███████▋   Positive  │  │
│ │ ChatGPT:     0.65 ██████▌    Positive  │  │
│ │ Copilot:     0.50 █████      Neutral   │  │
│ │ Google:      0.70 ███████    Positive   │  │
│ └─────────────────────────────────────────┘  │
│                                             │
│ ┌─── Sentiment Trend ────────────────────┐  │
│ │ (placeholder for trend chart —         │  │
│ │  line chart showing weekly average)    │  │
│ └─────────────────────────────────────────┘  │
│                                             │
│ No sentiment data yet? Run your first SOV  │
│ queries to start tracking sentiment.       │
└─────────────────────────────────────────────┘
```

**Sub-Components:**

**`SentimentScoreCard`** — Overall sentiment with score, label, tone, evaluation count. Use color coding: score > 0.3 = green, > -0.3 = amber, else red.

**`DescriptorDisplay`** — Positive descriptors shown as green-tinted tags, negative as red-tinted tags. NOT a word cloud (too complex for V1) — simple tag list sorted by frequency.

**`EngineBreakdownCard`** — Per-engine sentiment with horizontal bar showing score. Include engine label from `ENGINE_LABELS` mapping (same as AI Says page).

**`SentimentTrendPlaceholder`** — For V1, show a simple text-based trend summary (e.g., "Sentiment has improved +0.12 over the past 4 weeks"). A proper chart component (Recharts) can be layered in a future sprint.

**Empty state:** "No sentiment data yet. Sentiment analysis runs automatically with your weekly SOV queries. Once you have SOV results, you'll see how each AI engine describes your business."

---

### Component 8: Error Boundary — `app/dashboard/sentiment/error.tsx`

Standard error boundary.

---

### Component 9: Sidebar Entry

```typescript
{
  label: 'AI Sentiment',
  href: '/dashboard/sentiment',
  icon: Heart,  // or SmilePlus, MessageCircleHeart — pick from lucide-react
  testId: 'nav-sentiment',
}
```

---

### Component 10: Golden Tenant Fixture — `src/__fixtures__/golden-tenant.ts`

```typescript
import type { SentimentExtraction } from '@/lib/ai/schemas';

/**
 * Sprint 81 — Canonical sentiment extraction for Charcoal N Chill.
 * Positive overall, with one minor negative descriptor.
 */
export const MOCK_SENTIMENT_EXTRACTION: SentimentExtraction = {
  score: 0.72,
  label: 'positive',
  descriptors: {
    positive: ['popular', 'premium atmosphere', 'unique', 'highly rated', 'Indo-American fusion'],
    negative: ['limited parking'],
    neutral: ['located in Alpharetta', 'offers hookah'],
  },
  tone: 'enthusiastic',
  recommendation_strength: 'primary',
};

/**
 * Sprint 81 — Canonical sentiment summary for dashboard.
 */
export const MOCK_SENTIMENT_SUMMARY: import('@/lib/services/sentiment.service').SentimentSummary = {
  averageScore: 0.65,
  dominantLabel: 'positive',
  dominantTone: 'positive',
  topPositive: ['popular', 'premium', 'unique atmosphere', 'highly rated', 'Indo-American fusion'],
  topNegative: ['limited parking'],
  byEngine: {
    perplexity: {
      averageScore: 0.72,
      label: 'positive',
      tone: 'enthusiastic',
      descriptors: { positive: ['popular', 'premium'], negative: [] },
    },
    openai: {
      averageScore: 0.65,
      label: 'positive',
      tone: 'positive',
      descriptors: { positive: ['highly rated', 'unique'], negative: ['limited parking'] },
    },
    copilot: {
      averageScore: 0.50,
      label: 'neutral',
      tone: 'matter_of_fact',
      descriptors: { positive: ['well-reviewed'], negative: [] },
    },
  },
  evaluationCount: 12,
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/sentiment-service.test.ts`

**Target: `lib/services/sentiment.service.ts`**

```
describe('extractSentiment')
  1.  returns null when rawResponse is null
  2.  returns null when rawResponse is empty string
  3.  returns null when hasApiKey returns false
  4.  returns not_mentioned result when business name not in response
  5.  calls generateObject with sentiment-extract model key
  6.  returns SentimentExtraction on happy path
  7.  returns null when generateObject throws

describe('aggregateSentiment')
  Empty input:
  8.  returns zero/neutral defaults for empty evaluations array
  9.  returns zero evaluationCount for all-null sentiment_data

  Score calculation:
  10. computes average score across evaluations
  11. rounds averageScore to 2 decimal places

  Dominant label/tone:
  12. selects most frequent label as dominantLabel
  13. selects most frequent tone as dominantTone

  Descriptors:
  14. aggregates positive descriptors across all evaluations
  15. aggregates negative descriptors across all evaluations
  16. deduplicates descriptors (case-insensitive)
  17. sorts descriptors by frequency (most common first)
  18. limits topPositive to 15 items
  19. limits topNegative to 15 items

  Per-engine breakdown:
  20. groups evaluations by engine
  21. computes per-engine average score
  22. computes per-engine dominant label
  23. computes per-engine descriptors (max 10 each)

  Integration:
  24. produces valid SentimentSummary from MOCK evaluations
  25. handles mixed engines with different sentiments

describe('utility functions')
  26. countFrequencies counts occurrences correctly
  27. dedupeByFrequency preserves order by frequency
  28. groupBy groups items by key function
```

**28 tests total.**

### Test File 2: `src/__tests__/unit/sentiment-data.test.ts`

**Target: `lib/data/sentiment.ts`**

```
describe('fetchSentimentSummary')
  1.  queries sov_evaluations filtered by org_id and location_id
  2.  filters to evaluations with non-null sentiment_data
  3.  defaults to 30-day range
  4.  respects custom dayRange option
  5.  returns aggregated SentimentSummary

describe('fetchSentimentTrend')
  6.  groups evaluations by ISO week
  7.  computes weekly average score
  8.  returns sorted by weekStart ascending
  9.  defaults to 12 weeks
```

**9 tests total.**

### Test File 3: `src/__tests__/unit/sentiment-extraction-integration.test.ts`

**Target: `extractSOVSentiment()` + `writeSentimentData()`**

```
describe('extractSOVSentiment')
  1.  runs extractSentiment for each result in parallel
  2.  returns Map of evaluationId → SentimentExtraction
  3.  handles individual extraction failures gracefully
  4.  skips results with null rawResponse

describe('writeSentimentData')
  5.  updates sov_evaluations.sentiment_data for each entry
  6.  skips null sentiment entries
  7.  logs errors but doesn't throw on individual write failures
```

**7 tests total.**

### Test File 4: `src/__tests__/unit/sentiment-page.test.ts`

**Target: Dashboard page + sidebar**

```
describe('Sentiment page')
  1.  renders overall sentiment score
  2.  renders descriptor tags (positive and negative)
  3.  renders per-engine breakdown
  4.  renders empty state when no sentiment data

describe('Sidebar')
  5.  shows AI Sentiment link with test-id nav-sentiment
```

**5 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `supabase/migrations/20260226000010_sentiment_data.sql` | **CREATE** | Add `sentiment_data` JSONB to `sov_evaluations` |
| 2 | `lib/supabase/database.types.ts` | **MODIFY** | Add `sentiment_data: Json \| null` to sov_evaluations |
| 3 | `lib/ai/schemas.ts` | **MODIFY** | Add `SentimentExtractionSchema` + type export |
| 4 | `lib/ai/providers.ts` | **MODIFY** | Add `sentiment-extract` model key (gpt-4o-mini) |
| 5 | `lib/services/sentiment.service.ts` | **CREATE** | `extractSentiment()`, `aggregateSentiment()`, helpers |
| 6 | `lib/services/sov-engine.service.ts` | **MODIFY** | Add `extractSOVSentiment()`, `writeSentimentData()` |
| 7 | `lib/inngest/functions/sov-cron.ts` | **MODIFY** | Add sentiment extraction step after SOV write |
| 8 | `app/api/cron/sov/route.ts` | **MODIFY** | Add sentiment extraction to inline fallback |
| 9 | `lib/data/sentiment.ts` | **CREATE** | `fetchSentimentSummary()`, `fetchSentimentTrend()` |
| 10 | `app/dashboard/sentiment/page.tsx` | **CREATE** | Dashboard page — score, descriptors, engine breakdown |
| 11 | `app/dashboard/sentiment/error.tsx` | **CREATE** | Error boundary |
| 12 | `app/dashboard/_components/` | **MODIFY** | Sidebar — add AI Sentiment link |
| 13 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_SENTIMENT_EXTRACTION, MOCK_SENTIMENT_SUMMARY |
| 14 | `src/__tests__/unit/sentiment-service.test.ts` | **CREATE** | 28 tests — extraction + aggregation |
| 15 | `src/__tests__/unit/sentiment-data.test.ts` | **CREATE** | 9 tests — data layer |
| 16 | `src/__tests__/unit/sentiment-extraction-integration.test.ts` | **CREATE** | 7 tests — pipeline integration |
| 17 | `src/__tests__/unit/sentiment-page.test.ts` | **CREATE** | 5 tests — page + sidebar |

**Expected test count: 49 new tests across 4 files.**

---

## 🚫 What NOT to Do

1. **DO NOT use a heavy NLP library (nltk, spaCy, etc.).** Use `gpt-4o-mini` via `generateObject` for structured sentiment extraction. It's cheaper than running a separate NLP pipeline and produces better results for AI response text.
2. **DO NOT modify `runMultiModelSOVQuery()`.** Sentiment extraction is a post-processing step that runs AFTER SOV results are written. Keep the SOV query pipeline clean.
3. **DO NOT block SOV writes on sentiment extraction.** Sentiment is a separate Inngest step (or separate async call in inline fallback). SOV data is persisted first. If sentiment fails, SOV data is safe.
4. **DO NOT create a new table.** `sentiment_data` is a JSONB column on the existing `sov_evaluations` table.
5. **DO NOT use raw `fetch()` to call OpenAI** (AI_RULES §19.3). Use `generateObject` via `getModel('sentiment-extract')`.
6. **DO NOT define the Zod schema inline.** Put it in `lib/ai/schemas.ts` and wrap with `zodSchema()`.
7. **DO NOT forget `zodSchema()` wrapper** — Zod v4 schemas need it for `generateObject` compatibility.
8. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
9. **DO NOT add plan gating.** Sentiment data enriches SOV evaluations for all tiers. The dashboard page is available to all.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] Migration adds `sentiment_data JSONB` to `sov_evaluations`
- [ ] `database.types.ts` updated with `sentiment_data` field
- [ ] `SentimentExtractionSchema` in `lib/ai/schemas.ts` with `zodSchema()` wrapper
- [ ] `sentiment-extract` model key in providers (gpt-4o-mini)
- [ ] `extractSentiment()` service with business-name pre-check, error handling
- [ ] `aggregateSentiment()` pure function with per-engine breakdown
- [ ] `extractSOVSentiment()` + `writeSentimentData()` pipeline functions
- [ ] Inngest SOV cron has sentiment extraction step (after SOV write)
- [ ] Inline SOV fallback includes sentiment extraction
- [ ] `fetchSentimentSummary()` + `fetchSentimentTrend()` data fetchers
- [ ] Dashboard page at `/dashboard/sentiment` with score, descriptors, engine breakdown, empty state
- [ ] Sidebar updated with "AI Sentiment" link (test-id: `nav-sentiment`)
- [ ] Golden Tenant: MOCK_SENTIMENT_EXTRACTION + MOCK_SENTIMENT_SUMMARY
- [ ] `npx vitest run src/__tests__/unit/sentiment-service.test.ts` — 28 tests passing
- [ ] `npx vitest run src/__tests__/unit/sentiment-data.test.ts` — 9 tests passing
- [ ] `npx vitest run src/__tests__/unit/sentiment-extraction-integration.test.ts` — 7 tests passing
- [ ] `npx vitest run src/__tests__/unit/sentiment-page.test.ts` — 5 tests passing
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 81: AI Sentiment Tracker (Completed)

**Goal:** Track not just whether AI mentions the business, but HOW it describes it — positive/negative descriptors, tone, recommendation strength. Answers "ChatGPT calls you 'affordable but inconsistent' while calling your competitor 'premium and trendy.'"

**Scope:**
- `supabase/migrations/20260226000010_sentiment_data.sql` — **NEW.** Adds `sentiment_data JSONB` to `sov_evaluations`. Partial index on `(org_id, created_at DESC) WHERE sentiment_data IS NOT NULL`.
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `sentiment_data: Json | null` to sov_evaluations Row/Insert/Update.
- `lib/ai/schemas.ts` — **MODIFIED.** Added `SentimentExtractionSchema` (Zod): score (-1 to 1), label (5 levels), descriptors (positive/negative/neutral arrays), tone (6 options), recommendation_strength (4 levels). Exported type `SentimentExtraction`.
- `lib/ai/providers.ts` — **MODIFIED.** Added `sentiment-extract` model key: `openai('gpt-4o-mini')`.
- `lib/services/sentiment.service.ts` — **NEW.** `extractSentiment()` — lightweight AI extraction via `generateObject`. Pre-checks: null/empty response returns null, missing API key returns null, business name not in response returns quick `not_mentioned` result (no API call). `aggregateSentiment()` — pure aggregation function. Computes average score, dominant label/tone, deduped descriptors sorted by frequency, per-engine breakdown. Utility helpers: `countFrequencies`, `dedupeByFrequency`, `groupBy`, `topKey`.
- `lib/services/sov-engine.service.ts` — **MODIFIED.** Added `extractSOVSentiment()` (parallel extraction via `Promise.allSettled`) and `writeSentimentData()` (per-evaluation UPDATE with error logging).
- `lib/inngest/functions/sov-cron.ts` — **MODIFIED.** Added sentiment extraction step after SOV write step. Separate Inngest step so SOV data is safe even if sentiment fails.
- `app/api/cron/sov/route.ts` — **MODIFIED.** Added sentiment extraction to inline fallback.
- `lib/data/sentiment.ts` — **NEW.** `fetchSentimentSummary()` (30-day default, filters non-null sentiment_data), `fetchSentimentTrend()` (12-week default, grouped by ISO week).
- `app/dashboard/sentiment/page.tsx` — **NEW.** Server Component. Overall sentiment score card, descriptor tag display (positive green / negative red), per-engine breakdown with horizontal score bars, empty state message.
- `app/dashboard/sentiment/error.tsx` — **NEW.** Standard error boundary.
- `app/dashboard/_components/` — **MODIFIED.** Sidebar: added "AI Sentiment" link (test-id: nav-sentiment).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_SENTIMENT_EXTRACTION` and `MOCK_SENTIMENT_SUMMARY`.

**Tests added:**
- `src/__tests__/unit/sentiment-service.test.ts` — **N Vitest tests.** extractSentiment (null/empty/no-key/not-mentioned/happy-path/error). aggregateSentiment (empty/score-calc/dominant-label/descriptors/dedup/per-engine). Utility functions.
- `src/__tests__/unit/sentiment-data.test.ts` — **N Vitest tests.** Summary query (org scope, date range, aggregation). Trend query (week grouping, weekly average).
- `src/__tests__/unit/sentiment-extraction-integration.test.ts` — **N Vitest tests.** Pipeline (parallel extraction, write, error handling).
- `src/__tests__/unit/sentiment-page.test.ts` — **N Vitest tests.** Page rendering, sidebar link.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/sentiment-service.test.ts                    # N tests passing
npx vitest run src/__tests__/unit/sentiment-data.test.ts                       # N tests passing
npx vitest run src/__tests__/unit/sentiment-extraction-integration.test.ts     # N tests passing
npx vitest run src/__tests__/unit/sentiment-page.test.ts                       # N tests passing
npx vitest run                                                                  # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `sov_evaluations.raw_response` | Sprint 41+ | Text to analyze for sentiment |
| Multi-model SOV pipeline | Sprint 61 (§36.2) | Multiple engine responses to compare |
| Inngest SOV cron fan-out | Sprint 49 (§30) | Step-based pipeline to extend |
| AI SDK + `generateObject` | Sprint 28+ (§19.3) | Structured output extraction |
| `visibility_analytics.sentiment_gap` | Schema | Pre-existing column for aggregate sentiment storage |
| `zodSchema()` wrapper | Sprint 58 (§19.3) | Zod v4 compatibility for `generateObject` |
| "AI Says" engine labels | Sprint 69/74/79 | Engine label mapping reuse |

---

## 🧠 Edge Cases to Handle

1. **No SOV evaluations yet:** Dashboard shows empty state. No sentiment extraction runs.
2. **SOV result with null raw_response:** `extractSentiment` returns null. Evaluation skipped.
3. **Business name not in response:** Quick return with `not_mentioned` — no API call. This saves tokens when AI didn't actually mention the business.
4. **`gpt-4o-mini` unavailable (no OpenAI key):** `hasApiKey` check returns false → null sentiment for all. SOV data still persists normally.
5. **Extraction returns malformed data:** `generateObject` with Zod schema validation catches this. If parse fails, catch block returns null.
6. **Same descriptor across multiple engines:** `dedupeByFrequency` aggregates case-insensitively. "Popular" from Perplexity and "popular" from ChatGPT count as 2 occurrences of "popular".
7. **All negative sentiment:** Score near -1.0, label `very_negative`, topPositive empty. UI should handle this gracefully — no green tags, just red.
8. **Mixed sentiment across engines:** Per-engine breakdown reveals differences. "Perplexity loves you (+0.8), Copilot is lukewarm (+0.2)" is the actionable insight.
9. **Historical evaluations (pre-Sprint 81):** `sentiment_data` is null. Dashboard filters these out. Old evaluations can be backfilled via a one-time migration script (future sprint).

---

## 🔮 AI_RULES Updates

Update §19.3 model key registry:

```
| `sentiment-extract` | OpenAI gpt-4o-mini | `generateObject` | Sentiment extraction from SOV raw_response. Uses `SentimentExtractionSchema`. Lightweight classification — doesn't need frontier reasoning. |
```

Add new rule:

```markdown
## 44. 🎭 AI Sentiment Extraction Pipeline (Sprint 81)

Sentiment extraction runs as a post-processing step in the SOV cron pipeline.

* **Extraction:** `extractSentiment()` in `lib/services/sentiment.service.ts` — uses `generateObject` with `SentimentExtractionSchema` via `gpt-4o-mini`.
* **Pre-checks:** Returns null for empty/null response, missing API key, or business not mentioned (no API call).
* **Pipeline position:** Runs AFTER `writeSOVResults()` as a separate Inngest step. SOV data is safe even if sentiment fails.
* **Storage:** `sov_evaluations.sentiment_data` JSONB — score, label, descriptors, tone, recommendation_strength.
* **Aggregation:** `aggregateSentiment()` is a pure function — deduped descriptors by frequency, per-engine breakdown.
* **Side-effect resilient (§17):** Individual extraction failures don't abort the batch.
```
