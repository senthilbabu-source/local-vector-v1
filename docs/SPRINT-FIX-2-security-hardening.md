# Sprint FIX-2 — Security Hardening: npm Vulnerabilities + memberships RLS

> **Claude Code Prompt — Bulletproof Production Fix Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisite:** Sprint FIX-1 must be complete (`npx tsc --noEmit` = 0 errors)

---

## 🎯 Objective

Close two security vulnerabilities before any real customer data enters the system:

- **[HIGH-2.3]** Three `npm audit` HIGH-severity vulnerabilities — including a cross-client data leak in the MCP SDK that directly threatens LocalVector's multi-tenant isolation at the `/api/mcp/[transport]` endpoint.
- **[HIGH-2.1]** The `memberships` table has `ENABLE ROW LEVEL SECURITY` missing from `prod_schema.sql` — any authenticated user could read every member across every org in the database.

**Why this sprint is second:** Security gates must be closed before other fixes are applied. The MCP SDK vulnerability in particular is architectural — LocalVector exposes an MCP endpoint backed by org-scoped tools, and a session leak at the transport layer could bypass all of the org isolation work in Sprints 98–101.

**What is broken today:**
- `@modelcontextprotocol/sdk` (GHSA-345p-7cg4-v4c7) — cross-client data leak via shared server/transport instance. LocalVector's MCP endpoint at `/api/mcp/[transport]` uses this SDK.
- `minimatch` — ReDoS via nested `*()` extglobs and multiple GLOBSTAR segments (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74).
- `rollup` — Arbitrary file write via path traversal (GHSA-mw96-cpmx-2vgc). Used by Vite (dev tooling).
- `memberships` table — no RLS. `SELECT * FROM memberships` returns all members from all orgs for any authenticated user. The `current_user_org_id()` SECURITY DEFINER function exists and is used on 24 other tables — it just was never applied here.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                 — All engineering rules
Read docs/CLAUDE.md                                   — Architecture, RLS patterns
Read supabase/prod_schema.sql                         — Schema authority (just regenerated in FIX-1)
Read lib/supabase/database.types.ts                   — Clean types from FIX-1
Read supabase/migrations/ newest files                — Understand existing RLS patterns for other tables
  § 20260218000000_initial_schema.sql                 — See: how current_user_org_id() is defined
  § 20260226000006_google_oauth_tokens_rls.sql        — Example: RLS on a sensitive table
  § 20260301000003_seat_billing_location_permissions.sql — Example: location_permissions RLS
Read app/api/mcp/[transport]/route.ts                 — The MCP endpoint using the vulnerable SDK
Read lib/mcp/tools.ts                                 — Understand MCP tool definitions (org-scoped)
Read src/__tests__/unit/visibility-tools.test.ts      — Existing MCP tool tests (must not regress)
Read supabase/migrations/20260218000000_initial_schema.sql
  § Find: current_user_org_id() SECURITY DEFINER function definition
  § Find: memberships table CREATE TABLE statement
  § Find: Example of org_isolation_select policy on another table (e.g. ai_evaluations)
Read package.json                                     — Current dependency versions
```

**Run this pre-implementation diagnosis before making any changes:**

```bash
# 1. Confirm current vulnerability state
npm audit 2>&1

# 2. Specifically check the three HIGH vulnerabilities
npm audit 2>&1 | grep -A3 "high\|Severity: high"

# 3. Confirm memberships has no RLS
grep -n "memberships" supabase/prod_schema.sql | grep -i "row level\|rls\|ENABLE"
# Expected: NO output (confirms the gap)

# 4. Confirm current_user_org_id() exists (needed for the RLS policy)
grep -n "current_user_org_id" supabase/prod_schema.sql | head -5
# Expected: output (function exists)

# 5. See an example RLS policy from another table to confirm the pattern
grep -A5 "org_isolation_select.*ai_evaluations" supabase/prod_schema.sql
# Copy this pattern for memberships

# 6. Confirm MCP endpoint exists and uses the vulnerable SDK
cat app/api/mcp/\[transport\]/route.ts | head -20

