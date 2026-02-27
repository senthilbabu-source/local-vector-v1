# Claude Code Prompt — Sprint 88: Phase 5 SOV Cleanup + Build Plan Reconciliation

## ⚠️ READ BEFORE ANYTHING ELSE

Read these files in order BEFORE writing any code:
1. `docs/AI_RULES.md` — all rules. Critical for this sprint:
   - §1 (schema source of truth = `prod_schema.sql`)
   - §3 (RLS, `getSafeAuthContext()`, belt-and-suspenders `.eq('org_id', orgId)`)
   - §4 (tests first, golden tenant fixtures, mocking)
   - §12 (Tailwind literal classes — no dynamic concatenation)
   - §13 (DEVLOG format, verified test counts)
   - §20 (never hardcode placeholder metrics — propagate null)
   - §25 (`'use server'` files — all exports must be async)
   - §38 (database.types.ts, no `as any` on Supabase)
2. `docs/CLAUDE.md` — project context, tech stack, migration list (28 migrations)
3. `supabase/prod_schema.sql` — `target_queries` table (search for `CREATE TABLE.*target_queries`)
4. `supabase/migrations/20260221000004_create_sov_tracking.sql` — original `target_queries` + `sov_evaluations` DDL
5. `supabase/migrations/20260226000001_add_query_category.sql` — `query_category`, `occasion_tag`, `intent_modifier` columns added
6. `lib/supabase/database.types.ts` — `target_queries` Row/Insert/Update types
7. `lib/services/sov-seed.ts` — **READ THE ENTIRE FILE.** Line 168 comment says "idempotent via unique constraint" but the constraint DOES NOT EXIST. This sprint fixes that.
8. `app/dashboard/share-of-voice/actions.ts` — `addTargetQuery()` server action. Inserts without duplicate checking.
9. `docs/20260223000001_sov_engine.sql` — **The unpromoted migration.** Read to understand what it planned. This sprint does NOT promote it — it supersedes it.
10. `docs/09-BUILD-PLAN.md` — Phase 5 section (search for `## Phase 5`). All checkboxes are `[ ]` but most work is done. This sprint updates the checkboxes.

---

## What This Sprint Does

Sprint 88 is a **small, surgical cleanup sprint** with 3 deliverables that close the final Phase 5 gaps:

### Problem 1 (🔴 DATA INTEGRITY): Missing `UNIQUE(location_id, query_text)` Constraint

**The bug:** `lib/services/sov-seed.ts` line ~168 says "idempotent via unique constraint on location_id + query_text" — but no migration ever created this constraint. The `docs/20260223000001_sov_engine.sql` planned it for `sov_target_queries`, but that migration was never promoted and the table was never renamed.

**Impact today:** If `seedSOVQueries()` runs twice for the same location (e.g., user re-onboards, or a bug triggers double-seeding), duplicate queries are inserted. The `sov-seed.ts` code catches the error with `console.warn` — but only because Supabase returns a generic insert error, not a clean constraint violation. `addTargetQuery()` in `actions.ts` has zero duplicate protection — a user can add the same custom query multiple times.

**Fix:** Add a `UNIQUE(location_id, query_text)` constraint via migration. Then update `addTargetQuery()` to detect and surface constraint violations cleanly.

### Problem 2 (🟡 SPEC COMPLIANCE): Missing `is_active` Column

**The spec:** `docs/20260223000001_sov_engine.sql` line ~12 defines `is_active BOOLEAN NOT NULL DEFAULT TRUE` for soft-disabling queries without deleting them. The SOV cron should skip `is_active = false` queries.

**Impact today:** None — no code references `is_active`. But deleting a query loses its evaluation history (`sov_evaluations` FK cascades). Adding `is_active` enables a "pause query" UX without data loss.

**Fix:** Add `is_active` column via migration. Update SOV cron and page queries to filter by `is_active = true`. Add a "Pause" toggle to the SOV dashboard query list. Keep backward compatible — all existing rows default to `true`.

### Problem 3 (🟢 HOUSEKEEPING): Supersede Unpromoted Migration + Reconcile Build Plan

