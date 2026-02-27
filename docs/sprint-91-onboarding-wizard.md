# Sprint 91 — Onboarding Wizard Completion

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `MEMORY.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `docs/06-ONBOARDING.md` (if it exists)

---

## 🎯 Objective

Complete the **onboarding wizard** — the first experience every new LocalVector user sees. The wizard currently exists at ~50%: the page loads, `TruthCalibrationForm` (hours + amenities) exists, and SOV seeding fires on completion. What's **missing** is everything that ties it together into a polished, confidence-inspiring first session:

1. **Full Step 1–5 wizard flow** with a visible progress indicator (not a single-page dump)
2. **GBP import wired into Step 1** — Sprint 89's `triggerGBPImport()` as the fast path, manual entry as the fallback
3. **Auto-run first Fear Engine audit** during Step 5 ("Launch") so the dashboard is populated when the user arrives — not empty
4. **< 3-minute promise** — a new user who connects GBP reaches a populated dashboard in under 3 minutes; a manual-entry user in under 5

**Why this matters:** First impressions are permanent. An empty dashboard on first visit is the #1 cause of Day-1 churn in SaaS products. The whole point of Sprints 89 and 90 was to get data into the system — this sprint makes sure that data flows through *during* onboarding, not after.

**Gap being closed:** Feature #56 (Onboarding Wizard) — 50% → 100%.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing a single line of code, read all of these. Do not skip any.

```
Read docs/AI_RULES.md                              — All engineering rules (39+)
Read CLAUDE.md                                     — Architecture, patterns, implementation inventory
Read MEMORY.md                                     — Architectural decisions and constraints
Read docs/06-ONBOARDING.md                         — Canonical onboarding spec (Step 1–5 source of truth)
                                                     If this file does not exist, read docs/09-BUILD-PLAN.md
                                                     Phase 4 section for onboarding spec details
Read supabase/prod_schema.sql                      — Canonical schema
  § Find: orgs table — check for onboarding_completed_at, onboarding_step, or similar columns
  § Find: locations table — hours_data, operational_status, amenities, gbp_synced_at (Sprint 89)
  § Find: sov_queries table — seeding happens at onboarding completion
  § Find: hallucination_audits or fear_engine equivalent table — for auto-first-audit
Read lib/supabase/database.types.ts               — TypeScript types for all tables above
Read src/__fixtures__/golden-tenant.ts             — Golden Tenant (org_id: a0eebc99-...)
Read app/onboarding/page.tsx                       — CURRENT onboarding page — understand everything built so far
Read app/actions/gbp-import.ts                     — Sprint 89: triggerGBPImport() Server Action
Read lib/gbp/gbp-data-mapper.ts                    — Sprint 89: MappedLocationData type
Read app/actions/                                  — Find existing onboarding-related server actions (SOV seeding, etc.)
Read lib/plan-enforcer.ts                          — Plan gating (onboarding is unblocked for all plans)
Read lib/supabase/server.ts                        — createClient() vs createServiceRoleClient()
Read app/api/cron/                                 — Find the Fear Engine / hallucination audit cron to understand the trigger pattern
Read app/dashboard/page.tsx                        — Destination after onboarding — understand what's shown
```

**Critical things to understand before writing code:**
- The exact current state of `app/onboarding/page.tsx` — what steps exist, what state is managed, what actions are already wired
- Whether `orgs` or `locations` tracks `onboarding_completed_at` or step progress — if not, you'll add it (see Component 7)
- How the existing SOV seeding action (`sov-seed.ts` or equivalent) is triggered — you'll call it in Step 4
- How the Fear Engine cron route triggers audits — you need to replicate or directly call that logic in Step 5
- Which Supabase client pattern the existing onboarding page uses

---

## 🏗️ Architecture — The 5-Step Wizard

### Wizard State Model

The wizard is a single `'use client'` page managing a step index and collected data. No page navigations between steps — pure React state transitions.

```typescript
type WizardStep = 1 | 2 | 3 | 4 | 5;

type WizardState = {
  step: WizardStep;

  // Step 1 output
  businessSource: 'gbp' | 'manual' | null;
  gbpImported: boolean;
  mappedData: MappedLocationData | null;

  // Step 2 output (hours + amenities — TruthCalibrationForm)
  hoursData: HoursData | null;
  amenities: AmenitiesData | null;

  // Step 3 output (competitors)
  competitors: string[];     // Google Place IDs or names

  // Step 4 output (SOV queries)
  sovQueries: string[];      // Seeded automatically, user can add/remove

  // Step 5 — launch state
  auditStatus: 'idle' | 'running' | 'complete' | 'error';
  auditId: string | null;
};

const INITIAL_STATE: WizardState = {
  step: 1,
  businessSource: null,
  gbpImported: false,
  mappedData: null,
  hoursData: null,
  amenities: null,
  competitors: [],
  sovQueries: [],
  auditStatus: 'idle',
  auditId: null,
};
```

---

### Progress Indicator

Render at the top of the wizard — always visible regardless of step.

```
Step 1 of 5  ●────○────○────○────○
             [1] [2] [3] [4] [5]
         Business Info  Hours  Competitors  Queries  Launch