# 7. Run all tests — baseline before any changes
npx vitest run 2>&1 | tail -5
```

---

## 🏗️ Architecture — What to Build / Fix

### Part A: npm Security Fixes

#### Step 1: Apply npm audit fixes

```bash
# Run audit fix (safe — applies non-breaking patches first)
npm audit fix

# Re-run audit to check remaining issues
npm audit 2>&1

# If HIGH vulnerabilities remain after `npm audit fix`, check if force-fix is needed:
npm audit fix --force 2>&1
# WARNING: --force may apply breaking semver changes. Read output carefully before accepting.
```

**Expected behavior of each fix:**

| Package | CVE | Fix type | Expected outcome |
|---------|-----|----------|-----------------|
| `@modelcontextprotocol/sdk` | GHSA-345p-7cg4-v4c7 | Patch update | Bumped to patched version, no API changes |
| `minimatch` | GHSA-7r86-cg39-jmmj | Transitive dep update | Updated via dependents |
| `rollup` | GHSA-mw96-cpmx-2vgc | Patch update | Vite/build tooling update, dev-only |

**If `--force` is required for any of the HIGH vulnerabilities:**
1. Read exactly which packages are being downgraded or updated
2. Check if any package being force-updated is imported directly in LocalVector production code (`lib/`, `app/`, not `node_modules/`)
3. If only dev dependencies are force-updated (rollup, minimatch via jest/vitest), proceed
4. If `@modelcontextprotocol/sdk` requires a breaking version change, read the changelog before updating

#### Step 2: Verify MCP endpoint still functions after SDK update

```bash
# After npm audit fix, check that MCP imports still resolve
npx tsc --noEmit 2>&1 | grep "mcp\|modelcontext"
# Expected: no errors related to MCP

# Check that the MCP route still compiles
npx tsc --noEmit app/api/mcp/\[transport\]/route.ts 2>&1
```

**If the SDK update breaks the MCP interface:**

Read `app/api/mcp/[transport]/route.ts` and `lib/mcp/tools.ts`. The MCP SDK's server/transport instantiation API may have changed. Common breaking changes between MCP SDK minor versions:
- `Server` constructor signature
- `Transport` class naming
- `StdioServerTransport` vs named transport classes

Consult the MCP SDK changelog at `node_modules/@modelcontextprotocol/sdk/CHANGELOG.md`. Update imports/instantiation to match the new API. The functional behavior must remain identical — only the instantiation pattern changes.

#### Step 3: Run full test suite after npm changes

```bash
npx vitest run
# Must match or exceed baseline. The visibility-tools.test.ts must pass.

npm audit 2>&1 | grep "Severity: high\|found [0-9]"
# Target: 0 high severity vulnerabilities
```

---

### Part B: memberships RLS Migration

#### Step 1: Create the migration file

**Migration filename format:** Use the next timestamp after the last migration.
```bash
ls supabase/migrations/ | tail -5
# Find the newest timestamp, increment by 1 second or use today's date
```

Create: `supabase/migrations/20260303000001_memberships_rls.sql`

```sql
-- ============================================================
-- Migration: 20260303000001_memberships_rls.sql
-- Sprint FIX-2 — Close Security Gap: memberships table RLS
--
-- PROBLEM: memberships table was created in the initial schema
-- with no ENABLE ROW LEVEL SECURITY statement. Any authenticated
-- Supabase client can read all membership rows across all orgs.
--
-- SOLUTION: Enable RLS and add org-scoped policies using the
-- existing current_user_org_id() SECURITY DEFINER function,
-- which is the same pattern used on 24 other tables.
--
-- POLICIES:
--   SELECT — org members can see their own org's memberships
--   INSERT — org members can only insert into their own org
--   UPDATE — owner/admin only (role check handled at app layer
--            via org-roles.ts; DB allows any authenticated user
--            in the org to update, app layer enforces role)
--   DELETE — same as update
--
-- SERVICE ROLE BYPASS: All cron routes, webhook handlers, and
-- server-side seed operations use createServiceRoleClient()
-- which bypasses RLS. These are unaffected by this migration.
-- ============================================================

