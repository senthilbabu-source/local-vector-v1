# Claude Code Prompt — Sprint 69: "AI Says" Response Library

## ⚠️ READ BEFORE ANYTHING ELSE

Read these files in order BEFORE writing any code:
1. `docs/AI_RULES.md` — all 38 rules. Pay special attention to:
   - §1 (schema source of truth is `prod_schema.sql`)
   - §3 (RLS, `getSafeAuthContext`, org_id server-side)
   - §4 (tests first, golden tenant fixtures, mocking)
   - §5 (no API calls on page load — all data served from DB)
   - §6 (Next.js 16 App Router, Server Components default, Tailwind v4 + shadcn)
   - §11 (RLS shadowban — always add `.eq('org_id', orgId)`)
   - §12 (Tailwind literal classes — no dynamic concatenation)
   - §13 (DEVLOG format, test counts via `grep -cE`)
   - §18 (`createClient()` for page data fetching, never service-role)
   - §20 (never hardcode placeholder metrics — use null/pending)
   - §23 (never show fake timestamps — real DB values or "No data yet")
   - §27 (CSS animation — no framer-motion, use existing keyframes)
   - §34 (Citation/Page Audit dashboard patterns — reuse component conventions)
   - §35.1 (error.tsx boundary for every dashboard section)
   - §35.4 (sidebar `data-testid` convention)
