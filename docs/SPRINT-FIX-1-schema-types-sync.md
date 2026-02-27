# Sprint FIX-1 — Schema Types Regeneration + prod_schema.sql Sync

> **Claude Code Prompt — Bulletproof Production Fix Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Eliminate **41 TypeScript compilation errors** caused by a stale `database.types.ts` — and bring all three Supabase source-of-truth files into full alignment with the live database schema.

This sprint fixes two audit findings in one pass:
- **[CRITICAL-1.1]** `database.types.ts` does not reflect Sprints 99–101 schema additions → 41 TS errors in billing, seat management, occasion feeds, and badge counts.
- **[MEDIUM-3.3]** `supabase/prod_schema.sql` is the declared schema authority (AI_RULES §1) but has diverged from migrations → sprint 99–101 tables and columns are absent.

**Why this must go first:** Every subsequent sprint in this fix series touches Supabase queries. If the types are stale, those sprints will introduce new TS errors on top of the existing 41. Regenerate types first, then every other fix compiles cleanly.

**What is broken today:**
- `lib/stripe/seat-manager.ts` — 10 errors: `seat_limit`, `stripe_subscription_id`, `plan_status` are unrecognised column names.
- `app/actions/seat-actions.ts` — 6 errors: same columns missing from organisations type.
- `lib/auth/location-permissions.ts` — 5 errors: Sprint 99/100 join query shapes don't match types.
- `lib/auth/active-org.ts` — 1 error: `OrgInfo` type mismatch after new columns added.
- `lib/occasions/occasion-feed.ts` — uses `(supabase as any)` to bypass missing `occasion_snoozes` table type.
- `lib/badges/badge-counts.ts` — uses `(supabase as any)` to bypass missing `sidebar_badge_state` table type.
- `app/actions/occasions.ts` — uses `(supabase as any)` twice for `occasion_snoozes` table.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing or modifying ANY code, read all of these in order. Do not skip any.

```
Read docs/AI_RULES.md                                 — All engineering rules, especially §2, §9, §38.2, §38.4
Read docs/CLAUDE.md                                   — Project context and architecture
Read docs/MEMORY.md                                   — Key decisions; confirm schema authority is prod_schema.sql
Read lib/supabase/database.types.ts                   — Current (stale) type file — identify what is missing
Read supabase/prod_schema.sql                         — Canonical schema (also stale — must be replaced)
Read supabase/migrations/ (ALL files, newest first)   — Ground truth of what is actually in the DB
  § 20260301000003_seat_billing_location_permissions.sql — adds seat_limit, seat_overage_count, seat_overage_since, location_permissions table
  § 20260302000001_multi_location_management.sql        — adds is_archived, display_name, timezone, location_order to locations
  § 20260302000002_occasion_snooze_sidebar_badges.sql   — creates occasion_snoozes and sidebar_badge_state tables
Read lib/occasions/occasion-feed.ts                   — Contains (supabase as any) casts to fix
Read lib/badges/badge-counts.ts                       — Contains (supabase as any) casts to fix
Read app/actions/occasions.ts                         — Contains (supabase as any) casts to fix
Read lib/stripe/seat-manager.ts                       — Primary file with 10 type errors
Read app/actions/seat-actions.ts                      — 6 type errors
Read lib/auth/location-permissions.ts                 — 5 type errors
Read lib/auth/active-org.ts                           — 1 type error
Read src/__fixtures__/golden-tenant.ts                — Fixtures — confirm no breakage after type changes
```

**Before writing any code, run this diagnostic command:**
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Expected: 41 (confirming the baseline before we fix anything)

npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "node_modules"
# Shows all 41 errors with file names — read every one before proceeding
```

**Understand before proceeding:**
- The Supabase CLI regenerates `database.types.ts` from the live schema snapshot. It is the only safe way to update this file — do not hand-edit types.
- `supabase/prod_schema.sql` is regenerated via `supabase db dump`. It replaces the stale file entirely.
- The `(supabase as any)` casts are a known workaround logged in the DEVLOG. After regeneration they must be removed and replaced with proper typed queries.
- The `location_permissions` table (Sprint 99) and `occasion_snoozes` / `sidebar_badge_state` tables (Sprint 101) are new tables — they will appear as entirely new sections in the regenerated types.

---

## 🏗️ Architecture — What to Build / Fix

### Step 1: Run Pre-Implementation Diagnosis

Run every bash command below. Capture the output before making any changes. This is your baseline.

```bash
# 1. Confirm current TypeScript error count
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l

# 2. Confirm current (supabase as any) cast count
grep -rn "supabase as any" lib/ app/ --include="*.ts" --include="*.tsx" | grep -v test

