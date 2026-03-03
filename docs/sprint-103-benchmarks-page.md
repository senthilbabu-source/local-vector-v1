# Sprint 103 — Benchmarks Full Page + Sidebar Entry

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

The benchmark comparison feature exists but is buried. `BenchmarkComparisonCard` renders as a small card near the bottom of `/dashboard` and is invisible to most users. There is **no dedicated route** — no sidebar entry, no full-page context, no explanation of how the benchmark is computed or what to do with it.

This sprint promotes benchmarks to a first-class dashboard section:

1. **`/dashboard/benchmarks` page** — full-page view with the existing card as the hero, extended with computed-at freshness, score history table, and a "how to improve" action block
2. **Sidebar entry** — `Benchmarks` added to the Intelligence group so users can navigate to it
3. **Seed data** — golden tenant gets a realistic Alpharetta benchmark row so the page renders in the ready state during development and testing
4. **Unit tests** — page render tests covering all 4 states (no-city, collecting, ready, no-score)
5. **E2E** — `nav-benchmarks` added to `14-sidebar-nav.spec.ts`

**Why this matters:** Benchmark data is the one feature that proves LocalVector's network effect — "you score better than 73% of restaurants in Alpharetta" is a retention-driving insight. Hidden at the bottom of a crowded dashboard, almost no user sees it. A dedicated page makes it discoverable and gives it room to breathe.

**Gap being closed:** Partial item #6 from the Sprint 89 codebase audit — "Benchmarks visible only as embedded card with no dedicated route." (0% → 100%)

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                            — All rules. Key: §12 (no dynamic Tailwind), §47 (PlanGate pattern), §48 (type drift)
Read docs/CLAUDE.md                                              — Project context, architecture, patterns
Read DEVLOG.md                                                   — Sprint history. Latest: Sprint 101 + FIX-9 + Sprint 102
Read lib/supabase/database.types.ts                              — Confirm benchmarks table is now typed (Sprint 102 added it)
Read lib/data/benchmarks.ts                                      — fetchBenchmark() — the data layer this page uses
Read app/dashboard/_components/BenchmarkComparisonCard.tsx       — The hero component — understand all 4 states and props
Read app/dashboard/_components/panels/AIVisibilityPanel.tsx      — How benchmarkDiff is computed (org_count >= 10 threshold)
Read lib/location/active-location.ts                             — getActiveLocationId() — how active location is resolved
Read src/__fixtures__/golden-tenant.ts                           — Golden Tenant fixtures (org_id: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11)
Read app/dashboard/entity-health/page.tsx                        — Page structure pattern: auth guard, no-location empty state, data fetch
Read app/dashboard/revenue-impact/page.tsx                       — Another page pattern: parallel data fetches, literal Tailwind classes
Read components/layout/Sidebar.tsx                               — NAV_ITEMS array and Intelligence NAV_GROUP
Read supabase/seed.sql                                           — Find where to insert the benchmark seed row
Read src/__tests__/unit/sprint-o-benchmark.test.ts               — Existing fetchBenchmark unit tests (9 tests) — do not duplicate
Read tests/e2e/14-sidebar-nav.spec.ts                            — Current E2E nav spec — add nav-benchmarks entry here
```

**Specifically understand before writing code:**
- The 4 render states of `BenchmarkComparisonCard`: (1) `!orgCity` → returns null, (2) collecting `org_count < 10`, (3) ready `org_count >= 10` with `orgScore`, (4) ready with `orgScore === null`
- `fetchBenchmark()` returns `{ benchmark: BenchmarkData | null; locationContext: OrgLocationContext }` — the `locationContext` always has city/industry even when benchmark is null
- `reality_score` comes from `visibility_scores` table — fetch the most recent row for this org
- The `MIN_DISPLAY_THRESHOLD` constant in `BenchmarkComparisonCard` is `10` — match this in tests
- Sidebar `testId` generation: `nav-${label.toLowerCase().replace(/\s+/g, '-')}` → `'Benchmarks'` → `'nav-benchmarks'`
- The Intelligence NAV_GROUP currently contains: compete, revenue-impact, agent-readiness, entity-health

---

## 🏗️ Architecture — What to Build

### Component 1: Benchmarks Page — `app/dashboard/benchmarks/page.tsx`

**Server Component.** Follows the same pattern as `entity-health/page.tsx` and `revenue-impact/page.tsx`. Auth guard → data fetch → render states.

```typescript
// ---------------------------------------------------------------------------
// app/dashboard/benchmarks/page.tsx — Sprint 103
//
// Full-page benchmark comparison. Promotes the BenchmarkComparisonCard
// from an embedded dashboard card to a first-class route.
//
// States:
//   1. No city set on primary location → onboarding nudge
//   2. Collecting (org_count < 10) → collecting state + explainer
//   3. Ready (org_count >= 10) + orgScore → full comparison + actions
//   4. Ready + no orgScore → benchmark ready but no score yet
//
// Server Component — all data fetched at render time.
// ---------------------------------------------------------------------------
```

**Data fetches (parallel where possible):**

```typescript
// Fetch benchmark + location context
const { benchmark, locationContext } = await fetchBenchmark(
  supabase,
  ctx.orgId,
  activeLocationId,
);

