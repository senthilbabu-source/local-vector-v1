# Sprint A — Stop the Bleeding: Observability, Trust & First Impressions

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Six high-impact, low-effort fixes that stop the most critical production bleeding in LocalVector V1. Every finding is grounded in specific files and line numbers from the code analysis. Together these changes:

1. **C1 — Sentry on all 42 bare `catch {}` blocks** — you are currently flying completely blind on production failures. Paying customers see blank cards; you have no idea why.
2. **C3 — Unify plan names across all surfaces** — a customer who signs up for "AI SHIELD" lands in their dashboard to see "Growth Plan." That mismatch breaks trust immediately at the moment of highest engagement.
3. **H3 — Log SOV cron per-org failures** — the Share of Voice cron silently skips orgs that fail. You cannot distinguish "ran fine" from "silently broke for 40% of customers."
4. **H4 — Add sidebar section group headers** — 22 navigation items with no grouping is cognitively overwhelming. A first-time user cannot navigate the product.
5. **H5 — Add `href` links to all dashboard MetricCards** — 4+ metric cards and 4 chart cards are dead ends. Users cannot click into the detail pages they represent.
6. **L4 — Fix ViralScanner error handling** — the public-facing conversion tool on your landing page has a bare `catch {}`. If the Places API fails, users see nothing. This kills conversions.

**Why this sprint first:** All 6 fixes are low-effort (30 min–2 hrs each), require no new database migrations, and have outsized impact on trust, retention, and ops visibility. This sprint unblocks all meaningful instrumentation for every sprint that follows.

**Estimated total implementation time:** 8–12 hours.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                          — All engineering rules
Read CLAUDE.md                                                 — Project context, architecture, patterns
Read MEMORY.md                                                 — Key decisions and constraints
Read sentry.client.config.ts                                   — Confirm Sentry DSN is set
Read sentry.server.config.ts                                   — Confirm server-side Sentry is configured
Read sentry.edge.config.ts                                     — Confirm edge Sentry is configured
Read app/dashboard/page.tsx                                    — Lines 80, 92, 102, 131: the 4 silent dashboard failures
Read app/api/cron/sov/route.ts                                 — Lines 203, 217, 309: SOV org failures swallowed
Read app/_components/ViralScanner.tsx                          — Line 150: public-facing bare catch
Read app/dashboard/compete/_components/AddCompetitorForm.tsx   — Line 50: bare catch
Read app/dashboard/magic-menus/actions.ts                      — Line 125: bare catch
Read app/dashboard/share-of-voice/actions.ts                   — Line 293: bare catch
Read app/dashboard/settings/team/_components/TeamClient.tsx    — Line 116: bare catch
Read app/_sections/PricingSection.tsx                          — Plan names on landing page
Read app/dashboard/billing/page.tsx                            — Plan names on billing page
Read lib/plan-enforcer.ts                                      — Canonical plan enum values
Read components/layout/Sidebar.tsx                             — All 22 NAV_ITEMS, current structure
Read app/dashboard/_components/MetricCard.tsx                  — Current MetricCard props interface
Read app/dashboard/page.tsx                                    — Dashboard layout, all card usage
Read app/dashboard/_components/SOVTrendChart.tsx               — Current chart card (check for href prop)
Read app/dashboard/_components/HallucinationsByModel.tsx       — Current chart card
Read app/dashboard/_components/AIHealthScoreCard.tsx           — Current score card
Read app/dashboard/_components/RealityScoreCard.tsx            — Current score card
```

**Specifically understand before writing code:**
- How Sentry is currently imported in the codebase. Check for existing `import * as Sentry from '@sentry/nextjs'` usage in any file — use the exact same import pattern. Do NOT introduce a second import style.
- The exact TypeScript plan union type in `lib/plan-enforcer.ts`: `'trial' | 'starter' | 'growth' | 'agency'`. These are the DB-canonical values.
- The existing `MetricCard` component's props interface — specifically whether an `href` prop already exists (it likely does not).
- The current Sidebar `NAV_ITEMS` structure — specifically whether items are already grouped into arrays or are a flat list.
- Whether a `cron_run_log` table exists in `prod_schema.sql`. **Do not create it if it doesn't exist** — log to Sentry instead (see H3 spec).
- The ViralScanner's current error state (if any) — does it have a `setError` state variable already?

---

## 🏗️ Architecture — What to Build

### Fix C1: Wire Sentry Into All 42 Bare `catch {}` Blocks

**This is the most important fix in this sprint.** Sentry is fully configured in `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts` but is **completely unused** in almost every catch block. This means you have zero production error visibility.

#### The Two Patterns to Apply

**Pattern A — Non-critical UI component (dashboard cards, client components):**

```typescript
// BEFORE (current — broken for observability):
} catch {
  // Proof timeline is non-critical — dashboard renders without it.
}

// AFTER (what you must implement):
} catch (err) {
  Sentry.captureException(err, {
    tags: { component: 'proof-timeline', sprint: 'A' },
    extra: { orgId: org?.id },  // include any available context, never PII
  });
  setProofTimelineError(true);  // triggers degraded state UI (see degraded state spec below)
}
```

**Pattern B — Server-side route handler / cron / server action:**

```typescript
// BEFORE (current — broken):
} catch {
  // swallow
}

// AFTER:
} catch (err) {
  Sentry.captureException(err, {
    tags: { route: '/api/cron/sov', phase: 'org-processing', sprint: 'A' },
    extra: { orgId: currentOrgId },
  });
  // Return structured error response (see per-file spec below)
}
```

#### Degraded State UI Pattern (for Dashboard Client Components)

For every dashboard card that currently shows blank on a catch, add a `boolean` error state and render a degraded placeholder. The degraded state should be minimal and informative — not alarming.

```typescript
// State variable pattern:
const [proofTimelineError, setProofTimelineError] = useState(false);

