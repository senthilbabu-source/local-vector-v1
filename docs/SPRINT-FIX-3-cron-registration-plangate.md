# Sprint FIX-3 — Critical Runtime Fixes: Missing Crons + PlanGate Import Crash

> **Claude Code Prompt — Bulletproof Production Fix Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisite:** Sprint FIX-1 complete (`npx tsc --noEmit` = 0 errors)

---

## 🎯 Objective

Fix two critical production runtime failures that cause complete feature silence or page crashes the moment the app is deployed:

- **[CRITICAL-2.1]** Four fully-implemented cron route handlers are not registered in `vercel.json` — the Fear Engine (hallucination audit), Greed Engine (SOV tracking), citation intelligence, and content freshness audit **will never fire in production**. Every day this is unresolved is a day of irreplaceable SOV baseline data lost — Sprints 107, 108, and 109 require 4–8 weeks of this data.
- **[CRITICAL-3.1]** `app/dashboard/settings/locations/page.tsx` uses a **default import** for `PlanGate`, which is a **named export**. This causes a runtime crash (blank page) for every Agency user who tries to visit the locations settings page — the primary Sprint 100 deliverable.

These two fixes are bundled because they are both under 10 lines of code each, both are zero-risk (no logic changes), and both must ship immediately before any customer lands on a production instance.

**What is silent today:**
- `/api/cron/audit` — AI hallucination detection cron. Registered nowhere. Never fires. Fear Engine dashboard shows stale or empty data forever.
- `/api/cron/sov` — Share-of-Voice tracking cron. Never fires. SOV baseline clock has not started. Sprints 107-109 are gated on 4–8 weeks of this data.
- `/api/cron/citation` — Citation intelligence cron. Never fires. Citation timeline is static.
- `/api/cron/content-audit` — Content freshness audit cron. Never fires. Monthly content audit never runs.

**What crashes today:**
- `app/dashboard/settings/locations/page.tsx` — `import PlanGate from '@/components/plan-gate/PlanGate'` fails because `PlanGate` is a named export. Every Agency tier user who navigates to `/dashboard/settings/locations` gets a blank screen or a React render error.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                       — All engineering rules
Read docs/CLAUDE.md                                         — Architecture, cron patterns
Read vercel.json                                            — Current file — see what crons ARE registered
Read app/api/cron/audit/route.ts                            — Confirm the route exists and exports GET
Read app/api/cron/sov/route.ts                              — Confirm route exists
Read app/api/cron/citation/route.ts                         — Confirm route exists
Read app/api/cron/content-audit/route.ts                    — Confirm route exists
Read app/api/cron/weekly-digest/route.ts                    — Example of a correctly registered cron
Read app/dashboard/settings/locations/page.tsx              — Contains the broken default import
Read components/plan-gate/PlanGate.tsx                      — Confirm it is a named export (export function / export const)
Read lib/plan-enforcer.ts                                   — Understand plan gating patterns
Read src/__tests__/e2e/plan-gate.spec.ts (if it exists)    — Existing plan gate e2e tests
Read src/__fixtures__/golden-tenant.ts                      — Agency org fixture (needed for locations test)
```

**Pre-implementation diagnosis — run every command before touching any file:**

```bash
# 1. Audit current vercel.json cron configuration
cat vercel.json | python3 -m json.tool 2>/dev/null || cat vercel.json
# Expected: Only 3 crons registered (weekly-digest, refresh-gbp-tokens, refresh-places)

# 2. Confirm all 4 missing cron route files exist and export GET
grep -n "export async function GET\|export const GET" \
  app/api/cron/audit/route.ts \
  app/api/cron/sov/route.ts \
  app/api/cron/citation/route.ts \
  app/api/cron/content-audit/route.ts
# Expected: 4 lines of output (one per file) — confirms routes are implemented