**The problem:** `docs/20260223000001_sov_engine.sql` creates `sov_target_queries` + `sov_first_mover_alerts` — tables that will never exist. All SOV code uses `target_queries` + `content_drafts` (for first mover alerts). The Build Plan Phase 5 checkboxes are all `[ ]` even though the work is done across sprints 57–86.

**Fix:** Add a superseded header to the unpromoted migration. Update Build Plan Phase 5 checkboxes to reflect actual completion status. Update `prod_schema.sql` with the new columns/constraints.

---

## Architecture Overview

```
Sprint 88 — Phase 5 SOV Cleanup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MIGRATION (Schema hardening):
├── supabase/migrations/20260228000002_sov_phase5_cleanup.sql
│   ├── ADD UNIQUE(location_id, query_text) to target_queries
│   ├── ADD is_active BOOLEAN NOT NULL DEFAULT TRUE
│   └── CREATE INDEX idx_target_queries_active

DATABASE TYPES UPDATE:
├── lib/supabase/database.types.ts
│   └── Add is_active to target_queries Row/Insert/Update

SERVICE UPDATES:
├── lib/services/sov-seed.ts
│   └── Use .upsert() with onConflict instead of .insert() + error swallow
├── lib/services/sov-engine.service.ts
│   └── Filter by is_active = true in query fetch (if applicable)

CRON UPDATES:
├── app/api/cron/sov/route.ts
│   └── Add .eq('is_active', true) to query fetch
├── lib/inngest/functions/sov-cron.ts
│   └── Add .eq('is_active', true) to query fetch

ACTION UPDATES:
├── app/dashboard/share-of-voice/actions.ts
│   ├── addTargetQuery() — detect unique constraint violation → friendly error
│   ├── NEW: toggleQueryActive() — flip is_active boolean
│   └── deleteTargetQuery() — keep as-is (hard delete still available)

PAGE UPDATES:
├── app/dashboard/share-of-voice/page.tsx
│   └── Add .eq('is_active', true) to query fetch + pass is_active to SovCard

COMPONENT UPDATES:
├── app/dashboard/share-of-voice/_components/SovCard.tsx
│   └── Add pause/resume toggle button (eye/eye-off icon)

DOC UPDATES:
├── docs/20260223000001_sov_engine.sql       — Add SUPERSEDED header
├── docs/09-BUILD-PLAN.md                     — Tick Phase 5 checkboxes
├── supabase/prod_schema.sql                  — Add UNIQUE + is_active
├── docs/CLAUDE.md                            — Add migration #29

TESTS:
├── src/__tests__/unit/sov-seed-idempotent.test.ts    — Duplicate seeding handled
├── src/__tests__/unit/sov-query-toggle.test.ts       — toggleQueryActive action
└── src/__tests__/unit/sov-unique-constraint.test.ts  — addTargetQuery dedup
```

---

## Phase 1: Database Migration

### 1A — Create Migration File

**File:** `supabase/migrations/20260228000002_sov_phase5_cleanup.sql`

```sql
-- ---------------------------------------------------------------------------
-- Sprint 88: Phase 5 SOV Cleanup — UNIQUE constraint + is_active column
--
-- 1. UNIQUE(location_id, query_text) — prevents duplicate query seeding.
--    sov-seed.ts and addTargetQuery() both assume this constraint exists.
-- 2. is_active BOOLEAN — soft-disable queries without losing sov_evaluations
--    history (which cascades on DELETE).
--
-- Supersedes the intent of docs/20260223000001_sov_engine.sql (never promoted).
-- ---------------------------------------------------------------------------

-- 1. Add is_active column (default TRUE — all existing queries stay active)
ALTER TABLE public.target_queries
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add UNIQUE constraint on (location_id, query_text)
--    Dedupe any existing duplicates first (keep earliest created_at)
DELETE FROM public.target_queries a
USING public.target_queries b
WHERE a.location_id = b.location_id
  AND a.query_text = b.query_text
  AND a.created_at > b.created_at;

ALTER TABLE public.target_queries
  ADD CONSTRAINT uq_target_queries_location_text
  UNIQUE (location_id, query_text);

-- 3. Partial index for active-only queries (used by SOV cron and dashboard)
CREATE INDEX IF NOT EXISTS idx_target_queries_active
  ON public.target_queries (location_id)
  WHERE is_active = TRUE;

-- 4. Comment for clarity
COMMENT ON CONSTRAINT uq_target_queries_location_text ON public.target_queries
  IS 'Prevents duplicate SOV queries per location. Required by sov-seed.ts upsert logic.';

COMMENT ON COLUMN public.target_queries.is_active
  IS 'Soft-disable toggle. FALSE = paused (hidden from cron + dashboard). Preserves sov_evaluations history.';
```