// Degraded render (inside the card JSX):
{proofTimelineError && (
  <p className="text-xs text-muted-foreground text-center py-4">
    Unable to load proof timeline — try refreshing.
  </p>
)}
```

Use existing Tailwind color tokens (`text-muted-foreground`, `bg-muted`, etc.). Do NOT introduce new CSS classes or hardcoded color strings.

#### Complete List of Files and Line Numbers to Fix

Work through every file below. Do not skip any. Check for additional bare catches you discover while reading — fix those too and document them in the DEVLOG.

**Client components (`'use client'`):**

| File | Line(s) | Context | Degraded state needed? |
|------|---------|---------|----------------------|
| `app/dashboard/page.tsx` | 80 | Proof Timeline fetch | Yes — `proofTimelineError` state |
| `app/dashboard/page.tsx` | 92 | Entity Health fetch | Yes — `entityHealthError` state |
| `app/dashboard/page.tsx` | 102 | Occasion Alerts fetch | Yes — `occasionAlertsError` state |
| `app/dashboard/page.tsx` | 131 | GBP card fetch | Yes — `gbpCardError` state |
| `app/dashboard/compete/_components/AddCompetitorForm.tsx` | 50 | Form submit | Yes — `setFormError('Unable to add competitor — please try again.')` |
| `app/dashboard/settings/team/_components/TeamClient.tsx` | 116 | Team action | Yes — `setTeamError(...)` |
| `app/_components/ViralScanner.tsx` | 150 | Public scanner | Yes — see Fix L4 below |

**Server-side (route handlers, crons, server actions):**

| File | Line(s) | Context | Response strategy |
|------|---------|---------|-----------------|
| `app/api/cron/sov/route.ts` | 203 | Per-org SOV failure | Log + `continue` (see Fix H3) |
| `app/api/cron/sov/route.ts` | 217 | Per-org SOV failure | Log + `continue` |
| `app/api/cron/sov/route.ts` | 309 | Per-org SOV failure | Log + `continue` |
| `app/dashboard/magic-menus/actions.ts` | 125 | Server action | Log + return `{ error: 'generation_failed' }` |
| `app/dashboard/share-of-voice/actions.ts` | 293 | Server action | Log + return `{ error: 'sov_action_failed' }` |

**Additional files — scan for bare `catch {` (no variable):**
After fixing the above 12 explicitly listed locations, run the following command and fix any remaining bare catches:

```bash
grep -rn "} catch {" app/ lib/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."
```

For each additional bare catch found:
1. Add `catch (err)` 
2. Add `Sentry.captureException(err, { tags: { file: '<filename>', sprint: 'A' } })`
3. If in a client component, add or reuse a relevant error state variable
4. If in a server route, return or log appropriately
5. Document each additional fix in the DEVLOG under "Additional catches fixed"

**Sentry import:** Use exactly this import in every file that doesn't already import Sentry:
```typescript
import * as Sentry from '@sentry/nextjs';
```
If the codebase uses a different import pattern (check existing Sentry usage in the repo first), use that exact pattern instead.

---

### Fix C3: Unify Plan Names Across All Surfaces

**The problem:** Three surfaces use three different names for the same plans:

| DB / `plan-enforcer.ts` | Landing Page (`PricingSection.tsx`) | Billing Page (`billing/page.tsx`) |
|-------------------------|-------------------------------------|-----------------------------------|
| `trial` | "THE AUDIT" (Free) | Trial |
| `starter` | "STARTER" | Starter ($29) |
| `growth` | **"AI SHIELD"** | Growth ($59) |
| `agency` | **"BRAND FORTRESS"** | Agency (Custom) |

"AI SHIELD" and "BRAND FORTRESS" are the two trust-breaking mismatches. A customer who signs up for "AI Shield" lands in their dashboard seeing "Growth Plan."

**Resolution strategy: Marketing names WIN on the landing page; DB-canonical names win everywhere else.**

The landing page is a marketing surface — bold naming is appropriate there. The fix is to make the billing page and any in-dashboard plan references use the **same marketing names** as the landing page.

#### Changes Required

**File: `app/dashboard/billing/page.tsx`**

Find where plan names are rendered (likely a switch/map over the plan value). Update the display labels:

```typescript
// Display name mapping — use this wherever plan names are shown in the dashboard:
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  trial:   'The Audit',       // Free tier
  starter: 'Starter',         // $29
  growth:  'AI Shield',       // $59 — was showing "Growth Plan" — now matches landing page
  agency:  'Brand Fortress',  // Custom — was showing "Agency" — now matches landing page
};
```

Locate every instance where the raw plan string (`'growth'`, `'agency'`) is rendered directly as text to the user in the billing page and replace with `PLAN_DISPLAY_NAMES[plan]`.

**File: `lib/plan-enforcer.ts` (or wherever plan names surface in the sidebar/footer)**

Check if the current plan name is rendered anywhere in the sidebar footer or dashboard shell. If so, apply the same `PLAN_DISPLAY_NAMES` mapping.

**File: `components/layout/Sidebar.tsx`**

Search for any plan name text rendered in the sidebar (e.g., `"Growth Plan"`, `"Starter Plan"`). Apply the display name mapping.

**File: `app/_sections/PricingSection.tsx`**

No changes needed — the marketing names here are the source of truth.

**Create a shared constant:** To prevent this divergence from happening again, create a new file:

```typescript
// lib/plan-display-names.ts
/**
 * Human-readable display names for plan values.
 * These match the marketing names on the landing page (PricingSection.tsx).
 * Source of truth: the DB plan enum values are: trial | starter | growth | agency
 * NEVER hardcode plan display names elsewhere — always import from here.
 */
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  trial:   'The Audit',
  starter: 'Starter',
  growth:  'AI Shield',
  agency:  'Brand Fortress',
};

