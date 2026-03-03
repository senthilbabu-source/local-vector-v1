# Sprint 102 — Database Types Sync + Sidebar Nav Completeness

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Two tightly-coupled hygiene sprints shipped as one. Both stem from the same root cause: **`database.types.ts` is out of sync with the production schema**, causing type casts to proliferate across the codebase.

**Problem 1 — Stale types (AI_RULES §48):** Three sprints added columns via migrations but `database.types.ts` was never regenerated:
- **Sprint F** added 4 columns to `ai_hallucinations` (`correction_query`, `verifying_since`, `follow_up_checked_at`, `follow_up_result`) and a brand-new `benchmarks` table
- **Sprint N** added 3 columns to `organizations` (`scan_day_of_week`, `notify_score_drop_alert`, `notify_new_competitor`)

Result: 7 files use `as Function` or `as never` as escape hatches because the TypeScript compiler doesn't know these columns or tables exist.

**Problem 2 — Hidden nav item:** `/dashboard/settings/locations` (the Locations Management page from Sprint 100) has no sidebar entry. Users can only reach it from a direct link. The `/dashboard/locations` redirect page exists but nothing in the nav points to it. This makes location management invisible.

**Why this matters:** Every `as Function` and `as never` cast is a future runtime error waiting to happen — the compiler can't catch mistakes in those code paths. And a hidden Locations page means Agency-plan users who need multi-location management literally cannot find it unless they know the URL.

**Gaps being closed:** Partial items #4 (benchmarks table not in types) and #5 (locations page hidden from nav) from the Sprint 89 codebase audit report.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                           — All engineering rules. Pay special attention to §38.2 (cast pattern), §48 (type drift protocol), §12 (no dynamic Tailwind)
Read docs/CLAUDE.md                                             — Project context, architecture, patterns
Read DEVLOG.md                                                  — Sprint history. Latest: Sprint 101 + FIX-9
Read supabase/migrations/20260308000001_sprint_f_engagement.sql — Sprint F columns on ai_hallucinations + benchmarks table DDL
Read supabase/migrations/20260310000001_sprint_n_settings.sql   — Sprint N columns on organizations
Read lib/supabase/database.types.ts                             — Current types file. Identify what's missing.
Read src/__fixtures__/golden-tenant.ts                          — Golden Tenant fixtures (org_id: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11)
Read lib/data/benchmarks.ts                                     — Uses (supabase.from as Function) cast on line 80 — remove after types update
Read app/api/cron/benchmarks/route.ts                           — Uses (supabase.rpc as Function) and (supabase.from as Function) — remove after types update
Read app/api/cron/correction-follow-up/route.ts                 — Uses .update(... as never) twice — remove after types update
Read app/dashboard/settings/actions.ts                          — Uses .update(parsed.data as never) twice — remove after types update
Read components/layout/Sidebar.tsx                              — NAV_ITEMS array and NAV_GROUPS structure
Read tests/e2e/14-sidebar-nav.spec.ts                           — Current E2E nav tests (9 items tested, many missing)
Read src/__tests__/unit/sidebar-nav-items.test.ts               — Validates AI Assistant position
Read src/__tests__/unit/sidebar-groups.test.ts                  — Validates group structure (total items = NAV_ITEMS.length)
Read src/__tests__/unit/database-types-completeness.test.ts     — Existing type regression tests (Sprint FIX-1, 12 tests)
```

**Specifically understand before writing code:**
- The exact columns added in the Sprint F migration vs what's currently in `ai_hallucinations` Row/Insert/Update types
- The exact columns added in the Sprint N migration vs what's currently in `organizations` Row/Insert/Update types
- The `benchmarks` table DDL — all columns, types, nullable/not-null, defaults
- How `testId` is derived from label: `nav-${label.toLowerCase().replace(/\s+/g, '-')}` (line 387 of Sidebar.tsx)
- Why `/dashboard/settings/locations` is the correct nav target (not `/dashboard/locations` which just redirects there)
- The `NAV_GROUPS` filter pattern — new items must appear in both `NAV_ITEMS` array AND the `NAV_GROUPS` filter list or they render as ungrouped

---

## 🏗️ Architecture — What to Build

### Component 1: Manual Types Update — `lib/supabase/database.types.ts`

**Context:** `supabase gen types` requires a running local Supabase instance. Since we are not running the Supabase CLI here, add the missing columns manually. This is the established pattern — see how Sprint FIX-1 did it in `database-types-completeness.test.ts`.

**After making changes, run `npx tsc --noEmit` to verify zero errors.**

#### 1a. Add missing columns to `ai_hallucinations`

The Sprint F migration (`20260308000001_sprint_f_engagement.sql`) added these 4 columns via `ALTER TABLE`:

```sql
correction_query    text          -- nullable, no default
verifying_since     timestamptz   -- nullable, no default
follow_up_checked_at timestamptz  -- nullable, no default
follow_up_result    text          -- nullable, no default
```

In `database.types.ts`, find the `ai_hallucinations` table definition (currently around line 170). Add to **Row**, **Insert**, and **Update** sections:

```typescript
// In Row:
correction_query: string | null;
verifying_since: string | null;
follow_up_checked_at: string | null;
follow_up_result: string | null;

