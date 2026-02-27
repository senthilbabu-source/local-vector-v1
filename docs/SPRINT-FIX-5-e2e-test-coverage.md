# Sprint FIX-5 — E2E Test Coverage: Sprints 98–101 Features

> **Claude Code Prompt — Bulletproof Production Fix Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** FIX-1 complete (`npx tsc --noEmit` = 0 errors). FIX-3 complete (PlanGate import fixed, crons registered).

---

## 🎯 Objective

Add **Playwright end-to-end tests for Sprints 98–101** — the most complex and business-critical features in LocalVector V1, currently shipped with zero E2E coverage.

**[MEDIUM-2.2]** The E2E suite covers Sprints 1–93. Sprints 98–101 added multi-user invitations, seat-based billing enforcement, multi-location management, and occasion alerts — all features that interact across auth, billing, database, and UI layers simultaneously. Unit tests alone cannot catch the integration failures that will affect real users.

**What has zero E2E coverage today:**

| Sprint | Feature | Risk Without E2E |
|--------|---------|-----------------|
| 98 | Multi-User: Invitations + Role Enforcement | Invite link silently broken; viewer accidentally gets edit rights |
| 99 | Seat-Based Billing + Location Permissions | Seat purchase doesn't trigger access; overage email never sends |
| 100 | Multi-Location Management | Add/archive location crashes; location switcher corrupts active context |
| 101 | Occasion Alerts + Sidebar Badges | Snooze doesn't persist; badge count never increments |

**Why now:** FIX-1 gave us clean types, FIX-3 gave us working imports. The test suite is the final safety net before production traffic. Adding these specs now — before customers touch the product — means every future sprint runs against a verified baseline for the most complex user flows.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing a single test line, read all of these files. Do not skip any.

```
Read docs/AI_RULES.md                                         — All engineering rules, especially §4 (tests first), §13.5 (DoD)
Read CLAUDE.md                                                — Sprint 98-101 implementation inventory; understand what was built
Read MEMORY.md                                                — Key decisions about multi-user, billing, location architecture
Read lib/supabase/database.types.ts                           — Types for invitation, membership, seat, location, badge tables
Read supabase/prod_schema.sql                                 — Schema: memberships, location_permissions, occasion_snoozes, sidebar_badge_state
Read src/__fixtures__/golden-tenant.ts                        — Existing fixtures; understand what's already there
Read playwright.config.ts                                     — Test runner config, baseURL, storageState, timeouts
Read src/__tests__/e2e/                                       — Read ALL existing E2E specs to understand patterns
  § auth.spec.ts                                              — Auth patterns for login helpers
  § gbp-import-flow.spec.ts (Sprint 89)                      — Gold standard for page.route() mocking pattern
  § onboarding.spec.ts                                        — Onboarding flow pattern
Read src/__tests__/e2e/helpers/                               — Auth helpers, fixtures, utilities
  § auth.ts or similar                                        — loginAsGoldenTenant() pattern
Read app/dashboard/team/page.tsx                              — Team management UI (Sprint 98)
Read app/dashboard/team/invite/page.tsx                       — Invitation flow UI (Sprint 98)
Read app/api/invitations/route.ts                             — Invitation API (Sprint 98)
Read app/dashboard/billing/page.tsx                           — Billing + seat management UI (Sprint 99)
Read app/actions/seat-actions.ts                              — Seat purchase/enforcement actions (Sprint 99)
Read app/dashboard/settings/locations/page.tsx                — Location management UI (Sprint 100) — NOTE: default import was fixed in FIX-3
Read app/actions/locations.ts                                 — Location CRUD actions (Sprint 100)
Read app/dashboard/page.tsx                                   — Dashboard with occasions feed + badge counts (Sprint 101)
Read lib/occasions/occasion-feed.ts                           — Occasion feed logic (Sprint 101)
Read lib/badges/badge-counts.ts                               — Badge count logic (Sprint 101)
Read components/layout/Sidebar.tsx                            — Sidebar with badge indicators (Sprint 101)
```