/**
 * Returns the marketing display name for a plan value.
 * Falls back to the raw value if not found (defensive).
 */
export function getPlanDisplayName(plan: string | null | undefined): string {
  if (!plan) return 'Free';
  return PLAN_DISPLAY_NAMES[plan] ?? plan;
}
```

Import `getPlanDisplayName` wherever plan names are displayed to users. Update all existing usages.

**Do NOT change:** The DB enum values, `lib/plan-enforcer.ts` logic, any `checkPlan()` calls, or any plan comparison logic. Only display strings change.

---

### Fix H3: Log SOV Cron Per-Org Failures Properly

**The problem:** `app/api/cron/sov/route.ts` processes orgs in a loop. Lines 203, 217, and 309 catch per-org failures silently. If the SOV cron runs for 50 orgs and 10 of them fail, you see a green cron run in your logs with no indication that 10 orgs got no SOV data.

#### Implementation

In `app/api/cron/sov/route.ts`, find the per-org processing loop. Replace the three bare catches with:

```typescript
} catch (err) {
  Sentry.captureException(err, {
    tags: { cron: 'sov', phase: 'org-processing', sprint: 'A' },
    extra: {
      orgId: org.id,
      orgName: org.name ?? 'unknown',
      // Include any query/location context available in scope
    },
  });
  orgFailureCount++;  // see aggregate logging below
  continue;  // do not abort the entire cron for one org failure
}
```

**Add aggregate failure logging at the cron summary level.** After the org processing loop completes, add:

```typescript
// After the loop:
const summary = {
  total_orgs: orgs.length,
  succeeded: orgs.length - orgFailureCount,
  failed: orgFailureCount,
};

console.log(`[SOV Cron] Completed: ${JSON.stringify(summary)}`);

if (orgFailureCount > 0) {
  Sentry.captureMessage(`SOV cron completed with ${orgFailureCount} org failures`, {
    level: 'warning',
    tags: { cron: 'sov', sprint: 'A' },
    extra: summary,
  });
}
```

**Check if `cron_run_log` table exists in `prod_schema.sql`:**
- If it exists: Also write the summary to `cron_run_log` using `createServiceRoleClient()`.
- If it does NOT exist: Sentry logging only (no DB writes). Do not create the table in this sprint — that's a separate concern.

**Declare `orgFailureCount`** at the top of the function body, before the loop:
```typescript
let orgFailureCount = 0;
```

Apply the same pattern to all 3 catch blocks (lines 203, 217, 309). Each catch increments `orgFailureCount` and calls `Sentry.captureException`.

---

### Fix H4: Add Section Group Headers to the Sidebar

**The problem:** The sidebar has 22 navigation items in a flat list. A first-time user cannot understand the product structure. This is the highest-impact UX fix requiring the least code.

#### Implementation

Read `components/layout/Sidebar.tsx` carefully first. Understand the current NAV_ITEMS structure — it is likely either a flat array or already has some grouping object.

**Proposed grouping (adjust based on actual NAV_ITEMS content):**

```typescript
// If NAV_ITEMS is currently a flat array, convert to grouped structure:
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      // Dashboard, Alerts — items the user sees first
    ],
  },
  {
    label: 'AI Visibility',
    items: [
      // Reality Score, AI Responses, Hallucinations, Share of Voice
    ],
  },
  {
    label: 'Content & Presence',
    items: [
      // Magic Menus, Content Calendar, Content Drafts, Proof Timeline
    ],
  },
  {
    label: 'Competitive Intelligence',
    items: [
      // Compete, Cluster Map
    ],
  },
  {
    label: 'Settings & Growth',
    items: [
      // Integrations, Listings, Billing, Settings, Team
    ],
  },
];
```

**Important:** The exact grouping must reflect the actual items in `NAV_ITEMS`. Read the sidebar file fully before assigning items to groups. Do not guess item names from memory.

**Sidebar group header render pattern:**

```tsx
{NAV_GROUPS.map((group) => (
  <div key={group.label} className="mb-4">
    <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
      {group.label}
    </p>
    {group.items.map((item) => (
      <SidebarNavItem key={item.href} item={item} />  {/* use whatever the existing NavItem component is called */}
    ))}
  </div>
))}
```

**Rules:**
- Group label: `text-[10px]`, `uppercase`, `tracking-widest`, `text-muted-foreground/60` — subtle, not competing with nav items.
- All 22 existing nav items must still be present after refactor — verify by counting.
- Active/hover states on individual nav items must be unchanged.
- Mobile sidebar behavior (if any) must be unchanged.
- Do NOT change the `href`, `icon`, `label`, or `active` properties of any existing NAV_ITEM.
- If NAV_ITEMS is already a grouped structure, adapt the grouping rather than re-architecting from scratch. Add group label rendering where missing.

---

### Fix H5: Add `href` Links to All Dashboard MetricCards and Chart Cards

**The problem:** Dashboard MetricCards and chart cards are rendered but are not clickable. They represent pages (Alerts, SOV, Hallucinations, Compete) but provide no way to navigate there from the dashboard. Users are stuck on the overview.

#### Implementation

**Step 1: Add `href` prop to `MetricCard`**

Read `app/dashboard/_components/MetricCard.tsx`. The component likely renders a `<div>` or `<Card>`. Add an optional `href` prop:

```typescript
// Add to MetricCard props interface:
interface MetricCardProps {
  // ... existing props ...
  /** If provided, the entire card becomes a link to this path */
  href?: string;
}
```

Wrap the card content conditionally:

```tsx
// Inside MetricCard render:
const cardContent = (
  <Card className={cn('...existing classes...')}>
    {/* existing card JSX unchanged */}
  </Card>
);