// In Insert (all optional, all nullable):
correction_query?: string | null;
verifying_since?: string | null;
follow_up_checked_at?: string | null;
follow_up_result?: string | null;

// In Update (all optional, all nullable):
correction_query?: string | null;
verifying_since?: string | null;
follow_up_checked_at?: string | null;
follow_up_result?: string | null;
```

#### 1b. Add missing columns to `organizations`

The Sprint N migration (`20260310000001_sprint_n_settings.sql`) added:

```sql
scan_day_of_week       integer    DEFAULT 0    CHECK (0–6)
notify_score_drop_alert boolean   DEFAULT true
notify_new_competitor   boolean   DEFAULT false
```

In `database.types.ts`, find the `organizations` table (currently around line 1328). Add to **Row**, **Insert**, and **Update**:

```typescript
// In Row:
scan_day_of_week: number | null;
notify_score_drop_alert: boolean | null;
notify_new_competitor: boolean | null;

// In Insert:
scan_day_of_week?: number | null;
notify_score_drop_alert?: boolean | null;
notify_new_competitor?: boolean | null;

// In Update:
scan_day_of_week?: number | null;
notify_score_drop_alert?: boolean | null;
notify_new_competitor?: boolean | null;
```

#### 1c. Add the `benchmarks` table (entirely absent from types)

The Sprint F migration created the `benchmarks` table:

```sql
CREATE TABLE IF NOT EXISTS public.benchmarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city        text NOT NULL,
  industry    text NOT NULL DEFAULT 'restaurant',
  org_count   integer NOT NULL,
  avg_score   numeric(5,2) NOT NULL,
  min_score   numeric(5,2) NOT NULL,
  max_score   numeric(5,2) NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT benchmarks_city_industry UNIQUE (city, industry)
);
```

Add a new `benchmarks` entry to the `Tables` section in `database.types.ts`, placed alphabetically (before `business_info`):

```typescript
benchmarks: {
  Row: {
    id: string;
    city: string;
    industry: string;
    org_count: number;
    avg_score: number;
    min_score: number;
    max_score: number;
    computed_at: string;
  };
  Insert: {
    id?: string;
    city: string;
    industry?: string;
    org_count: number;
    avg_score: number;
    min_score: number;
    max_score: number;
    computed_at?: string;
  };
  Update: {
    id?: string;
    city?: string;
    industry?: string;
    org_count?: number;
    avg_score?: number;
    min_score?: number;
    max_score?: number;
    computed_at?: string;
  };
  Relationships: [];
};
```

**Note on numeric(5,2):** Supabase returns PostgreSQL `numeric` as `number` in TypeScript (not `string`). Use `number`.

---

### Component 2: Remove `as Function` Casts — `lib/data/benchmarks.ts`

After the `benchmarks` table is in types, the cast on line 80 is no longer needed.

**Before (line ~80):**
```typescript
const { data: benchmarkRow } = await (supabase.from as Function)('benchmarks')
  .select('city, industry, org_count, avg_score, min_score, max_score, computed_at')
  .eq('city', city)
  .eq('industry', industry)
  .maybeSingle() as { data: { ... } | null };
```

**After (strongly typed):**
```typescript
const { data: benchmarkRow } = await supabase
  .from('benchmarks')
  .select('city, industry, org_count, avg_score, min_score, max_score, computed_at')
  .eq('city', city)
  .eq('industry', industry)
  .maybeSingle();
```

The inline type cast after `.maybeSingle()` is also removed — the return type now infers correctly from the generated types. The `BenchmarkData` mapping below stays the same; just clean up the redundant manual cast.

---

### Component 3: Remove `as Function` Casts — `app/api/cron/benchmarks/route.ts`

Two casts to remove after types are updated:

**Cast 1 — RPC call (line ~48):**
```typescript
// Before:
const { data, error } = await (supabase.rpc as Function)('compute_benchmarks', {});

// After:
const { data, error } = await supabase.rpc('compute_benchmarks', {});
```

**Note:** `compute_benchmarks` is an RPC function defined in the Sprint F migration. It may or may not appear in `database.types.ts` under `Functions`. Read the current types file to check. If it's not in `Functions`, the `rpc()` call will still TypeScript-error. In that case, add it to the `Functions` section:

```typescript
compute_benchmarks: {
  Args: Record<PropertyKey, never>;
  Returns: {
    city: string;
    industry: string;
    org_count: number;
    avg_score: number;
    min_score: number;
    max_score: number;
  }[];
};
```

**Cast 2 — upsert call (line ~56):**
```typescript
// Before:
const { error: upsertErr } = await (supabase.from as Function)('benchmarks')
  .upsert({ ... }, { onConflict: 'city,industry' });

// After:
const { error: upsertErr } = await supabase
  .from('benchmarks')
  .upsert({ ... }, { onConflict: 'city,industry' });