### ⚠️ MIGRATION EDGE CASES

1. **Duplicate cleanup before constraint.** The DELETE statement removes duplicate `(location_id, query_text)` rows, keeping only the earliest. This MUST run before `ADD CONSTRAINT` or the constraint will fail if any duplicates exist.
2. **`IF NOT EXISTS` on ADD COLUMN.** Safe for replay.
3. **Partial index.** `WHERE is_active = TRUE` keeps the index small and fast. The SOV cron queries exactly this predicate.
4. **FK cascade preservation.** `is_active = false` keeps the `target_queries` row alive, so `sov_evaluations` FK references survive. This is the whole point vs. DELETE.

---

## Phase 2: Update `database.types.ts`

### 2A — Add New Column

In `lib/supabase/database.types.ts`, find the `target_queries` section and add to Row, Insert, and Update:

```typescript
// Row
is_active: boolean;

// Insert
is_active?: boolean;  // defaults to true in DB

// Update
is_active?: boolean;
```

---

## Phase 3: Update `sov-seed.ts` — Proper Upsert

### 3A — Replace `.insert()` + Error Swallow with `.upsert()`

**File:** `lib/services/sov-seed.ts`

Replace the current insert block (approximately lines 158–170):

```typescript
// BEFORE (broken — relies on constraint that didn't exist):
const { error } = await supabase
  .from('target_queries')
  .insert(rows)
  .select('id');

if (error) {
  console.warn(`[sov-seed] Insert warning for location ${location.id}: ${error.message}`);
}
```

With:

```typescript
// AFTER (true idempotent upsert — constraint now exists):
const { error } = await supabase
  .from('target_queries')
  .upsert(rows, {
    onConflict: 'location_id,query_text',
    ignoreDuplicates: true,       // Skip existing, don't update
  })
  .select('id');

if (error) {
  // Genuine errors (not constraint violations) — log for cron diagnostics
  console.error(`[sov-seed] Upsert error for location ${location.id}: ${error.message}`);
}
```

### ⚠️ KEY DETAIL: `ignoreDuplicates: true`
This tells Supabase to skip rows that conflict on `(location_id, query_text)` rather than updating them. We don't want re-seeding to overwrite a user's modified `query_category` or `is_active` state.

---

## Phase 4: Update SOV Cron — Filter Active Queries

### 4A — `app/api/cron/sov/route.ts`

Find every place where `target_queries` are fetched and add `.eq('is_active', true)`. Look for patterns like:

```typescript
.from('target_queries')
.select('...')
.eq('org_id', orgId)
```

Add after the org_id filter:

```typescript
.eq('is_active', true)
```

### 4B — `lib/inngest/functions/sov-cron.ts`

Same change — find the `target_queries` fetch and add `.eq('is_active', true)`.

### 4C — `app/dashboard/share-of-voice/page.tsx`

Find the query fetch (approximately line 70) and add `.eq('is_active', true)` so paused queries don't appear in the main dashboard view.

**ALSO:** Add a separate count query for paused queries so we can show a "X paused queries" indicator:

```typescript
const pausedCountResult = await supabase
  .from('target_queries')
  .select('id', { count: 'exact', head: true })
  .eq('org_id', orgId)
  .eq('location_id', locationId)
  .eq('is_active', false);
```

Pass `pausedCount` to the page UI.

---

## Phase 5: Update `addTargetQuery()` — Duplicate Detection

### 5A — `app/dashboard/share-of-voice/actions.ts`