if (props.href) {
  return (
    <Link href={props.href} className="block hover:no-underline group">
      <div className="transition-all duration-150 group-hover:shadow-md group-hover:-translate-y-px">
        {cardContent}
      </div>
    </Link>
  );
}

return cardContent;
```

Use Next.js `<Link>` from `'next/link'` — do not use `<a>` tags.

**Step 2: Wire `href` props in `app/dashboard/page.tsx`**

Find every `<MetricCard>` usage in the dashboard page. Add the appropriate `href`:

```tsx
// Example — adjust to match actual MetricCard usage in the file:
<MetricCard
  label="Open Alerts"
  value={openAlerts.length}
  href="/dashboard/alerts"           // ← ADD THIS
/>
<MetricCard
  label="Reality Score"
  value={scores.realityScore}
  href="/dashboard/reality-score"    // ← ADD THIS
/>
<MetricCard
  label="AI Visibility"
  value={scores.aiVisibility}
  href="/dashboard/share-of-voice"   // ← ADD THIS
/>
<MetricCard
  label="Intercept Analyses"
  value={interceptCount}
  href="/dashboard/ai-responses"     // ← ADD THIS
/>
```

**Step 3: Add `href` prop and click behavior to chart cards**

Read each chart card component: `SOVTrendChart`, `HallucinationsByModel`, `AIHealthScoreCard`, `RealityScoreCard`. Each should get a "View details →" link in its card header/footer area:

```tsx
// Pattern — add to each chart card's header or footer:
<div className="flex items-center justify-between mb-4">
  <h3 className="text-sm font-medium text-foreground">Share of Voice</h3>
  <Link href="/dashboard/share-of-voice" className="text-xs text-primary hover:underline flex items-center gap-1">
    View details
    <ChevronRight className="h-3 w-3" />
  </Link>
</div>
```

Apply to:
| Chart Card | `href` |
|-----------|--------|
| `SOVTrendChart` | `/dashboard/share-of-voice` |
| `HallucinationsByModel` | `/dashboard/alerts` |
| `AIHealthScoreCard` | `/dashboard/reality-score` (or most relevant detail page) |
| `RealityScoreCard` | `/dashboard/reality-score` |

**Verify all target routes exist** before wiring them. Check `app/dashboard/` directory for each route. If a route doesn't exist yet, use the closest parent that does (e.g., `/dashboard/alerts` instead of `/dashboard/alerts/hallucinations`).

**Rules:**
- All card click areas must use `next/link` — no `router.push()` in event handlers for these.
- Cards without a meaningful detail page (if any) should not get an `href` — leave them as-is rather than wiring a non-existent route.
- The hover effect on MetricCard must be subtle — `hover:shadow-md` and `-translate-y-px` are sufficient. Do not add large motion effects.
- Do NOT change any chart logic, data fetching, or rendering. Only add the link layer.

---

### Fix L4: Fix ViralScanner Error Handling

**The problem:** `app/_components/ViralScanner.tsx` line 150 has a bare `catch {}`. The ViralScanner is the primary public conversion tool on the landing page — it's meant to demonstrate LocalVector's value in 8 seconds. A silent failure kills conversions with zero feedback.

#### Implementation

Read `app/_components/ViralScanner.tsx` fully before making changes. Understand:
- The current state variables (likely `isScanning`, `results`, etc.)
- The current error handling (if any)
- Whether there is already a `setError` or `error` state variable

**Add error state if it doesn't exist:**

```typescript
const [scanError, setScanError] = useState<string | null>(null);
```

**Fix the bare catch at line 150:**

```typescript
} catch (err) {
  Sentry.captureException(err, {
    tags: { component: 'ViralScanner', surface: 'landing-page', sprint: 'A' },
    // No user PII in extra — this is a public-facing component
  });
  setScanError('Our AI scanner is temporarily unavailable — please try again in a moment.');
  setIsScanning(false);  // ensure spinner is stopped
}
```

**Add error state render in the JSX:**

```tsx
{scanError && (
  <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
    <p className="text-sm text-destructive">{scanError}</p>
    <button
      onClick={() => setScanError(null)}
      className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
    >
      Try again
    </button>
  </div>
)}
```

**Clear the error on retry:** When the user submits a new scan, call `setScanError(null)` at the top of the submit handler (before the try block), so the error state clears on the next attempt.

**Rules:**
- The ViralScanner is a `'use client'` component — confirm before adding Sentry (use the client config import).
- Do NOT change the happy-path UI, animations, or results rendering.
- The "Try again" button should reset to the initial idle state (clear results, clear error, allow a new scan).
- Do NOT expose the raw error message or stack trace to the user — only the friendly string.

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/sentry-coverage.test.ts`

**Validates that critical catch blocks now call `Sentry.captureException`.**
Uses Vitest `vi.spyOn` to mock Sentry, triggers error conditions, and asserts Sentry was called.