**Run this pre-implementation baseline before writing any code:**

```bash
# 1. Count existing E2E specs
ls src/__tests__/e2e/*.spec.ts | wc -l
# Note this number — you will add 4 new spec files

# 2. Run full existing E2E suite — confirm baseline passes
npx playwright test 2>&1 | tail -10
# Note: X passed, 0 failed — this is your regression baseline

# 3. Confirm Sprint 98-101 features actually exist in the codebase
ls app/dashboard/team/
ls app/dashboard/billing/
ls app/dashboard/settings/locations/
grep -r "occasion_snoozes\|sidebar_badge_state" lib/ --include="*.ts" | wc -l
# Each should show files/counts — if empty, that feature may not have been implemented yet

# 4. Check if a second test user / rival tenant fixture already exists
grep -i "rival\|tenant.*b\|second.*user\|invite.*test" src/__fixtures__/golden-tenant.ts
grep -i "rival\|tenant.*b\|second.*user" playwright.config.ts

# 5. Check what storageState files exist (pre-authenticated sessions)
ls -la src/__tests__/e2e/helpers/ 2>/dev/null || ls -la tests/helpers/ 2>/dev/null
ls *.json 2>/dev/null | grep "auth\|session\|state"
```

---

## 🏗️ Architecture — What to Build

### Setup: Shared Test Infrastructure

Before writing the 4 spec files, confirm or create the shared infrastructure that all specs depend on.

#### Confirm: `src/__tests__/e2e/helpers/auth.ts`

Check if `loginAsGoldenTenant()` already exists. If not, create it:

```typescript
// src/__tests__/e2e/helpers/auth.ts
import { Page } from '@playwright/test';

/**
 * Logs in as the golden tenant (Charcoal N Chill) owner.
 * Uses Supabase auth — mocks the session if real auth is unavailable in CI.
 * org_id: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
 */
export async function loginAsGoldenTenant(page: Page): Promise<void> {
  // Check if storageState already has a valid session
  // If so, just navigate to dashboard and verify session
  await page.goto('/dashboard');
  
  // If redirected to /login, perform login
  if (page.url().includes('/login')) {
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL ?? 'owner@charcoalnchill.com');
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD ?? 'test-password-dev');
    await page.click('[data-testid="sign-in-btn"]');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  }
}

/**
 * Logs in as a second test user (member/viewer role in golden tenant).
 * Used for testing role enforcement — this user cannot perform admin actions.
 */
export async function loginAsGoldenTenantMember(page: Page): Promise<void> {
  await page.goto('/dashboard');
  if (page.url().includes('/login')) {
    await page.fill('[data-testid="email-input"]', process.env.TEST_MEMBER_EMAIL ?? 'member@charcoalnchill.com');
    await page.fill('[data-testid="password-input"]', process.env.TEST_MEMBER_PASSWORD ?? 'test-password-dev');
    await page.click('[data-testid="sign-in-btn"]');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  }
}
```

**NOTE:** If real Supabase auth doesn't work in the test environment (local CI, no real DB), use `page.route()` to mock the auth API. Look at how `gbp-import-flow.spec.ts` mocks `/api/` calls and apply the same pattern to auth responses.

#### Confirm: `RIVAL_TENANT` fixture

Multi-user and invitation tests need a second org to test isolation. Check if one exists:

```typescript
// In src/__fixtures__/golden-tenant.ts, add if not present:
export const RIVAL_TENANT = {
  org_id: 'b1ffcd00-9c0b-4ef8-bb6d-7bb9bd380b22', // rival org for isolation tests
  org_name: 'Rival Hookah Lounge',
  owner_email: 'rival@test.com',
} as const;
```

---

### Spec 1: `src/__tests__/e2e/multi-user-invitations.spec.ts`

**Sprint 98 — Multi-User: Invitations + Role Enforcement**