```

---

### Component 4: Remove `as never` Casts — `app/api/cron/correction-follow-up/route.ts`

Two casts to remove. Both exist because `correction_query`, `verifying_since`, `follow_up_checked_at`, and `follow_up_result` weren't in the types. After Component 1 they are.

**Cast 1 (line ~107):**
```typescript
// Before:
await supabase
  .from('ai_hallucinations')
  .update(updatePayload as never)
  .eq('id', alert.id);

// After:
await supabase
  .from('ai_hallucinations')
  .update(updatePayload)
  .eq('id', alert.id);
```

**Note:** `updatePayload` is typed as `Record<string, unknown>`. After removing `as never`, TypeScript may still complain that `Record<string, unknown>` isn't assignable to the Update type. If so, type `updatePayload` explicitly:

```typescript
const updatePayload: Database['public']['Tables']['ai_hallucinations']['Update'] = {
  correction_status: newStatus,
  follow_up_result: newStatus,
  follow_up_checked_at: new Date().toISOString(),
};
if (newStatus === 'fixed') {
  updatePayload.resolved_at = new Date().toISOString();
}
```

**Cast 2 (line ~130):**
```typescript
// Before:
await supabase
  .from('ai_hallucinations')
  .update({ follow_up_checked_at: new Date().toISOString() } as never)
  .eq('id', alert.id);

// After:
await supabase
  .from('ai_hallucinations')
  .update({ follow_up_checked_at: new Date().toISOString() })
  .eq('id', alert.id);
```

---

### Component 5: Remove `as never` Casts — `app/dashboard/settings/actions.ts`

Two casts to remove. Both exist because `scan_day_of_week`, `notify_score_drop_alert`, and `notify_new_competitor` weren't in the `organizations` Update type. After Component 1 they are.

**Cast 1 (line ~164) — notification preferences update:**
```typescript
// Before:
const { error } = await supabase
  .from('organizations')
  .update(parsed.data as never)
  .eq('id', ctx.orgId);

// After:
const { error } = await supabase
  .from('organizations')
  .update(parsed.data)
  .eq('id', ctx.orgId);
```

**Cast 2 (line ~207) — AI monitoring prefs update:**
```typescript
// Before:
const { error } = await supabase
  .from('organizations')
  .update({
    monitored_ai_models: parsed.data.monitored_ai_models,
    scan_day_of_week: parsed.data.scan_day_of_week,
  } as never)
  .eq('id', ctx.orgId);

// After:
const { error } = await supabase
  .from('organizations')
  .update({
    monitored_ai_models: parsed.data.monitored_ai_models,
    scan_day_of_week: parsed.data.scan_day_of_week,
  })
  .eq('id', ctx.orgId);
