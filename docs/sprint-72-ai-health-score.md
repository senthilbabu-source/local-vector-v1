# Sprint 72 — AI Health Score Composite + Top Recommendation

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **AI Health Score** — a single 0–100 composite metric that combines data from 4 existing engines (SOV, Page Audit, Hallucinations, Schema Completeness) into one number, with a prioritized **Top Recommendation** surfacing the single highest-impact action the business should take this week. This is the "IDENTIFY" stage of the Intelligence Flywheel (Master Strategy §4B).

**Why this matters:** Restaurant owners don't want to learn AEO theory. They want one number ("am I healthy or sick?") and one action ("what's the single most impactful thing I can do this week?").

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order:

```
Read docs/AI_RULES.md                          — All 39 engineering rules
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — Canonical schema (§1)
Read lib/supabase/database.types.ts            — TypeScript DB types (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read lib/plan-enforcer.ts                      — Plan gating functions (§5)
Read lib/data/dashboard.ts                     — Existing dashboard data layer (Sprint 64)
Read app/dashboard/page.tsx                    — deriveRealityScore() lives here
Read lib/services/sov-engine.service.ts        — SOV score computation
Read lib/page-audit/                           — Page audit scoring (5 dimensions)
Read app/dashboard/page-audits/                — Page Audit dashboard + actions
Read lib/schema-generator/                     — Schema generator (Sprint 70)
```

---

## 🏗️ Architecture — What to Build

### Component 1: Pure Scoring Service — `lib/services/ai-health-score.service.ts`

**This is a PURE function.** It takes pre-fetched data as input and returns a computed score. It MUST NOT import Supabase clients, call `fetch()`, or perform any I/O (AI_RULES §39 pattern).

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Input types ──────────────────────────────────────────────

export interface HealthScoreInput {
  /** Latest SOV share_of_voice (0.0–1.0 float from visibility_analytics). null = no scan yet. */
  sovScore: number | null;

  /** Latest page_audits row for primary location. null = never audited. */
  pageAudit: {
    overall_score: number | null;          // 0–100
    answer_first_score: number | null;     // 0–100
    schema_completeness_score: number | null; // 0–100
    faq_schema_score: number | null;       // 0–100
    entity_clarity_score: number | null;   // 0–100
    aeo_readability_score: number | null;  // 0–100
    faq_schema_present: boolean | null;
    recommendations: PageAuditRecommendation[] | null;
  } | null;

  /** Count of OPEN hallucinations (correction_status = 'open'). */
  openHallucinationCount: number;

  /** Total hallucinations ever detected (for accuracy denominator). */
  totalAuditCount: number;

  /** Whether FAQ schema is present on homepage (from page_audits or schema generator). */
  hasFaqSchema: boolean;

  /** Whether LocalBusiness schema is present on homepage. */
  hasLocalBusinessSchema: boolean;
}

// ── Output types ─────────────────────────────────────────────

export interface HealthScoreResult {
  /** Composite 0–100 score, or null if insufficient data. */
  score: number | null;

  /** Letter grade: A (80+), B (60-79), C (40-59), D (20-39), F (<20). null if score is null. */
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | null;

  /** Per-component breakdown (each 0–100, null if no data for that component). */
  components: {
    visibility: { score: number | null; weight: number; label: string };
    accuracy:   { score: number | null; weight: number; label: string };
    structure:  { score: number | null; weight: number; label: string };
    freshness:  { score: number | null; weight: number; label: string };
  };

  /** The single highest-impact recommendation. null if no recommendations available. */
  topRecommendation: TopRecommendation | null;

  /** All ranked recommendations (max 5), highest impact first. */
  recommendations: TopRecommendation[];
}