# 3. List all migration files to understand schema state
ls -la supabase/migrations/

# 4. Confirm which tables are in current database.types.ts (will not include Sprint 101 tables)
grep -E "^\s+[a-z_]+:" lib/supabase/database.types.ts | grep -v "?" | head -50

# 5. Confirm the Sprint 101 tables ARE in migrations but NOT in database.types.ts
grep "occasion_snoozes\|sidebar_badge_state\|location_permissions" lib/supabase/database.types.ts
# Expected: no output (they are missing)

grep "occasion_snoozes\|sidebar_badge_state\|location_permissions" supabase/migrations/*.sql
# Expected: entries in 20260301000003 and 20260302000002

# 6. Confirm seat_limit is missing from types
grep "seat_limit\|seat_overage" lib/supabase/database.types.ts
# Expected: no output

grep "seat_limit\|seat_overage" supabase/migrations/20260301000003_seat_billing_location_permissions.sql
# Expected: entries present

# 7. Confirm locations columns gap
grep "is_archived\|display_name\|timezone\|location_order" lib/supabase/database.types.ts | head -10
# Some may be present from earlier — check vs migration

# 8. Run full test suite to capture baseline (do NOT fix anything yet)
npx vitest run 2>&1 | tail -5
# Note the current passing/failing counts — this is your regression baseline
```

---

### Step 2: Regenerate `database.types.ts`

**Method A — Preferred (Supabase CLI connected to production):**
```bash
# If you have a Supabase project ID configured:
npx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > lib/supabase/database.types.ts

# Verify the regeneration worked:
grep "seat_limit" lib/supabase/database.types.ts      # Must have output
grep "occasion_snoozes" lib/supabase/database.types.ts  # Must have output
grep "sidebar_badge_state" lib/supabase/database.types.ts  # Must have output
grep "location_permissions" lib/supabase/database.types.ts  # Must have output
```

**Method B — Local Supabase:**
```bash
# If running local Supabase:
npx supabase gen types typescript --local --schema public > lib/supabase/database.types.ts
```

**Method C — If CLI is unavailable (manual additions only as last resort):**
If neither CLI option is available, you must manually add the missing types to `database.types.ts`. This is error-prone and should only be done if the CLI is confirmed unavailable. The additions needed are:

**For `organizations` table** — add these columns to Row, Insert, and Update interfaces:
```typescript
seat_limit: number | null
seat_overage_count: number | null
seat_overage_since: string | null
```

**For `locations` table** — verify and add if missing:
```typescript
is_archived: boolean | null
display_name: string | null
timezone: string | null
location_order: number | null
```

**For `memberships` table** — verify and add if missing:
```typescript
invited_by: string | null
joined_at: string | null
```

**New tables to add entirely** — `location_permissions`, `occasion_snoozes`, `sidebar_badge_state`. Read their CREATE TABLE statements from `supabase/migrations/20260301000003_*.sql` and `supabase/migrations/20260302000002_*.sql` and transcribe each column into proper Row/Insert/Update interfaces.

**Structure for a new table in database.types.ts:**
```typescript
location_permissions: {
  Row: {
    id: string
    org_id: string
    membership_id: string
    location_id: string
    created_at: string
  }
  Insert: {
    id?: string
    org_id: string
    membership_id: string
    location_id: string
    created_at?: string
  }
  Update: {
    id?: string
    org_id?: string
    membership_id?: string
    location_id?: string
    created_at?: string
  }
  Relationships: [
    { foreignKeyName: "location_permissions_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organizations"; referencedColumns: ["id"]; },
    { foreignKeyName: "location_permissions_membership_id_fkey"; columns: ["membership_id"]; referencedRelation: "memberships"; referencedColumns: ["id"]; },
    { foreignKeyName: "location_permissions_location_id_fkey"; columns: ["location_id"]; referencedRelation: "locations"; referencedColumns: ["id"]; },
  ]
}
```

Similarly transcribe `occasion_snoozes` and `sidebar_badge_state` from their migration SQL.

**After any method: Run the TypeScript check immediately:**
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Target: fewer than 5 remaining (ideally 0)
# If still 41: the file was not regenerated correctly — do not proceed
```

---

### Step 3: Regenerate `supabase/prod_schema.sql`

The `prod_schema.sql` is the declared schema authority (AI_RULES §1). It must reflect the complete current schema.

**Method A — Preferred:**
```bash
npx supabase db dump --local > supabase/prod_schema.sql
# OR for production:
npx supabase db dump --project-id YOUR_PROJECT_ID > supabase/prod_schema.sql
```

**Method B — If dump is unavailable:**
The correct approach is to manually reconcile the file. Read the current `supabase/prod_schema.sql` and compare against the latest migrations. Add the following to the file:

For `organizations` table, add the three columns after existing columns:
```sql
seat_limit          integer DEFAULT 1,
seat_overage_count  integer DEFAULT 0,
seat_overage_since  timestamptz,
```

For `locations` table, add:
```sql
is_archived     boolean DEFAULT false,
display_name    text,
timezone        text,
location_order  integer DEFAULT 0,
```

For `memberships` table, add:
```sql
invited_by  uuid REFERENCES public.users(id),
joined_at   timestamptz,
```

Append the three new table definitions (copy from migrations):
- `location_permissions` (from 20260301000003)
- `occasion_snoozes` (from 20260302000002)
- `sidebar_badge_state` (from 20260302000002)

Append the RLS and index statements for these tables from the same migrations.

**Verify after either method:**
```bash
grep "seat_limit" supabase/prod_schema.sql         # Must exist
grep "occasion_snoozes" supabase/prod_schema.sql     # Must exist
grep "sidebar_badge_state" supabase/prod_schema.sql  # Must exist
grep "location_permissions" supabase/prod_schema.sql # Must exist
```

---

### Step 4: Remove All `(supabase as any)` Casts

After regeneration, the three files using `(supabase as any)` must be updated to use proper types.

**AI_RULES §38.2:** Never use `as any` on Supabase clients. Use `as unknown as SupabaseClient<Database>` if a cast is ever needed. But in these three cases, casts are not needed at all after types are regenerated.

#### File 1: `lib/occasions/occasion-feed.ts`

Find the line:
```typescript
const { data: snoozes } = await (supabase as any)
  .from('occasion_snoozes')
```

Replace with proper typed query:
```typescript
const { data: snoozes } = await supabase
  .from('occasion_snoozes')
```

The query should now type-check cleanly because `occasion_snoozes` is now in `database.types.ts`.

#### File 2: `lib/badges/badge-counts.ts`

Find all `(supabase as any)` occurrences (there are 2 or 3):
- The `sidebar_badge_state` SELECT query
- The `sidebar_badge_state` UPSERT query

Replace each `(supabase as any)` with `supabase`. After regeneration these queries should type-check.

#### File 3: `app/actions/occasions.ts`

Find both `(supabase as any)` occurrences:
- The `occasion_snoozes` INSERT
- The `occasion_snoozes` UPDATE/UPSERT

Replace with plain `supabase` calls. Confirm the action still uses `getSafeAuthContext()` for auth (AI_RULES §3) — do not change auth logic.

---

### Step 5: Verify TypeScript Compilation

After completing Steps 2–4:

```bash
npx tsc --noEmit 2>&1 | grep "error TS"
# Target: 0 errors
# If errors remain, read each one and fix the underlying type mismatch
# Do NOT use `as any` to silence errors — fix the actual type

npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Must output: 0
```

**If errors persist after regeneration:**

The most common remaining errors after regeneration are:
1. `OrgInfo` type in `lib/auth/active-org.ts` — check that the `select()` query's return shape matches the `OrgInfo` interface. The interface may need updating, or the `select()` string may need adjustment. Read the current select statement and compare to `OrgInfo`.
2. `location-permissions.ts` join queries — these build complex multi-table joins. After types are regenerated, Supabase's embedded type inference may still flag some joins. If so, use typed intermediate results and narrow with `if (typeof x === 'string')` guards, not `as any`.
3. Stripe SDK `quantity` param — `lib/stripe/seat-manager.ts` line 180 has an error about `quantity` not existing in `SubscriptionUpdateParams`. This is a Stripe SDK type issue. Check the installed Stripe version (`stripe@20.x`). The correct field for updating subscription quantity is `items: [{ id: subscriptionItemId, quantity: newQuantity }]`. Adjust the call to match the Stripe SDK's actual API.

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### New Test: `src/__tests__/unit/database-types-completeness.test.ts`

This test verifies that critical Sprint 99–101 table/column types are accessible without `as any` casts. It acts as a regression guard — if `database.types.ts` becomes stale again, this test will fail.

```
describe('database.types.ts — Sprint 99-101 completeness')

  describe('organizations table has seat billing columns')
    1.  type check: organizations Row includes seat_limit as number | null
    2.  type check: organizations Row includes seat_overage_count as number | null
    3.  type check: organizations Row includes seat_overage_since as string | null

  describe('locations table has multi-location columns')
    4.  type check: locations Row includes is_archived as boolean | null
    5.  type check: locations Row includes display_name as string | null
    6.  type check: locations Row includes location_order as number | null

  describe('new Sprint 101 tables are present in types')
    7.  occasion_snoozes table type is accessible (Row has id, org_id, user_id, occasion_id, snoozed_until, snooze_count)
    8.  sidebar_badge_state table type is accessible (Row has id, org_id, user_id, section, last_seen_at)
    9.  location_permissions table type is accessible (Row has id, org_id, membership_id, location_id)

  describe('no (as any) casts remain in production code')
    10. lib/occasions/occasion-feed.ts does not contain "(supabase as any)"
    11. lib/badges/badge-counts.ts does not contain "(supabase as any)"
    12. app/actions/occasions.ts does not contain "(supabase as any)"
```

**Implementation note:** Tests 1–9 are compile-time type tests using TypeScript's type system. Use the pattern:
```typescript
import type { Database } from '@/lib/supabase/database.types';
type OrgRow = Database['public']['Tables']['organizations']['Row'];

// This assignment will fail to compile if seat_limit is missing from the type:
const _test: OrgRow['seat_limit'] = null; // should accept null
const _test2: OrgRow['seat_limit'] = 5;   // should accept number
```

Tests 10–12 use `fs.readFileSync` to scan source files for the banned pattern:
```typescript
import fs from 'fs';
import path from 'path';

test('lib/occasions/occasion-feed.ts does not contain "(supabase as any)"', () => {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'lib/occasions/occasion-feed.ts'),
    'utf-8'
  );
  expect(content).not.toContain('supabase as any');
});
```

**12 tests total.**

### Regression Check — Run Full Test Suite

```bash
# After all changes, run the complete unit test suite
npx vitest run

# Must match or exceed pre-fix baseline (no regressions)
# Document actual test counts in DEVLOG
```

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/supabase/database.types.ts` | **REGENERATE** | Add Sprint 99-101 tables/columns |
| 2 | `supabase/prod_schema.sql` | **REGENERATE** | Sync with migrations |
| 3 | `lib/occasions/occasion-feed.ts` | **MODIFY** | Remove `(supabase as any)` |
| 4 | `lib/badges/badge-counts.ts` | **MODIFY** | Remove `(supabase as any)` ×2-3 |
| 5 | `app/actions/occasions.ts` | **MODIFY** | Remove `(supabase as any)` ×2 |
| 6 | `src/__tests__/unit/database-types-completeness.test.ts` | **CREATE** | 12 type-guard regression tests |

---

## 🚫 What NOT to Do

1. **DO NOT hand-edit column types guesswork style** — every type must come from the actual migration SQL. If using Method C (manual), re-read the migration CREATE TABLE statements before typing anything.
2. **DO NOT use `as any` to silence remaining errors** — each remaining error after regeneration has a real fix. Read the error message, understand the shape mismatch, and fix the query or interface.
3. **DO NOT change any business logic** in `occasion-feed.ts`, `badge-counts.ts`, or `occasions.ts` — only remove the `(supabase as any)` casts. The query logic stays identical.
4. **DO NOT delete or restructure `database.types.ts`** — only regenerate it or add missing entries. The file's overall structure (enums, helper types, Tables/Views sections) must remain intact.
5. **DO NOT run migrations** — this sprint does not apply any migrations. All schema changes already exist; we are only updating the TypeScript representation.
6. **DO NOT modify any test that is currently passing** — this sprint's only test addition is `database-types-completeness.test.ts`.
7. **DO NOT commit until `npx tsc --noEmit` shows 0 errors** — this is a hard requirement.
8. **DO NOT use `@ts-ignore` or `@ts-expect-error`** — these mask the same problem differently.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `lib/supabase/database.types.ts` includes `seat_limit` in `organizations` Row
- [ ] `lib/supabase/database.types.ts` includes `occasion_snoozes` table type
- [ ] `lib/supabase/database.types.ts` includes `sidebar_badge_state` table type
- [ ] `lib/supabase/database.types.ts` includes `location_permissions` table type
- [ ] `supabase/prod_schema.sql` includes all three new tables and new columns
- [ ] `lib/occasions/occasion-feed.ts` — zero `(supabase as any)` occurrences
- [ ] `lib/badges/badge-counts.ts` — zero `(supabase as any)` occurrences
- [ ] `app/actions/occasions.ts` — zero `(supabase as any)` occurrences
- [ ] `npx tsc --noEmit` — **0 errors** (was 41)
- [ ] `npx vitest run` — all tests passing, zero regressions
- [ ] `src/__tests__/unit/database-types-completeness.test.ts` — **12 tests passing**
- [ ] DEVLOG.md entry written with actual test counts

---

## 🔮 AI_RULES Update (Append to `docs/AI_RULES.md`)

```markdown
## §55. Schema Type Alignment — `database.types.ts` is the TypeScript Authority (FIX-1)

After any migration that adds tables or columns, the following three files must be updated together:

1. `lib/supabase/database.types.ts` — Regenerate with `npx supabase gen types typescript`
2. `supabase/prod_schema.sql` — Regenerate with `npx supabase db dump`
3. Any code using `(supabase as any)` workarounds for the new tables — remove casts

**Rule:** Never ship a migration without immediately regenerating these two files.  
**Rule:** Never use `(supabase as any)` as a permanent fix — it is a temporary workaround only.  
**Rule:** `npx tsc --noEmit` must return 0 errors before any commit.  
**Enforcement:** `src/__tests__/unit/database-types-completeness.test.ts` will fail if `(supabase as any)` casts are reintroduced for Sprint 99-101 tables.
```

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## [DATE] — Sprint FIX-1: Schema Types Regeneration + prod_schema.sql Sync (Completed)

**Problem:**
- 41 TypeScript errors caused by stale `database.types.ts` — Sprint 99-101 migrations (seat_limit, location_permissions, occasion_snoozes, sidebar_badge_state) were not reflected in types.
- `supabase/prod_schema.sql` (AI_RULES §1 authority) was missing Sprint 99-101 additions.
- Three production files used `(supabase as any)` casts as workarounds.

**Solution:**
- `lib/supabase/database.types.ts` — REGENERATED. Now includes: seat_limit/seat_overage_count/seat_overage_since on organizations; is_archived/display_name/timezone/location_order on locations; full types for location_permissions, occasion_snoozes, sidebar_badge_state tables.
- `supabase/prod_schema.sql` — REGENERATED. Fully aligned with all migrations through Sprint 101.
- `lib/occasions/occasion-feed.ts` — MODIFIED. Removed (supabase as any) cast. Direct typed query.
- `lib/badges/badge-counts.ts` — MODIFIED. Removed (supabase as any) casts (×N). Direct typed queries.
- `app/actions/occasions.ts` — MODIFIED. Removed (supabase as any) casts (×2). Direct typed queries.

**Tests added:**
- `src/__tests__/unit/database-types-completeness.test.ts` — **12 Vitest tests.** Type-guard regression tests (9) + source file scan tests (3). Guards against future type drift.

**Result:** `npx tsc --noEmit` → 0 errors (was 41). All N existing tests still pass. No regressions.
```

---

## 📚 Document Sync + Git Commit

### After all tests pass and `npx tsc --noEmit` shows 0 errors:

**Step 1: Update `docs/CLAUDE.md`**
Add to implementation inventory:
```markdown
### Sprint FIX-1 — Schema Types Regeneration ([DATE])
- `lib/supabase/database.types.ts` — Regenerated. Sprint 99-101 tables now typed.
- `supabase/prod_schema.sql` — Regenerated. Aligned with all migrations.
- Removed (supabase as any) casts from occasion-feed, badge-counts, occasions actions.
- Tests: 12 Vitest (type-guard regression suite)
```

**Step 2: Git commit**
```bash
git add -A
git status   # Verify only the expected files are staged
git commit -m "FIX-1: Regenerate database.types.ts + prod_schema.sql (was 41 TS errors)

- database.types.ts: regenerated — Sprint 99-101 tables/columns now typed
  (seat_limit, location_permissions, occasion_snoozes, sidebar_badge_state)
- prod_schema.sql: regenerated — aligned with all migrations through Sprint 101
- occasion-feed.ts: removed (supabase as any) cast
- badge-counts.ts: removed (supabase as any) casts
- occasions.ts (actions): removed (supabase as any) casts
- AI_RULES: added §55 schema alignment rules
- tests: database-types-completeness.test.ts (12 tests, regression guard)

npx tsc --noEmit: 0 errors (was 41)
All existing tests passing. No regressions."
git push origin main
```

---

## 🏁 Sprint Outcome

After FIX-1 completes:
- `npx tsc --noEmit` → 0 errors (was 41, all in billing/auth/badge core)
- All three `(supabase as any)` workarounds eliminated
- `database.types.ts` and `prod_schema.sql` are in sync with live schema
- 12 new type-guard tests ensure this never silently regresses again
- Sprints FIX-2 through FIX-4 can now proceed without inheriting type debt

**This sprint unblocks:** FIX-2, FIX-3, FIX-4, FIX-5 (all subsequent fixes depend on clean types)