// Fetch org's latest reality score from visibility_scores
const { data: latestScore } = await supabase
  .from('visibility_scores')
  .select('reality_score, snapshot_date')
  .eq('org_id', ctx.orgId)
  .order('snapshot_date', { ascending: false })
  .limit(1)
  .maybeSingle();

const orgScore: number | null = latestScore?.reality_score ?? null;
```

**Page layout spec:**

```
┌──────────────────────────────────────────────────────────────────┐
│  h1: City Benchmark                                               │
│  p:  How your AI Visibility Score compares to other [industry]   │
│       businesses in [city] on LocalVector.                        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  BenchmarkComparisonCard (hero — full width)                      │
│  orgScore={orgScore}                                              │
│  orgCity={locationContext.city}                                   │
│  orgIndustry={locationContext.industry}                           │
│  benchmark={benchmark}                                            │
└──────────────────────────────────────────────────────────────────┘

[If benchmark ready (org_count >= 10):]
┌──────────────────────────────────────────────────────────────────┐
│  "About This Benchmark"                                           │
│  Computed every Sunday from anonymized Reality Scores.            │
│  Last updated: [computed_at formatted as "March 2, 2026"]         │
│  Based on [org_count] businesses in [city].                       │
│  Minimum 10 businesses required to display.                       │
└──────────────────────────────────────────────────────────────────┘

[If orgScore is above or below avg:]
┌──────────────────────────────────────────────────────────────────┐
│  "How to Improve Your Score"                                      │
│  [If below avg]:                                                  │
│    • Resolve open hallucination alerts → link /dashboard/hallucinations
│    • Review your AI Sources → link /dashboard/source-intelligence
│    • Check your Citations → link /dashboard/citations             │
│  [If above avg]:                                                  │
│    • You're above average. Keep your data fresh.                  │
│    • Set up weekly scanning → link /dashboard/settings            │
└──────────────────────────────────────────────────────────────────┘
```

**State 1 — No city:**
```
<h1>City Benchmark</h1>
<div data-testid="benchmark-no-city-state">
  <p>No city set for your primary location.</p>
  <p>Add your city in Settings to unlock city benchmark comparison.</p>
  <a href="/dashboard/settings">Go to Settings →</a>