```

**Note:** `monitored_ai_models` may also be absent from the types if it was added in a migration. Check and add if needed.

---

### Component 6: Add Locations to Sidebar — `components/layout/Sidebar.tsx`

**Context:** `/dashboard/settings/locations` is the Locations Management page (Sprint 100). It is fully built with LocationCard, LocationFormModal, plan-gating for Agency. Zero sidebar entry exists — users cannot discover it. `/dashboard/locations` is a redirect shim that points there. The nav item should target `/dashboard/settings/locations` directly — the redirect shim is just a bookmark-preservation layer and is not the canonical URL.

**Step 1 — Import the icon.** `MapPinned` (distinct from the existing `MapPin` used for "Listings") is the correct icon for a locations management page. Add it to the lucide-react import at the top of Sidebar.tsx:

```typescript
import {
  // ... existing imports ...
  MapPinned,   // ← add this (Locations management — distinct from MapPin used for Listings)
} from 'lucide-react';
```

**Step 2 — Add to `NAV_ITEMS`.** Insert after the `Listings` entry (`/dashboard/integrations`) to keep related items together:

```typescript
{
  href: '/dashboard/settings/locations',
  label: 'Locations',
  icon: MapPinned,
  exact: false,
  active: true,
},
```

**Step 3 — Add to `NAV_GROUPS`.** The `Admin` group currently contains:
```typescript
'/dashboard/ai-assistant',
'/dashboard/integrations',
'/dashboard/system-health',
'/dashboard/settings',
'/dashboard/billing',
```

Add `/dashboard/settings/locations` to this group, after `/dashboard/integrations`:
```typescript
{
  label: 'Admin',
  items: NAV_ITEMS.filter((i) =>
    [
      '/dashboard/ai-assistant',
      '/dashboard/integrations',
      '/dashboard/settings/locations',   // ← add here
      '/dashboard/system-health',
      '/dashboard/settings',
      '/dashboard/billing',
    ].includes(i.href),
  ),
},
```

**Critical:** If `NAV_GROUPS` does not include the href in its filter list, the item will be in `NAV_ITEMS` but rendered in no group — it simply disappears from the rendered sidebar. The `sidebar-groups.test.ts` test `'total item count across all groups equals the NAV_ITEMS count'` will catch this regression.

**Resulting `data-testid`:** The sidebar generates testIds as:
```typescript
`nav-${displayLabel.toLowerCase().replace(/\s+/g, '-')}`
```
For label `'Locations'` → `data-testid="nav-locations"`.

---

### Component 7: Update E2E Spec — `tests/e2e/14-sidebar-nav.spec.ts`

The current spec tests 9 nav items. It is missing coverage for 14 of the 23 items in `NAV_ITEMS`. This sprint adds the Locations entry and expands coverage for all currently-untested items.

**Replace the existing `navTests` array with the complete set:**

```typescript
const navTests = [
  // ── Overview ─────────────────────────────────────────────────────────
  { testId: 'nav-dashboard',          url: '/dashboard',                   heading: /Dashboard/i },
  { testId: 'nav-alerts',             url: '/dashboard/hallucinations',    heading: /Alerts|Hallucination/i },
  // ── AI Visibility ─────────────────────────────────────────────────────
  { testId: 'nav-share-of-voice',     url: '/dashboard/share-of-voice',    heading: /Share of Voice/i },
  { testId: 'nav-cluster-map',        url: '/dashboard/cluster-map',       heading: /Cluster/i },
  { testId: 'nav-ai-says',            url: '/dashboard/ai-responses',      heading: /AI Says|Responses/i },
  { testId: 'nav-ai-sentiment',       url: '/dashboard/sentiment',         heading: /Sentiment/i },
  { testId: 'nav-ai-sources',         url: '/dashboard/source-intelligence', heading: /Sources|Intelligence/i },
  { testId: 'nav-bot-activity',       url: '/dashboard/crawler-analytics', heading: /Bot|Crawler/i },
  // ── Content & Menu ────────────────────────────────────────────────────
  { testId: 'nav-menu',               url: '/dashboard/magic-menus',       heading: /Menu/i },
  { testId: 'nav-content',            url: '/dashboard/content-drafts',    heading: /Content/i },
  { testId: 'nav-content-calendar',   url: '/dashboard/content-calendar',  heading: /Calendar/i },
  { testId: 'nav-page-audits',        url: '/dashboard/page-audits',       heading: /Page Audits/i },
  { testId: 'nav-citations',          url: '/dashboard/citations',         heading: /Citation/i },
  { testId: 'nav-proof-timeline',     url: '/dashboard/proof-timeline',    heading: /Proof|Timeline/i },
  // ── Intelligence ──────────────────────────────────────────────────────
  { testId: 'nav-compete',            url: '/dashboard/compete',           heading: /Compete/i },
  { testId: 'nav-revenue-impact',     url: '/dashboard/revenue-impact',    heading: /Revenue/i },
  { testId: 'nav-agent-readiness',    url: '/dashboard/agent-readiness',   heading: /Agent/i },
  { testId: 'nav-entity-health',      url: '/dashboard/entity-health',     heading: /Entity/i },
  // ── Admin ─────────────────────────────────────────────────────────────
  { testId: 'nav-ai-assistant',       url: '/dashboard/ai-assistant',      heading: /Assistant/i },
  { testId: 'nav-listings',           url: '/dashboard/integrations',      heading: /Listings/i },
  { testId: 'nav-locations',          url: '/dashboard/settings/locations', heading: /Locations/i },
  { testId: 'nav-settings',           url: '/dashboard/settings',          heading: /Settings/i },
  { testId: 'nav-billing',            url: '/dashboard/billing',           heading: /Billing|Plan/i },
];
```

**Note on System Health:** `/dashboard/system-health` is present in `NAV_ITEMS` but intentionally omitted from the E2E test array above. It relies on cron log data that is not present in the test environment. If a `system-health` E2E test already exists in another spec file, do not duplicate it here. If it doesn't exist and you can reliably test the page heading loads, add it. Use your judgment — do not add a flaky test.

**Implementation rules:**
- Do NOT use `page.waitForTimeout()` — use `page.waitForSelector()` or `page.waitForURL()`.
- All assertions use `page.getByTestId(testId)` — no CSS selectors.
- The test loop pattern (one `test()` per `navTests` entry) remains unchanged.
- The `heading` regex matches are intentionally loose — page headings vary slightly by screen width and plan. The intent is to verify the correct page loaded, not the exact heading text.

---

### Component 8: Extend Unit Test — `src/__tests__/unit/database-types-completeness.test.ts`

The existing file has 12 tests covering Sprint 99–101 schema. **Extend it** — do not create a new file — with a new describe block covering Sprint F and Sprint N columns:

```
describe('database.types.ts — Sprint F + Sprint N completeness', () => {

  describe('ai_hallucinations table has Sprint F follow-up columns', () => {
    13. correction_query is string | null
    14. verifying_since is string | null
    15. follow_up_checked_at is string | null
    16. follow_up_result is string | null
  });

  describe('organizations table has Sprint N notification columns', () => {
    17. scan_day_of_week is number | null
    18. notify_score_drop_alert is boolean | null
    19. notify_new_competitor is boolean | null
  });

  describe('benchmarks table is present in types', () => {
    20. benchmarks Row type is accessible and has correct fields
    21. benchmarks Insert type is accessible
    22. benchmarks Update type is accessible
    23. avg_score is number (not string — PostgreSQL numeric maps to number)
  });

  describe('no (as Function) or (as never) casts remain in target files', () => {
    24. lib/data/benchmarks.ts does not contain 'as Function'
    25. app/api/cron/benchmarks/route.ts does not contain 'as Function'
    26. app/api/cron/correction-follow-up/route.ts does not contain 'as never'
    27. app/dashboard/settings/actions.ts does not contain 'as never'
  });

});
```

**17 new tests. Total file: 29 tests (was 12).**

Use the same compile-time type assertion pattern as the existing tests:
```typescript
type HallucinationRow = Database['public']['Tables']['ai_hallucinations']['Row'];
const val: HallucinationRow['correction_query'] = null;
expect(val).toBeNull();
```

For the "no cast" tests, use `fs.readFileSync` + `expect(content).not.toContain(...)` — same pattern as tests 10–12.

---

### Component 9: Extend Unit Test — `src/__tests__/unit/sidebar-nav-items.test.ts`

The existing file validates the AI Assistant position. **Extend it** with Locations assertions — do not create a new file:

```
describe('Sidebar NAV_ITEMS — Locations entry (Sprint 102)', () => {
  5. includes Locations entry with href /dashboard/settings/locations
  6. Locations label is 'Locations'
  7. Locations has active=true
  8. Locations is positioned after Listings (integrations)
  9. Locations is positioned before System Health
});
```

**5 new tests. Total file: 9 tests (was 4).**

---

## 🧪 Testing — Complete Test Plan

### Existing tests — must all still pass (zero regressions)

```bash
npx vitest run src/__tests__/unit/sidebar-groups.test.ts
# Key: 'total item count across all groups equals the NAV_ITEMS count'
# This test will FAIL until Component 6 Step 3 (NAV_GROUPS update) is done