```
describe('C1 — Sentry coverage on critical catch blocks')

  ViralScanner:
  1.  when Places API throws, Sentry.captureException is called with tag component='ViralScanner'
  2.  when Places API throws, scanError state is set (not null)
  3.  when Places API throws, isScanning is set to false

  SOV cron (per-org):
  4.  when a single org throws during SOV processing, Sentry.captureException is called
  5.  when a single org throws, the cron continues to process remaining orgs (no re-throw)
  6.  when 2 of 3 orgs throw, orgFailureCount === 2 in the summary log

  AddCompetitorForm:
  7.  when form submit throws, Sentry.captureException is called
  8.  when form submit throws, an error message state is set

  plan-display-names:
  9.  getPlanDisplayName('growth') returns 'AI Shield'
  10. getPlanDisplayName('agency') returns 'Brand Fortress'
  11. getPlanDisplayName('starter') returns 'Starter'
  12. getPlanDisplayName('trial') returns 'The Audit'
  13. getPlanDisplayName(null) returns 'Free'
  14. getPlanDisplayName(undefined) returns 'Free'
  15. getPlanDisplayName('unknown_value') returns 'unknown_value' (defensive fallback)
```

**Total Vitest tests: 15**

**Notes:**
- Mock `@sentry/nextjs` at the top of the test file: `vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))`
- For SOV cron tests, mock Supabase calls to avoid real DB calls — use `vi.mock('@/lib/supabase/server')`
- For ViralScanner, render the component with `@testing-library/react` — mock the Places API fetch to throw
- For AddCompetitorForm, render and submit the form with the API mocked to throw

### Test File 2: `src/__tests__/unit/sidebar-groups.test.ts`

**Validates sidebar grouping structure.**

```
describe('H4 — Sidebar NAV_GROUPS structure')

  1.  NAV_GROUPS is an array with 4–6 entries (reasonable group count)
  2.  Every group has a non-empty string label
  3.  Every group has at least 1 item
  4.  Total item count across all groups equals 22 (no items lost during grouping)
  5.  No item appears in more than one group (no duplicates)
  6.  Every item that was in the original NAV_ITEMS flat array is present in NAV_GROUPS
  7.  Every item has a valid href (starts with '/dashboard' or '/')
```

**Total Vitest tests: 7**

### Test File 3: `src/__tests__/unit/metric-card-links.test.ts`

**Validates MetricCard href prop behavior.**

```
describe('H5 — MetricCard href prop')

  1.  when href is provided, renders a Next.js Link wrapping the card
  2.  when href is not provided, renders a plain div/Card (no Link wrapper)
  3.  when href is provided, the Link href attribute matches the passed prop
  4.  hover class is applied when href is provided
  5.  no hover class when href is absent
```

**Total Vitest tests: 5**

### E2E Test File: `src/__tests__/e2e/sprint-a-smoke.spec.ts`

**Smoke tests confirming Sprint A fixes are live in the UI.**

```
describe('Sprint A — Smoke Tests')

  Sidebar:
  1.  at least one sidebar group label is visible (e.g., 'Overview' or 'AI Visibility')
  2.  all 22 nav items are still present in the sidebar after grouping

  MetricCard links:
  3.  clicking the 'Open Alerts' metric card navigates to /dashboard/alerts
  4.  clicking the 'Reality Score' metric card navigates to /dashboard/reality-score

  Chart card links:
  5.  'View details' link is visible on the SOVTrendChart card
  6.  'View details' link on SOVTrendChart navigates to /dashboard/share-of-voice

  Plan names:
  7.  billing page shows 'AI Shield' (not 'Growth') for growth plan users
  8.  billing page shows 'Brand Fortress' (not 'Agency') for agency plan users

  ViralScanner error state:
  9.  when the Places API is mocked to return 500, an error message appears (not blank)
  10. 'Try again' button is visible after ViralScanner error
```

**Total Playwright tests: 10**

**Critical Playwright rules:**
- Use `page.route()` to mock the Places API for ViralScanner tests — never allow real external API calls
- Use existing Playwright auth helpers for tests requiring logged-in state (billing page, dashboard)
- Use `data-testid` attributes for all new interactive elements:
  - `data-testid="viral-scanner-error"` on the ViralScanner error div
  - `data-testid="viral-scanner-retry"` on the retry button
  - `data-testid="sidebar-group-label"` on each group header `<p>` tag
  - `data-testid="metric-card-link"` on each linked MetricCard `<Link>` wrapper
- Never use `page.waitForTimeout()` — use `page.waitForSelector()` or `page.waitForResponse()`
- Playwright tests should not require a real Sentry DSN — Sentry calls in the browser are fire-and-forget and won't cause test failures

**Run commands:**