</div>
```

**State 2/3/4 — delegate to BenchmarkComparisonCard** (handles all three internally).

**Implementation rules:**
- Auth: `getSafeAuthContext()` — redirect to `/login` if null
- Use `getActiveLocationId()` from `lib/location/active-location.ts` for location resolution (same pattern as dashboard page)
- All Tailwind classes must be literal strings (AI_RULES §12) — no dynamic construction
- Do NOT wrap in `<PlanGate>` — benchmarks are available to all plan tiers (data is anonymized averages, no competitive PII)
- The "How to Improve" section uses `<Link>` from `next/link` — not `<a>` tags
- `data-testid` attributes required on: page container (`benchmark-page`), no-city state (`benchmark-no-city-state`), about section (`benchmark-about-section`), improve section (`benchmark-improve-section`)
- Format `computed_at` with: `new Date(benchmark.computed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })`

**TypeScript interfaces (for this file only):**

```typescript
interface BenchmarksPageProps {
  // No props — Server Component, reads from auth context
}
```

No new shared types needed — `BenchmarkData` from `lib/data/benchmarks.ts` covers everything.

---

### Component 2: Sidebar Entry — `components/layout/Sidebar.tsx`

Add `Benchmarks` to the sidebar. It belongs in the **Intelligence** group alongside Compete, Revenue Impact, Agent Readiness, and Entity Health — all "how am I doing vs. context" features.

**Step 1 — Import the icon.** Use `Trophy` from lucide-react. It's unused in the codebase (verify with grep) and communicates competitive ranking perfectly.

```typescript
import {
  // ... existing imports ...
  Trophy,   // ← Benchmarks — city/industry ranking
} from 'lucide-react';
```

**Step 2 — Add to `NAV_ITEMS`.** Insert after `Revenue Impact` to group it with Intelligence items:

```typescript
{
  href: '/dashboard/benchmarks',
  label: 'Benchmarks',
  icon: Trophy,
  exact: false,
  active: true,
},
```

**Step 3 — Add to Intelligence `NAV_GROUP`.** The Intelligence group currently filters on:
```typescript
'/dashboard/compete',
'/dashboard/revenue-impact',
'/dashboard/agent-readiness',
'/dashboard/entity-health',
```

Add `/dashboard/benchmarks` after `/dashboard/revenue-impact`:
```typescript
{
  label: 'Intelligence',
  items: NAV_ITEMS.filter((i) =>
    [
      '/dashboard/compete',
      '/dashboard/revenue-impact',
      '/dashboard/benchmarks',      // ← add here
      '/dashboard/agent-readiness',
      '/dashboard/entity-health',
    ].includes(i.href),
  ),
},
```

**Resulting `data-testid`:** `nav-benchmarks` (auto-generated from label `'Benchmarks'`).

---

### Component 3: Seed Data — `supabase/seed.sql`

The golden tenant (Charcoal N Chill, Alpharetta, GA) needs a benchmark row so the page renders in the **ready state** during development. Without this, the page always shows the "collecting" state since no benchmark rows exist in seed.

Add at the end of `seed.sql`, in the Sprint 103 section:

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 103: Benchmark seed row for golden tenant city
-- Alpharetta, GA — Restaurant industry benchmark
-- org_count >= 10 so the "ready" state renders in development
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.benchmarks (
  id,
  city,
  industry,
  org_count,
  avg_score,
  min_score,
  max_score,
  computed_at
)
VALUES (
  'b1234567-89ab-cdef-0123-456789abcdef',
  'Alpharetta',
  'Restaurant',
  14,
  51.20,
  22.50,
  88.00,
  NOW() - INTERVAL '2 days'
)
ON CONFLICT (city, industry) DO UPDATE SET
  org_count   = EXCLUDED.org_count,
  avg_score   = EXCLUDED.avg_score,
  min_score   = EXCLUDED.min_score,
  max_score   = EXCLUDED.max_score,
  computed_at = EXCLUDED.computed_at;
```

**Note:** The `ON CONFLICT DO UPDATE` ensures re-running seed doesn't fail. The benchmark is 2 days old — well within the 14-day staleness threshold from Sprint O.

---

### Component 4: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

Add two benchmark fixtures for use in unit tests:

```typescript
/**
 * Sprint 103 — Benchmark row for Alpharetta (ready state: org_count >= 10).
 * Use this in tests that exercise the "ready" benchmark comparison state.
 */
export const MOCK_BENCHMARK_READY: import('@/lib/data/benchmarks').BenchmarkData = {
  city: 'Alpharetta',
  industry: 'Restaurant',
  org_count: 14,
  avg_score: 51.2,
  min_score: 22.5,
  max_score: 88.0,
  computed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
};

/**
 * Sprint 103 — Benchmark row for Alpharetta (collecting state: org_count < 10).
 * Use this in tests that exercise the "collecting" / not-enough-data state.
 */
export const MOCK_BENCHMARK_COLLECTING: import('@/lib/data/benchmarks').BenchmarkData = {
  city: 'Alpharetta',
  industry: 'Restaurant',
  org_count: 6,
  avg_score: 55.0,
  min_score: 30.0,
  max_score: 80.0,
  computed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
};
```