-- 1. Enable RLS on memberships
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 2. SELECT: any org member can see their org's full member list
--    (needed for team management page, invitation checks)
CREATE POLICY "memberships_org_isolation_select" ON public.memberships
  FOR SELECT
  USING (org_id = public.current_user_org_id());

-- 3. INSERT: only members of the target org can insert
--    (handle_new_user trigger runs as SECURITY DEFINER and bypasses RLS)
--    (invitation acceptance uses service role client — bypasses RLS)
CREATE POLICY "memberships_org_isolation_insert" ON public.memberships
  FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

-- 4. UPDATE: role changes and join_at updates — org-scoped
--    (role enforcement is at app layer in lib/auth/org-roles.ts)
CREATE POLICY "memberships_org_isolation_update" ON public.memberships
  FOR UPDATE
  USING (org_id = public.current_user_org_id());

-- 5. DELETE: member removal — org-scoped
--    (owner protection is enforced at app layer in seat-actions.ts)
CREATE POLICY "memberships_org_isolation_delete" ON public.memberships
  FOR DELETE
  USING (org_id = public.current_user_org_id());

-- 6. Index to support the RLS predicate efficiently
--    (idx_memberships_org already exists from initial schema — confirm)
-- DO NOT create duplicate index. Check first:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'memberships';
```

**Important:** Verify `idx_memberships_org` already exists before adding an index. The initial schema likely created it. Do NOT create a duplicate.

```bash
grep "idx_memberships_org" supabase/prod_schema.sql
# If output: index exists, do not add another
# If no output: add CREATE INDEX IF NOT EXISTS idx_memberships_org ON public.memberships(org_id);
```

#### Step 2: Assess `local_occasions` RLS status

The production audit flagged `local_occasions` as also missing RLS from `prod_schema.sql`. Before creating a migration for it, determine intent:

```bash
# Check if local_occasions is a shared/global table (no org_id column)
grep -A30 "CREATE TABLE.*local_occasions" supabase/prod_schema.sql | head -35
# OR from initial schema:
grep -A30 "CREATE TABLE.*local_occasions" supabase/migrations/20260218000000_initial_schema.sql | head -35
```

**Decision tree:**
- If `local_occasions` has NO `org_id` column: it is a global shared lookup table (like `directories`). Global tables are intentionally public. Add a comment to the migration explaining this.
- If `local_occasions` HAS an `org_id` column: it needs RLS just like `memberships`. Add it to this migration.
- If unclear: check how `local_occasions` is queried in `lib/occasions/occasion-feed.ts` and `lib/services/occasion-engine.service.ts`. Does it filter by `org_id`? If yes, RLS is needed.

Add a comment block to the migration explaining the `local_occasions` decision:
```sql
-- NOTE on local_occasions:
-- local_occasions [DOES / DOES NOT] have an org_id column.
-- [Because it is a shared global table / Because it is org-scoped]:
-- [No RLS needed — same as directories table / RLS added below]
```

#### Step 3: Apply migration locally and verify

```bash
# Apply the migration to local Supabase
npx supabase db reset --local
# OR apply just the new migration:
npx supabase migration apply --local 20260303000001_memberships_rls.sql

# Verify RLS is now enabled on memberships
npx supabase db dump --local 2>&1 | grep -A5 "memberships.*ROW LEVEL"
# Expected: ENABLE ROW LEVEL SECURITY on memberships
```

#### Step 4: Update `supabase/prod_schema.sql`

After applying the migration, update `prod_schema.sql` to reflect the new RLS status:

Add after the `memberships` table's last policy (or after its CREATE TABLE block if no policies existed):
```sql
ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_org_isolation_select" ON "public"."memberships" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));
CREATE POLICY "memberships_org_isolation_insert" ON "public"."memberships" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));
CREATE POLICY "memberships_org_isolation_update" ON "public"."memberships" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"()));
CREATE POLICY "memberships_org_isolation_delete" ON "public"."memberships" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### New Test: `src/__tests__/unit/memberships-rls.test.ts`