```bash
npx vitest run src/__tests__/unit/sentry-coverage.test.ts      # 15 tests
npx vitest run src/__tests__/unit/sidebar-groups.test.ts       # 7 tests
npx vitest run src/__tests__/unit/metric-card-links.test.ts    # 5 tests
npx vitest run                                                  # All unit tests — no regressions
npx playwright test src/__tests__/e2e/sprint-a-smoke.spec.ts   # 10 e2e tests
npx tsc --noEmit                                                # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Fix |
|---|------|--------|-----|
| 1 | `lib/plan-display-names.ts` | **CREATE** | C3 — Shared plan display names |
| 2 | `app/dashboard/billing/page.tsx` | **MODIFY** | C3 — Use `getPlanDisplayName()` |
| 3 | `components/layout/Sidebar.tsx` | **MODIFY** | C3 + H4 — Plan names + grouped nav |
| 4 | `app/dashboard/page.tsx` | **MODIFY** | C1 + H5 — Sentry on catches + MetricCard hrefs |
| 5 | `app/_components/ViralScanner.tsx` | **MODIFY** | C1 + L4 — Sentry + error state UI |
| 6 | `app/api/cron/sov/route.ts` | **MODIFY** | C1 + H3 — Sentry + aggregate failure log |
| 7 | `app/dashboard/compete/_components/AddCompetitorForm.tsx` | **MODIFY** | C1 — Sentry + error state |
| 8 | `app/dashboard/magic-menus/actions.ts` | **MODIFY** | C1 — Sentry + structured return |
| 9 | `app/dashboard/share-of-voice/actions.ts` | **MODIFY** | C1 — Sentry + structured return |
| 10 | `app/dashboard/settings/team/_components/TeamClient.tsx` | **MODIFY** | C1 — Sentry + error state |
| 11 | `app/dashboard/_components/MetricCard.tsx` | **MODIFY** | H5 — `href` prop + Link wrapper |
| 12 | `app/dashboard/_components/SOVTrendChart.tsx` | **MODIFY** | H5 — "View details" link |
| 13 | `app/dashboard/_components/HallucinationsByModel.tsx` | **MODIFY** | H5 — "View details" link |
| 14 | `app/dashboard/_components/AIHealthScoreCard.tsx` | **MODIFY** | H5 — "View details" link |
| 15 | `app/dashboard/_components/RealityScoreCard.tsx` | **MODIFY** | H5 — "View details" link |
| 16 | `src/__tests__/unit/sentry-coverage.test.ts` | **CREATE** | C1 + C3 unit tests (15 tests) |
| 17 | `src/__tests__/unit/sidebar-groups.test.ts` | **CREATE** | H4 unit tests (7 tests) |
| 18 | `src/__tests__/unit/metric-card-links.test.ts` | **CREATE** | H5 unit tests (5 tests) |
| 19 | `src/__tests__/e2e/sprint-a-smoke.spec.ts` | **CREATE** | E2E smoke tests (10 tests) |

**Additional files (if bare catches are found via grep):** Document any extra files modified beyond this list in the DEVLOG.

---

## 🧠 Edge Cases to Handle

1. **Sentry not initialized in test environment:** `Sentry.captureException` must not throw in test environments. If `SENTRY_DSN` env var is absent, Sentry initializes in no-op mode — this is correct behavior. Do not add null checks around Sentry calls; the SDK handles this internally.

2. **`err` may not be an `Error` instance:** In some catch blocks, `err` could be a string, object, or null (e.g., from a rejected promise that doesn't throw an `Error`). `Sentry.captureException` handles non-Error objects gracefully — do not add `instanceof Error` guards.

3. **Client vs. Server Sentry:** `@sentry/nextjs` exports the correct SDK automatically based on the runtime. One import path works for both. No special handling needed.

4. **Plan names in email templates or transactional content:** Check if plan names appear in any email templates (`lib/services/weekly-digest.service.ts` or similar). If so, apply `getPlanDisplayName()` there too. Document in DEVLOG if found.

5. **Sidebar active state:** After converting NAV_ITEMS from flat to grouped, verify that the active item highlight still works. The active state logic likely compares `pathname` to `item.href` — this comparison is unaffected by grouping. But test it.

6. **MetricCard with `href` inside a draggable or sortable container:** If any MetricCard is inside a drag-and-drop widget, the Link wrapper could interfere with drag events. Check before adding the Link wrapper. If draggable, use `router.push()` in an `onClick` handler instead of `<Link>`.

7. **SOV cron `orgFailureCount` in concurrent execution:** Inngest functions may run in parallel. The `orgFailureCount` variable is scoped to the single function invocation — no race conditions. This is correct.

8. **ViralScanner `scanError` cleared on navigation:** Since ViralScanner is on the landing page (not inside the Next.js app router with persistent state), navigating away and back will reset component state naturally. No special cleanup needed.

9. **Missing `data-testid` on existing elements:** When adding `data-testid` attributes to existing components, ensure no existing tests select elements by other means (class names, aria labels) that would conflict. Do not remove existing test attributes.

10. **`getPlanDisplayName` called with a plan from a future sprint:** The fallback `?? plan` (return the raw value) is intentional — if a new plan tier is added in a future sprint without updating `PLAN_DISPLAY_NAMES`, the raw value is shown rather than crashing. Document this in the file's JSDoc.

---

## 🚫 What NOT to Do

1. **DO NOT create new database migrations** — this sprint has zero schema changes. If you find yourself writing SQL, stop and re-read this prompt.
2. **DO NOT add `try { } catch (err) { throw err; }` wrappers** — re-throwing after Sentry logging is only correct in route handlers where the caller needs to know about the error. For fire-and-forget UI data fetches, swallow after logging.
3. **DO NOT use `console.error(err)` as a substitute for `Sentry.captureException(err)`** — console logs disappear in production. Sentry is the production observability tool.
4. **DO NOT change the DB plan enum values** (`trial`, `starter`, `growth`, `agency`) — only display strings change.
5. **DO NOT rename the `NAV_ITEMS` export** if it is imported by other files — maintain backward compatibility. Add `NAV_GROUPS` as a new export if needed, and update the Sidebar render to use it while keeping `NAV_ITEMS` intact.
6. **DO NOT use `<a>` tags for MetricCard links** — always use `next/link`. `<a>` triggers full page reloads.
7. **DO NOT modify `middleware.ts`** (AI_RULES §6) — all middleware logic lives in `proxy.ts`.
8. **DO NOT expose raw JavaScript errors to users** — the ViralScanner error message must be a hardcoded friendly string, not `err.message`.
9. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12) — use literal class strings.
10. **DO NOT skip the `grep` sweep for additional bare catches** — the 12 explicitly listed locations are confirmed; there may be up to 30 more across auth routes and cron routes per the code analysis. Fix all of them.
11. **DO NOT add Sentry tags with user PII** — `orgId` (a UUID) is acceptable in `extra`; email addresses, names, or phone numbers are not.
12. **DO NOT change any chart rendering logic, data fetching, or visual design** — H5 adds link affordances only; nothing else changes in chart components.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `lib/plan-display-names.ts` created with `PLAN_DISPLAY_NAMES` and `getPlanDisplayName()`
- [ ] `app/dashboard/billing/page.tsx` uses `getPlanDisplayName()` — no raw `'growth'` or `'agency'` strings rendered to users
- [ ] `components/layout/Sidebar.tsx` uses `getPlanDisplayName()` for any plan name rendering + NAV_GROUPS with section headers
- [ ] All 22 sidebar nav items still present after grouping (verified by count)
- [ ] Sidebar group labels render with correct Tailwind classes (uppercase, muted, small)
- [ ] All 12 explicitly listed bare `catch {}` blocks now have `catch (err)` with `Sentry.captureException`
- [ ] `grep -rn "} catch {" app/ lib/ --include="*.ts" --include="*.tsx"` returns 0 results in production source files (excluding test files)
- [ ] `app/api/cron/sov/route.ts` has `orgFailureCount` tracking and aggregate summary log after the org loop
- [ ] `app/_components/ViralScanner.tsx` has `scanError` state, friendly error message renders on catch, retry button clears error
- [ ] `data-testid` attributes added: `viral-scanner-error`, `viral-scanner-retry`, `sidebar-group-label`, `metric-card-link`
- [ ] `MetricCard` has optional `href` prop — wraps content in `next/link` when present
- [ ] All MetricCard usages in `app/dashboard/page.tsx` have correct `href` values pointing to existing routes
- [ ] `SOVTrendChart`, `HallucinationsByModel`, `AIHealthScoreCard`, `RealityScoreCard` each have a "View details →" link
- [ ] `npx vitest run src/__tests__/unit/sentry-coverage.test.ts` — **15 tests passing**
- [ ] `npx vitest run src/__tests__/unit/sidebar-groups.test.ts` — **7 tests passing**
- [ ] `npx vitest run src/__tests__/unit/metric-card-links.test.ts` — **5 tests passing**
- [ ] `npx vitest run` — ALL existing tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/sprint-a-smoke.spec.ts` — **10 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written with actual test counts
- [ ] `AI_RULES.md` updated with Rule 42

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## [DATE] — Sprint A: Stop the Bleeding — Observability, Trust & First Impressions (Completed)