Update the `addTargetQuery()` function to detect unique constraint violations:

```typescript
const { error } = await supabase.from('target_queries').insert({
  org_id: ctx.orgId,
  location_id,
  query_text: query_text.trim(),
  query_category: 'custom',
});

if (error) {
  // PostgreSQL unique_violation code = 23505
  if (error.code === '23505') {
    return { success: false, error: 'This query already exists for this location.' };
  }
  return { success: false, error: error.message };
}
```

### 5B — Add `toggleQueryActive()` Server Action

Add a new server action in the same file:

```typescript
// ---------------------------------------------------------------------------
// toggleQueryActive — Server Action
// ---------------------------------------------------------------------------

const ToggleQuerySchema = z.object({
  query_id: z.string().uuid(),
  is_active: z.boolean(),
});

type ToggleQueryInput = z.infer<typeof ToggleQuerySchema>;

export async function toggleQueryActive(input: ToggleQueryInput): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = ToggleQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('target_queries')
    .update({ is_active: parsed.data.is_active })
    .eq('id', parsed.data.query_id)
    .eq('org_id', ctx.orgId);  // Belt-and-suspenders RLS

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/share-of-voice');
  return { success: true };
}
```

---

## Phase 6: Update `SovCard.tsx` — Pause Toggle

### 6A — Add Pause/Resume Button

**File:** `app/dashboard/share-of-voice/_components/SovCard.tsx`

Add a small toggle button next to each query's delete button. Use `Eye` / `EyeOff` icons from `lucide-react` (already in project dependencies).

```typescript
import { toggleQueryActive } from '../actions';
```