```

**Implementation rules:**
- Progress dots: filled circle for completed steps, current step highlighted with brand color, upcoming steps gray
- Step labels below each dot: short single-word labels (see above)
- Do NOT use a stepper library — build with Tailwind flex layout and conditional classes
- Use literal Tailwind classes for active/inactive states (AI_RULES §12): `bg-violet-600`, `bg-gray-300`, etc.
- Never hide the progress bar — even on the Launch step (Step 5)

**Component:** Extract into `app/onboarding/_components/WizardProgress.tsx`

```typescript
interface WizardProgressProps {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
}
```

---

### Step 1: Business Info (GBP Import OR Manual)

**This step already has a GBP interstitial built in Sprint 89.** Your job is to make sure it's correctly wired into the wizard's step flow, not a standalone page. Specifically:

**If GBP is connected** (check `gbp_connections` row server-side at page load, pass as `hasgbpConnected: boolean` prop):
- Show the Sprint 89 GBP interstitial UI (import button, importing spinner, success preview, error fallback)
- On import success: set `wizardState.gbpImported = true`, `wizardState.mappedData = result.mapped`, auto-advance to Step 2 after 1.5 seconds
- On import error or "Skip / Enter Manually": advance to Step 2 with `wizardState.businessSource = 'manual'`
- On manual skip: Step 2's `TruthCalibrationForm` becomes required (cannot be skipped)

**If GBP is NOT connected:**
- Show a simplified business name + address form (minimal — just enough to populate the `locations` row name/address)
- Below the form: a small "Connect Google Business Profile" link → opens settings in a new tab
- On submit: save name + address via Server Action, set `wizardState.businessSource = 'manual'`, advance to Step 2

**data-testid attributes required on Step 1:**
- `data-testid="step1-gbp-import-btn"` — the import button
- `data-testid="step1-skip-manual"` — the "Enter manually" link/button
- `data-testid="step1-success-card"` — the success preview card
- `data-testid="step1-manual-form"` — the manual entry form
- `data-testid="step1-next-btn"` — the Next button (manual path only)

---

### Step 2: Hours & Amenities (TruthCalibrationForm)

**This component already exists.** Wire it into Step 2 of the wizard flow.

**If GBP imported (Step 1 success):**
- Pre-populate the form with `wizardState.mappedData.hours_data` and `wizardState.mappedData.amenities`
- Show a banner: "✅ Imported from Google — review and confirm your hours"
- User can edit any field before continuing

**If manual path:**
- Form starts empty — all fields required before advancing

**On Step 2 submit:**
- Call the existing save action for hours + amenities (find the correct action in `app/actions/`)
- If no action exists for this, create `app/actions/save-location-truth.ts` (see Component 2)
- On success: set `wizardState.hoursData` + `wizardState.amenities`, advance to Step 3

**data-testid attributes required:**
- `data-testid="step2-hours-form"` — the TruthCalibrationForm wrapper
- `data-testid="step2-gbp-prefill-banner"` — the "imported from Google" banner (conditional)
- `data-testid="step2-next-btn"` — advance to Step 3
- `data-testid="step2-back-btn"` — return to Step 1

---

### Step 3: Add Competitors

**This is net-new UI.** A lightweight competitor seeding step.

**Purpose:** Seed 1–3 competitors so the Greed Engine has targets from Day 1. Users who skip this see empty competitor dashboards.

**UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Who are your main competitors?                                  │
│  We'll track when AI models recommend them over you.            │
│                                                                   │
│  [Search for a business...              ] [Add]                  │
│                                                                   │
│  Added competitors:                                              │
│  ✕ Krave Hookah Lounge, Alpharetta                              │
│  ✕ Hookah Palace, Johns Creek                                    │
│                                                                   │
│  [Skip for now — I'll add competitors later]                     │
│  [Next → ]                                                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Text input: free-form competitor name entry (do NOT require Google Places API here — keep it simple, just save the name string)
- "Add" button appends to list, max 5 competitors
- Each competitor shows an ✕ remove button
- "Skip" is always visible — competitors are optional
- On Step 3 submit: call `app/actions/seed-competitors.ts` (create if not exists — see Component 3)
- Save competitors to `competitors` table as rows with `org_id`, `name`, `is_manual: true`
- On success (or skip): advance to Step 4

**data-testid attributes:**
- `data-testid="step3-competitor-input"` — the text input
- `data-testid="step3-add-btn"` — the Add button
- `data-testid="step3-competitor-list"` — the added competitors list
- `data-testid="step3-skip-btn"` — the skip link
- `data-testid="step3-next-btn"` — the Next button

---

### Step 4: AI Visibility Queries (SOV Seeding Review)

**SOV seeding at onboarding already fires (`sov-seed.ts`)** — Feature #21 is complete. This step shows the user what was seeded so they feel in control, and lets them add custom queries.

**UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  How will AI find you?                                           │
│  These are the questions we'll track in ChatGPT, Perplexity,   │
│  Google Gemini, and Copilot.                                    │
│                                                                   │
│  Auto-generated for you:                                         │
│  ✓ "best hookah lounge in Alpharetta GA"                         │
│  ✓ "hookah bar near me Johns Creek"                              │
│  ✓ "Indian fusion restaurant Alpharetta"                         │
│  ✓ "hookah lounge with live music Atlanta"                       │
│                                                                   │
│  + Add your own query                                            │
│  [___________________________________] [Add]                     │
│                                                                   │
│  [← Back]                      [Next → Launch]                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Fetch already-seeded `sov_queries` for this org from the DB server-side (pass as `initialQueries` prop)
- If SOV seeding hasn't run yet (empty), trigger it now via the existing seed action
- Allow adding up to 3 custom queries (INSERT into `sov_queries` via a new action `app/actions/add-sov-query.ts` — only create if no existing action covers this)
- Read-only display for auto-generated queries (no delete on this step — they can manage in the SOV dashboard)
- Custom queries show ✕ to remove before saving
- Step 4 is never blockable — always allow advancing even if queries couldn't load

**data-testid attributes:**
- `data-testid="step4-query-list"` — the seeded queries list
- `data-testid="step4-custom-input"` — the custom query input
- `data-testid="step4-add-query-btn"` — the Add button
- `data-testid="step4-next-btn"` — the "Next → Launch" button
- `data-testid="step4-back-btn"` — Back to Step 3

---

### Step 5: Launch (Auto-Run First Audit + Celebrate)

**This is the most critical step.** It fires the first Fear Engine audit, marks onboarding complete, then redirects to the dashboard.

**UI flow:**

```
[State: Launching]
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  🚀 Launching your AI Visibility Engine...                       │
│                                                                   │
│  ⏳ Running your first AI audit across ChatGPT, Perplexity,     │
│     Google Gemini, and Microsoft Copilot...                     │
│                                                                   │
│  This takes about 30–60 seconds.                                 │
│                                                                   │
│                         [spinner]                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

[State: Complete]
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  ✅ You're live! Your AI visibility profile is ready.            │
│                                                                   │
│  We checked 4 AI engines for mentions of your business.          │
│  Your Risk Dashboard is now populated.                           │
│                                                                   │
│  [Go to My Dashboard →]                                          │
│                                                                   │
│  (Auto-redirecting in 5 seconds...)                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