**Goal:** Six high-impact, low-effort fixes identified in the February 2026 code analysis. Closes production blind spots, eliminates trust-breaking plan name mismatch, adds UX navigation affordances.

**Scope:**
- `lib/plan-display-names.ts` — **NEW.** Shared plan display name mapping. `getPlanDisplayName()` maps DB enum values to marketing names (AI Shield, Brand Fortress). Single source of truth.
- `app/dashboard/billing/page.tsx` — **MODIFIED.** Uses `getPlanDisplayName()`. Growth plan now shows "AI Shield"; Agency shows "Brand Fortress."
- `components/layout/Sidebar.tsx` — **MODIFIED.** Flat NAV_ITEMS converted to NAV_GROUPS with section headers. Groups: [list actual groups used]. All 22 items preserved.
- `app/dashboard/page.tsx` — **MODIFIED.** 4 bare catch blocks now log to Sentry with degraded state UI. MetricCards wired with href props.
- `app/_components/ViralScanner.tsx` — **MODIFIED.** Bare catch at line 150 replaced. scanError state added. Friendly error message + retry button on failure. Sentry captures exception.
- `app/api/cron/sov/route.ts` — **MODIFIED.** 3 bare catches at lines 203, 217, 309 now log to Sentry. orgFailureCount tracking added. Aggregate summary logged + Sentry warning if any orgs fail.
- `app/dashboard/compete/_components/AddCompetitorForm.tsx` — **MODIFIED.** Bare catch wired to Sentry + form error state.
- `app/dashboard/magic-menus/actions.ts` — **MODIFIED.** Bare catch wired to Sentry + structured error return.
- `app/dashboard/share-of-voice/actions.ts` — **MODIFIED.** Bare catch wired to Sentry + structured error return.
- `app/dashboard/settings/team/_components/TeamClient.tsx` — **MODIFIED.** Bare catch wired to Sentry + team error state.
- `app/dashboard/_components/MetricCard.tsx` — **MODIFIED.** Optional `href` prop added. Card wraps in `next/link` when href provided. Hover: shadow-md + -translate-y-px.
- `app/dashboard/_components/SOVTrendChart.tsx` — **MODIFIED.** "View details →" link added to card header.
- `app/dashboard/_components/HallucinationsByModel.tsx` — **MODIFIED.** "View details →" link added.
- `app/dashboard/_components/AIHealthScoreCard.tsx` — **MODIFIED.** "View details →" link added.
- `app/dashboard/_components/RealityScoreCard.tsx` — **MODIFIED.** "View details →" link added.
- Additional bare catches fixed via grep sweep: [list any extra files/lines found]

**Tests added:**
- `src/__tests__/unit/sentry-coverage.test.ts` — N Vitest tests (Sentry coverage + plan display names)
- `src/__tests__/unit/sidebar-groups.test.ts` — N Vitest tests (grouping structure validation)
- `src/__tests__/unit/metric-card-links.test.ts` — N Vitest tests (href prop behavior)
- `src/__tests__/e2e/sprint-a-smoke.spec.ts` — N Playwright tests (end-to-end smoke)

**Total tests added: [N] Vitest + [N] Playwright**
**Total bare catches fixed: [N] (12 explicit + [N] additional from grep sweep)**