The toggle button should:
- Show `Eye` icon when query is active (click to pause)
- Show `EyeOff` icon when paused (click to resume)
- Call `toggleQueryActive({ query_id, is_active: !currentState })`
- Show loading state during transition
- Use `text-zinc-500 hover:text-amber-400` for the pause button (not destructive red — it's reversible)

### 6B — Pass `is_active` Through Props

Update the `QueryWithEvals` type (or equivalent prop type) to include `is_active: boolean`.

Update the page query to select `is_active` from `target_queries`.

**NOTE:** The main dashboard query filters to `is_active = true`, so paused queries won't appear in the main list. The toggle is only useful if you also add a "Show paused" toggle or a small indicator. For MVP, just add the pause button to active queries — paused queries disappear from the list, and the "X queries paused" count tells the user they exist.

---

## Phase 7: Supersede Unpromoted Migration

### 7A — `docs/20260223000001_sov_engine.sql`

Add a header block at the very top of the file:

```sql
-- =====================================================================
-- ⚠️ SUPERSEDED — DO NOT PROMOTE TO supabase/migrations/
--
-- This migration was written for Phase 5 planning but was NEVER applied.
-- All intended features were delivered incrementally:
--
--   sov_target_queries  → stays as `target_queries` (migration 20260221000004)
--                         + query_category/occasion_tag/intent_modifier (20260226000001)
--                         + is_active + UNIQUE constraint (20260228000002, Sprint 88)
--
--   sov_first_mover_alerts → replaced by content_drafts.trigger_type = 'first_mover'
--                            (migration 20260226000002, Sprint 48)
--
-- Kept for historical reference only. See Sprint 88 DEVLOG for full reconciliation.
-- =====================================================================
```

---

## Phase 8: Update `prod_schema.sql`

### 8A — Add New Column and Constraint to `target_queries` Definition

Find the `target_queries` table in `supabase/prod_schema.sql` and add:

```sql
is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
```

And after the table definition, add:

```sql
ALTER TABLE public.target_queries
  ADD CONSTRAINT uq_target_queries_location_text
  UNIQUE (location_id, query_text);

CREATE INDEX IF NOT EXISTS idx_target_queries_active
  ON public.target_queries (location_id)
  WHERE is_active = TRUE;
```

---

## Phase 9: Reconcile Build Plan Phase 5 Checkboxes

### 9A — `docs/09-BUILD-PLAN.md`

Update the Phase 5 section. Replace the stale checkboxes with accurate completion status. Here is the mapping of what's done vs. what's not:

**Database Migration:**
- [x] `target_queries` has `query_category`, `occasion_tag`, `intent_modifier` (Sprint 65, migration `20260226000001`)
- [x] `UNIQUE(location_id, query_text)` constraint (Sprint 88, migration `20260228000002`)
- [x] `is_active` column (Sprint 88, migration `20260228000002`)
- ~~Migrate to `sov_target_queries`~~ — **SUPERSEDED.** Table stays as `target_queries`. See Sprint 88.
- ~~Create `sov_first_mover_alerts`~~ — **SUPERSEDED.** First Mover alerts use `content_drafts.trigger_type = 'first_mover'`. See Sprint 48.

**Query Seeding:**
- [x] `seedSOVQueries(location)` in `lib/services/sov-seed.ts` — 4 query categories (discovery, near_me, occasion, comparison)
- [x] Wired into onboarding completion (`app/onboarding/actions.ts` line 130)
- [x] Golden Tenant seeded with system-generated queries (`supabase/seed.sql`)

**SOV Cron:**
- [x] `app/api/cron/sov/route.ts` — Route Handler with Inngest dispatch + inline fallback
- [x] `runSOVQuery()` with Perplexity Sonar + OpenAI multi-model (Sprint 61B)
- [x] `writeSOVResults()` — upserts to `visibility_analytics`
- [x] `STOP_SOV_CRON` kill switch
- [x] Vercel Cron trigger configured in `vercel.json`
- [x] `CRON_SECRET` auth guard

**Reality Score Fix:**
- [x] Visibility reads live `visibility_analytics.share_of_voice` × 100 (`lib/data/dashboard.ts` line 199)
- [x] Hardcoded `98` removed — `RealityScoreCard` accepts `visibility: number | null`
- [x] `state: 'calculating'` UI — shows "First AI visibility scan runs Sunday, {date}" when null
- [x] Score formula: `realityScore = visibility * 0.4 + accuracy * 0.4 + dataHealth * 0.2`

**First Mover Alert Pipeline:**
- [x] First Mover alerts created via `content_drafts` with `trigger_type = 'first_mover'` (Sprint 48)
- [x] `FirstMoverCard` component (`app/dashboard/share-of-voice/_components/FirstMoverCard.tsx`)
- ~~`sov_first_mover_alerts` table~~ — **SUPERSEDED** (uses `content_drafts`)
- ~~`GET /api/sov/alerts` endpoint~~ — **SUPERSEDED** (server component reads `content_drafts` directly)
- [ ] Wire alert count to sidebar badge — deferred (not blocking)

**SOV Dashboard (`/share-of-voice`):**
- [x] `/dashboard/share-of-voice/page.tsx` — full page with score ring, trend chart, query table, first mover cards, gap alerts, category breakdown
- [x] `SOVScoreRing` with calculating state
- [x] `SovCard` (query table with eval results)
- [x] `addTargetQuery`, `deleteTargetQuery`, `runSovEvaluation` server actions
- [x] "Share of Voice" in sidebar

**Content Draft Trigger:**
- [x] `createDraft()` called for first_mover alerts and prompt_missing gaps (Sprint 48)
- [x] `content_drafts` table created (`20260224000001_content_pipeline.sql`)

### 9B — Update the NOTE block

Replace the existing `⚠️ NOTE (Group A remediation)` block with:

```markdown
  - [x] ⚠️ **NOTE (Sprint 88 reconciliation, 2026-02-28):** `docs/20260223000001_sov_engine.sql` has been formally SUPERSEDED. It planned `sov_target_queries` + `sov_first_mover_alerts` as replacement tables, but all intended features were delivered incrementally into the existing `target_queries` + `content_drafts` tables across sprints 48–88. The migration file is preserved for historical reference with a SUPERSEDED header. No table rename is needed.
```

---

## Phase 10: Update `docs/CLAUDE.md`

### 10A — Add Migration to List

Add migration #29:

```
29. `20260228000002_sov_phase5_cleanup.sql` — `is_active` column + `UNIQUE(location_id, query_text)` constraint on `target_queries`, duplicate dedup
```

### 10B — Update `target_queries` Table Description

In the Database Tables section, update the `target_queries` row:

```
| `target_queries` | SOV query library per location. Columns: `query_category` (discovery/comparison/occasion/near_me/custom), `occasion_tag`, `intent_modifier`, `is_active` (soft-disable toggle). UNIQUE on `(location_id, query_text)`. |
```

---

## Phase 11: Update Seed Data

### 11A — `supabase/seed.sql`

If `target_queries` seed rows exist, ensure they include `is_active = TRUE` explicitly (even though it's the default). This makes the seed self-documenting.

---

## Phase 12: Tests

### 12A — `src/__tests__/unit/sov-seed-idempotent.test.ts`

Test that `seedSOVQueries()` handles duplicate seeding gracefully:

```typescript
describe('seedSOVQueries — idempotent seeding', () => {
  it('should use upsert with ignoreDuplicates', async () => {
    // Verify the service calls .upsert() with onConflict: 'location_id,query_text'
    // and ignoreDuplicates: true
  });

  it('should not throw on re-seed of same location', async () => {
    // Call seedSOVQueries twice with same location
    // Second call should succeed with no error
  });

  it('should not overwrite existing query_category on re-seed', async () => {
    // Seed once, manually change category to 'custom', re-seed
    // Category should remain 'custom' (ignoreDuplicates skips)
  });
});
```

### 12B — `src/__tests__/unit/sov-query-toggle.test.ts`

Test the `toggleQueryActive()` server action:

```typescript
describe('toggleQueryActive', () => {
  it('should flip is_active from true to false', async () => {
    // ...
  });

  it('should flip is_active from false to true', async () => {
    // ...
  });

  it('should reject unauthorized requests', async () => {
    // ...
  });

  it('should enforce RLS with org_id check', async () => {
    // Attempt to toggle a query belonging to another org
  });
});
```

### 12C — `src/__tests__/unit/sov-add-query-dedup.test.ts`

Test that `addTargetQuery()` returns a friendly error on duplicate:

```typescript
describe('addTargetQuery — duplicate detection', () => {
  it('should return friendly error when query already exists', async () => {
    // Mock supabase.insert to return { error: { code: '23505', message: '...' } }
    // Verify result.error === 'This query already exists for this location.'
  });

  it('should pass through other errors unchanged', async () => {
    // Mock a non-23505 error
    // Verify the raw error message is returned
  });
});
```

### 12D — Verify Existing Tests Still Pass

```bash
npx vitest run src/__tests__/unit/sov-engine-service.test.ts
npx vitest run src/__tests__/unit/share-of-voice-actions.test.ts
npx vitest run src/__tests__/unit/cron-sov.test.ts
npx vitest run src/__tests__/unit/inngest-sov-cron.test.ts
```

All must pass with zero changes (backward compatible — `is_active` defaults to `true`).

---

## Definition of Done Checklist

- [ ] Migration adds `is_active BOOLEAN NOT NULL DEFAULT TRUE` to `target_queries`
- [ ] Migration deduplicates existing rows (keeps earliest `created_at`)
- [ ] Migration adds `UNIQUE(location_id, query_text)` constraint
- [ ] Migration adds partial index `idx_target_queries_active` on `is_active = TRUE`
- [ ] `database.types.ts` updated with `is_active` (Row, Insert, Update)
- [ ] `sov-seed.ts` uses `.upsert()` with `onConflict` + `ignoreDuplicates: true`
- [ ] `addTargetQuery()` detects `23505` constraint violation → friendly error message
- [ ] `toggleQueryActive()` server action created and working
- [ ] SOV cron (both route + inngest) filters by `.eq('is_active', true)`
- [ ] SOV dashboard page filters active queries + shows paused count
- [ ] `SovCard` has pause/resume toggle (Eye/EyeOff icon, amber hover)
- [ ] `docs/20260223000001_sov_engine.sql` has SUPERSEDED header
- [ ] `docs/09-BUILD-PLAN.md` Phase 5 checkboxes updated to reflect actual status
- [ ] `supabase/prod_schema.sql` updated with `is_active` + UNIQUE + index
- [ ] `docs/CLAUDE.md` migration list updated (#29)
- [ ] `docs/CLAUDE.md` `target_queries` table description updated
- [ ] Seed data includes explicit `is_active = TRUE`
- [ ] 3 new test files created and passing (9+ tests total)
- [ ] All existing SOV tests still passing
- [ ] `npx vitest run` — ALL tests passing
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npx supabase db reset` — seeds apply cleanly
- [ ] DEVLOG entry with verified test counts
- [ ] No `as any` on Supabase clients
- [ ] No hardcoded scores or placeholders (AI_RULES §20)

---

## What NOT to Do

1. **DO NOT** rename `target_queries` to `sov_target_queries`. The entire codebase uses `target_queries`. The rename was planned but never needed — the columns were added incrementally.
2. **DO NOT** create a `sov_first_mover_alerts` table. First Mover alerts are stored in `content_drafts` with `trigger_type = 'first_mover'`. This works and is simpler.
3. **DO NOT** promote `docs/20260223000001_sov_engine.sql`. Add the SUPERSEDED header and leave it in docs.
4. **DO NOT** modify SOV scoring logic (`writeSOVResults`, `runSOVQuery`, etc.). This sprint is schema + hygiene only.
5. **DO NOT** modify the Reality Score formula or `RealityScoreCard`. It already works correctly.
6. **DO NOT** change the `sov_evaluations` table or its FK to `target_queries`. The cascade behavior is correct.
7. **DO NOT** add new npm packages.
8. **DO NOT** modify E2E tests unless the new toggle button breaks existing selectors. Note any needed updates in DEVLOG.
9. **DO NOT** backfill `is_active` — it defaults to `TRUE`, which is the correct state for all existing rows.
10. **DO NOT** remove the `console.warn` in `sov-seed.ts` entirely — convert it to `console.error` for genuine errors only (non-constraint failures).

---

## File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `supabase/migrations/20260228000002_sov_phase5_cleanup.sql` | CREATE | UNIQUE constraint + is_active column + dedup + index |
| `lib/supabase/database.types.ts` | MODIFY | Add `is_active` to target_queries types |
| `lib/services/sov-seed.ts` | MODIFY | `.insert()` → `.upsert()` with `onConflict` + `ignoreDuplicates` |
| `app/dashboard/share-of-voice/actions.ts` | MODIFY | `addTargetQuery()` 23505 detection + `toggleQueryActive()` new action |
| `app/api/cron/sov/route.ts` | MODIFY | Add `.eq('is_active', true)` to query fetch |
| `lib/inngest/functions/sov-cron.ts` | MODIFY | Add `.eq('is_active', true)` to query fetch |
| `app/dashboard/share-of-voice/page.tsx` | MODIFY | Filter active queries + paused count |
| `app/dashboard/share-of-voice/_components/SovCard.tsx` | MODIFY | Add pause/resume toggle button |
| `docs/20260223000001_sov_engine.sql` | MODIFY | Add SUPERSEDED header block |
| `docs/09-BUILD-PLAN.md` | MODIFY | Tick Phase 5 checkboxes with sprint references |
| `supabase/prod_schema.sql` | MODIFY | Add is_active + UNIQUE + index to target_queries |
| `docs/CLAUDE.md` | MODIFY | Migration #29 + target_queries description |
| `supabase/seed.sql` | MODIFY | Add explicit `is_active = TRUE` to seed rows |
| `src/__tests__/unit/sov-seed-idempotent.test.ts` | CREATE | Upsert idempotency tests |
| `src/__tests__/unit/sov-query-toggle.test.ts` | CREATE | toggleQueryActive action tests |
| `src/__tests__/unit/sov-add-query-dedup.test.ts` | CREATE | Duplicate detection tests |
| `DEVLOG.md` | MODIFY | Sprint 88 entry |

**Total new files:** 4 (1 migration + 3 test files)
**Total modified files:** 13
**Estimated scope:** Small-Medium (schema migration + service fix + light UI + doc reconciliation)