[State: Audit Error — graceful degradation]
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  ✅ You're set up! Your profile is ready.                        │
│                                                                   │
│  Your first AI audit is queued and will complete within          │
│  the next few minutes. Check back shortly.                       │
│                                                                   │
│  [Go to My Dashboard →]                                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- On mount of Step 5: immediately call `triggerFirstAudit()` Server Action (see Component 4)
- Poll for audit completion every 5 seconds using `setInterval` — poll the `hallucination_audits` (or equivalent) table via a lightweight status endpoint
- Cap polling at 90 seconds — if audit not complete, show the graceful degradation state and still redirect
- On completion OR graceful degradation: mark onboarding complete via `completeOnboarding()` (see Component 5) then redirect to `/dashboard`
- Auto-redirect countdown: `setInterval` 5-second countdown shown in the success state
- `router.push('/dashboard')` on redirect — never use `window.location.href`

**data-testid attributes:**
- `data-testid="step5-launching-state"` — the spinner / running state
- `data-testid="step5-complete-state"` — the success state
- `data-testid="step5-error-state"` — the graceful degradation state
- `data-testid="step5-dashboard-btn"` — the "Go to My Dashboard" button
- `data-testid="step5-countdown"` — the auto-redirect countdown text

---

## 🔧 Components to Build

### Component 1: `app/onboarding/_components/WizardProgress.tsx`

```typescript
'use client';

interface WizardProgressProps {
  currentStep: WizardStep;         // 1–5
  completedSteps: WizardStep[];    // Steps already finished
}

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Business',
  2: 'Hours',
  3: 'Competitors',
  4: 'Queries',
  5: 'Launch',
};

export function WizardProgress({ currentStep, completedSteps }: WizardProgressProps) { ... }
```

Rules:
- Fully accessible: `aria-label="Onboarding progress"`, `role="progressbar"`, `aria-valuenow={currentStep}`, `aria-valuemin={1}`, `aria-valuemax={5}`
- `data-testid="wizard-progress"` on the outer wrapper
- `data-testid={`step-indicator-${n}`}` on each step dot

---

### Component 2: `app/actions/save-location-truth.ts` (create only if no existing action covers this)

```typescript
'use server';

/**
 * Saves verified hours and amenities for the authenticated user's org.
 * Called from Step 2 of the onboarding wizard and (future) Business Info Editor (Sprint 93).
 * Returns { ok: true, location_id } or { ok: false, error }.
 */
export async function saveLocationTruth(data: {
  hoursData: HoursData;
  amenities: AmenitiesData;
}): Promise<{ ok: boolean; location_id?: string; error?: string }> { ... }
```

- Uses `createClient()` for auth (user must own the org)
- Uses service role for the UPDATE (bypasses RLS on locations if needed)
- Updates `locations` for the org's primary location (same pattern as Sprint 89)
- If an existing action already handles this (check `app/actions/` carefully), do NOT create a duplicate — call the existing one

---

### Component 3: `app/actions/seed-competitors.ts` (create only if `app/actions/competitors.ts` doesn't cover this)

```typescript
'use server';

/**
 * Seeds initial competitors for an org during onboarding.
 * Creates competitor rows with is_manual: true.
 * Idempotent: skips duplicates by name (case-insensitive) for the org.
 */
export async function seedOnboardingCompetitors(
  competitorNames: string[]
): Promise<{ ok: boolean; seeded: number; error?: string }> { ... }
```

- Max 5 competitors enforced server-side (reject if `competitorNames.length > 5`)
- Duplicate detection: check existing `competitors` rows for this org by name (lowercased)
- Only create if the existing competitors CRUD actions don't already handle bulk-insert from onboarding

---

### Component 4: `app/actions/trigger-first-audit.ts`

```typescript
'use server';

/**
 * Triggers the first Fear Engine audit for a new org during onboarding.
 * 
 * Strategy: look up the existing cron handler pattern. Options (pick whichever matches the codebase):
 *   A) Call the internal cron route via fetch (same pattern as crawler-log in Sprint 73)
 *   B) Directly call the audit trigger function used by the cron (if it's exported from lib/)
 *   C) INSERT a row into a job queue table (if that pattern exists)
 * 
 * DO NOT duplicate audit logic. Find the right hook into the existing Fear Engine.
 * 
 * Returns { ok: true, auditId } if the audit was queued/started.
 * Returns { ok: false, error } if the trigger failed — onboarding continues regardless.
 */
export async function triggerFirstAudit(): Promise<
  { ok: true; auditId: string } | { ok: false; error: string }
> { ... }
```

**Critical rule:** Read `app/api/cron/` carefully before implementing. Find the exact pattern the Fear Engine uses (direct function call, internal fetch, Inngest event, etc.) and replicate it. Do NOT write a new audit runner from scratch.

---

### Component 5: `app/actions/complete-onboarding.ts`

```typescript
'use server';

/**
 * Marks onboarding as complete for the authenticated user's org.
 * Sets onboarding_completed_at on the orgs table (or equivalent — check schema).
 * Also triggers SOV seeding if not already run.
 * Called from Step 5 before redirecting to /dashboard.
 */
export async function completeOnboarding(): Promise<{ ok: boolean; error?: string }> { ... }
```

- Read the schema carefully — `orgs` may already have `onboarding_completed_at` or an `onboarding_step` column. If not, see Component 7 (migration) to add it.
- Idempotent: calling this twice should not error (use `UPDATE ... WHERE onboarding_completed_at IS NULL`)
- If SOV seeding hasn't run (check `sov_queries` count for org = 0), call the SOV seed action here as a safety net

---

### Component 6: `app/api/onboarding/audit-status/route.ts`

**Lightweight polling endpoint** for Step 5 to check whether the first audit completed.

```typescript
/**
 * GET /api/onboarding/audit-status?orgId={orgId}
 * Returns { status: 'running' | 'complete' | 'not_found', auditId? }
 * 
 * Used by Step 5 polling loop. Authenticated — verifies org ownership.
 * Low-cost: SELECT COUNT(*) from hallucination_audits (or equivalent)
 * where org_id = orgId AND status = 'complete' AND created_at > NOW() - 5 minutes
 */
export async function GET(request: Request) { ... }
```