# 3. Confirm CRON_SECRET auth guard exists in each route (security check)
grep -n "CRON_SECRET\|Authorization" \
  app/api/cron/audit/route.ts \
  app/api/cron/sov/route.ts \
  app/api/cron/citation/route.ts \
  app/api/cron/content-audit/route.ts
# Expected: Each file should guard with CRON_SECRET — confirm before registering

# 4. Confirm the broken PlanGate import
grep -n "import PlanGate" app/dashboard/settings/locations/page.tsx
# Expected: import PlanGate from '@/components/plan-gate/PlanGate' (default — wrong)

# 5. Confirm PlanGate is a named export
grep -n "^export" components/plan-gate/PlanGate.tsx
# Expected: "export function PlanGate" or "export const PlanGate" (named)

# 6. Find all other PlanGate usages to confirm correct import pattern
grep -rn "import.*PlanGate" app/ components/ lib/ --include="*.tsx" --include="*.ts"
# All other usages should use { PlanGate } — the locations page is the outlier

# 7. TypeScript confirmation of the import error
npx tsc --noEmit 2>&1 | grep "locations/page.tsx\|PlanGate"
# Expected: TS2613 or TS1192 error on locations/page.tsx

# 8. Run full test baseline before any changes
npx vitest run 2>&1 | tail -5
npx playwright test --reporter=dot 2>&1 | tail -5
```

---

## 🏗️ Architecture — What to Build / Fix

### Part A: Register Missing Crons in `vercel.json`

#### Step 1: Understand the cron schedule requirements

Read each cron route file and confirm its intended schedule. The route file may have a comment at the top specifying the schedule.

```bash
head -10 app/api/cron/audit/route.ts
head -10 app/api/cron/sov/route.ts
head -10 app/api/cron/citation/route.ts
head -10 app/api/cron/content-audit/route.ts
```

**Expected schedules (verify against route comments — route comment wins if different):**

| Route | Intended Schedule | Cron Expression | Rationale |
|-------|------------------|-----------------|-----------|
| `/api/cron/audit` | Daily, 8 AM UTC | `0 8 * * *` | Runs after overnight AI model activity, before US business hours |
| `/api/cron/sov` | Weekly, Sunday 7 AM UTC | `0 7 * * 0` | Weekly SOV snapshot on quiet traffic day |
| `/api/cron/citation` | Daily, 10 AM UTC | `0 10 * * *` | After audit cron, during business hours |
| `/api/cron/content-audit` | Monthly, 1st of month, 8 AM UTC | `0 8 1 * *` | Monthly content freshness check |

**If the route files specify different schedules, use the route file schedule.** The table above is the audit report's recommendation — the route file comment is the source of truth.

#### Step 2: Read and understand current `vercel.json`

The file currently looks like this (exact content may vary):
```json
{
  "crons": [
    { "path": "/api/cron/weekly-digest",    "schedule": "0 13 * * 1" },
    { "path": "/api/cron/refresh-gbp-tokens", "schedule": "0 * * * *" },
    { "path": "/api/cron/refresh-places",   "schedule": "0 9 * * *" }
  ]
}
```

**Do not delete or change existing cron entries.** Only add the four missing ones.

#### Step 3: Add the four missing cron entries

Update `vercel.json` to add the four entries. The final `crons` array must contain all 7 entries:

```json
{
  "crons": [
    { "path": "/api/cron/weekly-digest",     "schedule": "0 13 * * 1"  },
    { "path": "/api/cron/refresh-gbp-tokens","schedule": "0 * * * *"   },
    { "path": "/api/cron/refresh-places",    "schedule": "0 9 * * *"   },
    { "path": "/api/cron/audit",             "schedule": "0 8 * * *"   },
    { "path": "/api/cron/sov",               "schedule": "0 7 * * 0"   },
    { "path": "/api/cron/citation",          "schedule": "0 10 * * *"  },
    { "path": "/api/cron/content-audit",     "schedule": "0 8 1 * *"   }
  ]
}
```

**Validate JSON is well-formed after editing:**
```bash
cat vercel.json | python3 -m json.tool
# Must print formatted JSON with no error. If error: you have a syntax issue.