```
describe('Multi-User Invitations and Role Enforcement (Sprint 98)')

  describe('Invitation Flow')
    1.  owner navigates to /dashboard/team — sees team members list and "Invite Member" button
    2.  owner sends invitation — fills email + role dropdown (viewer/editor/admin), submits
    3.  invitation appears in "Pending Invitations" list immediately after sending
    4.  invitation email triggers (mock /api/invitations POST and verify request payload)
    5.  invited user visits accept link — lands on /invite/[token] page with org name visible
    6.  invited user accepts invitation — is redirected to dashboard and sees correct org context
    7.  accepted invitation disappears from pending list; new member appears in members list

  describe('Role Enforcement')
    8.  viewer role: member logs in — "Edit" buttons on business info page are absent or disabled
    9.  viewer role: member navigates to /dashboard/settings/locations — cannot access or sees read-only view
    10. admin role: member logs in — "Invite Member" button IS visible on team page
    11. owner cannot be removed: "Remove" button absent for the owner row in member list
    12. cross-org: member cannot see another org's team page (navigating directly by URL returns 403 or redirects)
```

**Mocking strategy:**
- Mock `/api/invitations` POST to return `{ ok: true, invitation_id: 'inv-123' }` and `{ invitation_token: 'tok-abc' }`.
- Mock `/api/invitations/[token]` GET to return the invitation details.
- Mock `/api/invitations/[token]/accept` POST to return `{ ok: true }`.
- Do NOT make real database calls — all Supabase API calls from the page are intercepted via `page.route('**/rest/v1/**', ...)`.

**`data-testid` attributes required** (add to components if missing):
- `[data-testid="invite-member-btn"]` — Invite Member button on team page
- `[data-testid="invite-email-input"]` — Email input in invite modal
- `[data-testid="invite-role-select"]` — Role dropdown in invite modal
- `[data-testid="invite-submit-btn"]` — Submit invite button
- `[data-testid="pending-invitations-list"]` — List of pending invites
- `[data-testid="members-list"]` — Current members list
- `[data-testid="member-remove-btn"]` — Remove button on a member row

**12 tests total.**

---

### Spec 2: `src/__tests__/e2e/seat-billing.spec.ts`

**Sprint 99 — Seat-Based Billing + Location Permissions**

```
describe('Seat-Based Billing and Access Enforcement (Sprint 99)')

  describe('Seat Purchase Flow')
    1.  owner on Starter plan visits /dashboard/billing — sees "Add Seat" button
    2.  owner clicks "Add Seat" — Stripe checkout or seat increment modal appears
    3.  seat purchase succeeds (mock Stripe API) — seat_limit increments in UI
    4.  seat count displayed matches expected value after purchase

  describe('Seat Limit Enforcement')
    5.  owner at seat_limit attempts to invite a new member — sees "Seat limit reached" error
    6.  "Seat limit reached" error includes a "Upgrade" or "Add Seat" CTA
    7.  owner who adds a seat beyond limit sees overage warning banner on billing page

  describe('Location Permissions')
    8.  member with limited location_permissions cannot see restricted locations in switcher
    9.  member with full permissions sees all locations in switcher
    10. admin can grant location access to a member from settings page

  describe('Billing Page Accuracy')
    11. billing page shows correct seat_limit, current member count, and plan name
    12. overage_since date displayed correctly when seat_overage_since is set
```

**Mocking strategy:**
- Mock Stripe API calls — `page.route('**/checkout/**', ...)` and any Stripe JS SDK calls.
- Mock Supabase `organizations` select to return different `seat_limit`/`seat_overage_count` values per test.
- Mock `seat-actions.ts` server action responses via API route mocking.

**`data-testid` attributes required:**
- `[data-testid="add-seat-btn"]` — Add seat CTA on billing page
- `[data-testid="seat-count-display"]` — Current seat count indicator
- `[data-testid="seat-limit-error"]` — Error shown when at limit
- `[data-testid="overage-warning-banner"]` — Overage warning on billing page
- `[data-testid="location-switcher"]` — Location switcher in sidebar/header

**12 tests total.**

---

### Spec 3: `src/__tests__/e2e/multi-location-management.spec.ts`

**Sprint 100 — Multi-Location Management**

