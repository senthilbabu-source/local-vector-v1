# Sprint 96 — Plan Gate Polish: Blur Teasers

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Apply a **consistent, conversion-optimized plan gate pattern** across all premium LocalVector pages. Starter plan users currently see either empty states or hard "Upgrade Required" walls — both kill conversion. This sprint implements a **blur-teaser pattern**: Starter users see *real, live data* rendered behind a `blur-sm` overlay with an upgrade CTA in the center. Seeing their actual data blurred (not placeholder lorem) creates urgency and drives upgrades.

**Five pages receive the treatment:**

1. `/citations` — Citation Gap Dashboard *(Growth+ gated)*
2. `/page-audits` — Page Audit Dashboard *(Growth+ gated)*
3. `/content-drafts` — Content Draft Review UI *(Growth+ gated)*
4. `/sentiment` — AI Sentiment Tracker *(Growth+ gated)*
5. `/source-intelligence` — Citation Source Intelligence *(Professional+ gated)*

**Core deliverable:** A single reusable `<PlanGate>` wrapper component in `components/plan-gate/PlanGate.tsx` that wraps any content, checks the org's plan, and when gated: renders children with `blur-sm` + `pointer-events-none` + an absolutely-positioned upgrade card overlay.

**What's already built:** `lib/plan-enforcer.ts` (Sprint 3) handles server-side plan enforcement on all actions. Some pages already show an upgrade card. This sprint standardizes and replaces any inconsistent implementations with a single component.

**Gap being closed:** Feature #66 — Starter Plan Blur Teasers (currently 30% → targeting 100%).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                    — All engineering rules (currently §48+)
Read CLAUDE.md                                           — Project context, architecture, patterns
Read MEMORY.md                                           — Key decisions and constraints
Read supabase/prod_schema.sql                            — Find: orgs table, plan column values/enum
Read lib/database.types.ts                               — TypeScript DB types, esp. plan type
Read lib/plan-enforcer.ts                                — How plan enforcement works today
Read src/__fixtures__/golden-tenant.ts                   — Golden Tenant org_id a0eebc99, current plan
Read app/dashboard/citations/page.tsx                    — Current citations page layout + any existing gate
Read app/dashboard/page-audits/page.tsx                  — Current page-audits layout + any existing gate
Read app/dashboard/content-drafts/page.tsx               — Current content-drafts layout + any existing gate
Read app/dashboard/sentiment/page.tsx                    — Current sentiment layout + any existing gate
Read app/dashboard/source-intelligence/page.tsx          — Current source-intelligence layout + any existing gate
Read components/layout/Sidebar.tsx                       — NAV_ITEMS plan gating pattern (reference only)
Read app/dashboard/_components/                          — Any existing UpgradeCard, PlanBadge, or gate components
Read app/pricing/page.tsx OR app/(marketing)/pricing/    — Upgrade CTA target URL + plan names/prices
Read lib/supabase/server.ts                              — createClient() pattern for RSC plan fetching
```

**Specifically understand before writing code:**
- The exact string values used for the `plan` column in `orgs` (e.g. `'starter'`, `'growth'`, `'professional'`, `'agency'`). Use these exact strings — do not guess.
- Whether `getPlan()` or similar helper already exists in `lib/plan-enforcer.ts` for fetching the org's current plan, or if plan comes from the session/org row directly.
- Whether any existing `<PlanGate>` or `<UpgradeGate>` component already exists. If so, read it thoroughly — **extend and standardize it rather than creating a competing implementation.**
- How each of the five target pages currently fetches its data — Server Component with `async`? Client Component with `useEffect`? This determines where plan checking happens.
- The exact `data-testid` values already on each page's primary content container (to target in tests without adding duplicates).
- Which upgrade CTA URL to use (e.g. `/settings/billing`, `/pricing`, or Stripe Customer Portal). Check existing upgrade cards for precedent.

---

## 🏗️ Architecture — What to Build

### Component 1: `components/plan-gate/PlanGate.tsx`

The single source of truth for all plan-gated UI in the dashboard. This is a **React Server Component** — it receives the org's current plan as a prop (never fetches it independently) so each page controls data fetching.

```typescript
/**
 * PlanGate — Blur-teaser plan enforcement wrapper.
 *
 * Usage (Server Component page):
 *   const plan = await getOrgPlan(orgId)
 *   <PlanGate requiredPlan="growth" currentPlan={plan} feature="Citation Gap Analysis">
 *     <CitationsTable data={citations} />
 *   </PlanGate>
 *
 * When currentPlan satisfies requiredPlan → renders children normally (no wrapper overhead).
 * When gated → renders children blurred behind an upgrade card overlay.
 *
 * Plan hierarchy (lowest → highest): starter < growth < professional < agency
 * "satisfies" means currentPlan is AT OR ABOVE requiredPlan in hierarchy.
 */