# Also validate path entries match actual file system paths
ls app/api/cron/audit/route.ts \
   app/api/cron/sov/route.ts \
   app/api/cron/citation/route.ts \
   app/api/cron/content-audit/route.ts
# All 4 must exist — if any is missing, DO NOT register it and document why
```

#### Step 4: Verify CRON_SECRET authorization in each newly-registered route

Before shipping, verify that each of the four routes correctly validates the Vercel-provided cron secret. Vercel sends an `Authorization: Bearer <CRON_SECRET>` header with all cron invocations.

Check each route for this pattern:
```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

Or for routes using the `STOP_*_CRON` kill switch pattern:
```typescript
if (process.env.STOP_AUDIT_CRON === 'true') {
  return NextResponse.json({ skipped: true, reason: 'kill_switch_active' });
}
```

If any route is missing the `CRON_SECRET` auth guard, **add it before registering the route**. An unguarded cron endpoint is a free denial-of-service attack surface.

```bash
# Confirm auth guard pattern in each route:
grep -n "CRON_SECRET\|Unauthorized\|401" \
  app/api/cron/audit/route.ts \
  app/api/cron/sov/route.ts \
  app/api/cron/citation/route.ts \
  app/api/cron/content-audit/route.ts
# Each file must have at least one match
```

---

### Part B: Fix PlanGate Default Import

#### Step 1: Understand the export shape

```bash
# Confirm PlanGate's export type
grep -n "^export" components/plan-gate/PlanGate.tsx
# Expected output will be ONE of:
#   export function PlanGate(      ← named function export
#   export const PlanGate =        ← named const export
#   export default function PlanGate  ← default export (rare — unlikely given other files use named)
```

If the file uses a **named export** (the expected case), the fix in `locations/page.tsx` is:

**Wrong (current):**
```typescript
import PlanGate from '@/components/plan-gate/PlanGate';
```

**Correct:**
```typescript
import { PlanGate } from '@/components/plan-gate/PlanGate';
```

If the file somehow uses a **default export**, the import is already correct and the TypeScript error has a different cause — read the full TS error message and diagnose accordingly.

#### Step 2: Apply the one-line fix

Open `app/dashboard/settings/locations/page.tsx`. Change only the import line. Do not modify any other code in this file.

**Before:**
```typescript
import PlanGate from '@/components/plan-gate/PlanGate';
```

**After:**
```typescript
import { PlanGate } from '@/components/plan-gate/PlanGate';
```

#### Step 3: Verify the fix

```bash
# TypeScript must no longer error on this file
npx tsc --noEmit 2>&1 | grep "locations/page.tsx"
# Expected: no output (no errors)

# Full type check — confirm total error count still 0
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Expected: 0
```

#### Step 4: Check for other default import mismatches across the codebase

While fixing this, audit all PlanGate imports to catch any other files with the same wrong import:

```bash
grep -rn "import PlanGate from" app/ components/ lib/ --include="*.tsx" --include="*.ts"
# Expected: no output (zero default imports of PlanGate anywhere)
# If any other files show up: fix those too
```