export interface TopRecommendation {
  /** Human-readable title, e.g. "Add FAQ Schema" */
  title: string;
  /** Human-readable description with specific context */
  description: string;
  /** Estimated point improvement to the health score */
  estimatedImpact: number;
  /** Which component this improves */
  component: 'visibility' | 'accuracy' | 'structure' | 'freshness';
  /** Dashboard page to navigate to for the fix */
  actionHref: string;
  /** CTA button text */
  actionLabel: string;
  /** Dimension key from page audit, if applicable */
  dimensionKey?: string;
}

export interface PageAuditRecommendation {
  issue: string;
  fix: string;
  impactPoints: number;
  dimensionKey: string;
  schemaType?: string;
}
```

#### Scoring Formula

```
AI Health Score = weighted average of non-null components

Components:
┌────────────┬────────┬─────────────────────────────────────────────────────────┐
│ Component  │ Weight │ Calculation                                             │
├────────────┼────────┼─────────────────────────────────────────────────────────┤
│ Visibility │  30%   │ sovScore × 100 (0.0–1.0 → 0–100)                      │
│            │        │ null if no visibility_analytics rows                    │
├────────────┼────────┼─────────────────────────────────────────────────────────┤
│ Accuracy   │  25%   │ If totalAuditCount = 0: null (no data yet)             │
│            │        │ If totalAuditCount > 0:                                 │
│            │        │   100 - (openHallucinationCount / totalAuditCount × 100)│
│            │        │ Clamped to 0–100                                        │
├────────────┼────────┼─────────────────────────────────────────────────────────┤
│ Structure  │  25%   │ page_audits.overall_score (already 0–100)              │
│            │        │ null if no page_audits rows                             │
├────────────┼────────┼─────────────────────────────────────────────────────────┤
│ Freshness  │  20%   │ Composite of:                                           │
│            │        │ - 50%: schema presence (FAQ=25pts + LocalBiz=25pts)     │
│            │        │ - 50%: page audit faq_schema_score + entity_clarity     │
│            │        │   averaged (both 0–100)                                 │
│            │        │ null if no page_audits AND no schema data               │
└────────────┴────────┴─────────────────────────────────────────────────────────┘

If ALL components are null → return { score: null, grade: null }
If SOME components are null → re-weight remaining components proportionally
  (e.g., if visibility is null, remaining weights become 25/70, 25/70, 20/70)
```

#### Grade Thresholds

```
A: 80–100  (Excellent — AI sees you clearly)
B: 60–79   (Good — some gaps to close)
C: 40–59   (Fair — significant opportunities)
D: 20–39   (Poor — major gaps hurting visibility)
F: 0–19    (Critical — AI barely knows you exist)
```

#### Top Recommendation Logic

Rank recommendations by `estimatedImpact` descending. Sources:

1. **Page audit recommendations** — from `page_audits.recommendations` JSONB array (already has `impactPoints`, `dimensionKey`, `fix`). Map each to a `TopRecommendation`.
2. **Missing schema** — if `hasFaqSchema === false`, inject recommendation: "Add FAQ Schema (+est. 15 points)" → href `/dashboard/page-audits`.
3. **Missing LocalBusiness schema** — if `hasLocalBusinessSchema === false`, inject: "Add LocalBusiness Schema (+est. 10 points)" → href `/dashboard/page-audits`.
4. **High hallucination count** — if `openHallucinationCount >= 3`, inject: "Resolve open hallucinations (+est. 8 points)" → href `/dashboard`.
5. **Low SOV** — if `sovScore !== null && sovScore < 0.2`, inject: "Improve AI visibility — track more queries (+est. 5 points)" → href `/dashboard/share-of-voice`.

Take the top 5, return as `recommendations[]`. Set `topRecommendation` to `recommendations[0]` or `null`.

#### Exported Functions

```typescript
/**
 * Pure function — computes AI Health Score from pre-fetched data.
 * No I/O, no Supabase, no side effects.
 */
export function computeHealthScore(input: HealthScoreInput): HealthScoreResult { ... }