2. `docs/DESIGN-SYSTEM.md` — visual tokens (midnight-slate, surface-dark, signal-green, electric-indigo, alert-crimson, alert-amber, truth-emerald)
3. `supabase/prod_schema.sql` — search for `sov_evaluations` and `target_queries`
4. `lib/supabase/database.types.ts` — Row types for `sov_evaluations`, `target_queries`
5. `src/__fixtures__/golden-tenant.ts` — golden tenant data
6. `app/dashboard/share-of-voice/page.tsx` — existing SOV page (data fetching pattern)
7. `app/dashboard/share-of-voice/_components/SovCard.tsx` — existing query card (extend, don't duplicate)
8. `lib/services/sov-engine.service.ts` — `writeSOVResults()` function (how `raw_response` is written)
9. `lib/schemas/sov.ts` — `SOV_ENGINES`, `SovEngine` type
10. `app/dashboard/citations/page.tsx` — reference for new dashboard page patterns
11. `components/layout/Sidebar.tsx` — verify AI Assistant was added in Sprint 68

---

## What This Sprint Does

Build the **"AI Says" Response Library** — a new dashboard page at `/dashboard/ai-responses` that shows users the **exact text** each AI engine generates when asked about their business. This is the highest wow-per-effort feature in the entire roadmap.

**Why it's the #1 wow feature:** Restaurant owners can literally READ what ChatGPT, Perplexity, etc. tell their customers. They screenshot it, share it with business partners, show it to staff. It makes AI visibility REAL in a way no score or chart can. Seeing a competitor's glowing AI response next to "Not mentioned" for your own business creates urgency that drives action.

**The data already exists.** The `sov_evaluations` table stores `raw_response` TEXT for every evaluation run. The SOV page fetches evaluations but currently only displays `rank_position` and `mentioned_competitors` — it completely ignores `raw_response`. This sprint surfaces that hidden data.

---

## What Already Exists (Don't Rebuild)

| Asset | Location | Status |
|-------|----------|--------|
| `sov_evaluations` table | `prod_schema.sql` | ✅ Has `raw_response TEXT`, `engine VARCHAR(20)`, `query_id UUID`, `created_at` |
| `target_queries` table | `prod_schema.sql` | ✅ Has `query_text VARCHAR(500)`, `query_category` |
| SOV page data fetching | `share-of-voice/page.tsx` | ✅ Fetches evals but skips `raw_response` in select |
| SovCard component | `_components/SovCard.tsx` | ✅ Displays rank + competitors, no response text |
| Seed evaluation data | `supabase/seed.sql` | ✅ One seed row with realistic raw_response text |
| `SOV_ENGINES` type | `lib/schemas/sov.ts` | ✅ `['openai', 'perplexity']` |
| Plan enforcer | `lib/plan-enforcer.ts` | ✅ `canRunSovEvaluation()` (Growth+) |
| Sidebar navigation | `components/layout/Sidebar.tsx` | ✅ Updated in Sprint 68 |
| Dashboard error boundary | `share-of-voice/error.tsx` | ✅ Exists for SOV section |

---

## Architecture Overview

```
Sprint 69 — "AI Says" Response Library
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEW PAGE: /dashboard/ai-responses
├── app/dashboard/ai-responses/
│   ├── page.tsx              — Server Component (data fetching)
│   ├── error.tsx             — Error boundary (AI_RULES §35.1)
│   └── _components/
│       ├── ResponseLibrary.tsx — Client Component (filters, expand/collapse)
│       ├── ResponseCard.tsx    — Single query's AI responses side-by-side
│       └── EngineResponseBlock.tsx — One engine's raw response display
│
SIDEBAR UPDATE:
├── components/layout/Sidebar.tsx — Add nav entry for AI Responses
│
DATA LAYER:
├── lib/data/ai-responses.ts  — Server-side data fetching function
│
SEED DATA:
├── supabase/seed.sql         — Add 2+ more sov_evaluation seeds with raw_response
│
FIXTURE:
├── src/__fixtures__/golden-tenant.ts — Add MOCK_SOV_RESPONSE fixture
│
TESTS:
├── src/__tests__/unit/ai-responses-data.test.ts   — Data layer tests
└── src/__tests__/unit/ai-responses-components.test.ts — Component render tests
```

---

## Phase 1: Data Layer — `lib/data/ai-responses.ts`

### 1A — Create the Data Fetching Function

This is a pure server-side data layer function (same pattern as `lib/data/dashboard.ts`).

**File:** `lib/data/ai-responses.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIResponseEntry {
  queryId: string;
  queryText: string;
  queryCategory: string;
  engines: EngineResponse[];
  latestDate: string;       // ISO date of most recent eval across all engines
}

export interface EngineResponse {
  engine: string;            // 'openai' | 'perplexity'
  rankPosition: number | null;
  rawResponse: string | null;
  mentionedCompetitors: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

export async function fetchAIResponses(
  orgId: string,
  supabase: SupabaseClient<Database>,
): Promise<AIResponseEntry[]> {
  // Fetch queries + latest evaluations in parallel
  const [queryResult, evalResult] = await Promise.all([
    supabase
      .from('target_queries')
      .select('id, query_text, query_category')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true }),

    // Fetch evaluations WITH raw_response (the key difference from SOV page)
    // Ordered newest-first so first match per (query, engine) is latest
    supabase
      .from('sov_evaluations')
      .select('query_id, engine, rank_position, raw_response, mentioned_competitors, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const queries = queryResult.data ?? [];
  const evals = evalResult.data ?? [];

  // Group evaluations by query_id, keeping only the latest per (query, engine)
  const evalsByQuery = new Map<string, EngineResponse[]>();

  for (const ev of evals) {
    if (!evalsByQuery.has(ev.query_id)) {
      evalsByQuery.set(ev.query_id, []);
    }
    const existing = evalsByQuery.get(ev.query_id)!;
    // Only keep the latest eval per engine (evals are newest-first)
    if (!existing.some((e) => e.engine === ev.engine)) {
      existing.push({
        engine: ev.engine,
        rankPosition: ev.rank_position,
        rawResponse: ev.raw_response,
        mentionedCompetitors: (ev.mentioned_competitors as string[]) ?? [],
        createdAt: ev.created_at,
      });
    }
  }

  // Assemble response entries
  return queries
    .map((q) => {
      const engines = evalsByQuery.get(q.id) ?? [];
      if (engines.length === 0) return null; // Skip queries with no evaluations

      const latestDate = engines
        .map((e) => e.createdAt)
        .sort()
        .reverse()[0] ?? '';

      return {
        queryId: q.id,
        queryText: q.query_text,
        queryCategory: q.query_category,
        engines,
        latestDate,
      };
    })
    .filter((entry): entry is AIResponseEntry => entry !== null);
}
```

### ⚠️ EDGE CASES

1. **`raw_response` can be `null`.** If a SOV evaluation was run but the AI response couldn't be parsed, `raw_response` may be null. The UI must handle this gracefully: show "Response not available" or "Run evaluation to see response."

2. **`raw_response` has TWO formats in the codebase:**
   - **In `writeSOVResults()`** (live code): it's stored as `JSON.stringify({ businesses: [...], cited_url: '...' })` — a JSON string, NOT the raw AI text.
   - **In seed data**: it's stored as plain text: `"Here are some of the best BBQ restaurants..."`.
   - **Decision:** The "AI Says" library should show the HUMAN-READABLE text, not the JSON. This means:
     - For seed data (plain text): display as-is.
     - For live data (JSON string): try `JSON.parse()`, and if it succeeds and has a non-useful shape (just `businesses` + `cited_url`), display a "Raw data only — run a new evaluation for full response text" message.
   - **Future improvement (NOT this sprint):** Modify `writeSOVResults()` to ALSO store the full AI text from `generateText()`. Add a `full_ai_response TEXT` column or change what `raw_response` stores. Flag this in the DEVLOG as Sprint 70+ work.

3. **`.limit(500)` on evaluations.** A customer with 20 queries × 2 engines × multiple runs could have thousands of rows. We only need the latest per (query, engine). The limit + newest-first ordering + dedup logic handles this, but be aware of performance for heavy users.

4. **RLS scoping.** The `createClient()` (cookie-based) automatically scopes by authenticated user's org. The explicit `.eq('org_id', orgId)` is belt-and-suspenders (AI_RULES §18).

---

## Phase 2: Page — `app/dashboard/ai-responses/page.tsx`

### 2A — Server Component Page

**Pattern:** Follow the exact structure of `app/dashboard/citations/page.tsx` and `app/dashboard/page-audits/page.tsx` (Sprint 58 dashboards — AI_RULES §34).

```typescript
import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchAIResponses } from '@/lib/data/ai-responses';
import { canRunSovEvaluation, type PlanTier } from '@/lib/plan-enforcer';
import ResponseLibrary from './_components/ResponseLibrary';

export default async function AIResponsesPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const supabase = await createClient();

  // Plan gate — AI Responses require Growth+ (same gate as SOV)
  const { data: orgData } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const plan = (orgData?.plan as string) ?? 'trial';
  const canView = canRunSovEvaluation(plan as PlanTier);

  if (!canView) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-white">AI Says</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            See the exact words AI engines use when describing your business.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center border border-white/5">
          <p className="text-sm font-medium text-[#94A3B8]">
            Upgrade to Growth to see how AI describes your business.
          </p>
          <a
            href="/dashboard/billing"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-signal-green px-4 py-2 text-sm font-medium text-deep-navy transition hover:brightness-110"
          >
            Upgrade Plan
          </a>
        </div>
      </div>
    );
  }

  const entries = await fetchAIResponses(ctx.orgId, supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">AI Says</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          The exact words AI engines use when asked about your business. Screenshot these, share them with your team.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center border border-white/5">
          <p className="text-sm font-medium text-[#94A3B8]">No AI responses yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Run SOV evaluations on your queries first. AI responses will appear here.
          </p>
          <a
            href="/dashboard/share-of-voice"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface-dark px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
          >
            Go to Share of Voice →
          </a>
        </div>
      ) : (
        <ResponseLibrary entries={entries} />
      )}
    </div>
  );
}
```

### 2B — Error Boundary

**File:** `app/dashboard/ai-responses/error.tsx`

Copy the exact pattern from `app/dashboard/share-of-voice/error.tsx` (AI_RULES §35.1). Change the section name to "AI Responses."

---

## Phase 3: Components

### 3A — `ResponseLibrary.tsx` (Client Component)

**File:** `app/dashboard/ai-responses/_components/ResponseLibrary.tsx`

This is the interactive container with filters and expand/collapse. Mark as `'use client'`.

**Features:**
- **Category filter tabs:** "All", "Discovery", "Comparison", "Near Me", "Occasion", "Custom" — filtering by `queryCategory`. Use the same tab styling as Content Drafts filter tabs.
- **Sort:** Latest first (default) by `latestDate`.
- **Count badge:** "12 queries with AI responses" (changes with filter).
- **Expand all / Collapse all** toggle button.

**Props:**

```typescript
interface Props {
  entries: AIResponseEntry[];
}
```

### 3B — `ResponseCard.tsx` (One Query's AI Responses)

**File:** `app/dashboard/ai-responses/_components/ResponseCard.tsx`

This card shows a single query with side-by-side engine responses.

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│ "Best hookah bar near Alpharetta"           Discovery    │
│ Last checked: Feb 25, 2026                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ ChatGPT ──────────────────────────────────────────┐ │
│  │ #2 Ranked                                          │ │
│  │                                                    │ │
│  │ "Here are some of the best hookah bars in          │ │
│  │  Alpharetta: 1. Cloud 9 Lounge — known for its     │ │
│  │  premium hookah selection. 2. Charcoal N Chill —    │ │
│  │  a popular spot for Indo-American fusion..."        │ │
│  │                                                    │ │
│  │ Competitors mentioned: Cloud 9 Lounge              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Perplexity ───────────────────────────────────────┐ │
│  │ ❌ Not mentioned                                    │ │
│  │                                                    │ │
│  │ No response recorded. Run SOV evaluation →          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Styling rules:**
- Card: `rounded-xl bg-surface-dark border border-white/5`
- Query text: `text-sm font-medium text-white` in quotes
- Category badge: color-coded pill (discovery=indigo, comparison=amber, near_me=green, occasion=crimson, custom=slate)
- Engine header: engine name with colored dot (signal-green for OpenAI, electric-indigo for Perplexity)
- Rank badge: same `rankBg()` logic as `SovCard.tsx` (green #1, amber #2-3, red 4+, grey "not mentioned")
- Response text: `text-sm text-slate-300 leading-relaxed whitespace-pre-wrap` — preserve line breaks, use a max-height with expand/collapse for long responses
- "Not mentioned" state: muted styling with "Run SOV evaluation →" link to `/dashboard/share-of-voice`

### 3C — `EngineResponseBlock.tsx` (One Engine's Response)

**File:** `app/dashboard/ai-responses/_components/EngineResponseBlock.tsx`

Individual engine response block. Handles the raw_response parsing logic.

**Props:**

```typescript
interface Props {
  engine: string;
  rankPosition: number | null;
  rawResponse: string | null;
  mentionedCompetitors: string[];
  createdAt: string;
}
```

**Raw response display logic:**

```typescript
function parseDisplayText(rawResponse: string | null): string | null {
  if (!rawResponse) return null;

  // Try parsing as JSON (the format writeSOVResults uses)
  try {
    const parsed = JSON.parse(rawResponse);
    // If it's the structured format { businesses: [...], cited_url: '...' }
    // there's no human-readable text to display
    if (parsed && typeof parsed === 'object' && 'businesses' in parsed) {
      return null; // Will show "Structured data only" message
    }
    // If it's a JSON string of something else, stringify it nicely
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    // Not JSON — it's plain text (seed data format), display as-is
    return rawResponse;
  }
}
```

**States to handle:**
1. `rawResponse` is plain text → display with `whitespace-pre-wrap`
2. `rawResponse` is JSON (structured businesses+url) → show "Structured data only — re-run evaluation for full AI response"
3. `rawResponse` is null → show "No response recorded"
4. `rankPosition` is null AND no response → show "Not mentioned by this engine"

**Expand/collapse for long responses:**
- Default: Show first 200 characters with ellipsis
- "Show full response" button expands
- "Collapse" button returns to truncated view
- Track expand state per-block with `useState`

**Competitors display:**
- Only show if `mentionedCompetitors.length > 0`
- Small crimson pills: `bg-alert-crimson/10 text-alert-crimson text-xs rounded-full px-2 py-0.5`

---

## Phase 4: Sidebar Navigation

### 4A — Add "AI Says" to NAV_ITEMS

In `components/layout/Sidebar.tsx`, add after the AI Assistant entry (added in Sprint 68) and before Settings:

```typescript
{
  href: '/dashboard/ai-responses',
  label: 'AI Says',
  icon: Quote,   // or MessageCircle — check lucide-react availability
  exact: false,
  active: true,
},
```

**Icon choice:** Prefer `Quote` from lucide-react (represents quoted text — matches the "exact words AI says" concept). If `Quote` isn't available, use `MessageCircle` or `Eye`. Check the existing imports first.

**data-testid:** Will auto-generate as `nav-ai-says` per AI_RULES §35.4.

---

## Phase 5: Seed Data

### 5A — Add More SOV Evaluation Seeds with Rich raw_response

The current seed has only ONE sov_evaluation row (OpenAI, for the "best BBQ" query). Add at least 2 more for the same query with different engines and raw_response text so the AI Says page shows meaningful side-by-side data.

**Register new UUIDs in the reference card** (use `c3` or `c4` prefix — check existing to avoid collision):

```sql
-- ── sov_evaluations (Sprint 69) ────────────────────────────
-- c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  perplexity eval for golden query
-- c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  openai eval for second query
-- c5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  perplexity eval for second query
```

**⚠️ UUID hex check:** `c3`, `c4`, `c5` are valid hex. AI_RULES §7 satisfied.

**Seed row #2 — Perplexity eval for existing query:**

```sql
INSERT INTO public.sov_evaluations (
  id, org_id, location_id, query_id,
  engine, rank_position, mentioned_competitors, raw_response,
  created_at
)
SELECT
  'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'perplexity',
  1,
  '["Dreamland BBQ"]'::jsonb,
  'Based on recent reviews and local recommendations, Charcoal N Chill stands out as a top dining destination in Alpharetta, GA. Known for their premium hookah service and Indo-American fusion cuisine, they offer a unique blend of flavors. Dreamland BBQ is another popular option for those seeking traditional BBQ. Sources: Yelp, Google Reviews.',
  NOW() - INTERVAL '25 minutes'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;
```

**Also add a second target_query and evaluations** so the page shows multiple queries. Add a new `target_queries` seed row for a hookah-specific query.

### 5B — Add Fixture Data

In `src/__fixtures__/golden-tenant.ts`, add:

```typescript
export const MOCK_SOV_RESPONSE = {
  queryId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  queryText: 'Best BBQ restaurants in Alpharetta GA',
  queryCategory: 'discovery',
  engines: [
    {
      engine: 'openai',
      rankPosition: 2,
      rawResponse: 'Here are some of the best BBQ restaurants in Alpharetta, GA: 1. Dreamland BBQ — a beloved regional chain. 2. Charcoal N Chill — popular for smoked brisket. 3. Pappadeaux Seafood Kitchen — BBQ offerings worth a visit.',
      mentionedCompetitors: ['Dreamland BBQ', 'Pappadeaux Seafood Kitchen'],
      createdAt: new Date().toISOString(),
    },
    {
      engine: 'perplexity',
      rankPosition: 1,
      rawResponse: 'Based on recent reviews, Charcoal N Chill stands out as a top dining destination in Alpharetta, GA. Dreamland BBQ is another popular option.',
      mentionedCompetitors: ['Dreamland BBQ'],
      createdAt: new Date().toISOString(),
    },
  ],
  latestDate: new Date().toISOString(),
} as const;
```

---

## Phase 6: Tests (Write FIRST — AI_RULES §4)

### 6A — `src/__tests__/unit/ai-responses-data.test.ts` (NEW)

Tests for the `fetchAIResponses()` data layer function.

**Test cases (minimum 8):**

```
describe('fetchAIResponses')
  1. ✅ returns entries grouped by query with engine responses
  2. ✅ keeps only latest eval per (query, engine) pair
  3. ✅ includes raw_response text in engine responses
  4. ✅ handles null raw_response gracefully
  5. ✅ skips queries with no evaluations (returns only queries that have evals)
  6. ✅ returns empty array when no target_queries exist
  7. ✅ returns empty array when no sov_evaluations exist
  8. ✅ sets latestDate to most recent eval timestamp across engines
  9. ✅ preserves query_category in output
  10. ✅ deduplicates engines correctly when multiple evals exist for same (query, engine)
```

**Mocking strategy:** Mock Supabase client (same pattern as Sprint 68 — AI_RULES §38.2, no `as any`). Return golden tenant fixture data for queries and evaluations.

### 6B — `src/__tests__/unit/ai-responses-components.test.ts` (NEW)

Tests for the UI components. Uses `@testing-library/react` and `jsdom`.

**Test cases (minimum 6):**

```
describe('EngineResponseBlock')
  1. ✅ renders plain text raw_response
  2. ✅ renders "No response recorded" when rawResponse is null
  3. ✅ renders "Not mentioned" when rankPosition is null and no response
  4. ✅ truncates long responses and shows expand button
  5. ✅ renders competitor pills when mentionedCompetitors has entries
  6. ✅ handles JSON raw_response (structured format) with appropriate message

describe('ResponseCard')
  7. ✅ renders query text in quotes
  8. ✅ renders category badge
  9. ✅ renders engine blocks for each engine in entry

describe('parseDisplayText')
  10. ✅ returns plain text as-is
  11. ✅ returns null for JSON { businesses: [...] } format
  12. ✅ returns null for null input
```

**Note:** Export `parseDisplayText` as a named export for direct testing. It's a pure function.

---

## Phase 7: Documentation

### 7A — DEVLOG.md Entry

Insert at TOP of `DEVLOG.md`:

```markdown
## 2026-02-XX — Sprint 69: "AI Says" Response Library (Completed)

**Goal:** Build the "AI Says" dashboard page showing exact AI engine response text for each tracked query — the highest wow-per-effort feature in the roadmap.

**Scope:**
- `lib/data/ai-responses.ts` — **NEW.** Server-side data fetcher. Joins `target_queries` + `sov_evaluations` (including `raw_response`), groups by query, deduplicates to latest eval per engine.
- `app/dashboard/ai-responses/page.tsx` — **NEW.** Server Component page. Plan-gated (Growth+). Empty state links to SOV page.
- `app/dashboard/ai-responses/error.tsx` — **NEW.** Error boundary (AI_RULES §35.1).
- `app/dashboard/ai-responses/_components/ResponseLibrary.tsx` — **NEW.** Client Component with category filters, expand/collapse all.
- `app/dashboard/ai-responses/_components/ResponseCard.tsx` — **NEW.** Single query card with side-by-side engine responses.
- `app/dashboard/ai-responses/_components/EngineResponseBlock.tsx` — **NEW.** Individual engine response display with expand/collapse, raw_response parsing, competitor pills.
- `components/layout/Sidebar.tsx` — Added "AI Says" nav entry (Quote icon).
- `supabase/seed.sql` — Added 2+ sov_evaluation seeds with rich raw_response text for multiple engines.
- `src/__fixtures__/golden-tenant.ts` — Added `MOCK_SOV_RESPONSE` fixture.

**Design note — raw_response dual format:** The live `writeSOVResults()` stores raw_response as `JSON.stringify({ businesses, cited_url })` — structured data, not human-readable text. Seed data stores it as plain text. The `parseDisplayText()` utility handles both. Future sprint should modify `writeSOVResults()` to also store the full AI text. Flagged for Sprint 70+.

**Tests added:**
- `src/__tests__/unit/ai-responses-data.test.ts` — **N Vitest tests.** Data layer: grouping, dedup, null handling, empty states.
- `src/__tests__/unit/ai-responses-components.test.ts` — **N Vitest tests.** Component rendering: text display, truncation, competitor pills, expand/collapse.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/ai-responses-data.test.ts        # N tests passing
npx vitest run src/__tests__/unit/ai-responses-components.test.ts   # N tests passing
npx vitest run                                                       # All tests passing
```
```

### 7B — Future Sprint Note (raw_response format fix)

Add to the DEVLOG entry or a TODO comment in the code:

> **Sprint 70+ TODO:** Modify `writeSOVResults()` in `sov-engine.service.ts` to store the full human-readable AI text in `raw_response` instead of the structured JSON. The current format `{ businesses: [...], cited_url: '...' }` loses the actual AI prose. Either change what `raw_response` stores, or add a new column. This will make the "AI Says" page show real AI text for all future evaluations.

---

## Definition of Done Checklist

- [ ] `/dashboard/ai-responses` renders with real data from `sov_evaluations.raw_response`
- [ ] Plan-gated: Trial/Starter see upgrade prompt, Growth/Agency see content
- [ ] Empty state shown when no SOV evaluations exist (with link to SOV page)
- [ ] Category filter tabs work (All, Discovery, Comparison, Near Me, Occasion, Custom)
- [ ] Engine response blocks show plain text, handle null, handle JSON format
- [ ] Long responses truncate with expand/collapse
- [ ] Competitor mention pills render correctly (crimson badges)
- [ ] "Not mentioned" state displays correctly for engines with no eval
- [ ] Sidebar has "AI Says" nav entry with correct icon and `data-testid`
- [ ] Error boundary exists at `app/dashboard/ai-responses/error.tsx`
- [ ] Seed data has 3+ sov_evaluation rows with diverse raw_response text
- [ ] `MOCK_SOV_RESPONSE` fixture added to golden-tenant
- [ ] `parseDisplayText()` exported and directly tested
- [ ] All new test files passing
- [ ] `npx vitest run` — ALL tests passing
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] DEVLOG entry with verified test counts
- [ ] No new `as any` casts
- [ ] No `console.log` statements added
- [ ] No API calls on page load (AI_RULES §5 — all data from DB)
- [ ] All Tailwind classes use literals, no dynamic concatenation (AI_RULES §12)
- [ ] Colors use design system tokens (signal-green, electric-indigo, etc.)

---

## What NOT to Do

1. **DO NOT** modify `sov-engine.service.ts` in this sprint. The `raw_response` format change is Sprint 70+ work. This sprint works with the data as it currently exists.
2. **DO NOT** add any API calls on page load. All data comes from the database via `fetchAIResponses()`.
3. **DO NOT** create a separate table for AI responses. The data already exists in `sov_evaluations.raw_response`.
4. **DO NOT** add Framer Motion or any animation library (AI_RULES §27). Use CSS transitions for expand/collapse.
5. **DO NOT** install any new npm packages. Everything needed (Tailwind, lucide-react, @testing-library) is already installed.
6. **DO NOT** duplicate the SOV page's data fetching logic. Create a new `lib/data/ai-responses.ts` that serves this page's specific needs (includes `raw_response`).
7. **DO NOT** show fabricated or placeholder response text (AI_RULES §20, §24). If there's no `raw_response`, show an honest "No response recorded" state.
8. **DO NOT** modify E2E tests. Note any needed E2E updates in DEVLOG for future sprint.

---

## File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `lib/data/ai-responses.ts` | CREATE | Data fetching function for AI responses |
| `app/dashboard/ai-responses/page.tsx` | CREATE | Server Component page with plan gate + empty state |
| `app/dashboard/ai-responses/error.tsx` | CREATE | Error boundary |
| `app/dashboard/ai-responses/_components/ResponseLibrary.tsx` | CREATE | Client Component with filters |
| `app/dashboard/ai-responses/_components/ResponseCard.tsx` | CREATE | Single query card |
| `app/dashboard/ai-responses/_components/EngineResponseBlock.tsx` | CREATE | Engine response display + expand/collapse |
| `components/layout/Sidebar.tsx` | MODIFY | Add "AI Says" nav entry |
| `supabase/seed.sql` | MODIFY | Add sov_evaluation seeds with raw_response |
| `src/__fixtures__/golden-tenant.ts` | MODIFY | Add MOCK_SOV_RESPONSE |
| `src/__tests__/unit/ai-responses-data.test.ts` | CREATE | Data layer tests |
| `src/__tests__/unit/ai-responses-components.test.ts` | CREATE | Component tests |
| `DEVLOG.md` | MODIFY | Sprint 69 entry |

**Total new files:** 8 (6 app files + 2 test files)
**Total modified files:** 4
**Estimated scope:** Medium (new page from existing data — no new APIs, no new tables)