- Auth via `createClient()` — user must be authenticated
- Queries for a recent completed audit (created in the last 5 minutes for this org)
- Returns JSON only — no HTML
- `data-testid` not applicable (server route)

---

### Component 7: Migration — `supabase/migrations/[timestamp]_orgs_onboarding_completed.sql`

**Only create this migration if `orgs.onboarding_completed_at` does not already exist in `prod_schema.sql`.**

Read `prod_schema.sql` first. If the column exists, skip this migration entirely.

```sql
-- Sprint 91: Track onboarding completion timestamp on orgs
-- Skip if orgs.onboarding_completed_at already exists in prod_schema.sql

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Index for dashboard queries: filter incomplete onboarding
CREATE INDEX IF NOT EXISTS idx_orgs_onboarding_completed
  ON public.orgs (onboarding_completed_at)
  WHERE onboarding_completed_at IS NULL;

COMMENT ON COLUMN public.orgs.onboarding_completed_at IS
  'Timestamp when onboarding wizard was completed. NULL = not yet completed. Sprint 91.';
```

**If the column exists:** skip migration, but do confirm `database.types.ts` has it typed correctly.

---

### Component 8: Onboarding Guard Middleware Update

**If `onboarding_completed_at` is NULL, redirect unauthenticated dashboard visits back to `/onboarding`.**

Check `proxy.ts` (AI_RULES §6 — never edit `middleware.ts`). Find where dashboard auth/redirect logic lives. Add:

```typescript
// If authenticated user has not completed onboarding, redirect to wizard
// Check: orgs.onboarding_completed_at IS NULL
// Only apply to /dashboard routes, not /onboarding itself
```

Implementation options (use whichever matches the existing pattern):
- **Option A:** Check `onboarding_completed_at` in the Supabase auth callback or layout server component for `/dashboard`
- **Option B:** Add a check in the dashboard root layout (`app/dashboard/layout.tsx`) — if `onboarding_completed_at` is null, `redirect('/onboarding')`
- **DO NOT** try to make this check in `proxy.ts` middleware if it requires a DB query — Edge middleware has the same SDK restrictions as in Sprint 73

**Preferred:** Check in `app/dashboard/layout.tsx` since it's a Server Component with full DB access.

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/wizard-progress.test.ts`

**Target: `app/onboarding/_components/WizardProgress.tsx`**

```
describe('WizardProgress')
  1.  renders 5 step indicators
  2.  current step dot has active/highlighted style class
  3.  completed steps have filled/success style class
  4.  future steps have inactive/gray style class
  5.  renders correct label for each step (Business, Hours, Competitors, Queries, Launch)
  6.  has aria-label="Onboarding progress"
  7.  has role="progressbar" with correct aria-valuenow
  8.  data-testid="wizard-progress" present on wrapper
  9.  data-testid="step-indicator-1" through "step-indicator-5" all present
  10. step 1 of 5 shows "Step 1 of 5" or equivalent accessible text
```

**10 tests. Use `@testing-library/react`. No mocks needed — pure UI component.**

---

### Test File 2: `src/__tests__/unit/save-location-truth.test.ts`

**Target: `app/actions/save-location-truth.ts`**
*(Skip if wiring into an existing action — test the existing action instead)*

```
describe('saveLocationTruth')
  1.  returns { ok: false } when user is not authenticated
  2.  returns { ok: false } when org has no location row
  3.  updates hours_data on the location row
  4.  updates amenities on the location row
  5.  returns { ok: true, location_id } on success
  6.  returns { ok: false, error } when Supabase update fails
  7.  does not update unrelated fields on the location row
```

**7 tests. Mock `createClient` and `createServiceRoleClient`.**

---

### Test File 3: `src/__tests__/unit/seed-competitors.test.ts`

**Target: `app/actions/seed-competitors.ts`**

```
describe('seedOnboardingCompetitors')
  1.  returns { ok: false } when user is not authenticated
  2.  rejects more than 5 competitors
  3.  inserts all provided competitor names
  4.  skips duplicates (case-insensitive name match for same org)
  5.  returns { ok: true, seeded: N } with correct count
  6.  returns { ok: true, seeded: 0 } for empty array (skip allowed)
  7.  returns { ok: false, error } when Supabase insert fails
  8.  sets is_manual: true on all inserted rows
```

**8 tests. Mock Supabase client.**

---

### Test File 4: `src/__tests__/unit/complete-onboarding.test.ts`

**Target: `app/actions/complete-onboarding.ts`**

```
describe('completeOnboarding')
  1.  returns { ok: false } when user is not authenticated
  2.  sets onboarding_completed_at to current timestamp
  3.  is idempotent — second call does not error when already completed
  4.  triggers SOV seeding if sov_queries count is 0 for org
  5.  does NOT re-trigger SOV seeding if queries already exist
  6.  returns { ok: true } on success
  7.  returns { ok: false, error } when DB update fails
```

**7 tests. Mock Supabase client and SOV seed action.**

---

### Test File 5: `src/__tests__/unit/trigger-first-audit.test.ts`

**Target: `app/actions/trigger-first-audit.ts`**

```
describe('triggerFirstAudit')
  1.  returns { ok: false } when user is not authenticated
  2.  calls the Fear Engine trigger via the correct mechanism (fetch/function/event)
  3.  returns { ok: true, auditId } on success
  4.  returns { ok: false, error } when trigger call fails — does NOT throw
  5.  failure is non-blocking — onboarding can still proceed
```

**5 tests. Mock the Fear Engine trigger mechanism (fetch or Inngest or direct function call — match whatever you find in the codebase).**

---

### Test File 6: `src/__tests__/unit/audit-status-route.test.ts`

**Target: `app/api/onboarding/audit-status/route.ts`**

```
describe('GET /api/onboarding/audit-status')
  1.  returns 401 when user is not authenticated
  2.  returns { status: "not_found" } when no recent audit exists for org
  3.  returns { status: "running" } when audit exists but is not complete
  4.  returns { status: "complete", auditId } when audit completed within last 5 min
  5.  ignores audits older than 5 minutes (scoped to "first audit during onboarding")
  6.  scopes query to authenticated user's org_id only (belt-and-suspenders)