npx vitest run src/__tests__/unit/sidebar-nav-items.test.ts
# 4 existing tests pass, then 5 new ones

npx vitest run src/__tests__/unit/database-types-completeness.test.ts
# 12 existing tests pass, then 17 new ones
```

### New unit tests

```bash
npx vitest run src/__tests__/unit/database-types-completeness.test.ts
# 29 tests total — 17 new for Sprint F + Sprint N + benchmarks + cast removal

npx vitest run src/__tests__/unit/sidebar-nav-items.test.ts
# 9 tests total — 5 new for Locations nav entry
```

### TypeScript verification

```bash
npx tsc --noEmit
# Must show 0 errors after Component 1 types update
# Run this BEFORE removing casts, then AFTER — both must be 0
```

### Full regression suite

```bash
npx vitest run
# All tests passing — zero regressions
# Baseline: 1789+ tests (see DEVLOG for latest count)
```

### E2E

```bash
npx playwright test tests/e2e/14-sidebar-nav.spec.ts
# 23 tests (expanded from 9)
# Auth: uses .playwright/dev-user.json (golden tenant, Growth plan)
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/supabase/database.types.ts` | **MODIFY** | Add `benchmarks` table; add Sprint F columns to `ai_hallucinations`; add Sprint N columns to `organizations`; add `compute_benchmarks` to `Functions` if missing |
| 2 | `lib/data/benchmarks.ts` | **MODIFY** | Remove `(supabase.from as Function)` cast — line 80 |
| 3 | `app/api/cron/benchmarks/route.ts` | **MODIFY** | Remove `(supabase.rpc as Function)` cast (line 48) and `(supabase.from as Function)` cast (line 56) |
| 4 | `app/api/cron/correction-follow-up/route.ts` | **MODIFY** | Remove `.update(updatePayload as never)` (line 107) and `.update({ follow_up_checked_at: ... } as never)` (line 130) |
| 5 | `app/dashboard/settings/actions.ts` | **MODIFY** | Remove `.update(parsed.data as never)` (line 164) and `.update({ ... } as never)` (line 207) |
| 6 | `components/layout/Sidebar.tsx` | **MODIFY** | Import `MapPinned`; add Locations to `NAV_ITEMS`; add `/dashboard/settings/locations` to Admin `NAV_GROUPS` filter |
| 7 | `tests/e2e/14-sidebar-nav.spec.ts` | **MODIFY** | Expand `navTests` array from 9 to 23 entries covering all nav items |
| 8 | `src/__tests__/unit/database-types-completeness.test.ts` | **MODIFY** | Add 17 new tests for Sprint F + Sprint N + benchmarks + cast removal |
| 9 | `src/__tests__/unit/sidebar-nav-items.test.ts` | **MODIFY** | Add 5 new tests for Locations nav entry |

**No new files. No migrations. No new components. Pure correctness work.**

---

## 🚫 What NOT to Do

1. **DO NOT run `supabase gen types`** — this sprint manually adds the missing types. The generated file format must be preserved exactly. Match the indentation, spacing, and semicolon style of the existing entries.
2. **DO NOT use `as any`** (AI_RULES §38.2) — if a cast is still needed temporarily, use `as unknown as TargetType`. The goal is to remove casts, not replace them with `as any`.
3. **DO NOT add `/dashboard/locations` as the nav href** — it's a redirect shim. Use `/dashboard/settings/locations` as the nav target directly.
4. **DO NOT create a new sidebar unit test file** — extend `sidebar-nav-items.test.ts`.
5. **DO NOT create a new types test file** — extend `database-types-completeness.test.ts`.
6. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12) — the Locations icon color follows the same active/inactive pattern already in Sidebar.tsx.
7. **DO NOT add Locations to `NAV_ITEMS` without also adding it to `NAV_GROUPS`** — ungrouped items render in no group and are invisible in the sidebar. The `sidebar-groups.test.ts` will catch this.
8. **DO NOT use `page.waitForTimeout()`** in Playwright tests (AI_RULES §11) — use `page.waitForURL()` or `page.waitForSelector()`.
9. **DO NOT modify `middleware.ts`** (AI_RULES §6) — all middleware logic lives in `proxy.ts`.
10. **DO NOT remove the `as unknown as Hallucination[]` cast in `app/dashboard/hallucinations/page.tsx`** — this was added in FIX-9 for `follow_up_result`. After this sprint adds `follow_up_result` to the types, that specific cast CAN be removed (replace with a direct cast). If you remove it, add a comment explaining it was resolved by Sprint 102 types regeneration.

---

## ✅ Definition of Done

- [ ] `lib/supabase/database.types.ts` — `benchmarks` table added (Row/Insert/Update/Relationships); 4 Sprint F columns added to `ai_hallucinations` Row/Insert/Update; 3 Sprint N columns added to `organizations` Row/Insert/Update; `compute_benchmarks` in `Functions` if absent
- [ ] `lib/data/benchmarks.ts` — `(supabase.from as Function)` cast removed, replaced with typed `.from('benchmarks')` call
- [ ] `app/api/cron/benchmarks/route.ts` — both `as Function` casts removed
- [ ] `app/api/cron/correction-follow-up/route.ts` — both `as never` casts removed; `updatePayload` typed explicitly using `Database['public']['Tables']['ai_hallucinations']['Update']`
- [ ] `app/dashboard/settings/actions.ts` — both `as never` casts removed
- [ ] `components/layout/Sidebar.tsx` — `MapPinned` imported; `Locations` entry in `NAV_ITEMS` with `href: '/dashboard/settings/locations'`; `/dashboard/settings/locations` added to Admin group filter in `NAV_GROUPS`
- [ ] `tests/e2e/14-sidebar-nav.spec.ts` — `navTests` expanded to 23 entries covering all nav items; `nav-locations` entry present
- [ ] `src/__tests__/unit/database-types-completeness.test.ts` — 17 new tests added; 29 total
- [ ] `src/__tests__/unit/sidebar-nav-items.test.ts` — 5 new tests for Locations; 9 total
- [ ] `npx tsc --noEmit` — **0 errors**
- [ ] `npx vitest run src/__tests__/unit/database-types-completeness.test.ts` — **29 tests passing**
- [ ] `npx vitest run src/__tests__/unit/sidebar-nav-items.test.ts` — **9 tests passing**
- [ ] `npx vitest run src/__tests__/unit/sidebar-groups.test.ts` — **all tests passing** (total grouped items = total NAV_ITEMS)
- [ ] `npx vitest run` — **all tests passing, zero regressions**
- [ ] `npx playwright test tests/e2e/14-sidebar-nav.spec.ts` — **23 tests passing**
- [ ] `app/dashboard/hallucinations/page.tsx` — `as unknown as Hallucination[]` cast optionally cleaned up now that `follow_up_result` is in types (document decision either way)
- [ ] DEVLOG.md entry written (see format below)

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-03-01 — Sprint 102: Database Types Sync + Sidebar Nav Completeness (Completed)

**Goal:** Eliminate all `as Function` and `as never` escape-hatch casts introduced by 3 sprints of schema drift (Sprint F, Sprint N) and surface the Locations Management page in the sidebar.

**Scope:**
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `benchmarks` table (Row/Insert/Update/Relationships). Added 4 Sprint F columns to `ai_hallucinations` (correction_query, verifying_since, follow_up_checked_at, follow_up_result: all `string | null`). Added 3 Sprint N columns to `organizations` (scan_day_of_week: `number | null`, notify_score_drop_alert: `boolean | null`, notify_new_competitor: `boolean | null`). Added `compute_benchmarks` to Functions if absent.
- `lib/data/benchmarks.ts` — **MODIFIED.** Removed `(supabase.from as Function)('benchmarks')` cast (line 80). Now uses strongly-typed `.from('benchmarks')`. Removed redundant manual type cast on `.maybeSingle()` result.
- `app/api/cron/benchmarks/route.ts` — **MODIFIED.** Removed `(supabase.rpc as Function)('compute_benchmarks', {})` cast (line 48) and `(supabase.from as Function)('benchmarks')` cast (line 56).
- `app/api/cron/correction-follow-up/route.ts` — **MODIFIED.** Removed `.update(updatePayload as never)` (line 107) and `.update({ follow_up_checked_at: ... } as never)` (line 130). Typed `updatePayload` explicitly as `Database['public']['Tables']['ai_hallucinations']['Update']`.
- `app/dashboard/settings/actions.ts` — **MODIFIED.** Removed `.update(parsed.data as never)` (line 164) and `.update({ monitored_ai_models, scan_day_of_week } as never)` (line 207).
- `components/layout/Sidebar.tsx` — **MODIFIED.** Imported `MapPinned` from lucide-react. Added Locations entry to `NAV_ITEMS` (`href: '/dashboard/settings/locations'`, label: 'Locations', icon: MapPinned). Added `/dashboard/settings/locations` to Admin group filter in `NAV_GROUPS`.
- `tests/e2e/14-sidebar-nav.spec.ts` — **MODIFIED.** Expanded `navTests` from 9 entries to 23 — full coverage of all sidebar nav items including new `nav-locations` entry.
- `src/__tests__/unit/database-types-completeness.test.ts` — **MODIFIED.** Added 17 new tests (Sprint F + Sprint N + benchmarks + cast removal guards). Total: 29 tests (was 12).
- `src/__tests__/unit/sidebar-nav-items.test.ts` — **MODIFIED.** Added 5 new tests for Locations nav entry. Total: 9 tests (was 4).

**Tests:**
- `src/__tests__/unit/database-types-completeness.test.ts` — **N tests** (29 total)
- `src/__tests__/unit/sidebar-nav-items.test.ts` — **N tests** (9 total)
- `src/__tests__/unit/sidebar-groups.test.ts` — **N tests passing** (no regressions)
- `npx vitest run` — **N tests passing** (zero regressions)
- `tests/e2e/14-sidebar-nav.spec.ts` — **23 Playwright tests**
- `npx tsc --noEmit` — **0 errors**

**Run commands:**
```bash
npx tsc --noEmit
npx vitest run src/__tests__/unit/database-types-completeness.test.ts   # 29 tests
npx vitest run src/__tests__/unit/sidebar-nav-items.test.ts             # 9 tests
npx vitest run src/__tests__/unit/sidebar-groups.test.ts                # all passing
npx vitest run                                                           # all passing
npx playwright test tests/e2e/14-sidebar-nav.spec.ts                    # 23 tests
```
```