/**
 * Maps a numeric 0–100 score to a letter grade.
 */
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' { ... }
```

---

### Component 2: Data Fetcher — `lib/data/ai-health-score.ts`

**This is the data layer.** It fetches from Supabase and calls the pure service. Same pattern as `lib/data/dashboard.ts` (Sprint 64) and `lib/data/schema-generator.ts` (Sprint 70).

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { computeHealthScore, type HealthScoreInput, type HealthScoreResult } from '@/lib/services/ai-health-score.service';

/**
 * Fetches all data needed for AI Health Score computation, then calls the pure scorer.
 * Caller passes the Supabase client (RLS-scoped for user actions, service-role for cron).
 */
export async function fetchHealthScore(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string
): Promise<HealthScoreResult> { ... }
```

**Queries to execute (all in parallel with `Promise.all`):**

1. **SOV score** — latest `visibility_analytics` row for this org+location, ordered by `snapshot_date DESC`, limit 1. Read `share_of_voice`.

2. **Page audit** — latest `page_audits` row for this org+location, ordered by `last_audited_at DESC`, limit 1. Read all 5 dimension scores + `overall_score` + `faq_schema_present` + `recommendations`.

3. **Open hallucination count** — `SELECT count(*)` from `ai_hallucinations` where `org_id = orgId` AND `correction_status = 'open'`.

4. **Total audit count** — `SELECT count(*)` from `ai_audits` where `org_id = orgId`.

5. **Schema presence** — derive from `page_audits.faq_schema_present` (already fetched in query 2) and `page_audits.schema_completeness_score > 0` as a proxy for LocalBusiness schema presence.

**Important patterns to follow:**
- All queries scoped by `org_id` (AI_RULES §3, §18 belt-and-suspenders).
- JSONB `recommendations` column cast per AI_RULES §38.4: `audit.recommendations as PageAuditRecommendation[] | null`.
- Null propagation per AI_RULES §20: never fabricate values when DB rows are absent.
- Service function takes injected `SupabaseClient<Database>` (AI_RULES §38.3).

---

### Component 3: Server Action — `app/dashboard/actions/health-score.ts`

```typescript
'use server';

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchHealthScore } from '@/lib/data/ai-health-score';
import type { HealthScoreResult } from '@/lib/services/ai-health-score.service';

/**
 * Server Action: Fetch the AI Health Score for the user's org + primary location.
 * Uses getSafeAuthContext() (not getAuthContext) per AI_RULES §3.
 */
export async function getHealthScore(): Promise<
  { success: true; data: HealthScoreResult } |
  { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // Fetch primary location
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return { success: false, error: 'No primary location found' };

  const result = await fetchHealthScore(supabase, ctx.orgId, location.id);
  return { success: true, data: result };
}
```

---

### Component 4: Dashboard UI — `app/dashboard/_components/AIHealthScoreCard.tsx`

**Server Component** that fetches and displays the score on the main dashboard (`app/dashboard/page.tsx`).

**Design spec:**

```
┌─────────────────────────────────────────────────────────────┐
│  AI Health Score                                    [?]     │
│                                                             │
│         ┌──────────┐                                        │
│         │          │                                        │
│         │   67     │  Grade: C                              │
│         │          │  "Fair — significant opportunities"    │
│         └──────────┘                                        │
│                                                             │
│  Visibility  ████████░░░░  42%   (30% weight)              │
│  Accuracy    ██████████░░  85%   (25% weight)              │
│  Structure   ██████░░░░░░  55%   (25% weight)              │
│  Freshness   ████░░░░░░░░  32%   (20% weight)              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  🎯 Top Recommendation                                      │
│  Add FAQ Schema to your homepage (+est. 15 points)          │
│  [Generate Schema →]                                         │
└─────────────────────────────────────────────────────────────┘
```

**Null state (no data yet):**