```

**6 tests. Mock Supabase client.**

---

### Test File 7 (Playwright E2E): `src/__tests__/e2e/onboarding-wizard.spec.ts`

**Target: Full 5-step onboarding wizard — two paths (GBP fast path + manual path)**

**Setup:**
- Use `page.route()` to mock `/api/gbp/import` (Sprint 89 endpoint)
- Use `page.route()` to mock `/api/onboarding/audit-status` (polling endpoint)
- Auth: use existing Playwright auth helper to log in as golden tenant user whose `onboarding_completed_at` is NULL — you may need to reset this in test setup
- Navigate to `/onboarding` and verify redirect behavior

```typescript
describe('Onboarding Wizard — GBP Fast Path', () => {
  test('progress indicator shows Step 1 of 5 on load', async ({ page }) => {
    // Assert: wizard-progress shows step 1 active
    // Assert: "Business" label highlighted
  });

  test('GBP interstitial appears when GBP is connected', async ({ page }) => {
    // Setup: mock GBP connected state (page.route or DB fixture)
    // Assert: step1-gbp-import-btn is visible
    // Assert: step1-skip-manual is visible
  });

  test('successful GBP import advances to Step 2 with pre-filled form', async ({ page }) => {
    // Mock /api/gbp/import → success with MOCK_GBP_MAPPED
    // Click step1-gbp-import-btn
    // Assert: step1-success-card appears
    // Assert: after 1.5s auto-advance, step2-hours-form is visible
    // Assert: step2-gbp-prefill-banner is visible
    // Assert: progress indicator shows Step 2 active
  });

  test('continuing through all 5 steps reaches the Launch state', async ({ page }) => {
    // Mock all API calls
    // Step 1: GBP import → success
    // Step 2: submit hours form → next
    // Step 3: skip competitors → next
    // Step 4: see queries → next
    // Step 5: Assert step5-launching-state visible
  });

  test('Launch step shows complete state when audit finishes', async ({ page }) => {
    // Mock /api/onboarding/audit-status → { status: "complete", auditId: "..." }
    // Assert: step5-complete-state visible
    // Assert: step5-dashboard-btn visible
    // Assert: step5-countdown visible
  });

  test('redirects to /dashboard after countdown', async ({ page }) => {
    // Mock audit status → complete
    // Wait for auto-redirect (5 second countdown)
    // Assert: URL is /dashboard
  });
});