interface PlanGateProps {
  /** Minimum plan required to see this content unblurred */
  requiredPlan: 'growth' | 'professional' | 'agency'
  /** Org's actual current plan from the database */
  currentPlan: string
  /** Human-readable feature name shown in upgrade card: "Citation Gap Analysis" */
  feature: string
  /** Optional override for the upgrade CTA URL. Defaults to '/settings/billing' */
  upgradeHref?: string
  /** Optional additional className on the outer wrapper (for layout sizing) */
  className?: string
  children: React.ReactNode
}

export function PlanGate({
  requiredPlan,
  currentPlan,
  feature,
  upgradeHref = '/settings/billing',
  className,
  children,
}: PlanGateProps) { ... }
```

**Plan hierarchy logic (pure function, export separately for testing):**

```typescript
// lib/plan-enforcer.ts — ADD this export if it doesn't already exist there.
// If plan-enforcer.ts already has a hierarchy function, use it instead.
export const PLAN_HIERARCHY: Record<string, number> = {
  starter: 0,
  growth: 1,
  professional: 2,
  agency: 3,
}

export function planSatisfies(currentPlan: string, requiredPlan: string): boolean {
  const current = PLAN_HIERARCHY[currentPlan] ?? 0
  const required = PLAN_HIERARCHY[requiredPlan] ?? 0
  return current >= required
}
```

⚠️ **CRITICAL:** If `lib/plan-enforcer.ts` already exports a `planSatisfies` function or equivalent, **use it** — do not create a duplicate. Read that file first.

**Upgrade card layout (within `PlanGate`):**

The overlay must be:
- `position: absolute, inset: 0` — covers the entire children area
- Centered vertically + horizontally
- Semi-transparent white background with backdrop blur on the card itself (not the content — the content uses `blur-sm`)
- Shows: lock icon, plan name badge, feature name, one-line benefit copy, "Upgrade to [Plan]" CTA button with `data-testid="plan-gate-upgrade-cta"`

```tsx
// When gated — the ONLY acceptable Tailwind classes for blur are:
// "blur-sm"   ← content wrapper
// "blur-none" ← NOT dynamic: never "blur-${level}"