> **Before writing the DEVLOG entry:** Replace all `N` placeholders with actual test counts by running `grep -cE "^\s*(it|test)\(" <file>` on each test file per AI_RULES §13.3.

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| Sprint F migration | Sprint F | `benchmarks` table DDL + `ai_hallucinations` columns — the schema being typed |
| Sprint N migration | Sprint N | `organizations` columns — the schema being typed |
| Locations Management page | Sprint 100 | `/dashboard/settings/locations` — the page we're adding to the nav |
| FIX-9 TypeScript sweep | FIX-9 | Cleared all pre-existing TS errors — Sprint 102 must not introduce new ones |
| `sidebar-groups.test.ts` | Sprint A | Total grouped items = NAV_ITEMS.length — catches ungrouped nav items |
| `database-types-completeness.test.ts` | FIX-1 | Type regression guard — we extend it, not replace it |

---

## 🧠 Edge Cases to Handle

1. **`monitored_ai_models` column:** `app/dashboard/settings/actions.ts` also updates `monitored_ai_models` on `organizations`. Check if it's in the types. If not, add it as `Json | null` (it stores a JSON array of model strings). If the cast removal causes a TS error because of this column specifically, fix it there too.

2. **`compute_benchmarks` RPC return type:** The function returns `{ city, industry, org_count, avg_score, min_score, max_score }[]`. After adding it to `Functions`, the `supabase.rpc('compute_benchmarks', {})` call's return type is `{ city: string; industry: string; org_count: number; avg_score: number; min_score: number; max_score: number }[]`. Verify the downstream usage in the cron matches these types.