```
describe('Multi-Location Management (Sprint 100)')

  describe('Locations Settings Page — /dashboard/settings/locations')
    1.  Agency-tier owner visits /dashboard/settings/locations — page renders (not blank, not crashed)
        NOTE: This test specifically guards against the FIX-3 PlanGate import regression
    2.  locations list shows at least one location (golden tenant's primary location)
    3.  primary location shows a "Primary" badge and no "Set as Primary" button
    4.  non-primary location shows "Set as Primary" button

  describe('Add Location')
    5.  owner clicks "Add Location" — modal or form appears
    6.  owner fills in location name, submits — new location appears in list
    7.  adding a location at Agency plan limit shows "Plan limit reached" message

  describe('Archive Location')
    8.  owner clicks archive on a non-primary location — confirmation dialog appears
    9.  owner confirms archive — location moves to "Archived" section or disappears from active list
    10. archived location does not appear in the location switcher

  describe('Location Switcher')
    11. clicking a location in the switcher changes the active location context
    12. page title or breadcrumb reflects the newly active location after switching
    13. switching to an archived location via direct URL is blocked (redirects or 404)

  describe('Plan Gating')
    14. Starter-tier user navigating to /dashboard/settings/locations sees upgrade prompt (not crash)
```

**Critical guard:** Test 1 (`page renders, not blank, not crashed`) is specifically a regression test for the FIX-3 PlanGate import fix. It must check:
```typescript
// Test 1 implementation:
await page.goto('/dashboard/settings/locations');
await page.waitForLoadState('networkidle');
// Must NOT see error boundary or blank screen:
await expect(page.locator('[data-testid="locations-page"]')).toBeVisible();
await expect(page.locator('text=Error')).not.toBeVisible();
await expect(page.locator('text=Cannot read properties')).not.toBeVisible();
```

**`data-testid` attributes required:**
- `[data-testid="locations-page"]` — Root container of locations settings page
- `[data-testid="add-location-btn"]` — Add location button
- `[data-testid="location-item"]` — Each location row (use `page.locator().nth()`)
- `[data-testid="primary-badge"]` — Primary location badge
- `[data-testid="set-primary-btn"]` — Set as primary button
- `[data-testid="archive-location-btn"]` — Archive button on location
- `[data-testid="archive-confirm-btn"]` — Confirmation button in archive dialog

**14 tests total.**

---

### Spec 4: `src/__tests__/e2e/occasion-alerts-badges.spec.ts`

**Sprint 101 — Occasion Alerts + Sidebar Badges**

```
describe('Occasion Alerts and Sidebar Badge Indicators (Sprint 101)')

  describe('Occasion Feed on Dashboard')
    1.  dashboard loads and occasions feed section is visible
    2.  occasion card displays occasion name, date, and suggested action
    3.  occasions are sorted by upcoming date (nearest first)
    4.  empty state displays correctly when no upcoming occasions
    5.  clicking "View Details" on an occasion navigates to the correct detail page

  describe('Snooze Behavior')
    6.  clicking "Snooze" on an occasion shows snooze duration options (1 day, 1 week, 1 month)
    7.  selecting a snooze duration removes the occasion from the feed immediately
    8.  snoozed occasion does NOT reappear on page refresh (persistence check)
    9.  snooze count increments visually or in a "snoozed N times" indicator

  describe('Sidebar Badge Indicators')
    10. sidebar shows a badge count on the "Occasions" nav item when there are active occasions
    11. badge count matches the number of unread/active occasions visible in the feed
    12. badge disappears (or decrements) after all occasions on the feed are snoozed
    13. badge count does not increment infinitely — snoozing one then visiting again shows correct count

  describe('Cross-User Badge Isolation')
    14. switching to a second logged-in user shows THEIR badge count, not the first user's
```