describe('Onboarding Wizard — Manual Path', () => {
  test('manual skip from Step 1 shows manual business form', async ({ page }) => {
    // Setup: GBP not connected OR click skip
    // Assert: step1-manual-form is visible
    // Assert: step1-gbp-import-btn is NOT visible (if no GBP)
  });

  test('manual path Step 2 form starts empty', async ({ page }) => {
    // Navigate through Step 1 manual path
    // Assert: step2-hours-form visible with no pre-filled values
    // Assert: step2-gbp-prefill-banner is NOT visible
  });

  test('audit timeout shows graceful degradation state', async ({ page }) => {
    // Mock /api/onboarding/audit-status → always { status: "running" }
    // Wait 95 seconds (Playwright timeout) OR mock a timeout trigger
    // Assert: step5-error-state visible (graceful degradation)
    // Assert: step5-dashboard-btn still visible
  });

  test('competitors step allows adding up to 5 competitors', async ({ page }) => {
    // Add 5 competitors via step3-competitor-input + step3-add-btn
    // Assert: 5 items in step3-competitor-list
    // Add a 6th → Assert: Add button disabled or error shown
  });

  test('SOV queries are pre-populated in Step 4', async ({ page }) => {
    // Mock sov_queries API or use seeded golden tenant data
    // Assert: step4-query-list contains at least 1 query
    // Assert: step4-next-btn is visible
  });
});
```

**Total Playwright tests: 11**

**Critical Playwright rules:**
- Never call real GBP, Inngest, or AI APIs in tests — mock everything with `page.route()`
- For the audit-status polling tests, mock the polling endpoint to return `complete` immediately so tests don't wait 30+ seconds
- For the timeout test, either use Playwright's `clock.tick()` (Playwright ≥ 1.45) or mock the polling endpoint to keep returning `running` and verify the graceful state appears after your capped timeout
- Use `page.waitForSelector('[data-testid="step2-hours-form"]')` — never `page.waitForTimeout()`
- Auth state: manage with `storageState` in Playwright config or reset `onboarding_completed_at` via a test-only API route
- Do NOT add a test-only API route in production code — gate it with `if (process.env.NODE_ENV === 'test')`

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `app/onboarding/page.tsx` | **REWRITE** | Full 5-step wizard with state machine |
| 2 | `app/onboarding/_components/WizardProgress.tsx` | **CREATE** | Step progress indicator |
| 3 | `app/onboarding/_components/Step1BusinessInfo.tsx` | **CREATE** | GBP import + manual form |
| 4 | `app/onboarding/_components/Step2HoursAmenities.tsx` | **CREATE** | Wraps TruthCalibrationForm |
| 5 | `app/onboarding/_components/Step3Competitors.tsx` | **CREATE** | Competitor seeding UI |
| 6 | `app/onboarding/_components/Step4SOVQueries.tsx` | **CREATE** | SOV query review + custom additions |
| 7 | `app/onboarding/_components/Step5Launch.tsx` | **CREATE** | Audit trigger + polling + celebrate |
| 8 | `app/actions/save-location-truth.ts` | **CREATE** (if not exists) | Save hours + amenities |
| 9 | `app/actions/seed-competitors.ts` | **CREATE** (if not exists) | Bulk competitor seed |
| 10 | `app/actions/trigger-first-audit.ts` | **CREATE** | Hook into Fear Engine trigger |
| 11 | `app/actions/complete-onboarding.ts` | **CREATE** | Mark onboarding done + SOV safety net |
| 12 | `app/api/onboarding/audit-status/route.ts` | **CREATE** | Polling endpoint for Step 5 |
| 13 | `app/dashboard/layout.tsx` | **MODIFY** | Guard: redirect to /onboarding if not complete |
| 14 | `supabase/migrations/[timestamp]_orgs_onboarding_completed.sql` | **CREATE** (if column missing) | Add onboarding_completed_at |
| 15 | `supabase/prod_schema.sql` | **MODIFY** (if migration created) | Add column |
| 16 | `lib/supabase/database.types.ts` | **MODIFY** (if migration created) | Add type |
| 17 | `supabase/seed.sql` | **MODIFY** | Reset golden tenant's onboarding_completed_at to NULL for local dev testing |
| 18 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_WIZARD_STATE, MOCK_ONBOARDING_ORG fixtures |
| 19 | `src/__tests__/unit/wizard-progress.test.ts` | **CREATE** | 10 tests |
| 20 | `src/__tests__/unit/save-location-truth.test.ts` | **CREATE** | 7 tests |
| 21 | `src/__tests__/unit/seed-competitors.test.ts` | **CREATE** | 8 tests |
| 22 | `src/__tests__/unit/complete-onboarding.test.ts` | **CREATE** | 7 tests |
| 23 | `src/__tests__/unit/trigger-first-audit.test.ts` | **CREATE** | 5 tests |
| 24 | `src/__tests__/unit/audit-status-route.test.ts` | **CREATE** | 6 tests |
| 25 | `src/__tests__/e2e/onboarding-wizard.spec.ts` | **CREATE** | 11 Playwright tests |

---

## 🚫 What NOT to Do

1. **DO NOT duplicate audit logic** — find the existing Fear Engine trigger hook and call it. Never rewrite the audit runner.
2. **DO NOT use `window.location.href` for the dashboard redirect** — use `router.push('/dashboard')` from `useRouter()`.
3. **DO NOT `await` the auto-redirect countdown** with `setTimeout` directly — use `useEffect` with cleanup so there's no memory leak if the component unmounts.
4. **DO NOT put wizard state in `localStorage`** — keep it in React state only. If the user refreshes mid-wizard, they restart from Step 1 (acceptable UX for onboarding).
5. **DO NOT make Step 5 blocking on audit completion** — cap the poll at 90 seconds and show graceful degradation. Never leave the user stranded on a spinner forever.
6. **DO NOT edit `middleware.ts`** (AI_RULES §6) — dashboard guard goes in `app/dashboard/layout.tsx`.
7. **DO NOT plan-gate any step of the wizard** — all plans go through all 5 steps. Plan gating lives in the dashboard, not onboarding.
8. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
9. **DO NOT use dynamic Tailwind class construction** for step indicator states (AI_RULES §12) — use literal class strings.
10. **DO NOT add test-only API routes that are callable in production** — gate with `process.env.NODE_ENV === 'test'`.
11. **DO NOT call `completeOnboarding()` more than once** — make it idempotent and call it exactly once when Step 5 resolves (success or graceful degradation).
12. **DO NOT skip reading the existing `app/onboarding/page.tsx`** before rewriting — understand what's already built. Preserve working logic; don't nuke it.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `app/onboarding/page.tsx` — 5-step wizard with `WizardState` state machine, full step transitions
- [ ] `WizardProgress.tsx` — accessible progress indicator, all 5 step labels, correct active/complete/inactive styling
- [ ] `Step1BusinessInfo.tsx` — GBP fast path (Sprint 89 wired in) + manual fallback, all `data-testid` attributes
- [ ] `Step2HoursAmenities.tsx` — wraps `TruthCalibrationForm`, GBP pre-fill banner, saves on submit
- [ ] `Step3Competitors.tsx` — free-form name input, add/remove, max 5, skip allowed
- [ ] `Step4SOVQueries.tsx` — displays seeded queries, allows up to 3 custom additions
- [ ] `Step5Launch.tsx` — triggers audit, polls status, cap at 90 seconds, graceful degradation, auto-redirect countdown
- [ ] `trigger-first-audit.ts` — hooks into existing Fear Engine trigger (no new audit logic written)
- [ ] `complete-onboarding.ts` — sets `onboarding_completed_at`, SOV seed safety net, idempotent
- [ ] `app/api/onboarding/audit-status/route.ts` — authenticated, org-scoped, returns running/complete/not_found
- [ ] `app/dashboard/layout.tsx` — onboarding guard redirects incomplete users to `/onboarding`
- [ ] Migration created (if `onboarding_completed_at` was missing) + `prod_schema.sql` + `database.types.ts` updated
- [ ] `seed.sql` — golden tenant `onboarding_completed_at` set to NULL for local dev
- [ ] `golden-tenant.ts` — `MOCK_WIZARD_STATE`, `MOCK_ONBOARDING_ORG` fixtures exported
- [ ] All interactive elements have `data-testid` attributes matching the spec above
- [ ] `npx vitest run src/__tests__/unit/wizard-progress.test.ts` — **10 tests passing**
- [ ] `npx vitest run src/__tests__/unit/save-location-truth.test.ts` — **7 tests passing**
- [ ] `npx vitest run src/__tests__/unit/seed-competitors.test.ts` — **8 tests passing**
- [ ] `npx vitest run src/__tests__/unit/complete-onboarding.test.ts` — **7 tests passing**
- [ ] `npx vitest run src/__tests__/unit/trigger-first-audit.test.ts` — **5 tests passing**
- [ ] `npx vitest run src/__tests__/unit/audit-status-route.test.ts` — **6 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/onboarding-wizard.spec.ts` — **11 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] A new user with GBP connected reaches a populated dashboard in < 3 minutes end-to-end
- [ ] A new user on manual path completes onboarding in < 5 minutes
- [ ] DEVLOG.md entry written with actual test counts

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 91: Onboarding Wizard Completion (Completed)

**Goal:** Complete the onboarding wizard from 50% → 100%. Build full Step 1–5 flow, wire Sprint 89 GBP import into Step 1, auto-run first Fear Engine audit in Step 5, add progress indicator. New users reach a populated dashboard in < 3 minutes (GBP) or < 5 minutes (manual).