3. **`avg_score` as `number` vs `string`:** PostgreSQL `numeric(5,2)` comes back as `string` from some Supabase versions, `number` from others. Read `lib/data/benchmarks.ts` — it wraps values in `Number(benchmarkRow.avg_score)` which suggests the raw DB value may be a string. If tests fail because `avg_score` is `string` not `number` in the actual response, change the type to `string` in the types file and update the `BenchmarkData` mapping accordingly. Do not assume — test.

4. **`sidebar-groups.test.ts` will fail mid-sprint:** After adding Locations to `NAV_ITEMS` (step 2 of Component 6) but before adding it to `NAV_GROUPS` (step 3), the test `'total item count across all groups equals the NAV_ITEMS count'` will fail. Do both steps atomically in the same edit, or run the test only after both steps are complete.

5. **`nav-system-health` test flakiness:** The System Health page renders a cron run log table. In the test environment with no DB, it may show an empty state or error boundary. Add `nav-system-health` to the E2E test array only if you can confirm the page heading is unconditionally rendered regardless of data. Otherwise omit it.

6. **`hallucinations/page.tsx` double cast:** After Sprint 102, `follow_up_result` is in the types. The `as unknown as Hallucination[]` cast added in FIX-9 can be changed to a direct `as Hallucination[]`. This is optional but clean — do it if `npx tsc --noEmit` is already at 0 errors and the simpler cast works.