```
┌─────────────────────────────────────────────────────────────┐
│  AI Health Score                                    [?]     │
│                                                             │
│         ┌──────────┐                                        │
│         │    —     │  Your AI Health Score will appear       │
│         │          │  after your first scan runs.            │
│         └──────────┘  Check back Monday.                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation rules:**
- Server Component — no `'use client'` unless interactivity needed (AI_RULES §6).
- Score ring: reuse the same SVG ring pattern from `SOVScoreRing.tsx`.
- Color thresholds: green ≥ 80 (A/B), amber 40–79 (C), crimson < 40 (D/F).
- Tailwind literal classes only (AI_RULES §12) — no dynamic class construction.
- Component bars: use literal width classes per bucket, not `style={{ width: '${pct}%' }}`.
- Top Recommendation: show `actionLabel` as a link to `actionHref`.
- If `score === null`, show the null state with `nextSundayLabel()` from `scan-health-utils.ts` (AI_RULES §23).

---

### Component 5: Integration into Dashboard Page — `app/dashboard/page.tsx`

Add `<AIHealthScoreCard>` to the main dashboard layout. Position it prominently — top of page, above the existing Reality Score card. The AI Health Score is designed to **replace** the existing `deriveRealityScore()` computation over time, but for V1 we keep both (AI Health Score card above, existing cards below).

**Do NOT remove `deriveRealityScore()`.** It has a test import dependency at `src/__tests__/unit/reality-score.test.ts` (Sprint 64 note). The AI Health Score is additive.

Import the data fetcher in `fetchDashboardData()` in `lib/data/dashboard.ts` and add the health score result to the `DashboardData` interface. Pass through to the page component.

---

### Component 6: Golden Tenant Fixture — `src/__fixtures__/golden-tenant.ts`

Add `MOCK_HEALTH_SCORE_INPUT` fixture:

```typescript
/**
 * Sprint 72 — Canonical HealthScoreInput fixture for Charcoal N Chill.
 * Use in all AI Health Score unit tests.
 */