**Scope:**
- `app/onboarding/page.tsx` — **REWRITTEN.** Full 5-step wizard with WizardState machine. Manages step transitions, collected data, audit status.
- `app/onboarding/_components/WizardProgress.tsx` — **NEW.** Accessible step progress indicator. ARIA roles, 5 step labels, active/complete/inactive Tailwind states.
- `app/onboarding/_components/Step1BusinessInfo.tsx` — **NEW.** GBP import fast path (Sprint 89 triggerGBPImport wired in) + manual form fallback. data-testid on all interactive elements.
- `app/onboarding/_components/Step2HoursAmenities.tsx` — **NEW.** Wraps existing TruthCalibrationForm. GBP pre-fill banner when imported. Saves via saveLocationTruth().
- `app/onboarding/_components/Step3Competitors.tsx` — **NEW.** Free-form competitor name entry. Add/remove, max 5. Skip allowed. Saves via seedOnboardingCompetitors().
- `app/onboarding/_components/Step4SOVQueries.tsx` — **NEW.** Displays seeded sov_queries. Up to 3 custom additions via add-sov-query action.
- `app/onboarding/_components/Step5Launch.tsx` — **NEW.** Triggers first Fear Engine audit via triggerFirstAudit(). Polls /api/onboarding/audit-status every 5s, cap 90s. Graceful degradation on timeout. Auto-redirect countdown. router.push('/dashboard').
- `app/actions/save-location-truth.ts` — **NEW** (or existing action used). Saves hours_data + amenities to primary location.
- `app/actions/seed-competitors.ts` — **NEW** (or existing action used). Bulk-inserts competitors with is_manual: true. Max 5. Idempotent by name.
- `app/actions/trigger-first-audit.ts` — **NEW.** Hooks into existing Fear Engine trigger pattern. Returns { ok, auditId } or { ok: false } — non-throwing.
- `app/actions/complete-onboarding.ts` — **NEW.** Sets onboarding_completed_at. SOV seed safety net. Idempotent.
- `app/api/onboarding/audit-status/route.ts` — **NEW.** Polling endpoint. Returns running/complete/not_found. Org-scoped. 5-minute window for "first audit" detection.
- `app/dashboard/layout.tsx` — **MODIFIED.** Onboarding guard: if onboarding_completed_at IS NULL, redirect('/onboarding').
- `supabase/migrations/[timestamp]_orgs_onboarding_completed.sql` — **NEW** (if column was missing). Adds onboarding_completed_at to orgs.
- `supabase/prod_schema.sql` — **MODIFIED** (if migration created). onboarding_completed_at added to orgs.
- `lib/supabase/database.types.ts` — **MODIFIED** (if migration created). onboarding_completed_at typed as string | null on orgs.
- `supabase/seed.sql` — **MODIFIED.** Golden tenant onboarding_completed_at set to NULL for local dev.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_WIZARD_STATE, MOCK_ONBOARDING_ORG.

**Tests added:**
- `src/__tests__/unit/wizard-progress.test.ts` — **N Vitest tests.** Accessibility, step styling, data-testid.
- `src/__tests__/unit/save-location-truth.test.ts` — **N Vitest tests.** Auth, update, idempotency.
- `src/__tests__/unit/seed-competitors.test.ts` — **N Vitest tests.** Max-5 guard, deduplication, is_manual flag.
- `src/__tests__/unit/complete-onboarding.test.ts` — **N Vitest tests.** Completion, SOV safety net, idempotency.
- `src/__tests__/unit/trigger-first-audit.test.ts` — **N Vitest tests.** Non-blocking failure handling.
- `src/__tests__/unit/audit-status-route.test.ts` — **N Vitest tests.** Auth, status states, 5-min window.
- `src/__tests__/e2e/onboarding-wizard.spec.ts` — **N Playwright tests.** GBP path (6), manual path (5). All external APIs mocked.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/wizard-progress.test.ts          # N tests
npx vitest run src/__tests__/unit/save-location-truth.test.ts      # N tests
npx vitest run src/__tests__/unit/seed-competitors.test.ts         # N tests
npx vitest run src/__tests__/unit/complete-onboarding.test.ts      # N tests
npx vitest run src/__tests__/unit/trigger-first-audit.test.ts      # N tests
npx vitest run src/__tests__/unit/audit-status-route.test.ts       # N tests
npx vitest run                                                       # All passing — no regressions
npx playwright test src/__tests__/e2e/onboarding-wizard.spec.ts    # N e2e tests
npx tsc --noEmit                                                     # 0 new type errors
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `triggerGBPImport()` Server Action | Sprint 89 | GBP fast path for Step 1 — MUST be complete |
| GBP token refresh utility | Sprint 90 | Token validity during import — MUST be complete |
| `TruthCalibrationForm` component | Phase 4 | Step 2's hours + amenities form — already built |
| SOV seeding action (`sov-seed.ts`) | Phase 5 | Triggered at the end of Step 4 / in completeOnboarding() |
| Fear Engine cron / audit trigger | Phase 1 | Step 5 hooks into this — read codebase to find hook point |
| `lib/plan-enforcer.ts` | Phase 3 | Onboarding itself is not plan-gated |
| `competitors` table + Greed Engine | Phase 3 | Step 3 seeds into this table |
| `sov_queries` table | Phase 5 | Step 4 reads and potentially adds rows |
| `getSafeAuthContext()` pattern | AI_RULES §3 | Used in all server actions and routes |

---

## 🧠 Edge Cases to Handle

1. **User refreshes mid-wizard:** State resets to Step 1. Acceptable — onboarding is a one-time flow and the DB updates made in Steps 1–4 persist. The wizard re-reads saved data on load (e.g., existing location hours, existing sov_queries count) to show appropriate defaults.

2. **User who already connected GBP but didn't import yet:** Step 1 detects `gbp_connections` row exists → shows import button. This is the common case for users who connected during the marketing site flow.

3. **User who completed onboarding tries to revisit `/onboarding`:** Dashboard layout guard redirects them to `/dashboard`. Onboarding page itself should also check `onboarding_completed_at` on load and redirect.

4. **Fear Engine audit takes > 90 seconds:** Show graceful degradation. The audit still runs in the background — it just won't be visible in the UI during onboarding. When the user arrives at the dashboard, the cron will eventually populate it. Message: "Your first audit is queued and will complete in a few minutes."

5. **SOV seeding fails silently:** `completeOnboarding()` calls the SOV seed as a safety net. If it fails, log the error but do NOT block onboarding completion. Dashboard will show an empty SOV state that the next cron run will populate.

6. **User skips both Step 3 (competitors) and adds no custom Step 4 queries:** Valid — onboarding completes with seeded queries only. They can add competitors later in the dashboard.