**Mocking strategy:**
- Mock Supabase `/rest/v1/occasion_snoozes` PATCH/POST to simulate snooze persistence.
- Mock Supabase `/rest/v1/sidebar_badge_state` to simulate badge state reads.
- Return different occasion arrays per test using `page.route('**/rest/v1/local_occasions**', ...)`.
- Test 8 (persistence check): after snooze, call `page.reload()` and then re-mock the snooze GET to return the snoozed record. Verify the occasion is not re-rendered.

**`data-testid` attributes required:**
- `[data-testid="occasions-feed"]` — Occasion feed section on dashboard
- `[data-testid="occasion-card"]` — Individual occasion card (use `nth()`)
- `[data-testid="occasion-snooze-btn"]` — Snooze button on an occasion card
- `[data-testid="snooze-1day"]`, `[data-testid="snooze-1week"]`, `[data-testid="snooze-1month"]` — Duration options
- `[data-testid="occasions-nav-badge"]` — Badge count on sidebar nav item
- `[data-testid="occasions-empty-state"]` — Empty state when no occasions

**14 tests total.**

---

## 🧪 Full Test Count Summary

| Spec File | Tests |
|-----------|-------|
| `multi-user-invitations.spec.ts` | 12 |
| `seat-billing.spec.ts` | 12 |
| `multi-location-management.spec.ts` | 14 |
| `occasion-alerts-badges.spec.ts` | 14 |
| **Total new** | **52** |

**Plus:** Any `data-testid` attributes added to component files are verified as part of the specs — if a `data-testid` is missing, the test fails with a clear selector error.

---

## 🧠 Edge Cases to Handle