export const MOCK_HEALTH_SCORE_INPUT: import('@/lib/services/ai-health-score.service').HealthScoreInput = {
  sovScore: 0.42,
  pageAudit: {
    overall_score: 66,
    answer_first_score: 65,
    schema_completeness_score: 55,
    faq_schema_score: 0,
    entity_clarity_score: 62,
    aeo_readability_score: 78,
    faq_schema_present: false,
    recommendations: [
      {
        issue: 'Opening text is navigation/hero copy with no substance',
        fix: 'Replace your opening section with an answer-first format.',
        impactPoints: 35,
        dimensionKey: 'answerFirst',
      },
      {
        issue: 'Missing required JSON-LD schema for homepage page',
        fix: 'Add LocalBusiness JSON-LD schema.',
        impactPoints: 25,
        dimensionKey: 'schemaCompleteness',
        schemaType: 'LocalBusiness',
      },
      {
        issue: 'No FAQPage schema found',
        fix: 'Add FAQPage schema with at least 5 Q&A pairs.',
        impactPoints: 20,
        dimensionKey: 'faqSchema',
        schemaType: 'FAQPage',
      },
    ],
  },
  openHallucinationCount: 2,
  totalAuditCount: 5,
  hasFaqSchema: false,
  hasLocalBusinessSchema: false,
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/ai-health-score-service.test.ts`

**Target: `lib/services/ai-health-score.service.ts`**

Write these tests BEFORE implementing the service:

```
describe('computeHealthScore')
  1. computes weighted score with all 4 components present
  2. returns correct grade A for score >= 80
  3. returns correct grade B for score 60-79
  4. returns correct grade C for score 40-59
  5. returns correct grade D for score 20-39
  6. returns correct grade F for score < 20
  7. returns null score and null grade when ALL components are null
  8. re-weights when visibility is null (SOV not run yet)
  9. re-weights when structure is null (page audit not run yet)
  10. re-weights when accuracy is null (no audits run yet)
  11. re-weights when only one component has data
  12. clamps accuracy to 0 when hallucination count exceeds audit count
  13. computes accuracy as 100 when 0 open hallucinations and audits > 0
  14. handles sovScore = 0.0 correctly (not null — score is 0)
  15. uses MOCK_HEALTH_SCORE_INPUT from golden-tenant and produces expected score

describe('scoreToGrade')
  16. maps boundary values: 0→F, 19→F, 20→D, 39→D, 40→C, 59→C, 60→B, 79→B, 80→A, 100→A

describe('Top Recommendation ranking')
  17. ranks page audit recommendations by impactPoints descending
  18. injects "Add FAQ Schema" when hasFaqSchema is false
  19. injects "Add LocalBusiness Schema" when hasLocalBusinessSchema is false
  20. injects "Resolve open hallucinations" when openHallucinationCount >= 3
  21. injects "Improve AI visibility" when sovScore < 0.2
  22. does NOT inject schema recommendations when schemas are present
  23. returns max 5 recommendations
  24. sets topRecommendation to highest-impact recommendation
  25. returns null topRecommendation when no recommendations exist (all good)
  26. each recommendation has required fields: title, description, estimatedImpact, component, actionHref, actionLabel
```

**26 tests total.**

**Mock requirements:**
- No Supabase mocks needed — this is a pure function test.
- Import `MOCK_HEALTH_SCORE_INPUT` and `MOCK_PAGE_AUDIT` from `golden-tenant.ts`.
- No AI SDK mocks needed — no LLM calls.

### Test File 2: `src/__tests__/unit/ai-health-score-data.test.ts`

**Target: `lib/data/ai-health-score.ts`**

```
describe('fetchHealthScore')
  1. fetches all 4 data sources in parallel (verify Promise.all pattern)
  2. passes correct org_id filter on all queries (belt-and-suspenders §18)
  3. handles missing visibility_analytics row (returns null sovScore)
  4. handles missing page_audits row (returns null pageAudit)
  5. handles zero ai_hallucinations (returns openHallucinationCount: 0)
  6. handles zero ai_audits (returns totalAuditCount: 0)
  7. casts JSONB recommendations column correctly (§38.4)
  8. calls computeHealthScore with assembled HealthScoreInput
  9. returns the HealthScoreResult from computeHealthScore
```

**9 tests total.**

**Mock requirements (AI_RULES §4):**
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
```
Build a mock Supabase client that handles:
- `.from('visibility_analytics').select('share_of_voice').eq('org_id', ...).eq('location_id', ...).order('snapshot_date', { ascending: false }).limit(1).maybeSingle()`
- `.from('page_audits').select('*').eq('org_id', ...).eq('location_id', ...).order('last_audited_at', { ascending: false }).limit(1).maybeSingle()`
- `.from('ai_hallucinations').select('id', { count: 'exact', head: true }).eq('org_id', ...).eq('correction_status', 'open')`
- `.from('ai_audits').select('id', { count: 'exact', head: true }).eq('org_id', ...)`

Use `as unknown as SupabaseClient<Database>` (AI_RULES §38.2 — no `as any`).

### Test File 3: `src/__tests__/unit/health-score-action.test.ts`

**Target: `app/dashboard/actions/health-score.ts`**

```
describe('getHealthScore')
  1. returns { success: false, error: 'Unauthorized' } when no session
  2. returns { success: false, error: 'No primary location found' } when no primary location
  3. returns { success: true, data: HealthScoreResult } on happy path
  4. passes org_id and location_id to fetchHealthScore
```

**4 tests total.**

**Mock requirements:**
```typescript
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/data/ai-health-score', () => ({
  fetchHealthScore: vi.fn(),
}));
```

---

## 📝 Seed Data — `supabase/seed.sql`

No new tables are created in this sprint (purely computed from existing data). However, verify that the existing seed data provides enough data points for the health score to compute:

- **Verify:** `visibility_analytics` has at least 1 row for Charcoal N Chill org (`a0eebc99-...`).
- **Verify:** `page_audits` has at least 1 row for Charcoal N Chill (should exist from Sprint 71).
- **Verify:** `ai_hallucinations` has at least 1 open row for Charcoal N Chill.
- **Verify:** `ai_audits` has at least 1 row for Charcoal N Chill (Sprint 68 added these).

If any are missing, add seed rows. Follow UUID conventions (AI_RULES §7 — hex only, register in UUID reference card).

---

## 🚫 What NOT to Do

1. **DO NOT create a new database table.** AI Health Score is a computed metric from existing data. No migration needed.
2. **DO NOT call any AI/LLM API.** This is pure data aggregation — no AI calls.
3. **DO NOT remove `deriveRealityScore()`.** It has test dependencies. The health score is additive.
4. **DO NOT trigger computation on page load via API call** (AI_RULES §5). The score is computed server-side in the RSC data fetch.
5. **DO NOT hardcode placeholder scores** (AI_RULES §20). Null data → null score → null state UI.
6. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
7. **DO NOT use `getAuthContext()` in the Server Action** (AI_RULES §3) — use `getSafeAuthContext()`.
8. **DO NOT inline plan-tier checks** (AI_RULES §5). Health Score is available to ALL tiers (even trial) — it's the core value proposition. No plan gating needed.
9. **DO NOT create files under `supabase/functions/`** (AI_RULES §6).
10. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/services/ai-health-score.service.ts` | **CREATE** | Pure scoring service (computeHealthScore, scoreToGrade) |
| 2 | `lib/data/ai-health-score.ts` | **CREATE** | Data fetcher — Supabase queries → computeHealthScore |
| 3 | `app/dashboard/actions/health-score.ts` | **CREATE** | Server Action — auth + fetch + return |
| 4 | `app/dashboard/_components/AIHealthScoreCard.tsx` | **CREATE** | Dashboard card component (Server Component) |
| 5 | `app/dashboard/page.tsx` | **MODIFY** | Add AIHealthScoreCard above existing cards |
| 6 | `lib/data/dashboard.ts` | **MODIFY** | Add health score to DashboardData interface + fetchDashboardData |
| 7 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_HEALTH_SCORE_INPUT fixture |
| 8 | `src/__tests__/unit/ai-health-score-service.test.ts` | **CREATE** | 26 tests — pure function |
| 9 | `src/__tests__/unit/ai-health-score-data.test.ts` | **CREATE** | 9 tests — data layer |
| 10 | `src/__tests__/unit/health-score-action.test.ts` | **CREATE** | 4 tests — server action |

**Expected test count: 39 new tests across 3 files.**

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `lib/services/ai-health-score.service.ts` — Pure function, no I/O, fully typed
- [ ] `lib/data/ai-health-score.ts` — Data layer with parallel queries, null propagation
- [ ] `app/dashboard/actions/health-score.ts` — Server Action with `getSafeAuthContext()`
- [ ] `app/dashboard/_components/AIHealthScoreCard.tsx` — Server Component with null state
- [ ] Dashboard page renders AIHealthScoreCard above existing content
- [ ] `MOCK_HEALTH_SCORE_INPUT` added to `golden-tenant.ts`
- [ ] Existing seed data verified sufficient (no new migration)
- [ ] `npx vitest run src/__tests__/unit/ai-health-score-service.test.ts` — 26 tests passing
- [ ] `npx vitest run src/__tests__/unit/ai-health-score-data.test.ts` — 9 tests passing
- [ ] `npx vitest run src/__tests__/unit/health-score-action.test.ts` — 4 tests passing
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written (see format below)
- [ ] No `as any` on Supabase clients
- [ ] No hardcoded placeholder values
- [ ] No AI API calls

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

After completing the sprint, write this entry at the TOP of `DEVLOG.md`:

```markdown
## 2026-02-27 — Sprint 72: AI Health Score Composite + Top Recommendation (Completed)

**Goal:** Build a single 0–100 AI Health Score compositing SOV, page audit, hallucination, and schema data, with a prioritized top recommendation surfacing the highest-impact action.

**Scope:**
- `lib/services/ai-health-score.service.ts` — **NEW.** Pure scoring service. Exports: `computeHealthScore()` (weighted composite of 4 components with proportional re-weighting for null components), `scoreToGrade()` (A/B/C/D/F mapping). Top Recommendation ranking from page audit recommendations + injected schema/hallucination/SOV recommendations. No I/O.
- `lib/data/ai-health-score.ts` — **NEW.** Data fetcher. 4 parallel Supabase queries (visibility_analytics, page_audits, ai_hallucinations count, ai_audits count). Assembles HealthScoreInput, calls computeHealthScore.
- `app/dashboard/actions/health-score.ts` — **NEW.** Server Action with getSafeAuthContext(), primary location lookup, delegates to fetchHealthScore.
- `app/dashboard/_components/AIHealthScoreCard.tsx` — **NEW.** Server Component. Score ring, 4 component bars, letter grade, top recommendation with action link. Null state with nextSundayLabel().
- `app/dashboard/page.tsx` — **MODIFIED.** Added AIHealthScoreCard above existing Reality Score card.
- `lib/data/dashboard.ts` — **MODIFIED.** Added healthScore to DashboardData interface.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_HEALTH_SCORE_INPUT fixture.

**Tests added:**
- `src/__tests__/unit/ai-health-score-service.test.ts` — **N Vitest tests.** computeHealthScore weighted scoring, grade mapping, null re-weighting, recommendation ranking, boundary cases.
- `src/__tests__/unit/ai-health-score-data.test.ts` — **N Vitest tests.** Data layer queries, null propagation, JSONB casting.
- `src/__tests__/unit/health-score-action.test.ts` — **N Vitest tests.** Auth guard, no-location error, happy path.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/ai-health-score-service.test.ts  # N tests passing
npx vitest run src/__tests__/unit/ai-health-score-data.test.ts     # N tests passing
npx vitest run src/__tests__/unit/health-score-action.test.ts      # N tests passing
npx vitest run                                                      # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `visibility_analytics` table + SOV data | Sprint 41 (SOV Engine Cron) | `share_of_voice` float for Visibility component |
| `page_audits` table with 5 dimension scores | Sprint 71 (Per-dimension audit) | `overall_score`, sub-scores, `recommendations` JSONB |
| `ai_audits` table actually written to | Sprint 68 (ai_audits bug fix) | `totalAuditCount` for Accuracy denominator |
| `ai_hallucinations` with `correction_status` | Initial schema | `openHallucinationCount` for Accuracy |
| Schema Generator pure functions | Sprint 70 | Context for schema-related recommendations |
| `deriveRealityScore()` in page.tsx | Sprint 64 | NOT removed — health score is additive |
| Dashboard data layer extraction | Sprint 64 | Pattern for `lib/data/` data fetchers |
| Golden Tenant fixture | All sprints | `MOCK_PAGE_AUDIT`, `MOCK_AI_AUDIT` fixtures |

---

## 🧠 Edge Cases to Handle

1. **Brand new tenant (day 1):** No SOV data, no page audits, no hallucinations, no audits → ALL components null → `score: null` → null state UI with "Check back Monday."
2. **Tenant with only SOV data (cron ran but no page audit):** Visibility = 42, others null → re-weight Visibility to 100% → score = 42, grade = C. Top recommendation: "Run a page audit for a complete AI Health Score."
3. **sovScore = 0.0 vs null:** `0.0` is a valid score (means 0% visibility) — treat as data. `null` means no data.
4. **Hallucination count > audit count:** Possible if hallucinations were bulk-imported. Clamp accuracy to 0, don't go negative.
5. **Page audit with empty recommendations array:** Valid state — no recommendations to rank. `topRecommendation: null` if no injected recommendations either.
6. **Page audit with `overall_score: 0`:** Valid — terrible score but real data. Display 0, don't treat as null.
7. **All schemas present, no hallucinations, good SOV:** Score should be high (80+), grade A, `topRecommendation: null` or low-impact suggestions only.