7. **New user on a trial plan:** No plan gating during onboarding. They see all 5 steps. Plan limits apply once they're in the dashboard.

8. **`onboarding_completed_at` already set when user hits Step 5:** The `completeOnboarding()` server action is idempotent — `UPDATE ... WHERE onboarding_completed_at IS NULL` is a no-op. No double-triggers.

9. **GBP import returns partial data in Step 1:** `mapGBPToLocation()` returns partial `MappedLocationData`. Step 2's `TruthCalibrationForm` must handle partial pre-fill gracefully — pre-fill what's available, leave the rest for manual entry.

10. **Audit status polling endpoint returns a stale audit from a previous run:** Scope the "first audit" detection to `created_at > NOW() - 5 minutes` to ensure you're detecting the audit triggered by onboarding, not a cron audit from yesterday.

---

## 📚 Document Sync + Git Commit (Run After All Tests Pass)

After all Vitest and Playwright tests pass and `npx tsc --noEmit` shows 0 errors:

### Step 1: Update `/docs` files

**`docs/roadmap.md`** — Update Feature #56 (Onboarding Wizard) from `🟡 50%` → `✅ 100%`. Add Sprint 91 completion note.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 91 to completed sprints. Check off all Sprint 91 build plan checkboxes.

**`docs/06-ONBOARDING.md`** (if it exists) — Update step implementation status to ✅ for all 5 steps. Note that GBP import interstitial was built in Sprint 89 and wired here.

### Step 2: Update `DEVLOG.md`

Paste the DEVLOG entry from the **📓 DEVLOG Entry Format** section above. Replace all `N` placeholders with actual test counts from running `grep -cE "^\s*(it|test)\("` on each file (AI_RULES §13.3). Replace `[timestamp]` with actual migration filename used.

### Step 3: Update `CLAUDE.md`

Add to the implementation inventory:
```markdown
### Sprint 91 — Onboarding Wizard Completion (2026-02-28)
- `app/onboarding/page.tsx` — Full 5-step wizard (REWRITTEN)
- `app/onboarding/_components/WizardProgress.tsx` — Accessible progress indicator
- `app/onboarding/_components/Step[1-5]*.tsx` — All 5 step components
- `app/actions/save-location-truth.ts` — Hours + amenities save action
- `app/actions/seed-competitors.ts` — Onboarding competitor seed
- `app/actions/trigger-first-audit.ts` — Fear Engine first-audit trigger
- `app/actions/complete-onboarding.ts` — Marks onboarding done, SOV safety net
- `app/api/onboarding/audit-status/route.ts` — Step 5 polling endpoint
- `app/dashboard/layout.tsx` — Onboarding guard added
- Tests: 43 Vitest + 11 Playwright
- Gap #56: Onboarding Wizard 50% → 100%
```

### Step 4: Update `MEMORY.md`

```markdown
## Decision: Onboarding Wizard Architecture (Sprint 91 — 2026-02-28)
- Single-page React state machine (no URL-per-step navigation) — state resets on refresh, acceptable for onboarding
- Step 5 audit polling: 5-second interval, 90-second cap, graceful degradation
- Onboarding guard lives in app/dashboard/layout.tsx (Server Component DB check), not in proxy.ts middleware
- completeOnboarding() is idempotent — safe to call even if already completed
- SOV seeding has a safety-net call in completeOnboarding() in case the primary seeding (Step 4) failed
- Fear Engine first-audit triggered via [actual mechanism found in codebase — fill in after reading]
```

### Step 5: Update `AI_RULES.md`

```markdown
## 42. 🧙 Onboarding Wizard — Single-Page State Machine (Sprint 91)

The onboarding wizard at `app/onboarding/page.tsx` is a React state machine. All 5 steps are rendered conditionally within a single `'use client'` page — no URL navigation between steps.

* **Rule:** Do not add URL-based step routing to onboarding. State is ephemeral — refreshing restarts from Step 1.
* **Completion tracking:** `orgs.onboarding_completed_at` is the canonical "has completed onboarding" flag. Check this, not cookies or localStorage.
* **Guard:** Dashboard layout (`app/dashboard/layout.tsx`) redirects users with `onboarding_completed_at IS NULL` to `/onboarding`.
* **Audit trigger:** Use `trigger-first-audit.ts` server action — never inline Fear Engine logic in onboarding.
```

### Step 6: Git Commit

```bash
# Stage everything including untracked files
git add -A

# Verify staged files
git status

# Commit
git commit -m "Sprint 91: Onboarding Wizard Completion — Full 5-step flow

- app/onboarding: full 5-step wizard state machine (REWRITTEN)
  - Step 1: GBP fast path (Sprint 89) + manual fallback
  - Step 2: TruthCalibrationForm with GBP pre-fill
  - Step 3: competitor seeding (free-form, max 5, skip allowed)
  - Step 4: SOV query review + custom additions
  - Step 5: first audit trigger + polling + countdown redirect
- WizardProgress: accessible progress indicator (aria-progressbar)
- trigger-first-audit: hooks into existing Fear Engine trigger
- complete-onboarding: idempotent, SOV safety net
- audit-status route: polling endpoint (5-min window, org-scoped)
- dashboard/layout: onboarding guard redirect
- migration: onboarding_completed_at on orgs (if was missing)
- seed: golden tenant onboarding_completed_at = NULL for dev
- tests: 43 Vitest + 11 Playwright passing, 0 regressions
- docs: roadmap Feature #56 → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES updated

GBP path: populated dashboard in < 3 min
Manual path: populated dashboard in < 5 min
Gap #56 closed. Unblocks Sprint 92 (Launch Readiness Sweep)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 91 completes:
- **Onboarding Wizard: 50% → 100%** (Gap #56 closed)
- Every new user goes through a guided, confidence-inspiring 5-step flow
- GBP-connected users: populated dashboard in < 3 minutes
- Manual-entry users: populated dashboard in < 5 minutes
- First audit fires automatically — no empty dashboard on first visit
- Dashboard is guarded — users who skip onboarding are redirected back
- Sprints 89 (GBP Import) + 90 (Token Refresh Cron) are now fully connected to the user's first experience
- **Sprint 92 (Launch Readiness Sweep) is now unblocked** — the core user journey is complete