Also check if any other plan-gate components have similar issues:
```bash
grep -rn "import.*PlanGate\|import.*PlanBlur\|import.*PlanBadge" app/ components/ lib/ \
  --include="*.tsx" --include="*.ts"
# Compare against the actual exports in components/plan-gate/*.tsx
# Fix any default imports that should be named imports
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### New Test File 1: `src/__tests__/unit/vercel-cron-config.test.ts`

This test reads `vercel.json` and asserts all required cron routes are registered. It fails immediately if any cron is removed from vercel.json in the future.

```
describe('vercel.json cron registration completeness')

  describe('required cron paths are all registered')
    1.  /api/cron/weekly-digest is registered in vercel.json
    2.  /api/cron/refresh-gbp-tokens is registered in vercel.json
    3.  /api/cron/refresh-places is registered in vercel.json
    4.  /api/cron/audit is registered in vercel.json
    5.  /api/cron/sov is registered in vercel.json
    6.  /api/cron/citation is registered in vercel.json
    7.  /api/cron/content-audit is registered in vercel.json

  describe('cron schedule formats are valid')
    8.  all registered crons have a non-empty schedule string
    9.  all schedule strings match cron expression format (5-part or 6-part)
    10. no duplicate cron paths exist in the registry

  describe('registered cron routes exist as files')
    11. /api/cron/audit → app/api/cron/audit/route.ts exists on disk
    12. /api/cron/sov → app/api/cron/sov/route.ts exists on disk
    13. /api/cron/citation → app/api/cron/citation/route.ts exists on disk
    14. /api/cron/content-audit → app/api/cron/content-audit/route.ts exists on disk
```

**Implementation:** Use `fs.readFileSync('vercel.json')` to read and parse. Use `fs.existsSync()` for the file-exists checks. Use a regex like `/^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/` for cron expression validation.

**14 tests total.**

### New Test File 2: `src/__tests__/unit/cron-auth-guard.test.ts`

```
describe('cron route CRON_SECRET authorization guard')

  describe('/api/cron/audit')
    1.  returns 401 when Authorization header is absent
    2.  returns 401 when Authorization header has wrong secret
    3.  returns 200 (or 503 kill-switch) when Authorization header is correct

  describe('/api/cron/sov')
    4.  returns 401 when Authorization header is absent
    5.  returns 401 when Authorization header has wrong secret
    6.  proceeds past auth guard when correct secret provided

  describe('/api/cron/citation')
    7.  returns 401 when Authorization header is absent
    8.  returns 401 when wrong secret provided

  describe('/api/cron/content-audit')
    9.  returns 401 when Authorization header is absent
    10. returns 401 when wrong secret provided
```

**Mock:** Set `process.env.CRON_SECRET = 'test-secret-abc'` in `beforeAll`. Call each route's GET handler directly (import the handler, construct a mock `Request` with/without the Authorization header).

**10 tests total.**

### New E2E Test: Extend `src/__tests__/e2e/plan-gate.spec.ts`

Add to the existing plan-gate E2E spec (or create if it doesn't exist):

```
describe('PlanGate — locations settings page')
  1.  Agency user can navigate to /dashboard/settings/locations without a crash
  2.  Agency user sees the location management UI (not a blank/error page)
  3.  Starter plan user sees the PlanGate blur overlay on /dashboard/settings/locations
  4.  Starter plan user sees upgrade CTA text on the locations page