---

### Component 5: Unit Tests — `src/__tests__/unit/benchmarks-page.test.tsx`

**New file.** Tests the `/dashboard/benchmarks` page component directly. Uses the established pattern from `revenue-impact-page.test.ts` — mock Supabase, mock auth context, render page, assert output.

**Mock setup:**

```typescript
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/data/benchmarks', () => ({
  fetchBenchmark: vi.fn(),
}));
vi.mock('@/lib/location/active-location', () => ({
  getActiveLocationId: vi.fn().mockResolvedValue('loc-golden'),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));
```

**Test spec:**

```
describe('BenchmarksPage')

  describe('auth guard')
    1.  redirects to /login when getSafeAuthContext returns null
    2.  redirects to /login when ctx.orgId is null

  describe('no-city state')
    3.  renders no-city state when locationContext.city is null
    4.  shows "No city set" message
    5.  renders a link to /dashboard/settings

  describe('collecting state (org_count < 10)')
    6.  renders BenchmarkComparisonCard with MOCK_BENCHMARK_COLLECTING
    7.  shows collecting state data-testid benchmark-collecting-state
    8.  does NOT render benchmark-about-section (not enough data to show "about")
    9.  does NOT render benchmark-improve-section

  describe('ready state (org_count >= 10, orgScore present)')
    10. renders BenchmarkComparisonCard with MOCK_BENCHMARK_READY
    11. shows benchmark-ready-state data-testid
    12. renders benchmark-about-section with org_count (14 businesses)
    13. renders formatted computed_at date
    14. renders benchmark-improve-section when orgScore below avg_score
    15. improve section links to /dashboard/hallucinations
    16. renders "above average" message in improve section when orgScore > avg_score

  describe('ready state — no org score yet')
    17. renders BenchmarkComparisonCard with ready benchmark but null orgScore
    18. renders benchmark-no-score-state data-testid
    19. does NOT render benchmark-improve-section when orgScore is null
```

**19 tests total.**

**Mock Supabase builder pattern** (matches `visibility_scores` query):

```typescript
function mockSupabase(options: {
  realityScore?: number | null;
}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'visibility_scores') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: options.realityScore !== undefined && options.realityScore !== null
              ? { reality_score: options.realityScore, snapshot_date: '2026-03-01' }
              : null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };
    }),
  };
}
```

---

### Component 6: E2E — Update `tests/e2e/14-sidebar-nav.spec.ts`

Add `nav-benchmarks` to the navTests array. It belongs in the Intelligence section of the array (after `nav-revenue-impact`):

```typescript
{ testId: 'nav-benchmarks', url: '/dashboard/benchmarks', heading: /Benchmark/i },
```

This brings the total from 23 (after Sprint 102) to **24 tests**.

---

## 🧪 Full Test Plan

### Unit tests — new file

```bash
npx vitest run src/__tests__/unit/benchmarks-page.test.tsx
# 19 tests — all states: auth, no-city, collecting, ready+score, ready+no-score
```

### Unit tests — regression check

```bash
npx vitest run src/__tests__/unit/sprint-o-benchmark.test.ts
# 9 existing fetchBenchmark tests — must still pass unchanged

npx vitest run src/__tests__/unit/sidebar-nav-items.test.ts
# Must pass — no changes to this file this sprint
# (Sprint 102 added Locations; Sprint 103 adds Benchmarks via sidebar-groups)

npx vitest run src/__tests__/unit/sidebar-groups.test.ts
# Key assertion: total grouped items = NAV_ITEMS.length
# Will FAIL if Benchmarks added to NAV_ITEMS but not NAV_GROUPS
```

### TypeScript check

```bash
npx tsc --noEmit
# 0 errors — benchmark table is now typed (Sprint 102)
```

### Full suite

```bash
npx vitest run
# All tests passing — zero regressions
# Baseline: ~2543 tests (Sprint 101 count)
```

### E2E