```
describe('memberships table RLS isolation')

  describe('SELECT isolation')
    1.  tenant A user cannot SELECT memberships rows from tenant B
    2.  tenant A user CAN SELECT their own org's memberships
    3.  unauthenticated client cannot SELECT any memberships row

  describe('INSERT isolation')
    4.  tenant A user cannot INSERT a membership row with tenant B's org_id
    5.  tenant A user CAN INSERT with their own org_id
    6.  service role client can INSERT into any org (bypass RLS)

  describe('UPDATE isolation')
    7.  tenant A user cannot UPDATE a membership row belonging to tenant B
    8.  tenant A user CAN UPDATE their own org's membership

  describe('DELETE isolation')
    9.  tenant A user cannot DELETE a membership row from tenant B
    10. tenant A user CAN DELETE a membership from their own org

  describe('trigger and service role bypass')
    11. service role client (cron, webhook) can read all memberships (RLS bypassed)
    12. handle_new_user trigger path creates membership successfully (SECURITY DEFINER bypass)
```

**Mock strategy:** Use the same pattern as `src/__tests__/integration/rls-isolation.test.ts`. Use `createTestClient()` and `createServiceClient()` from `src/__helpers__/supabase-test-client.ts`. Create two tenants (tenantA, tenantB) in `beforeAll`, verify isolation in tests, clean up in `afterAll`.

**12 tests total.**

### Extend: `src/__tests__/unit/npm-audit.test.ts`

```
describe('npm security audit')

  1.  package.json does not reference @modelcontextprotocol/sdk below patched version
  2.  package-lock.json does not contain known vulnerable minimatch version (< 3.0.5 or < 9.0.1)
  3.  package-lock.json does not contain known vulnerable rollup version (< 4.22.4 or < 3.29.5)
```

These tests read `package.json` and `package-lock.json` via `fs.readFileSync` and check version constraints. They fail loudly if a dependency is downgraded to a vulnerable version in the future.

**3 tests total.**

### Regression: Existing MCP tests must still pass

```bash
npx vitest run src/__tests__/unit/visibility-tools.test.ts
# Must pass — confirms MCP tool layer is unaffected by SDK update
```

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `package.json` | **MODIFY** (auto) | npm audit fix updates dependency versions |
| 2 | `package-lock.json` | **MODIFY** (auto) | Lockfile updated by npm audit fix |
| 3 | `supabase/migrations/20260303000001_memberships_rls.sql` | **CREATE** | Enables RLS + 4 policies on memberships |
| 4 | `supabase/prod_schema.sql` | **MODIFY** | Add RLS/policies for memberships |
| 5 | `src/__tests__/unit/memberships-rls.test.ts` | **CREATE** | 12 RLS isolation tests |
| 6 | `src/__tests__/unit/npm-audit.test.ts` | **CREATE** | 3 security version guard tests |

---

## 🚫 What NOT to Do

1. **DO NOT use `npm audit fix --force` blindly** — read the output first, understand what breaks, test before committing.
2. **DO NOT add RLS to `local_occasions` without first confirming it has an `org_id` column** — adding RLS to a global table breaks all reads for all users.
3. **DO NOT create an `idx_memberships_org` index if it already exists** — the initial schema likely created it. Duplicate indexes waste space and slow writes.
4. **DO NOT add `WITH CHECK (auth.uid() = user_id)` to the memberships INSERT policy** — the check must be `org_id = current_user_org_id()` to match all other tables. The `user_id` check would break invitation acceptance where an admin inserts a row for another user.
5. **DO NOT change the invitation flow or seat-actions.ts** — the migration must be backward-compatible. Invitations use `createServiceRoleClient()` which bypasses RLS. No code changes needed there.
6. **DO NOT remove any currently passing tests** — the full regression suite must pass.
7. **DO NOT use `supabase.auth.getUser()` in the RLS test** — use the `createTestClient()` helper which handles session creation correctly for test isolation.
8. **DO NOT skip the MCP endpoint test after SDK update** — run `visibility-tools.test.ts` explicitly before committing.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `npm audit` — 0 HIGH severity vulnerabilities (was 3)
- [ ] `@modelcontextprotocol/sdk` updated to patched version
- [ ] MCP endpoint still compiles and passes existing tests after SDK update
- [ ] `supabase/migrations/20260303000001_memberships_rls.sql` — ENABLE RLS + 4 org isolation policies
- [ ] `supabase/prod_schema.sql` — updated with memberships RLS and policies
- [ ] `local_occasions` RLS status assessed and documented in migration comment
- [ ] `npx tsc --noEmit` — still 0 errors (inherited from FIX-1, must not regress)
- [ ] `src/__tests__/unit/memberships-rls.test.ts` — **12 tests passing**
- [ ] `src/__tests__/unit/npm-audit.test.ts` — **3 tests passing**
- [ ] `npx vitest run src/__tests__/unit/visibility-tools.test.ts` — passes (MCP unbroken)
- [ ] `npx vitest run` — all tests passing, no regressions
- [ ] DEVLOG.md entry written