```

**Implementation:**
- Use the golden tenant (Agency tier) for tests 1–2. Assert `page.locator('[data-testid="locations-list"]')` is visible.
- Use a Starter plan fixture user for tests 3–4. Assert `page.locator('[data-testid="plan-gate-blur"]')` is visible and the locations list is NOT visible.
- These tests use `page.route()` to mock Supabase data — never hit real DB.

**4 E2E tests.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `vercel.json` | **MODIFY** | Add 4 missing cron registrations |
| 2 | `app/dashboard/settings/locations/page.tsx` | **MODIFY** | Fix default → named PlanGate import |
| 3 | `app/api/cron/audit/route.ts` | **VERIFY** (modify if needed) | Add CRON_SECRET guard if missing |
| 4 | `app/api/cron/sov/route.ts` | **VERIFY** (modify if needed) | Add CRON_SECRET guard if missing |
| 5 | `app/api/cron/citation/route.ts` | **VERIFY** (modify if needed) | Add CRON_SECRET guard if missing |
| 6 | `app/api/cron/content-audit/route.ts` | **VERIFY** (modify if needed) | Add CRON_SECRET guard if missing |
| 7 | `src/__tests__/unit/vercel-cron-config.test.ts` | **CREATE** | 14 cron registry completeness tests |
| 8 | `src/__tests__/unit/cron-auth-guard.test.ts` | **CREATE** | 10 cron security tests |
| 9 | `src/__tests__/e2e/plan-gate.spec.ts` | **CREATE/MODIFY** | 4 E2E tests for locations page |

---

## 🚫 What NOT to Do

1. **DO NOT change the schedule of existing crons** — `weekly-digest`, `refresh-gbp-tokens`, `refresh-places` are production-critical and their schedules must remain exactly as they are.
2. **DO NOT change any business logic in the cron route handlers** — this sprint only adds them to `vercel.json` and verifies auth guards. The route logic is Sprint 99-101 work and must not be touched.
3. **DO NOT register a cron route if its route file does not exist on disk** — verify file existence before adding to vercel.json. A registered path with no handler returns 404 on every invocation and wastes cron quota.
4. **DO NOT change any code in `app/dashboard/settings/locations/page.tsx` beyond the import line** — the rest of the file's logic is Sprint 100 work and must be left intact.
5. **DO NOT add `export default PlanGate` to `PlanGate.tsx`** — the correct fix is to update the import in the page file. Do not change the component file to accommodate a wrong import.
6. **DO NOT hardcode `CRON_SECRET` values** — all references to the secret in code use `process.env.CRON_SECRET`. In tests, use `vi.stubEnv('CRON_SECRET', 'test-secret')`.
7. **DO NOT use `page.waitForTimeout()` in Playwright tests** — use `page.waitForSelector()` or `page.waitForResponse()`.
8. **DO NOT commit until `npx tsc --noEmit` = 0 errors** — the PlanGate fix eliminates a TS error; the total must stay at 0.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `vercel.json` contains exactly 7 cron entries — all 3 original plus 4 new
- [ ] `cat vercel.json | python3 -m json.tool` — valid JSON, no syntax errors
- [ ] All 4 new cron routes (`audit`, `sov`, `citation`, `content-audit`) have CRON_SECRET auth guard
- [ ] `app/dashboard/settings/locations/page.tsx` uses `{ PlanGate }` named import
- [ ] Zero other files use `import PlanGate from` (default import) anywhere in the codebase
- [ ] `npx tsc --noEmit` — 0 errors (PlanGate TS error eliminated)
- [ ] `src/__tests__/unit/vercel-cron-config.test.ts` — **14 tests passing**
- [ ] `src/__tests__/unit/cron-auth-guard.test.ts` — **10 tests passing**
- [ ] Locations page E2E — **4 tests passing** (Agency user lands, Starter user sees gate)
- [ ] `npx vitest run` — all tests passing, zero regressions
- [ ] DEVLOG.md entry written

---

## ⏱️ SOV Baseline Clock — Critical Note

**The moment `vercel.json` is deployed with the SOV and audit crons registered, the 4–8 week data accumulation clock starts for Sprints 107 (Competitor Prompt Hijacking), 108 (Per-Engine Playbooks), and 109 (Intent Discovery).** Every day this fix is delayed is a day added to the Tier 5 wait. Deploy this sprint as fast as possible.

Document the deployment timestamp in DEVLOG:
```markdown
**SOV baseline clock started:** [DEPLOYMENT_DATE] at [DEPLOYMENT_TIME] UTC
Sprint 107 earliest start: [DEPLOYMENT_DATE + 28 days]
Sprint 109 earliest start: [DEPLOYMENT_DATE + 56 days]
```

---

## 🔮 AI_RULES Update (Append to `docs/AI_RULES.md`)

```markdown
## §57. Cron Registration Completeness (FIX-3)

Every cron route handler at `app/api/cron/*/route.ts` MUST be registered in `vercel.json`. Adding a cron handler without registering it produces no error — the handler simply never fires. `src/__tests__/unit/vercel-cron-config.test.ts` enforces this automatically.