**Before/After:**
- Before: `grep -rn "} catch {" app/ lib/` returned [N] results. After: 0 results.
- Before: billing page showed "Growth Plan" for AI Shield customers. After: "AI Shield."
- Before: 22 flat sidebar items. After: [N] groups with labeled sections.
- Before: MetricCards not clickable. After: all 4 link to detail pages.
- Before: ViralScanner failure = blank. After: friendly error message + retry.
```

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 42. 🚨 Sentry Error Instrumentation — Required on All `catch` Blocks (Sprint A)

All `catch` blocks in production code must capture to Sentry. Bare `catch {}` blocks with no logging are banned.

* **Rule:** `catch (err) { Sentry.captureException(err, { tags: { ... } }) }` is the minimum required pattern.
* **Client components:** Also set a local error state variable to render a degraded UI. Never show a blank card.
* **Server routes/crons:** Log to Sentry + return/continue appropriately. Never swallow silently.
* **Non-critical catches:** Logging + degraded state. Do NOT re-throw.
* **Critical catches:** Logging + re-throw or return error code to caller.
* **Never in `extra`:** Email addresses, names, phone numbers, or any user PII. UUIDs (orgId, locationId) are acceptable.
* **Import:** `import * as Sentry from '@sentry/nextjs'` — use this exact import everywhere.

## 43. 🏷️ Plan Display Names — Always Use `lib/plan-display-names.ts` (Sprint A)

All human-readable plan name rendering must use `getPlanDisplayName()` from `lib/plan-display-names.ts`.

* **Rule:** Never hardcode plan display strings ('Growth Plan', 'Agency', etc.) inline. Import and call `getPlanDisplayName(plan)`.
* **DB values stay unchanged:** `trial | starter | growth | agency` are canonical. Never change these.
* **Adding new plans:** Add entry to `PLAN_DISPLAY_NAMES` in `lib/plan-display-names.ts` only.
```

---

## 📚 Document Sync + Git Commit (Run After All Tests Pass)

After all Vitest and Playwright tests pass and `npx tsc --noEmit` shows 0 errors:

### Step 1: Update `CLAUDE.md`

Add to the implementation inventory:
```markdown
### Sprint A — Stop the Bleeding (2026-[DATE])
- `lib/plan-display-names.ts` — Shared plan display name mapping + getPlanDisplayName()
- MetricCard: optional `href` prop, Link wrapper, hover state
- Sidebar: NAV_GROUPS with section headers (all 22 items preserved)
- Sentry: [N] bare catch blocks instrumented across [N] files
- SOV cron: orgFailureCount tracking + aggregate summary + Sentry warning
- ViralScanner: scanError state + friendly error UI + retry button
- Chart cards: "View details →" links on 4 dashboard cards
- Tests: [N] Vitest + [N] Playwright
```

### Step 2: Update `MEMORY.md`

```markdown
## Decision: Sentry Instrumentation Pattern (Sprint A — 2026-[DATE])
- All catch blocks use `catch (err)` + `Sentry.captureException(err, { tags: {...} })`
- Client components show degraded state UI on error (never blank)
- Server routes return structured error objects; do not re-throw non-fatal catches
- PII never in Sentry `extra` — UUIDs acceptable, no emails/names/phones

## Decision: Plan Display Names (Sprint A — 2026-[DATE])
- Marketing names (AI Shield, Brand Fortress) are shown to users everywhere
- DB enum values (growth, agency) are unchanged and used only in logic/queries
- Single source of truth: lib/plan-display-names.ts / getPlanDisplayName()
```

### Step 3: Update `AI_RULES.md`

Append Rules 42 and 43 from the **🔮 AI_RULES Update** section above.

### Step 4: Git Commit

```bash
git add -A
git status

git commit -m "Sprint A: Stop the Bleeding — Observability, Trust & First Impressions

- lib/plan-display-names.ts: shared plan display name mapping (AI Shield, Brand Fortress)
- billing/sidebar: plan names now match landing page marketing names
- Sentry: [N] bare catch blocks instrumented ([N] files) — production visibility restored
- SOV cron: orgFailureCount tracking + aggregate failure summary + Sentry warning
- ViralScanner: scanError state + friendly error UI + retry — conversion tool no longer fails silently
- Sidebar: 22 NAV_ITEMS grouped into [N] sections with labeled headers
- MetricCard: href prop + Link wrapper — cards now navigate to detail pages
- Chart cards: View details link on SOVTrendChart, Hallucinations, AIHealth, Reality cards
- Tests: [N] Vitest + [N] Playwright passing, 0 regressions

Fixes: C1 (42 bare catches), C3 (plan names), H3 (SOV cron), H4 (sidebar), H5 (card links), L4 (ViralScanner)
Unblocks: Sprint B (sample data mode + tooltips)"

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint A completes:
- **Production error visibility: 0% → 100%** — every catch block now reports to Sentry. You will see real production failures for the first time.
- **Plan name trust:** Customers who sign up for "AI Shield" now see "AI Shield" in their dashboard, not "Growth Plan."
- **SOV cron reliability:** You can now distinguish a healthy cron run from one that silently failed for 40% of orgs.
- **Sidebar navigability:** First-time users see a logically grouped sidebar instead of 22 undifferentiated items.
- **Dashboard discoverability:** Every MetricCard and chart card now leads somewhere — the dashboard becomes a navigation hub, not a dead end.
- **Conversion tool reliability:** ViralScanner errors are visible to users and captured in Sentry. No more silent conversion kills.
- **Foundation for Sprint B:** With Sentry coverage active, any new issues introduced in Sprint B (sample data mode, tooltips) will be caught immediately.