---

## 📚 Document Sync + Git Commit (Run After All Tests Pass)

After all Vitest and Playwright tests pass and `npx tsc --noEmit` shows 0 errors, perform the following sync.

### Step 1: Update `docs/DEVLOG.md`

Paste the DEVLOG entry from the **📓 DEVLOG Entry Format** section above at the top of `docs/DEVLOG.md` (after the header, before the FIX-9 entry). Replace all `N` test count placeholders with actual counts.

### Step 2: Update root `DEVLOG.md`

Add a one-line summary at the top of root `DEVLOG.md`:
```markdown
## 2026-03-01 — Sprint 102: Database Types Sync + Sidebar Nav Completeness (Completed)
**Goal:** Sync database.types.ts with 3 sprints of schema drift (Sprint F + Sprint N: benchmarks table, 7 new columns). Remove all `as Function`/`as never` casts (5 files). Add Locations to sidebar nav. 29 unit tests + 23 E2E tests passing.
```

### Step 3: Update `docs/CLAUDE.md`

Add Sprint 102 to the implementation inventory (after FIX-9 entry):
```markdown
### Sprint 102 — Database Types Sync + Sidebar Nav Completeness (2026-03-01)
- `lib/supabase/database.types.ts` — **MODIFIED.** Added `benchmarks` table; Sprint F columns on `ai_hallucinations`; Sprint N columns on `organizations`; `compute_benchmarks` RPC.
- `lib/data/benchmarks.ts` / `app/api/cron/benchmarks/route.ts` — **MODIFIED.** Removed `as Function` casts (3 total).
- `app/api/cron/correction-follow-up/route.ts` / `app/dashboard/settings/actions.ts` — **MODIFIED.** Removed `as never` casts (4 total).
- `components/layout/Sidebar.tsx` — **MODIFIED.** Added Locations nav item pointing to `/dashboard/settings/locations`. Added to Admin NAV_GROUP.
- `tests/e2e/14-sidebar-nav.spec.ts` — **MODIFIED.** Expanded to 23 nav tests (was 9).
- `src/__tests__/unit/database-types-completeness.test.ts` — **MODIFIED.** Extended to 29 tests (was 12).
- `src/__tests__/unit/sidebar-nav-items.test.ts` — **MODIFIED.** Extended to 9 tests (was 4).
```

Update the build history footer: `AI_RULES: §1–§122` remains unchanged (no new rule this sprint).

### Step 4: Git commit

```bash
git add -A
git status   # verify staged files

git commit -m "Sprint 102: Database Types Sync + Sidebar Nav Completeness

- database.types.ts: add benchmarks table (Row/Insert/Update);
  add Sprint F columns to ai_hallucinations (correction_query,
  verifying_since, follow_up_checked_at, follow_up_result);
  add Sprint N columns to organizations (scan_day_of_week,
  notify_score_drop_alert, notify_new_competitor);
  add compute_benchmarks to Functions
- lib/data/benchmarks.ts: remove (supabase.from as Function) cast
- app/api/cron/benchmarks/route.ts: remove 2x as Function casts
- app/api/cron/correction-follow-up/route.ts: remove 2x as never casts
- app/dashboard/settings/actions.ts: remove 2x as never casts
- components/layout/Sidebar.tsx: add Locations nav item (MapPinned icon,
  href: /dashboard/settings/locations, Admin group)
- tests/e2e/14-sidebar-nav.spec.ts: expand to 23 nav tests (was 9)
- database-types-completeness.test.ts: extend to 29 tests (was 12)
- sidebar-nav-items.test.ts: extend to 9 tests (was 4)
- docs: DEVLOG, CLAUDE.md updated

npx tsc --noEmit → 0 errors
npx vitest run → all tests passing
npx playwright test 14-sidebar-nav → 23 tests passing

Closes audit partial gaps #4 (benchmarks not in types) and #5 (locations hidden from nav).
Implements AI_RULES §48 post-migration type sync protocol."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 102 completes:
- **Zero `as Function` casts** in production code (3 removed)
- **Zero `as never` casts** in production code (4 removed)
- **`database.types.ts` fully in sync** with all migrations through Sprint N — the compiler now guards `benchmarks`, `correction_query`, `verifying_since`, `follow_up_checked_at`, `follow_up_result`, `scan_day_of_week`, `notify_score_drop_alert`, `notify_new_competitor`
- **Locations Management page discoverable** via sidebar for all users — Agency users can now find multi-location management without knowing the direct URL
- **E2E nav coverage expanded** from 9 → 23 items (100% of NAV_ITEMS covered)
- **Type regression guard expanded** from 12 → 29 tests
- All 5 `as Function`/`as never` files now have full TypeScript protection — runtime errors that were previously invisible to the compiler are now caught at build time