```bash
npx playwright test tests/e2e/14-sidebar-nav.spec.ts
# 24 tests (was 23 after Sprint 102, now 24 with nav-benchmarks)
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `app/dashboard/benchmarks/page.tsx` | **CREATE** | Full-page benchmarks route — 4 render states, auth guard, parallel data fetch |
| 2 | `components/layout/Sidebar.tsx` | **MODIFY** | Import `Trophy`; add Benchmarks to `NAV_ITEMS`; add `/dashboard/benchmarks` to Intelligence `NAV_GROUPS` filter |
| 3 | `supabase/seed.sql` | **MODIFY** | Add Alpharetta benchmark row (org_count: 14) for golden tenant dev/test |
| 4 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add `MOCK_BENCHMARK_READY` and `MOCK_BENCHMARK_COLLECTING` exports |
| 5 | `src/__tests__/unit/benchmarks-page.test.tsx` | **CREATE** | 19 unit tests covering all page states |
| 6 | `tests/e2e/14-sidebar-nav.spec.ts` | **MODIFY** | Add `nav-benchmarks` entry (24 total) |

**No migrations. No new API routes. No new shared components.**

---

## 🚫 What NOT to Do

1. **DO NOT create a new data layer** — `lib/data/benchmarks.ts` with `fetchBenchmark()` already exists and is fully tested. Use it.
2. **DO NOT duplicate `BenchmarkComparisonCard`** — import it from `app/dashboard/_components/BenchmarkComparisonCard.tsx`. The card handles all 4 internal states; the page just provides props.
3. **DO NOT plan-gate this page** — benchmarks are anonymized aggregates available to all tiers. Do not add `<PlanGate>`.
4. **DO NOT add Benchmarks to `NAV_ITEMS` without also updating `NAV_GROUPS`** — the `sidebar-groups.test.ts` total-count assertion will fail (AI_RULES via Sprint 102 pattern).
5. **DO NOT use `page.waitForTimeout()`** in Playwright tests (AI_RULES §11).
6. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12) — all status colors are literal strings.
7. **DO NOT use `<a>` tags** for internal links — use `<Link>` from `next/link`.
8. **DO NOT fetch all `visibility_scores` rows** — fetch only the most recent: `.order('snapshot_date', { ascending: false }).limit(1).maybeSingle()`.
9. **DO NOT use `as Function` or `as never` casts** (AI_RULES §48) — the `benchmarks` table is fully typed after Sprint 102. Use `supabase.from('benchmarks')` directly.
10. **DO NOT add a new AI_RULES entry for this sprint** — no new patterns introduced. This sprint purely applies existing patterns.

---

## ✅ Definition of Done

- [ ] `app/dashboard/benchmarks/page.tsx` — created; auth guard (redirect to /login); parallel data fetch (`fetchBenchmark` + latest `visibility_scores`); all 4 render states; `data-testid` on page container + all state containers; `<Link>` for all internal navigation; literal Tailwind classes only
- [ ] `components/layout/Sidebar.tsx` — `Trophy` imported; `Benchmarks` in `NAV_ITEMS` with `href: '/dashboard/benchmarks'`; `/dashboard/benchmarks` in Intelligence NAV_GROUP filter
- [ ] `supabase/seed.sql` — Alpharetta benchmark row inserted with `ON CONFLICT DO UPDATE`; org_count: 14; within 14-day staleness window
- [ ] `src/__fixtures__/golden-tenant.ts` — `MOCK_BENCHMARK_READY` and `MOCK_BENCHMARK_COLLECTING` exported
- [ ] `src/__tests__/unit/benchmarks-page.test.tsx` — 19 tests, all passing; covers auth, no-city, collecting, ready+score, ready+no-score states
- [ ] `tests/e2e/14-sidebar-nav.spec.ts` — `nav-benchmarks` entry added; 24 total tests
- [ ] `npx tsc --noEmit` — **0 errors**
- [ ] `npx vitest run src/__tests__/unit/benchmarks-page.test.tsx` — **19 tests passing**
- [ ] `npx vitest run src/__tests__/unit/sprint-o-benchmark.test.ts` — **9 tests passing (no regressions)**
- [ ] `npx vitest run src/__tests__/unit/sidebar-groups.test.ts` — **all passing** (total grouped = NAV_ITEMS length)
- [ ] `npx vitest run` — **all tests passing, zero regressions**
- [ ] `npx playwright test tests/e2e/14-sidebar-nav.spec.ts` — **24 tests passing**
- [ ] DEVLOG.md entry written (see format below)

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-03-01 — Sprint 103: Benchmarks Full Page + Sidebar Entry (Completed)

**Goal:** Promote benchmark comparison from a buried dashboard card to a first-class route. Add dedicated page, sidebar nav entry, seed data, and full test coverage.

**Scope:**
- `app/dashboard/benchmarks/page.tsx` — **NEW.** Server Component. Auth guard → parallel data fetch (fetchBenchmark + latest visibility_scores). 4 render states: no-city (onboarding nudge + Settings link), collecting (org_count < 10), ready with score (full comparison + About section + How to Improve action block), ready without score (benchmark ready but no scan yet). All states have data-testid attributes. Literal Tailwind classes throughout (AI_RULES §12).
- `components/layout/Sidebar.tsx` — **MODIFIED.** Imported `Trophy` icon. Added Benchmarks entry to `NAV_ITEMS` (`href: '/dashboard/benchmarks'`). Added `/dashboard/benchmarks` to Intelligence NAV_GROUP filter.
- `supabase/seed.sql` — **MODIFIED.** Added Alpharetta benchmark seed row (org_count: 14, avg_score: 51.20, min: 22.50, max: 88.00, computed 2 days ago). ON CONFLICT DO UPDATE so re-runs are idempotent.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_BENCHMARK_READY` (org_count: 14, Alpharetta) and `MOCK_BENCHMARK_COLLECTING` (org_count: 6) exports.
- `src/__tests__/unit/benchmarks-page.test.tsx` — **NEW.** 19 Vitest tests. Covers: auth redirects (2), no-city state (3), collecting state (4), ready+score state (7), ready+no-score state (3).
- `tests/e2e/14-sidebar-nav.spec.ts` — **MODIFIED.** Added `nav-benchmarks` entry. Total: 24 tests (was 23).