**Checklist when adding a new cron:**
1. Create `app/api/cron/<name>/route.ts`
2. Add `CRON_SECRET` authorization guard (returns 401 without correct header)
3. Add `STOP_<NAME>_CRON` kill switch (returns early with `{ skipped: true }`)
4. Register in `vercel.json` with appropriate schedule
5. Document `CRON_SECRET` and `STOP_<NAME>_CRON` in `.env.local.example`
6. Add the path to `vercel-cron-config.test.ts`

## §58. Named vs Default Exports — Plan Gate Components (FIX-3)

All components in `components/plan-gate/` use **named exports**. Always import with `{ PlanGate }`, `{ PlanBlur }`, etc. Never use default imports for plan-gate components.
```

---

## 📓 DEVLOG Entry Format

```markdown
## [DATE] — Sprint FIX-3: Missing Cron Registration + PlanGate Import Fix (Completed)

**Problems fixed:**
1. vercel.json missing 4 of 7 cron routes — audit, sov, citation, content-audit were never firing.
2. app/dashboard/settings/locations/page.tsx had default import of PlanGate (named export) — caused blank page crash for Agency users.

**Changes:**
- `vercel.json` — Added 4 missing cron entries. All 7 crons now registered.
  - /api/cron/audit: 0 8 * * * (daily 8 AM UTC)
  - /api/cron/sov: 0 7 * * 0 (weekly Sunday 7 AM UTC)
  - /api/cron/citation: 0 10 * * * (daily 10 AM UTC)
  - /api/cron/content-audit: 0 8 1 * * (monthly 1st 8 AM UTC)
- `app/dashboard/settings/locations/page.tsx` — Fixed: default import → { PlanGate } named import.
- [CRON ROUTE FILES] — Verified/added CRON_SECRET authorization guards.
- `AI_RULES.md` — Added §57 (cron registration) and §58 (named exports).

**SOV baseline clock started:** [DEPLOYMENT_TIMESTAMP]
Sprint 107 earliest: [+28 days]. Sprint 109 earliest: [+56 days].

**Tests added:**
- `src/__tests__/unit/vercel-cron-config.test.ts` — **14 Vitest tests.** Registry completeness + schedule validation + file existence.
- `src/__tests__/unit/cron-auth-guard.test.ts` — **10 Vitest tests.** CRON_SECRET auth on all 4 new routes.
- Locations page E2E — **4 Playwright tests.** Agency landing + Starter plan gate.

**Result:** `npx tsc --noEmit` → 0 errors. All N tests passing.
```

---

## 📚 Document Sync + Git Commit

```bash
git add -A
git status   # Verify: vercel.json, locations/page.tsx, cron route files (if modified), 2 test files
git commit -m "FIX-3: Register missing crons + fix PlanGate default import crash

CRITICAL: 4 cron routes were registered in code but missing from vercel.json.
They have never fired in production. SOV/audit/citation/content-audit now registered.

- vercel.json: added audit (daily), sov (weekly), citation (daily), content-audit (monthly)
- settings/locations/page.tsx: fixed default import → named { PlanGate } (was crashing Agency users)
- cron routes: verified/added CRON_SECRET authorization guards on all 4 new routes
- AI_RULES: §57 cron completeness, §58 named exports rule
- tests: vercel-cron-config.test.ts (14), cron-auth-guard.test.ts (10), plan-gate E2E (4)

SOV baseline clock starts on deployment of this commit.
Sprint 107/108/109 earliest dates: +28/+28/+56 days from deploy."
git push origin main
```

---

## 🏁 Sprint Outcome

After FIX-3 completes:
- All 7 cron routes are registered and will fire on their schedules in production
- SOV/audit data accumulation begins — the Tier 5 countdown clock starts
- Agency users can access `/dashboard/settings/locations` without a crash
- 28 new tests guard against both regressions permanently