1. **No DB / CI environment:** All Supabase API calls (`/rest/v1/`, `/auth/v1/`) must be intercepted via `page.route()`. Never assume a real database is available during E2E runs.
2. **Timing/race conditions in badge counts:** Badge count increments are async (may be behind a cache or polling interval). Use `page.waitForSelector('[data-testid="occasions-nav-badge"]:has-text("3")')` with a reasonable timeout (5s) rather than asserting immediately.
3. **Location switcher state:** After switching locations, the dashboard re-fetches data. Use `page.waitForResponse('**/rest/v1/locations**')` before asserting the new location context.
4. **Invitation token format:** If the token is a UUID or JWT, the mock `page.route` for `/invite/[token]` must use a glob pattern: `'**/invite/**'`.
5. **Stripe redirect:** Stripe Checkout uses a redirect, not a modal. If using Stripe Checkout (not Elements), mock `page.route('**/checkout.stripe.com/**', ...)` to immediately redirect back with `?session_id=mock`.
6. **Existing `data-testid` gaps:** If a required `data-testid` attribute is missing from a component, you MUST add it to the component file. Do not use text-content selectors or CSS class selectors as a workaround — `data-testid` selectors are required per AI_RULES for E2E test stability.
7. **Archived location URL access (Test 13 in location spec):** The route handler for `/dashboard/settings/locations/[id]` must check `is_archived`. If the check doesn't exist, note it in the DEVLOG but don't implement it in this sprint — just mark the test as `test.skip` with a comment citing the gap.
8. **Snooze persistence test (Test 8):** Page reload will re-run the Supabase fetch. You must re-establish the `page.route()` mock AFTER reload to return the snoozed state. Use `page.route()` inside the test after `await page.reload()`.

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/__tests__/e2e/multi-user-invitations.spec.ts` | **CREATE** | 12 E2E tests — Sprint 98 invitation + role flows |
| 2 | `src/__tests__/e2e/seat-billing.spec.ts` | **CREATE** | 12 E2E tests — Sprint 99 seat billing flows |
| 3 | `src/__tests__/e2e/multi-location-management.spec.ts` | **CREATE** | 14 E2E tests — Sprint 100 location management |
| 4 | `src/__tests__/e2e/occasion-alerts-badges.spec.ts` | **CREATE** | 14 E2E tests — Sprint 101 occasions + badges |
| 5 | `src/__tests__/e2e/helpers/auth.ts` | **CREATE or VERIFY** | loginAsGoldenTenant() + loginAsGoldenTenantMember() |
| 6 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add RIVAL_TENANT fixture if not present |
| 7–N | Various component files (`app/dashboard/team/`, `app/dashboard/billing/`, `app/dashboard/settings/locations/`, `app/dashboard/_components/`) | **MODIFY** | Add missing `data-testid` attributes |

**Important rule on component modifications:** Only add `data-testid="..."` attributes to existing JSX elements. Do NOT change component logic, styling, or structure. These are strictly additive changes.

---

## 🚫 What NOT to Do

1. **DO NOT make real API or database calls in any test** — all `/rest/v1/`, `/auth/v1/`, Stripe, and external calls are intercepted via `page.route()`.
2. **DO NOT use `page.waitForTimeout()`** — use event-driven waits: `page.waitForSelector()`, `page.waitForResponse()`, `page.waitForURL()`, `page.waitForLoadState()`.
3. **DO NOT use CSS class selectors** like `.btn-primary` or `div.location-row` — these break when Tailwind classes change. Only `data-testid` and ARIA role selectors are stable.
4. **DO NOT use text-content selectors** like `text=Add Location` as the primary selector — add `data-testid` instead and use text as a secondary assertion.
5. **DO NOT test the happy path only** — each spec must include at least 2–3 error/edge-case tests (limit reached, wrong role, empty state).
6. **DO NOT modify any existing passing E2E spec** — only add new files.
7. **DO NOT skip test setup/teardown** — each `describe` block must clean up its `page.route()` intercepts if they could interfere with subsequent tests.
8. **DO NOT hard-code org IDs or user IDs** in test assertions — import from `golden-tenant.ts` fixtures.
9. **DO NOT implement missing backend features** — if a feature (e.g., archived location URL guard) doesn't exist yet, use `test.skip('reason')` and log it in the DEVLOG. This sprint adds tests only.
10. **DO NOT add `data-testid` with dynamic values** like `data-testid={`location-${id}`}` for the primary selector — use `data-testid="location-item"` and `page.locator('[data-testid="location-item"]').nth(0)` in tests.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `src/__tests__/e2e/multi-user-invitations.spec.ts` — **12 tests passing**
- [ ] `src/__tests__/e2e/seat-billing.spec.ts` — **12 tests passing**
- [ ] `src/__tests__/e2e/multi-location-management.spec.ts` — **14 tests passing** (including PlanGate regression guard)
- [ ] `src/__tests__/e2e/occasion-alerts-badges.spec.ts` — **14 tests passing**
- [ ] All `data-testid` attributes added to component files
- [ ] `src/__tests__/e2e/helpers/auth.ts` — `loginAsGoldenTenant()` and `loginAsGoldenTenantMember()` working
- [ ] `src/__fixtures__/golden-tenant.ts` — `RIVAL_TENANT` fixture present
- [ ] All 52 new tests pass: `npx playwright test src/__tests__/e2e/multi-user-invitations.spec.ts src/__tests__/e2e/seat-billing.spec.ts src/__tests__/e2e/multi-location-management.spec.ts src/__tests__/e2e/occasion-alerts-badges.spec.ts`
- [ ] Existing E2E suite still passes: `npx playwright test` — no regressions in existing specs
- [ ] `npx tsc --noEmit` — 0 errors (inherited from FIX-1, must not regress)
- [ ] `npx vitest run` — all unit tests still passing
- [ ] Any skipped tests have `test.skip('reason: [specific gap]')` and a DEVLOG note
- [ ] DEVLOG.md entry written with actual test counts

---

## 🔮 AI_RULES Update (Append to `docs/AI_RULES.md`)

```markdown
## §57. E2E Test Coverage Requirements (FIX-5)

Every sprint that ships user-facing features must include E2E tests before the sprint is considered complete.

**Required coverage per sprint:**
- At minimum 1 happy-path test for each new user-visible flow
- At minimum 1 error/edge-case test per new API endpoint
- At minimum 1 regression test for any feature fixed in a prior sprint

**Selector rules (enforced):**
- All E2E selectors use `data-testid` attributes — no CSS class selectors, no text selectors as primary selectors
- `data-testid` attributes are added alongside component code — not retroactively