---

## 🔮 AI_RULES Update (Append to `docs/AI_RULES.md`)

```markdown
## §56. Security Maintenance Rules (FIX-2)

**npm audit:** Run `npm audit` before every production deployment. Any HIGH or CRITICAL vulnerability blocks deployment.  
**RLS completeness:** Every new table with an `org_id` column MUST have ENABLE ROW LEVEL SECURITY and at minimum a SELECT policy using `current_user_org_id()`. Tables without `org_id` (global lookup tables) document their public-read intent with a comment.  
**MCP security:** The `/api/mcp/[transport]` endpoint serves org-scoped tools. The `@modelcontextprotocol/sdk` package must be at the latest patched version at all times. Cross-client data leaks at the transport layer bypass all org isolation.
```

---

## 📓 DEVLOG Entry Format

```markdown
## [DATE] — Sprint FIX-2: Security Hardening — npm Vulnerabilities + memberships RLS (Completed)

**Problem:**
- 3 HIGH npm vulnerabilities: @modelcontextprotocol/sdk (cross-client data leak at MCP transport), minimatch (ReDoS), rollup (arbitrary file write).
- memberships table had no ENABLE ROW LEVEL SECURITY — any authenticated user could read all org members.

**Solution:**
- `npm audit fix` — Updated @modelcontextprotocol/sdk to [NEW VERSION], minimatch to [VERSION], rollup to [VERSION]. 0 HIGH vulnerabilities remain.
- `supabase/migrations/20260303000001_memberships_rls.sql` — ENABLE ROW LEVEL SECURITY + 4 org isolation policies (select/insert/update/delete using current_user_org_id()).
- `supabase/prod_schema.sql` — Updated with memberships RLS.
- local_occasions: [assessed as global table — no RLS needed / assessed as org-scoped — RLS added].

**Tests added:**
- `src/__tests__/unit/memberships-rls.test.ts` — **12 Vitest tests.** SELECT/INSERT/UPDATE/DELETE isolation + service role bypass.
- `src/__tests__/unit/npm-audit.test.ts` — **3 Vitest tests.** Version guard against vulnerable packages.

**Result:** 0 HIGH npm vulnerabilities. memberships RLS active. MCP endpoint unchanged and passing.
```

---

## 📚 Document Sync + Git Commit

```bash
git add -A
git status  # Verify: package.json, package-lock.json, migration, prod_schema.sql, 2 test files
git commit -m "FIX-2: Security hardening — npm vulns patched + memberships RLS

- npm audit fix: @modelcontextprotocol/sdk, minimatch, rollup — 0 HIGH vulns remaining
- migration 20260303000001: ENABLE RLS on memberships + 4 org isolation policies
- prod_schema.sql: memberships RLS/policies added
- AI_RULES: §56 security maintenance rules
- tests: memberships-rls.test.ts (12), npm-audit.test.ts (3)

npx tsc --noEmit: 0 errors. All existing tests passing."
git push origin main
```

---

## 🏁 Sprint Outcome

After FIX-2 completes:
- 0 HIGH-severity npm vulnerabilities (was 3, including MCP data leak)
- `memberships` table protected by org-scoped RLS (same as 24 other tables)
- 15 new security regression tests protect against future drift
- Production is safe to receive real customer data without cross-org exposure risk