**Tests added:**
- `src/__tests__/unit/benchmarks-page.test.tsx` — **19 tests** (all states)
- `tests/e2e/14-sidebar-nav.spec.ts` — **24 tests total** (1 new: nav-benchmarks)

**Run commands:**
```bash
npx tsc --noEmit                                                           # 0 errors
npx vitest run src/__tests__/unit/benchmarks-page.test.tsx                 # 19 tests PASS
npx vitest run src/__tests__/unit/sprint-o-benchmark.test.ts               # 9 tests PASS (no regression)
npx vitest run src/__tests__/unit/sidebar-groups.test.ts                   # all passing
npx vitest run                                                              # all passing
npx playwright test tests/e2e/14-sidebar-nav.spec.ts                       # 24 tests
```
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `BenchmarkComparisonCard` | Sprint F | The hero component — all 4 render states already built |
| `fetchBenchmark()` | Sprint F | Data layer — `lib/data/benchmarks.ts` |
| Staleness check (14-day) | Sprint O | Already in `fetchBenchmark()` — no changes needed |
| `benchmarks` table in types | Sprint 102 | Enables `supabase.from('benchmarks')` without casts |
| `as Function` cast removed | Sprint 102 | `lib/data/benchmarks.ts` is now clean |
| `sidebar-groups.test.ts` total-count guard | Sprint A | Catches ungrouped nav items |

---

## 🧠 Edge Cases to Handle

1. **`Trophy` already used elsewhere:** Run `grep -rn "Trophy" /home/claude/local-vector-v1/components/` before adding the import to confirm it's not already imported elsewhere in Sidebar.tsx. If `Trophy` is already used for a different nav item, use `BarChart3` instead (verify it's also unused).

2. **`computed_at` formatting:** `benchmark.computed_at` is typed as `string` in `BenchmarkData` but is `optional` (`computed_at?: string`). Guard with `benchmark.computed_at ? new Date(benchmark.computed_at).toLocaleDateString(...) : 'Recently'` before formatting.

3. **`orgScore` vs `reality_score`:** The `visibility_scores` table has both `visibility_score` and `reality_score` columns. **Use `reality_score`** — this is the blended score that `BenchmarkComparisonCard` expects and what the cron aggregates for benchmarks. Don't use `visibility_score`.

4. **Empty `visibility_scores` table in test env:** In unit tests, mock `visibility_scores` to return `null` for the no-score test cases — this simulates a new org with no scan history yet.