**Mocking rules:**
- All Supabase `/rest/v1/` calls are mocked in E2E via `page.route()`
- All external API calls (Stripe, GBP, Anthropic) are mocked in E2E via `page.route()`
- `page.waitForTimeout()` is forbidden — use event-driven waits only

**Sprint E2E gaps:** Sprints 98–101 have full E2E coverage as of FIX-5. Sprints 102+ must ship with E2E on day one.
```

---

## 📓 DEVLOG Entry Format

```markdown
## [DATE] — Sprint FIX-5: E2E Test Coverage — Sprints 98–101 (Completed)

**Problem:**
- Sprints 98-101 (multi-user, seat billing, multi-location, occasions) shipped with zero E2E coverage.
- Sprint 100's locations page had a silent crash (PlanGate import error, fixed in FIX-3) — E2E would have caught this before production.

**Solution:**
4 new Playwright spec files covering all 4 sprints. All Supabase and external API calls mocked via page.route().

**Tests added:**
- `src/__tests__/e2e/multi-user-invitations.spec.ts` — **12 Playwright tests.** Invitation send/accept flow, role enforcement (viewer/admin/owner), cross-org isolation.
- `src/__tests__/e2e/seat-billing.spec.ts` — **12 Playwright tests.** Seat purchase, limit enforcement, overage banner, location permissions.
- `src/__tests__/e2e/multi-location-management.spec.ts` — **14 Playwright tests.** Page render (PlanGate regression guard), add/archive location, switcher, plan gating.
- `src/__tests__/e2e/occasion-alerts-badges.spec.ts` — **14 Playwright tests.** Occasion feed, snooze persistence, sidebar badge counts, cross-user isolation.

**Components modified (data-testid only):**
- [List each component file and which data-testid attrs were added]

**Skipped tests (if any):**
- [List any test.skip() with reason]

**Result:** 52 new E2E tests passing. All N existing E2E tests still passing. No regressions.
```

---

## 📚 Document Sync + Git Commit

**Step 1: Update `docs/CLAUDE.md`**
```markdown
### Sprint FIX-5 — E2E Test Coverage Sprints 98-101 ([DATE])
- src/__tests__/e2e/multi-user-invitations.spec.ts — 12 tests (Sprint 98)
- src/__tests__/e2e/seat-billing.spec.ts — 12 tests (Sprint 99)
- src/__tests__/e2e/multi-location-management.spec.ts — 14 tests (Sprint 100, PlanGate regression guard)
- src/__tests__/e2e/occasion-alerts-badges.spec.ts — 14 tests (Sprint 101)
- data-testid attributes added across team, billing, location, dashboard components
```

**Step 2: Git commit**
```bash
git add -A
git status  # Verify: 4 new spec files, helpers, fixtures, component data-testid additions
git commit -m "FIX-5: E2E test coverage for Sprints 98-101

- multi-user-invitations.spec.ts: 12 tests (invite flow, role enforcement, isolation)
- seat-billing.spec.ts: 12 tests (seat purchase, limit enforcement, permissions)
- multi-location-management.spec.ts: 14 tests (page render, add/archive, switcher, plan gate)
  includes PlanGate regression guard from FIX-3
- occasion-alerts-badges.spec.ts: 14 tests (feed, snooze persistence, badges, isolation)
- data-testid attributes added to team/billing/location/dashboard components
- AI_RULES: §57 E2E coverage requirements

52 new Playwright tests passing. All existing specs unaffected."
git push origin main
```

---

## 🏁 Sprint Outcome

After FIX-5 completes:
- **52 new E2E tests** covering Sprints 98–101 — the four most complex feature sets in LocalVector V1
- The PlanGate regression (FIX-3) is permanently protected by Test 1 in the location spec
- Every Sprint 102+ feature has a clear test pattern to follow
- Total E2E coverage: 23 existing + 52 new = **75 Playwright tests** protecting the full platform

**This sprint unblocks:** FIX-6 (documentation) — the final cleanup sprint before production readiness sign-off.