<div data-testid="plan-gate-container" className={cn("relative", className)}>
  {/* Blurred content — real data, not placeholder */}
  <div
    data-testid="plan-gate-blurred-content"
    className="blur-sm pointer-events-none select-none"
    aria-hidden="true"
  >
    {children}
  </div>

  {/* Upgrade overlay */}
  <div
    data-testid="plan-gate-overlay"
    className="absolute inset-0 flex items-center justify-center"
    role="region"
    aria-label={`Upgrade required to access ${feature}`}
  >
    <div
      data-testid="plan-gate-card"
      className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 p-8 max-w-sm w-full mx-4 text-center"
    >
      {/* Lock icon — use heroicons or lucide-react, whichever is already in the project */}
      <div data-testid="plan-gate-icon" className="mx-auto mb-4 w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
        <LockClosedIcon className="w-6 h-6 text-indigo-600" />
      </div>

      {/* Required plan badge */}
      <span
        data-testid="plan-gate-plan-badge"
        className="inline-block mb-3 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 uppercase tracking-wide"
      >
        {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Plan
      </span>

      <h3
        data-testid="plan-gate-title"
        className="text-lg font-semibold text-gray-900 mb-2"
      >
        {feature}
      </h3>

      <p
        data-testid="plan-gate-description"
        className="text-sm text-gray-500 mb-6"
      >
        {FEATURE_DESCRIPTIONS[feature] ?? `Upgrade to unlock ${feature} and drive more AI visibility.`}
      </p>

      <a
        data-testid="plan-gate-upgrade-cta"
        href={upgradeHref}
        className="inline-block w-full px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
      >
        Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
      </a>
    </div>
  </div>
</div>
```

**Feature description map (within `PlanGate.tsx`):**

```typescript
const FEATURE_DESCRIPTIONS: Record<string, string> = {
  'Citation Gap Analysis':     'See exactly which AI models are missing your business — and the directories you need to claim.',
  'Page Audit':                'Get a full 5-dimension AI readiness audit of your website with actionable recommendations.',
  'Content Drafts':            'AI-generated, HITL-reviewed content drafts that close your citation gaps and beat competitors.',
  'AI Sentiment Tracker':      'Track how AI models describe your business over time — catch reputation drift before it costs you.',
  'Citation Source Intelligence': 'Identify which directories and data providers AI models trust most for your category.',
}
```

---

### Component 2: Apply `<PlanGate>` to all five pages

For each page, the pattern is:

1. **Fetch the org's plan** in the Server Component — read how `plan` is currently fetched in similar pages (e.g. `/compete` or `/entity-health`). Replicate that exact pattern.
2. **Identify the primary content block** — the table, chart, or card grid that carries the most "I need this" visual weight. Wrap it (not the whole page header/nav) in `<PlanGate>`.
3. **Remove any existing ad-hoc upgrade gates** — if the page has a `{plan !== 'growth' && <SomeOldUpgradeCard />}` pattern, delete it and replace with `<PlanGate>`.

**Specific wrapping targets per page:**

| Page | Route | Required Plan | Wrap Target | `feature` Prop |
|------|-------|--------------|-------------|----------------|
| Citations | `/dashboard/citations` | `growth` | The citation gap table/score visualization | `"Citation Gap Analysis"` |
| Page Audits | `/dashboard/page-audits` | `growth` | The 5-dimension audit cards + recommendations section | `"Page Audit"` |
| Content Drafts | `/dashboard/content-drafts` | `growth` | The draft list (all draft rows) | `"Content Drafts"` |
| Sentiment | `/dashboard/sentiment` | `growth` | The sentiment timeline chart + entity table | `"AI Sentiment Tracker"` |
| Source Intelligence | `/dashboard/source-intelligence` | `professional` | The source ranking table + trust score chart | `"Citation Source Intelligence"` |

⚠️ **Never wrap page-level `<main>` or layout wrappers.** Wrap only the value-demonstrating content block. The page title, breadcrumb, and "what is this?" description copy must remain visible and unblurred so users understand what they're upgrading to.

⚠️ **Data must still be fetched even for gated users.** The blur teaser only works if real data is passed through to `children`. Do not short-circuit data fetching when plan check fails. The whole point is Starter users see *their real data* blurred.

---

### Component 3: `components/plan-gate/index.ts` — barrel export

```typescript
export { PlanGate } from './PlanGate'
export { planSatisfies, PLAN_HIERARCHY } from '../../lib/plan-enforcer'
```

---

### Component 4: Accessibility + SSR safety

- The blurred children div must have `aria-hidden="true"` so screen readers skip the blurred duplicate content
- The upgrade overlay `<div>` must have `role="region"` and `aria-label` describing what's locked
- The upgrade CTA must be keyboard-focusable (`<a>` with `href` satisfies this — do not use `<button onClick>` for navigation)
- The component must SSR cleanly — no `useEffect`, no `useState`, no `"use client"` directive unless absolutely unavoidable

---

## 🧪 Tests — Write These FIRST (AI_RULES §4)

Write all tests before implementing the component. Tests define the contract.

### Test File 1: `src/__tests__/unit/plan-gate.test.tsx`

**~28 Vitest tests.** Use `@testing-library/react` for component rendering.

```typescript
// planSatisfies() — 12 tests
describe('planSatisfies', () => {
  // Hierarchy enforcement
  it('starter satisfies starter')         // true (same level)
  it('growth satisfies starter')          // true (above)
  it('professional satisfies growth')     // true (above)
  it('agency satisfies professional')     // true (above)
  it('agency satisfies starter')          // true (well above)
  // Failure cases
  it('starter does NOT satisfy growth')   // false
  it('starter does NOT satisfy professional') // false
  it('growth does NOT satisfy professional')  // false
  it('growth does NOT satisfy agency')    // false
  // Edge cases
  it('unknown plan treated as starter (index 0)') // false vs growth
  it('empty string treated as starter')   // false vs growth
  it('agency satisfies agency (same level)') // true
})

// PlanGate component — 16 tests
describe('PlanGate', () => {
  // Pass-through when satisfied
  it('renders children normally when growth plan meets growth requirement')
  it('renders children normally when professional plan meets growth requirement')
  it('renders children normally when agency meets professional requirement')
  it('does NOT render blur wrapper when plan satisfied')
  it('does NOT render upgrade overlay when plan satisfied')

  // Gated — blur teaser
  it('renders blur wrapper when starter hits growth requirement')
  it('renders children inside blur wrapper (real data, not placeholder)')
  it('renders upgrade overlay when gated')
  it('upgrade CTA has correct href defaulting to /settings/billing')
  it('upgrade CTA accepts custom upgradeHref override')
  it('displays correct feature name in overlay title')
  it('displays correct plan name badge (capitalized)')
  it('blurred content has aria-hidden="true"')
  it('overlay has role="region" with aria-label')

  // data-testid
  it('plan-gate-upgrade-cta data-testid present when gated')
  it('plan-gate-blurred-content data-testid present when gated')
})
```

### Test File 2: `src/__tests__/unit/plan-gate-pages.test.tsx`

**~10 Vitest tests.** Shallow render each page Server Component with mock Supabase client returning starter plan, verify PlanGate renders with correct props. Use MSW to mock Supabase responses.

```typescript
// For each of the 5 pages:
it('[citations] renders PlanGate with requiredPlan="growth" when starter plan')
it('[page-audits] renders PlanGate with requiredPlan="growth" when starter plan')
it('[content-drafts] renders PlanGate with requiredPlan="growth" when starter plan')
it('[sentiment] renders PlanGate with requiredPlan="growth" when starter plan')
it('[source-intelligence] renders PlanGate with requiredPlan="professional" when starter plan')

// Pass-through checks — growth plan skips gate on growth-gated pages
it('[citations] does NOT render PlanGate blur when growth plan')
it('[page-audits] does NOT render PlanGate blur when growth plan')
it('[content-drafts] does NOT render PlanGate blur when growth plan')
it('[sentiment] does NOT render PlanGate blur when growth plan')
// source-intelligence still gated at growth (needs professional)
it('[source-intelligence] STILL renders PlanGate blur when growth plan (needs professional)')
```

### Test File 3: `src/__tests__/e2e/plan-gate.spec.ts`

**~10 Playwright tests.** Uses the golden tenant (org_id: `a0eebc99`). All tests run against a test DB with a seeded starter-plan org.

```typescript
// Test setup: seed a separate "starter_test" org with plan='starter' and some citations/audits data
// All pages should show blur overlay for this org

describe('Plan Gate E2E — Starter User Blur Teasers', () => {
  it('citations page: upgrade overlay visible for starter plan user', async ({ page }) => {
    // Login as starter org
    // Navigate to /dashboard/citations
    // Assert: data-testid="plan-gate-overlay" is visible
    // Assert: data-testid="plan-gate-upgrade-cta" has href containing '/settings/billing'
    // Assert: data-testid="plan-gate-blurred-content" has CSS blur applied
  })

  it('page-audits page: upgrade overlay visible for starter user')
  it('content-drafts page: upgrade overlay visible for starter user')
  it('sentiment page: upgrade overlay visible for starter user')
  it('source-intelligence page: upgrade overlay visible for starter user (professional required)')

  // Growth plan passes all growth-gated pages
  it('citations page: no overlay for growth plan user', async ({ page }) => {
    // Login as golden tenant (growth plan)
    // Navigate to /dashboard/citations
    // Assert: data-testid="plan-gate-overlay" does NOT exist
    // Assert: data-testid="plan-gate-blurred-content" does NOT exist
  })

  it('page-audits page: no overlay for growth plan user')
  it('content-drafts page: no overlay for growth plan user')

  // source-intelligence: growth user STILL sees overlay (needs professional)
  it('source-intelligence: overlay visible for growth plan user (needs professional)')

  // CTA navigation
  it('clicking upgrade CTA navigates to /settings/billing', async ({ page }) => {
    // Login as starter org
    // Navigate to /dashboard/citations
    // Click data-testid="plan-gate-upgrade-cta"
    // Assert URL contains '/settings/billing'
  })
})
```

**Playwright test data strategy:** Add a second fixture org to `golden-tenant.ts`:

```typescript
export const STARTER_ORG_ID = 'b1ffcd00-0000-0000-0000-000000000001' // Fictional — check prod_schema.sql for UUID format
export const STARTER_ORG = {
  id: STARTER_ORG_ID,
  name: 'Starter Test Org',
  plan: 'starter',
  // ... minimal required fields
}
```

⚠️ Read `golden-tenant.ts` before adding — match the exact shape of existing fixture exports. Do not break any existing golden-tenant exports.

---

## 🔍 Pre-Implementation Diagnosis

Before writing the `<PlanGate>` component, do this **diagnosis pass**:

```
1. For each of the 5 target pages, open the file and find: 
   - Any existing plan check (if plan !== 'growth', if !hasAccess, etc.)
   - Any existing UpgradeCard, UpgradeGate, or similar component being rendered
   - How `plan` is currently passed in (props? from session? from org row query?)
   
2. Search the codebase:
   grep -r "UpgradeCard\|UpgradeGate\|plan-gate\|blur-sm" app/dashboard --include="*.tsx" -l
   
3. Check components/ui/ and components/dashboard/ for any existing blur or gate components.

4. Check lib/plan-enforcer.ts for existing plan hierarchy logic or planSatisfies().

Document your findings as a comment at the top of your implementation before writing any code.
```

**If an existing `<PlanGate>` component is found:** Read it carefully. Fix its inconsistencies (missing `data-testid`, wrong blur class, not showing real data behind blur) rather than creating a parallel component. Rename/consolidate if needed.

---

## 📓 DEVLOG Entry Format

```markdown
## Sprint 96 — Plan Gate Polish: Blur Teasers (Gap #66: 30% → 100%)
**Date:** [DATE]
**Duration:** ~3 hours (Small sprint — S effort)

### Problem
Starter plan users hit hard "Upgrade Required" walls or empty states across 5 premium pages. No urgency to upgrade — they never see what they're missing.

### Solution
Built `components/plan-gate/PlanGate.tsx` — single reusable blur-teaser wrapper. Data still fetches for all users; Starter users see their real data behind `blur-sm` + an upgrade card overlay. Growth plan unlocks 4 pages; Professional unlocks source-intelligence.

### Files Changed
- `components/plan-gate/PlanGate.tsx` — NEW: blur-teaser wrapper component
- `components/plan-gate/index.ts` — NEW: barrel export
- `lib/plan-enforcer.ts` — MODIFIED: added/confirmed planSatisfies() + PLAN_HIERARCHY exports
- `app/dashboard/citations/page.tsx` — MODIFIED: wrapped primary content in PlanGate
- `app/dashboard/page-audits/page.tsx` — MODIFIED: wrapped primary content in PlanGate
- `app/dashboard/content-drafts/page.tsx` — MODIFIED: wrapped primary content in PlanGate
- `app/dashboard/sentiment/page.tsx` — MODIFIED: wrapped primary content in PlanGate
- `app/dashboard/source-intelligence/page.tsx` — MODIFIED: wrapped primary content in PlanGate (professional)
- `src/__fixtures__/golden-tenant.ts` — MODIFIED: added STARTER_ORG fixture
- `src/__tests__/unit/plan-gate.test.tsx` — NEW: [N] Vitest tests
- `src/__tests__/unit/plan-gate-pages.test.tsx` — NEW: [N] Vitest tests
- `src/__tests__/e2e/plan-gate.spec.ts` — NEW: [N] Playwright tests

### Grep counts (run before committing):
grep -cE "^\s*(it|test)\(" src/__tests__/unit/plan-gate.test.tsx          # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/plan-gate-pages.test.tsx    # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/e2e/plan-gate.spec.ts            # [N]

### Gaps Closed
- Gap #66: Starter Plan Blur Teasers — 30% → 100%
  - Before: 5 pages had inconsistent or absent gating UI
  - After: Single PlanGate component, blur-teaser on all 5 pages, Growth+ unlocks 4, Professional unlocks 1

### Next Sprint
Sprint 97 — Citation Cron + Dynamic llms.txt (Gaps #60 + #62)
```

---

## 🔮 AI_RULES Update — Add Rule §49 to `AI_RULES.md`

```markdown
## §49. 🔒 Plan Gate UI — Always Use `<PlanGate>` (Sprint 96)

All plan-gated UI in the dashboard uses `components/plan-gate/PlanGate.tsx`. Never implement ad-hoc blur or upgrade cards inline in page components.

**Rules:**
- `<PlanGate requiredPlan="..." currentPlan={plan} feature="...">` wraps only the value-bearing content block — never the entire page, never the page header.
- Data MUST still be fetched for gated users. `<PlanGate>` receives real populated children. The blur teaser only works because Starter users see their actual data blurred.
- Plan satisfaction logic lives exclusively in `planSatisfies()` from `lib/plan-enforcer.ts`. Never compare plan strings inline (e.g. `plan !== 'growth'`).
- Tailwind blur class is always the literal `"blur-sm"`. Never construct blur class dynamically (violates §12).
- `pointer-events-none` and `select-none` must accompany `blur-sm` on gated content — prevents keyboard traversal into aria-hidden content.
- `data-testid="plan-gate-upgrade-cta"` must be present on the upgrade button for Playwright tests.
- The upgrade CTA is an `<a href>` tag — not a `<button onClick>`. Upgrade navigation is always a full page transition, not a client-side handler.
- `source-intelligence` requires `professional` plan. All other gated dashboard pages require `growth`. Do not relax these thresholds without a product decision and MEMORY.md entry.
```

---

## 🧠 Edge Cases to Handle

1. **Plan column is `null` in DB:** Treat `null` as `'starter'`. `planSatisfies(null, 'growth')` → `false`. Never crash.
2. **Unknown plan string in DB:** `PLAN_HIERARCHY[unknownString]` → `undefined` → treat as `0` (starter). Graceful degradation.
3. **Growth user on source-intelligence:** They see the blur overlay — `professional` is required. The overlay badge says "Professional Plan", not "Growth Plan". Make sure `requiredPlan` prop flows correctly to the badge.
4. **Golden tenant plan:** The golden tenant (`a0eebc99`, Charcoal N Chill) should be on `growth` plan in seed data. Verify this before running E2E tests — if it's `starter`, most E2E "pass-through" tests will fail.
5. **`blur-sm` on a table with sticky headers:** Some table implementations use `position: sticky` on `<thead>`. `blur-sm` on the table wrapper may cause stacking context issues. If the blur looks broken, move the blur wrapper to a `<div>` that wraps only the scrollable tbody, not the entire `<table>`. Test visually.
6. **Existing ad-hoc upgrade cards with their own styling:** When removing old upgrade cards, check if they import any locally-scoped CSS modules or have Tailwind classes that depend on sibling selectors. Remove cleanly — do not leave orphaned CSS classes.
7. **Hydration mismatch if plan is client-fetched:** If any of the 5 target pages currently fetch plan client-side (in a `useEffect`), there will be a flash of unblurred content on load. The correct fix is to make plan-fetching happen in the Server Component. If this requires refactoring a page from Client to Server Component, note the scope and complete it — the blur teaser has no value if it flashes in.
8. **`aria-hidden` content and focus traps:** Some browsers allow keyboard focus into `aria-hidden` elements if `tabIndex` attributes exist on children. The `pointer-events-none` + `select-none` classes prevent mouse interaction, but you must also verify no focusable elements (buttons, links, inputs) exist directly in the blurred children for the gated pages. If they do, add `tabIndex={-1}` to each or wrap in a `<div aria-hidden inert>` using the HTML `inert` attribute.
9. **Page-level Playwright authentication:** The E2E tests need to log in as two different users (starter + growth). Reuse the existing Playwright auth helpers (e.g. `loginAs(page, 'starter')`) — do not hardcode credentials. Read existing E2E specs for the auth helper pattern before writing.
10. **`upgradeHref` for Agency plan users on source-intelligence:** If the org is `growth` and hits the `professional` gate on source-intelligence, the CTA should link to the professional upgrade, not the generic billing page. The default `/settings/billing` is acceptable for V1 — Stripe's billing portal will show the correct upgrade options. Document this in MEMORY.md.

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `lib/plan-enforcer.ts` + plan gating foundation | Sprint 3 | Server-side plan enforcement, plan types — read before touching |
| Citations Dashboard | Sprint 58A | Page being gated — must not break existing Growth+ user experience |
| Page Audit Dashboard | Sprint 58B, 71 | Page being gated — same |
| Content Draft Review UI | Sprint 42, 48 | Page being gated — same |
| AI Sentiment Tracker | Sprint 81 | Page being gated — same |
| Citation Source Intelligence | Sprint 82 | Page being gated (professional tier) — same |
| Golden Tenant fixtures | All sprints | Adding STARTER_ORG — must not break existing exports |
| Stripe billing (checkout + portal) | Sprint 0, Phase 3 | Upgrade CTA destination — verify `/settings/billing` is the correct route |

---

## 📐 Visual QA Checklist

Run this manually after implementation before committing:

```
For each of the 5 pages — logged in as a STARTER user:
[ ] Blur overlay is visible and centered in viewport
[ ] Page title and description ABOVE the gate are fully readable (not blurred)
[ ] Blurred content shows recognizable data shapes (table rows, chart bars) — not empty
[ ] Upgrade CTA button is clickable and navigates correctly
[ ] Plan badge says the correct plan name (Growth or Professional)
[ ] No layout overflow — overlay doesn't extend beyond the content card
[ ] On mobile (375px): overlay card doesn't overflow horizontally (mx-4 provides margin)

For each of the 5 pages — logged in as a GROWTH user:
[ ] Citations: no blur, full data visible ✓
[ ] Page Audits: no blur, full data visible ✓
[ ] Content Drafts: no blur, full data visible ✓
[ ] Sentiment: no blur, full data visible ✓
[ ] Source Intelligence: blur overlay visible (professional required) ✓

For PROFESSIONAL user:
[ ] Source Intelligence: no blur, full data visible ✓
```

---

## ✅ Acceptance Criteria

This sprint is complete when ALL of the following are true:

- [ ] `components/plan-gate/PlanGate.tsx` exists with `blur-sm`, `pointer-events-none`, `aria-hidden`, `role="region"`, and all required `data-testid` attributes
- [ ] `planSatisfies()` is exported from `lib/plan-enforcer.ts` (not duplicated in the component)
- [ ] All 5 target pages use `<PlanGate>` — no ad-hoc inline plan checks remain on those pages
- [ ] Starter users see real blurred data (not empty state, not placeholder) on all 5 pages
- [ ] Growth users see unblurred data on all 4 growth-gated pages
- [ ] Growth users still see blur on source-intelligence (professional required)
- [ ] All unit tests pass: `npx vitest run src/__tests__/unit/plan-gate.test.tsx`
- [ ] All page unit tests pass: `npx vitest run src/__tests__/unit/plan-gate-pages.test.tsx`
- [ ] All E2E tests pass: `npx playwright test src/__tests__/e2e/plan-gate.spec.ts`
- [ ] Full unit suite passes with no regressions: `npx vitest run`
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] No literal `blur-sm` class constructed dynamically anywhere (AI_RULES §12)
- [ ] No inline plan string comparisons (`plan !== 'growth'`) on the 5 target pages (use `planSatisfies()`)

---

## 🧾 Test Run Commands

```bash
npx vitest run src/__tests__/unit/plan-gate.test.tsx           # ~28 tests
npx vitest run src/__tests__/unit/plan-gate-pages.test.tsx     # ~10 tests
npx vitest run                                                   # Full unit suite — 0 regressions
npx playwright test src/__tests__/e2e/plan-gate.spec.ts        # ~10 E2E tests
npx tsc --noEmit                                                 # 0 new type errors
```

---

## 📚 Document Sync + Git Commit (Run After All Tests Pass)

### Step 1: Update `/docs` files

**`docs/roadmap.md`** — Update Feature #66 (Starter Plan Blur Teasers) from `🟡 30%` to `✅ 100%`. Note Sprint 96 completion.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 96 to the completed sprints list. Check off all Sprint 96 checkboxes if a checklist exists.

**`docs/LocalVector-Master-Intelligence-Platform-Strategy.md`** — If this document references plan gating UI or Starter tier conversion strategy, update accordingly.

### Step 2: Update `DEVLOG.md`

Paste the DEVLOG entry from the **📓 DEVLOG Entry Format** section above. Replace all `N` placeholders with actual test counts from running `grep -cE "^\s*(it|test)\("` on each test file (AI_RULES §13.3).

### Step 3: Update `CLAUDE.md`

Add to the implementation inventory:
```markdown
### Sprint 96 — Plan Gate Polish: Blur Teasers (2026-03-XX)
- `components/plan-gate/PlanGate.tsx` — Blur-teaser plan gate wrapper (RSC)
- `components/plan-gate/index.ts` — Barrel export
- `lib/plan-enforcer.ts` — Added planSatisfies() + PLAN_HIERARCHY exports (if not present)
- Modified: citations, page-audits, content-drafts, sentiment, source-intelligence pages
- Tests: [N] Vitest + [N] Playwright
- Gap #66 closed: Starter Plan Blur Teasers 30% → 100%
```

### Step 4: Update `MEMORY.md`

Add a decision record:
```markdown
## Decision: Plan Gate UI Architecture (Sprint 96 — 2026-03-XX)
- Single PlanGate component in components/plan-gate/ — not per-page
- Data always fetched for gated users (blur teaser needs real data)
- source-intelligence requires 'professional' — all other dashboard gates require 'growth'
- Upgrade CTA routes to /settings/billing (Stripe portal handles plan upgrade display)
- planSatisfies() lives in lib/plan-enforcer.ts — PlanGate imports from there, not duplicate
- Starter-plan golden fixture (STARTER_ORG) added to golden-tenant.ts for E2E tests
```

### Step 5: Update `AI_RULES.md`

Append Rule §49 from the **🔮 AI_RULES Update** section above.

### Step 6: Final sync checklist

- [ ] `DEVLOG.md` has Sprint 96 entry with actual test counts (not "N")
- [ ] `CLAUDE.md` has Sprint 96 in implementation inventory
- [ ] `MEMORY.md` has plan gate architecture decision
- [ ] `AI_RULES.md` has Rule §49
- [ ] `docs/roadmap.md` shows Starter Plan Blur Teasers as ✅ 100%
- [ ] `docs/09-BUILD-PLAN.md` has Sprint 96 checked

### Step 7: Git commit

```bash
git add -A
git status

git commit -m "Sprint 96: Plan Gate Polish — Blur Teasers (Gap #66: 30% → 100%)

- components/plan-gate/PlanGate.tsx: blur-sm teaser wrapper (RSC, aria-safe)
- lib/plan-enforcer.ts: planSatisfies() + PLAN_HIERARCHY exported
- app/dashboard/citations: wrapped in PlanGate (growth)
- app/dashboard/page-audits: wrapped in PlanGate (growth)
- app/dashboard/content-drafts: wrapped in PlanGate (growth)
- app/dashboard/sentiment: wrapped in PlanGate (growth)
- app/dashboard/source-intelligence: wrapped in PlanGate (professional)
- golden-tenant.ts: STARTER_ORG fixture added for E2E
- tests: [N] Vitest + [N] Playwright passing
- docs: roadmap Feature #66 → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES §49

Closes Gap #66. Starter users see real blurred data on all 5 premium pages.
Drives upgrade intent — no more empty walls.
Unblocks Sprint 97 (Citation Cron + Dynamic llms.txt)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 96 completes:

- **Starter Plan Blur Teasers: 30% → 100%** (Gap #66 closed)
- Starter users see *their real data* blurred on citations, page-audits, content-drafts, sentiment, and source-intelligence — creating visible urgency to upgrade
- A single `<PlanGate>` component enforces all dashboard plan gates — no more ad-hoc inline checks
- `planSatisfies()` is the single source of truth for plan hierarchy — importable by any future component
- `source-intelligence` correctly requires `professional` (not just `growth`) — documented in AI_RULES §49 and MEMORY.md
- [~28 Vitest unit] + [~10 Vitest page] + [~10 Playwright E2E] tests protect the gate against regressions
- **Sprint 97** can proceed: Citation Cron + Dynamic llms.txt (Gaps #60 + #62)