5. **`getActiveLocationId` import path:** It lives at `lib/location/active-location.ts` — import as `@/lib/location/active-location`. Read the file before importing to confirm the exact export name.

6. **Benchmark `avg_score` display precision:** `BenchmarkComparisonCard` displays `benchmark.avg_score` directly. The seed data uses `51.20` — PostgreSQL `numeric(5,2)` may return this as `51.2` (drops trailing zero). The display renders fine either way but verify `Number(benchmarkRow.avg_score)` in `lib/data/benchmarks.ts` handles both formats.

7. **"How to Improve" section threshold:** Show the improve section only when `benchmark` is ready (`org_count >= 10`) AND `orgScore !== null`. If `orgScore === null`, skip the improve section — the user hasn't scanned yet and improvement advice isn't actionable. This prevents showing "resolve hallucinations" when there are no hallucinations yet.

---

## 📚 Document Sync + Git Commit

After all tests pass and `npx tsc --noEmit` shows 0 errors:

### Step 1: Update `docs/DEVLOG.md`

Paste the DEVLOG entry from **📓 DEVLOG Entry Format** above at the top (after the header, before Sprint 102). Replace test count placeholders with actual counts.

### Step 2: Update root `DEVLOG.md`

```markdown
## 2026-03-01 — Sprint 103: Benchmarks Full Page + Sidebar Entry (Completed)
**Goal:** Promote benchmark comparison to first-class route. New /dashboard/benchmarks page (4 states), sidebar entry (Intelligence group, Trophy icon), seed data for Alpharetta (org_count: 14), MOCK_BENCHMARK_READY + MOCK_BENCHMARK_COLLECTING fixtures. 19 unit tests + 24 E2E tests passing.
```

### Step 3: Update `docs/CLAUDE.md`

Add Sprint 103 to the implementation inventory (after Sprint 102):

```markdown
### Sprint 103 — Benchmarks Full Page + Sidebar Entry (2026-03-01)
- `app/dashboard/benchmarks/page.tsx` — **NEW.** Full-page benchmark view. 4 states: no-city, collecting, ready+score, ready+no-score. Reuses BenchmarkComparisonCard as hero. About section + How to Improve action block.
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added Benchmarks (Trophy icon) to NAV_ITEMS + Intelligence NAV_GROUP.
- `supabase/seed.sql` — **MODIFIED.** Alpharetta benchmark row (org_count: 14).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** MOCK_BENCHMARK_READY + MOCK_BENCHMARK_COLLECTING.
- `src/__tests__/unit/benchmarks-page.test.tsx` — **NEW.** 19 Vitest tests.
- `tests/e2e/14-sidebar-nav.spec.ts` — **MODIFIED.** 24 total nav tests.
```

### Step 4: Git commit

```bash
git add -A
git status   # verify staged files

git commit -m "Sprint 103: Benchmarks Full Page + Sidebar Entry

- app/dashboard/benchmarks/page.tsx: NEW full-page benchmark route.
  4 states: no-city, collecting (org_count<10), ready+score,
  ready+no-score. Reuses BenchmarkComparisonCard as hero.
  About section (computed_at, org_count). How to Improve action
  block (conditional on score vs avg). data-testid on all states.
- components/layout/Sidebar.tsx: add Benchmarks (Trophy icon,
  /dashboard/benchmarks) to NAV_ITEMS + Intelligence NAV_GROUP
- supabase/seed.sql: Alpharetta benchmark seed row (org_count: 14,
  avg: 51.20, min: 22.50, max: 88.00) — ON CONFLICT DO UPDATE
- golden-tenant.ts: MOCK_BENCHMARK_READY + MOCK_BENCHMARK_COLLECTING
- benchmarks-page.test.tsx: NEW — 19 tests (auth, no-city,
  collecting, ready+score, ready+no-score states)
- 14-sidebar-nav.spec.ts: add nav-benchmarks (24 total)
- docs: DEVLOG, CLAUDE.md updated

npx tsc --noEmit → 0 errors
npx vitest run → all passing
npx playwright test 14-sidebar-nav → 24 tests passing

Closes audit gap #6: benchmarks now a first-class route."

git push origin main
```
