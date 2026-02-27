# Sprint 100 — Multi-Location Management

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Complete the Agency tier's operational backbone by delivering **full multi-location management** — the ability for an agency owner to add, edit, switch between, and independently operate up to 10 client locations from a single dashboard.

Today the `LocationSwitcher` dropdown exists (Sprint 27A) and a cookie-based org selection mechanism is partially in place, but:
- There is **no add/edit location form** — you cannot create a second location
- There is **no location-scoped data isolation verification** — it's untested whether switching locations actually scopes all data correctly
- There is **no agency org-switching UI** — an agency user managing multiple client orgs has no way to jump between them

This sprint delivers all three in full production-quality form.

**Four deliverables:**

1. **Add / Edit Location Form** — A full CRUD form for locations under an Agency org. Name, address, phone, website, hours, category, amenities. Reuses the `TruthCalibrationForm` from onboarding (Sprint 91) and Business Info Editor (Sprint 93) so there is zero duplication.

2. **Location-Scoped Data Isolation Verification** — A systematic audit of every dashboard data query to confirm that switching location truly scopes the data. Fix any gaps found. Add integration tests that prove isolation.

3. **Agency Org-Switching UI** — For users who belong to multiple orgs (accepted via Sprint 98 invitations), a clean UI to switch the active org context. The active org is stored in a server-side cookie (never URL params — AI_RULES §18).

4. **Location Management Page** — `/dashboard/settings/locations` — list all locations, add/edit/archive, set primary, see per-location health at a glance.

**Gap being closed:** Feature #57 — Multi-Location (Agency), 40% → 100%.

**Effort:** M (Medium — 4–8 hours). The form reuse strategy keeps this lean. The isolation audit is methodical but not complex. The org-switcher is a focused UI component.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order without exception.

```
Read docs/AI_RULES.md                                         — All rules (§52+ after Sprint 99)
Read CLAUDE.md                                                — Full inventory, location patterns
Read MEMORY.md                                                — Prior decisions on location, cookies, org context
Read supabase/prod_schema.sql                                 — Find: locations table (ALL columns),
                                                                orgs table, org_members, location_permissions,
                                                                ANY existing location-related tables
Read lib/database.types.ts                                    — TypeScript types (needs updating for new columns)
Read src/__fixtures__/golden-tenant.ts                        — Golden Tenant: org_id a0eebc99, 1 location
Read lib/supabase/server.ts                                   — createClient() + createServiceRoleClient()
Read lib/supabase/middleware.ts                               — Auth middleware (DO NOT EDIT — AI_RULES §6)
Read components/layout/LocationSwitcher.tsx                   — Existing switcher — read EVERY line
Read app/onboarding/page.tsx                                  — TruthCalibrationForm usage during onboarding
Read app/dashboard/settings/                                  — Business Info Editor (Sprint 93)
Read components/forms/TruthCalibrationForm.tsx                — The reusable form component (if it exists)
  OR app/onboarding/_components/TruthCalibrationForm.tsx      — Try both paths
Read app/actions/business-info.ts                             — Sprint 93 server actions for location updates
Read app/dashboard/                                           — ALL pages — understand location_id scoping
Read lib/auth/location-permissions.ts                         — Sprint 99 location role resolution
Read lib/auth/org-roles.ts                                    — Sprint 98 role enforcement
Read app/api/cron/                                            — Cron patterns (location-aware crons)
Read docs/MULTI-USER_AGENCY_WHITE_LABEL.md                    — Original multi-location spec
```

**Specifically understand before writing code:**

1. What columns does the `locations` table have? Does it have `is_primary`, `is_archived`, `order`, `slug`? These determine what the management page can display without new migrations.
2. How does `LocationSwitcher` currently store the active location? Cookie name? Cookie value format (location ID? slug?)? Server-side or client-side cookie?
3. How do dashboard pages currently read the active location? From the cookie? From a context provider? From a server action? Trace the exact flow.
4. Does `TruthCalibrationForm` exist as a standalone reusable component, or is it inlined in the onboarding page? If inlined, the first task of this sprint is to extract it.
5. Does an org have a hard limit on location count? Is it enforced anywhere? What does the Agency plan allow?
6. How does the existing "Add Location" plan-gated button work — what happens when you click it today?
7. Are there any existing `location_id` filters missing from dashboard queries that Sprint 99 didn't catch? The isolation audit will find them.
8. How is `orgId` threaded through the system today — session only, or is there any place it leaks through URL params? (AI_RULES §18 compliance check.)

---

## 🏗️ Architecture — What to Build

---

### PART 1: Database Schema

#### Migration 1: Location management columns

```sql
-- ============================================================
-- Migration: XXXX_multi_location_management.sql
-- ============================================================

-- -------------------------------------------------------
-- 1. Location management columns
--    Read prod_schema.sql first — only add columns that
--    do not already exist.
-- -------------------------------------------------------

-- is_primary: exactly one location per org should be primary.
-- The primary location is the default for new users and reports.
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS is_primary   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name text,        -- Optional override for UI display
  ADD COLUMN IF NOT EXISTS timezone     text,        -- IANA timezone string (e.g. 'America/New_York')
  ADD COLUMN IF NOT EXISTS location_order integer DEFAULT 0;  -- Display sort order

COMMENT ON COLUMN locations.is_primary IS
  'Exactly one location per org should have is_primary=true.
   Enforced by trigger below. Primary location is the default dashboard view.';

COMMENT ON COLUMN locations.is_archived IS
  'Archived locations are hidden from the switcher and dashboard by default.
   Data is preserved. Not deleted. Can be unarchived.';

-- -------------------------------------------------------
-- 2. Ensure exactly one primary per org (partial unique index)
-- -------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_one_primary_per_org
  ON locations(org_id)
  WHERE is_primary = true AND is_archived = false;

-- -------------------------------------------------------
-- 3. Backfill: set existing single locations as primary
-- -------------------------------------------------------
UPDATE locations SET is_primary = true
WHERE id IN (
  SELECT DISTINCT ON (org_id) id
  FROM locations
  ORDER BY org_id, created_at ASC
);
-- This sets the OLDEST location per org as primary.
-- For orgs with multiple locations already (shouldn't exist yet), picks oldest.

-- -------------------------------------------------------
-- 4. Location count limit enforcement
--    Max 10 locations per Agency org in V1.
--    Enforced at application layer (not DB constraint) for flexibility.
--    Document the limit here as a comment for reference.
-- -------------------------------------------------------
-- V1 LIMIT: 10 active (non-archived) locations per Agency org.
-- Enforced in addLocation() server action.
-- Rationale: keeps query complexity manageable; Agency clients needing 10+ are Enterprise.

-- -------------------------------------------------------
-- 5. Org-level active location cookie tracking
--    Store the user's last-selected location per org in a
--    server-side cookie. No DB column needed — cookie is the source.
--    (Documented here for reference — no SQL needed.)
-- -------------------------------------------------------
-- Cookie name: lv_active_location_{orgId}
-- Cookie value: locations.id (UUID)
-- HttpOnly: true, SameSite: Lax, Path: /dashboard
-- Max-age: 30 days
-- Set by: setActiveLocation() server action
-- Read by: getActiveLocation() utility in lib/location/active-location.ts

-- -------------------------------------------------------
-- 6. Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_locations_org_id_active
  ON locations(org_id)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_locations_is_primary
  ON locations(org_id, is_primary)
  WHERE is_primary = true;
```

---

### PART 2: Active Location Management

#### `lib/location/active-location.ts`

**Server-side active location resolution.** This is the single source of truth for "which location is the current user viewing."

```typescript
/**
 * Active Location — server-side resolution utility.
 *
 * Resolution order (first match wins):
 * 1. Cookie: lv_active_location_{orgId} (HttpOnly, server-side set)
 * 2. Primary location for the org (is_primary = true)
 * 3. First created location (created_at ASC)
 * 4. null (org has no locations — onboarding incomplete)
 *
 * NEVER reads from URL params or query strings (AI_RULES §18).
 * NEVER exposes raw location IDs in public URLs.
 *
 * Cookie strategy:
 * - One cookie per org: lv_active_location_{orgId}
 * - Value: location UUID
 * - HttpOnly, SameSite=Lax, Path=/dashboard, MaxAge=30 days
 * - Set server-side only (via setActiveLocation action)
 * - Client cannot read or set (HttpOnly)
 */

/** Cookie name for a given org */
export function getActiveLocationCookieName(orgId: string): string

/**
 * Returns the active location ID for the current user + org.
 * Uses the resolution order above.
 * Validates that the resolved location actually belongs to the org
 * (cookie tampering protection).
 *
 * @param orgId — from session (never from URL)
 * @returns locationId string or null
 */
export async function getActiveLocationId(
  supabase: SupabaseClient,
  orgId: string
): Promise<string | null>

/**
 * Returns the full active location row.
 * Convenience wrapper around getActiveLocationId + a DB fetch.
 */
export async function getActiveLocation(
  supabase: SupabaseClient,
  orgId: string
): Promise<Location | null>

/**
 * Sets the active location cookie (server-side).
 * Validates locationId belongs to orgId before setting.
 * Called by the LocationSwitcher server action.
 *
 * @param orgId — from session
 * @param locationId — the location to activate
 */
export async function setActiveLocationCookie(
  supabase: SupabaseClient,
  orgId: string,
  locationId: string
): Promise<{ success: boolean; error?: string }>
```

---

### PART 3: Location Server Actions

#### `app/actions/locations.ts`

```typescript
'use server'

/**
 * addLocation
 * Creates a new location under the current org.
 *
 * Checks (in order):
 * 1. orgId from session — never from args (AI_RULES §18)
 * 2. assertOrgRole('admin') — admin+ can add locations
 * 3. planSatisfies('agency') — multi-location is Agency only
 * 4. Active location count < 10 (V1 limit)
 * 5. Validate all required fields (name, address, city, state)
 * 6. Validate phone format if provided (E.164 or standard US)
 * 7. Validate URL format if website provided
 * 8. Insert location row with org_id from session
 * 9. If this is the first location: set is_primary = true
 * 10. Revalidate /dashboard/settings/locations
 * 11. Return { success, locationId, location }
 *
 * Input type: LocationFormInput (see below)
 */
export async function addLocation(
  input: LocationFormInput
): Promise<{ success: boolean; error?: string; locationId?: string; location?: Location }>

/**
 * updateLocation
 * Updates an existing location's details.
 *
 * Checks:
 * 1. orgId from session
 * 2. assertOrgRole('admin')
 * 3. Verify locationId belongs to org (prevent cross-org update)
 * 4. Validate input fields
 * 5. Update location row
 * 6. Touch llms_txt_updated_at (triggers llms.txt cache bust — Sprint 97)
 * 7. Revalidate affected paths
 */
export async function updateLocation(
  locationId: string,
  input: Partial<LocationFormInput>
): Promise<{ success: boolean; error?: string }>

/**
 * archiveLocation
 * Archives (soft-delete) a location.
 * Cannot archive the primary location — must set a new primary first.
 * Cannot archive if it's the only non-archived location.
 * Sets is_archived=true, removes from switcher.
 * Data (audits, SOV, citations) is preserved.
 */
export async function archiveLocation(
  locationId: string
): Promise<{ success: boolean; error?: string }>

/**
 * setPrimaryLocation
 * Sets a location as the primary location for the org.
 * Clears is_primary on the previous primary atomically (single UPDATE with CASE).
 * Owner only — changing primary affects all users in the org.
 */
export async function setPrimaryLocation(
  locationId: string
): Promise<{ success: boolean; error?: string }>

/**
 * switchActiveLocation
 * Sets the active location cookie for the current user.
 * Called by the LocationSwitcher component.
 * Validates that locationId belongs to the user's current org.
 * Also verifies the user has at least viewer access to the location
 * (respects location_permissions from Sprint 99).
 */
export async function switchActiveLocation(
  locationId: string
): Promise<{ success: boolean; error?: string }>

/**
 * LocationFormInput — shared type for add + update
 */
export interface LocationFormInput {
  name: string                    // required
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  website?: string
  primary_category?: string
  display_name?: string           // Optional UI override for agency client name
  timezone?: string               // IANA timezone string
  hours_data?: HoursData          // Same format as TruthCalibrationForm
  amenities?: Record<string, boolean>
  operational_status?: 'open' | 'closed_permanently' | 'closed_temporarily'
}
```

---

### PART 4: Form Component Extraction + Reuse

#### Step 4A — Extract `TruthCalibrationForm`

Before building the location management UI, determine whether `TruthCalibrationForm` is already a standalone reusable component.

```bash
# Run this in the diagnosis step:
find app components lib -name "TruthCalibrationForm*" -o -name "truth-calibration*" 2>/dev/null
grep -r "TruthCalibrationForm\|TruthCalibration" app/ components/ --include="*.tsx" -l
```

**If it exists as a standalone component:** Import it directly. Skip extraction.

**If it is inlined in `app/onboarding/page.tsx` or `app/dashboard/settings/page.tsx`:**

Extract it to `components/forms/TruthCalibrationForm.tsx` with these props:

```typescript
interface TruthCalibrationFormProps {
  /** Initial values to populate the form (for edit mode) */
  initialValues?: Partial<LocationFormInput>
  /** Called on successful submit with the validated form data */
  onSubmit: (data: LocationFormInput) => Promise<void>
  /** Submit button label — "Save Changes" for edit, "Add Location" for create */
  submitLabel?: string
  /** Whether to show all fields or just essential ones (onboarding uses minimal mode) */
  mode?: 'full' | 'essential'
  /** Whether form is in a loading/submitting state */
  isSubmitting?: boolean
  /** Error message to display below the form */
  error?: string
  /** Success message */
  success?: string
}
```

⚠️ When extracting: do NOT change the form's internal logic or validation. Copy-extract only. Verify the onboarding page and Business Info Editor still work after extraction by running their E2E tests.

---

### PART 5: Location Management Page

#### `app/dashboard/settings/locations/page.tsx`

New settings sub-page at `/dashboard/settings/locations`. Agency plan only.

```typescript
/**
 * Location Management Page
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────┐
 * │ Locations                              [Add Location]│
 * │ Manage your client locations           (admin+ only) │
 * ├─────────────────────────────────────────────────────┤
 * │ ● Charcoal N Chill          [Primary] [Edit] [...]  │
 * │   Alpharetta, GA · 4 audits this week               │
 * ├─────────────────────────────────────────────────────┤
 * │   Downtown Hookah Bar                 [Edit] [...]  │
 * │   Atlanta, GA · 2 audits this week    [Set Primary] │
 * ├─────────────────────────────────────────────────────┤
 * │ [+ Add Location]  (3 of 10 locations used)          │
 * └─────────────────────────────────────────────────────┘
 *
 * Per-location stats shown (fetched in parallel):
 * - Audit count this week (from ai_audits)
 * - Reality Score (from visibility_analytics, latest)
 * - Hallucination count (from ai_audits where is_hallucination=true)
 *
 * Actions per row:
 * - Edit → opens inline edit form or navigates to edit page
 * - [...] overflow menu: Set Primary, Archive, View Dashboard
 *
 * Add Location:
 * - Opens a slide-over panel (not a new page) with TruthCalibrationForm
 * - On success: new row appears in list without full page reload
 * - On limit reached (10/10): button disabled + tooltip "Upgrade for more locations"
 *
 * Plan gate:
 * - Starter/Growth/Professional: show <PlanGate requiredPlan="agency"> over the list
 * - Agency plan: full access
 *
 * data-testid values:
 * - locations-page
 * - location-list
 * - location-row-[locationId]
 * - location-primary-badge-[locationId]
 * - location-edit-btn-[locationId]
 * - location-overflow-menu-[locationId]
 * - location-set-primary-btn-[locationId]
 * - location-archive-btn-[locationId]
 * - location-add-btn
 * - location-count-display         ("3 of 10 locations used")
 * - location-add-panel             (slide-over)
 * - location-form-submit-btn
 * - location-form-error
 * - location-form-success
 */
```

---

### PART 6: LocationSwitcher Enhancement

#### Extend `components/layout/LocationSwitcher.tsx`

The existing switcher shows location names but has these gaps:
- Clicking a location calls an unknown mechanism — verify and standardize to `switchActiveLocation()` server action
- No visual indicator of the currently active location beyond what's selected in the dropdown
- No "Manage Locations" link at the bottom of the dropdown (add for Agency orgs)
- No handling for archived locations (must be filtered out)

```typescript
/**
 * Enhanced LocationSwitcher:
 *
 * 1. Reads active location from server-side cookie via getActiveLocation()
 *    (never from URL params or client state)
 * 2. Filters out is_archived=true locations
 * 3. Calls switchActiveLocation(locationId) server action on selection
 *    → sets cookie → triggers router.refresh() to reload page data
 * 4. Shows location count: "3 locations" in header
 * 5. Shows "Manage Locations →" footer link (Agency only)
 * 6. Shows primary badge (★) next to primary location name
 * 7. Shows per-location health indicator (green/amber/red dot from Reality Score)
 *
 * data-testid values:
 * - location-switcher
 * - location-switcher-trigger
 * - location-switcher-option-[locationId]
 * - location-switcher-active-[locationId]
 * - location-switcher-manage-link
 */
```

---

### PART 7: Org Switcher (Multi-Org Users)

#### `components/layout/OrgSwitcher.tsx`

For users who belong to multiple orgs (accepted invitations from Sprint 98), a way to switch the active org context.

```typescript
/**
 * OrgSwitcher — shown in sidebar/header when user is member of 2+ orgs.
 * Hidden when user belongs to exactly 1 org (majority of V1 users).
 *
 * Active org stored in cookie: lv_active_org
 * Set by: switchActiveOrg() server action
 * Read by: getActiveOrgId() in lib/auth/active-org.ts
 *
 * Display:
 * - Shows current org name + plan badge
 * - Dropdown lists all orgs the user belongs to (from org_members)
 * - Clicking an org: sets cookie, reloads dashboard for new org context
 * - Shows role in each org: "Charcoal N Chill (Admin)", "Downtown Bar (Viewer)"
 *
 * data-testid:
 * - org-switcher
 * - org-switcher-trigger
 * - org-switcher-option-[orgId]
 * - org-switcher-active-indicator
 */
```

#### `lib/auth/active-org.ts`

```typescript
/**
 * Active Org resolution — mirrors active-location.ts pattern.
 *
 * Resolution order:
 * 1. Cookie: lv_active_org (HttpOnly, server-side)
 * 2. First org in org_members (oldest membership, sorted by joined_at ASC)
 * 3. null (user has no org — shouldn't happen post-onboarding)
 *
 * Validates that resolved orgId is in the user's org_members.
 * Cookie tampering → falls back to first org.
 *
 * NEVER reads orgId from URL params (AI_RULES §18).
 */
export async function getActiveOrgId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null>

export async function setActiveOrgCookie(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }>
```

#### `app/actions/switch-org.ts`

```typescript
'use server'

/**
 * switchActiveOrg
 * Sets the active org cookie for the current user.
 * Validates that userId is a member of the target orgId.
 * On success: sets cookie + triggers full dashboard reload.
 *
 * userId from session (never from args).
 * orgId from input — but validated against user's org_members.
 */
export async function switchActiveOrg(
  orgId: string
): Promise<{ success: boolean; error?: string }>
```

---

### PART 8: Data Isolation Audit

This is not a feature — it is a **systematic verification pass** that existing dashboard pages correctly scope data to the active location. Sprint 99 added `getUserLocationAccess()` filtering, but this sprint must verify the implementation is complete and correct.

**Audit methodology:**

```bash
# Step 1: Find ALL queries in dashboard pages
grep -rn "\.from('\|\.from(\`" app/dashboard --include="*.tsx" --include="*.ts" | \
  grep -v "test\|spec" | \
  grep -v "org_members\|orgs\|pending_invitations\|stripe"

# Step 2: For each table queried, check if location_id exists on that table
# Tables that ARE location-scoped (must have filter):
#   ai_audits, content_drafts, visibility_analytics, sov_queries,
#   citation_source_intelligence, page_audits, sentiment_data,
#   menu_items, locations (already scoped by org)
# Tables that are NOT location-scoped (org-level only):
#   orgs, org_members, pending_invitations, stripe_*, gbp_connections

# Step 3: For each location-scoped table query, verify it has:
#   .eq('location_id', activeLocationId)
#   OR .in('location_id', accessibleLocationIds)
#   — NOT just .eq('org_id', orgId) alone

# Step 4: Check all API routes (not just pages)
grep -rn "\.from('\|\.from(\`" app/api --include="*.ts" | \
  grep -v "test\|spec\|webhook\|cron"
```

**For each gap found:** Fix the query inline. Do not defer. Document fixes in DEVLOG.

**Write isolation tests that prove correctness** — see Test File 4 below.

---

### PART 9: Settings Navigation Update

Add "Locations" tab to the settings page navigation, visible only for Agency plan orgs:

```typescript
// In app/dashboard/settings/layout.tsx or equivalent settings nav:
{
  label: 'Locations',
  href: '/dashboard/settings/locations',
  showFor: ['agency'],  // Only Agency orgs
  dataTestId: 'settings-locations-tab',
}
```

Also add the "Locations" nav item to the sidebar if there is a sidebar link to settings sub-pages.

---

## 🧪 Tests — Write These FIRST (AI_RULES §4)

---

### Test File 1: `src/__tests__/unit/active-location.test.ts`

**~22 Vitest tests.**

```typescript
describe('getActiveLocationCookieName', () => {
  it('returns consistent cookie name for a given orgId')
  it('two different orgIds produce different cookie names')
  it('cookie name contains the orgId substring')
})

describe('getActiveLocationId', () => {
  // Cookie resolution
  it('returns locationId from cookie when cookie is set and valid')
  it('validates that cookie locationId belongs to the org (tamper protection)')
  it('falls back to primary when cookie locationId not in org')
  it('falls back to primary when cookie is absent')

  // Primary resolution
  it('returns primary location when no cookie')
  it('returns oldest location when no primary set and no cookie')

  // Edge cases
  it('returns null when org has no locations')
  it('returns null for archived-only locations (no active location)')
  it('handles DB error gracefully — returns null')
  it('does not read from URL params or query strings')
})

describe('setActiveLocationCookie', () => {
  it('sets HttpOnly cookie with correct name and value')
  it('returns error when locationId does not belong to org (tamper attempt)')
  it('returns error when location is archived')
  it('sets SameSite=Lax')
  it('sets Path=/dashboard')
  it('sets MaxAge=2592000 (30 days)')
  it('overwrites existing cookie value on re-call')
})

describe('getActiveOrgId (active-org.ts)', () => {
  it('returns orgId from cookie when valid member')
  it('falls back to first org when cookie orgId not in org_members (tamper)')
  it('falls back to first org when cookie absent')
  it('returns null when user has no org memberships')
  it('does not read from URL params')
})
```

---

### Test File 2: `src/__tests__/unit/location-actions.test.ts`

**~36 Vitest tests.** Mock Supabase via MSW.

```typescript
describe('addLocation', () => {
  it('inserts location row with org_id from session (not from input)')
  it('sets is_primary=true when this is the first location')
  it('does NOT set is_primary=true when org already has a primary')
  it('returns error when caller is viewer (admin+ required)')
  it('returns error when plan is not agency')
  it('returns error when org already has 10 active locations')
  it('returns error when name is empty')
  it('returns error when required fields missing (name, address, city, state)')
  it('returns error when phone format invalid')
  it('returns error when website URL malformed')
  it('returns locationId and location on success')
  it('revalidates /dashboard/settings/locations on success')
  it('does NOT allow injecting arbitrary org_id via input')
  it('touches llms_txt_updated_at on success (Sprint 97 integration)')
})

describe('updateLocation', () => {
  it('updates specified fields only (partial update)')
  it('returns error when locationId does not belong to org (cross-org attempt)')
  it('returns error when caller is viewer')
  it('does not change org_id (immutable)')
  it('touches llms_txt_updated_at on update')
  it('accepts partial input — does not null out unspecified fields')
})

describe('archiveLocation', () => {
  it('sets is_archived=true on success')
  it('returns error when location is the primary (cannot archive primary)')
  it('returns error when location is the only active location')
  it('returns error when caller is not admin+')
  it('returns error when locationId does not belong to org')
  it('does NOT delete any data (preservation guarantee)')
})

describe('setPrimaryLocation', () => {
  it('sets is_primary=true on target location')
  it('clears is_primary on previous primary (single UPDATE)')
  it('returns error when caller is not owner (owner-only operation)')
  it('returns error when locationId is already primary (no-op with success)')
  it('returns error when locationId is archived')
  it('returns error when locationId does not belong to org')
})

describe('switchActiveLocation', () => {
  it('calls setActiveLocationCookie with validated locationId')
  it('returns error when locationId does not belong to org')
  it('returns error when location is archived')
  it('verifies user has at least viewer permission on location (Sprint 99)')
  it('returns error when user has no access to location')
})
```

---

### Test File 3: `src/__tests__/unit/org-switcher.test.ts`

**~14 Vitest tests.**

```typescript
describe('switchActiveOrg', () => {
  it('sets lv_active_org cookie with validated orgId')
  it('returns error when orgId not in user\'s org_members')
  it('userId from session — never from input')
  it('HttpOnly cookie set correctly')
  it('returns success for valid org switch')
  it('handles user with single org (no-op with success)')
})

describe('getActiveOrgId', () => {
  it('returns orgId from valid cookie')
  it('validates cookie orgId against org_members (tamper protection)')
  it('falls back to first org_members entry when cookie invalid')
  it('falls back to first org when cookie absent')
  it('returns null for user with no memberships')
  it('sorts by joined_at ASC for fallback (oldest membership first)')
  it('does not leak orgId in error messages')
  it('is callable safely with null userId (returns null, no crash)')
})
```

---

### Test File 4: `src/__tests__/integration/location-data-isolation.test.ts`

**~24 Vitest integration tests.** This is the isolation audit in test form. Uses a real Supabase test DB (or MSW with realistic multi-location fixtures).

```typescript
/**
 * Setup: Two orgs, each with 2 locations and seeded data.
 * OrgA: LocationA1 (has ai_audits, content_drafts, sov_queries)
 *       LocationA2 (has separate ai_audits, content_drafts)
 * OrgB: LocationB1 (has ai_audits — must NEVER appear in OrgA queries)
 *
 * These tests verify that every data table is properly scoped.
 */

describe('Location Data Isolation', () => {
  describe('ai_audits', () => {
    it('switching to LocationA2 shows only LocationA2 audits')
    it('LocationB1 audits never appear in OrgA dashboard')
    it('org_id + location_id filter applied (not just org_id)')
  })

  describe('content_drafts', () => {
    it('drafts scoped to active location only')
    it('switching location changes draft list')
  })

  describe('visibility_analytics / SOV data', () => {
    it('SOV scores scoped to active location')
    it('switching location shows correct SOV data')
  })

  describe('citation_source_intelligence', () => {
    it('citation sources scoped to active location category+metro')
  })

  describe('page_audits', () => {
    it('page audit results scoped to active location')
  })

  describe('menu_items', () => {
    it('menu items scoped to active location')
  })

  describe('Cross-org isolation (critical)', () => {
    it('OrgB data never visible to OrgA user regardless of location context')
    it('switching to a locationId from another org is blocked (cookie tamper attempt)')
    it('direct URL access to another org\'s data returns empty/403')
  })

  describe('Owner vs Member isolation', () => {
    it('owner sees all org locations')
    it('viewer with location_permission sees only their permitted location\'s data')
    it('viewer without location_permission sees primary location data (org-level fallback)')
  })

  describe('Archived location isolation', () => {
    it('archived location data NOT shown in active dashboard')
    it('archived location data IS visible in historical reports (explicit date range)')
  })
})
```

---

### Test File 5: `src/__tests__/e2e/multi-location.spec.ts`

**~18 Playwright tests.**

```typescript
describe('Multi-Location Management E2E', () => {
  // Location settings page
  it('settings/locations page visible for Agency owner')
  it('settings/locations shows plan gate for non-Agency org')
  it('settings/locations shows correct location count (X of 10)')

  // Add location flow
  it('clicking Add Location opens slide-over panel', async ({ page }) => {
    // Login as Agency owner (golden tenant upgraded)
    // Navigate to /dashboard/settings/locations
    // Click location-add-btn
    // Assert: location-add-panel is visible
    // Fill TruthCalibrationForm fields
    // Click location-form-submit-btn
    // Assert: location-form-success visible
    // Assert: new location row appears in location-list
    // Assert: location count increments
  })

  it('add location at limit (10/10) disables add button')
  it('add location validates required fields — shows inline errors')
  it('add location with invalid phone returns error')

  // Edit location
  it('clicking edit opens form pre-filled with location data')
  it('saving edit updates location row in list')

  // Archive
  it('archiving primary location is blocked with clear error')
  it('archiving non-primary location hides it from switcher')
  it('archived location count not included in active count display')

  // Set primary
  it('owner can set a different location as primary')
  it('only one location has primary badge at any time')

  // Location switcher
  it('LocationSwitcher shows all active (non-archived) locations')
  it('selecting a location in switcher reloads dashboard with correct data')
  it('active location highlighted in switcher dropdown')
  it('Manage Locations link visible in switcher for Agency org')

  // Org switcher
  it('OrgSwitcher hidden for single-org user')
  it('OrgSwitcher visible for user in 2+ orgs')
  it('switching org reloads dashboard with correct org context')

  // Data isolation visual verification
  it('switching location changes displayed business name in dashboard header')
  it('switching location changes hallucination count in dashboard stats')
})
```

---

## 🔍 Pre-Implementation Diagnosis

Run every command. Document findings as comments before writing any code.

```bash
# ============================================================
# LOCATION SWITCHER INVESTIGATION
# ============================================================

# 1. Read the complete existing LocationSwitcher
cat components/layout/LocationSwitcher.tsx

# 2. Find how it stores the active location today
grep -r "lv_active\|active_location\|activeLocation\|selectedLocation\|cookie" \
  components/layout/LocationSwitcher.tsx lib/location/ 2>/dev/null

# 3. Find any existing active-location or active-org utilities
find lib -name "active-*" -o -name "*active*" 2>/dev/null
grep -r "getActiveLocation\|setActiveLocation\|active_location" \
  lib/ app/ --include="*.ts" --include="*.tsx" -l

# 4. Find the existing "Add Location" button and what it does
grep -r "Add Location\|addLocation\|add-location" \
  app/ components/ --include="*.tsx" --include="*.ts"

# ============================================================
# TRUTH CALIBRATION FORM INVESTIGATION
# ============================================================

# 5. Find TruthCalibrationForm
find app components -name "TruthCalibrationForm*" 2>/dev/null
grep -r "TruthCalibrationForm\|TruthCalibration\|truth-calibration" \
  app/ components/ --include="*.tsx" -l

# 6. Find where it is currently used
grep -rn "TruthCalibrationForm" app/ components/ --include="*.tsx"

# ============================================================
# LOCATION TABLE INVESTIGATION
# ============================================================

# 7. Read full locations table schema
grep -A60 "CREATE TABLE.*locations" supabase/prod_schema.sql

# 8. Check existing columns vs what migration will add
grep -E "is_primary|is_archived|display_name|timezone|location_order" supabase/prod_schema.sql

# 9. Check existing indexes on locations
grep -A5 "INDEX.*location\|index.*location" supabase/prod_schema.sql

# 10. Check location-related RLS policies
grep -B2 -A10 "CREATE POLICY" supabase/prod_schema.sql | grep -A10 "location"

# ============================================================
# DATA ISOLATION INVESTIGATION
# ============================================================

# 11. Find all tables with location_id column
grep -E "location_id.*uuid\|uuid.*location_id" supabase/prod_schema.sql | \
  grep -v "references\|primary"

# 12. Find dashboard queries that may be missing location filter
grep -rn "supabase.*from\|\.from('" app/dashboard \
  --include="*.tsx" --include="*.ts" | \
  grep -v "test\|spec\|orgs\|org_members" | head -40

# 13. Find any places where org_id filter used without location_id (potential gap)
grep -rn "\.eq('org_id'" app/dashboard --include="*.tsx" --include="*.ts" | \
  grep -v "location_id\|test\|spec"

# ============================================================
# SETTINGS NAVIGATION INVESTIGATION
# ============================================================

# 14. Find settings nav/tabs component
find app/dashboard/settings -name "layout*" -o -name "_components*" 2>/dev/null
grep -r "settings.*tab\|settingsNav\|settings.*nav" \
  app/dashboard/settings/ --include="*.tsx" -l

# 15. Check existing settings sub-pages
ls app/dashboard/settings/

# ============================================================
# ORG MEMBERSHIP INVESTIGATION
# ============================================================

# 16. Check if org_members was added by Sprint 98 or already existed
grep -A20 "CREATE TABLE.*org_members" supabase/prod_schema.sql

# 17. Find how current orgId flows from session to pages
grep -rn "orgId\|org_id" app/dashboard --include="*.tsx" | \
  grep -v "location_id\|\.eq\|filter\|where" | head -20
```

**After diagnosis, document these answers at the top of every new file:**
- Is `TruthCalibrationForm` already extracted? (determines extraction need)
- What is the active location cookie name today? (determines migration vs. new)
- Does `is_primary` already exist on `locations`? (determines migration scope)
- Which dashboard pages are missing `location_id` filters? (isolation audit gaps)

---

## 🧠 Edge Cases to Handle

**Location switching:**

1. **User switches location and the new location has no data yet:** Dashboard shows empty states, not errors. Every query that relies on `activeLocationId` must handle the case where that location has zero rows in `ai_audits`, `content_drafts`, etc.

2. **Cookie contains a locationId from a deleted/archived location:** `getActiveLocationId()` validates the locationId against the org's active locations. If not found, falls back to primary. Do not crash.

3. **Cookie tamper — user manually sets cookie to another org's locationId:** `setActiveLocationCookie()` validates `locations.org_id = sessionOrgId` before setting. `getActiveLocationId()` re-validates on read. Two layers of protection.

4. **Race condition: location archived while user is viewing it:** Next request, `getActiveLocationId()` finds the cookie locationId is now archived → falls back to primary → loads primary location's data. User sees a toast or banner: "Your previously active location was archived. Showing primary location."

5. **Org with no locations:** After full data deletion or before onboarding completes. `getActiveLocation()` returns `null`. Dashboard pages must handle `null` activeLocation gracefully — show "Complete your setup" CTA, not a crash.

6. **Adding the 10th location:** Allow it. Adding the 11th: block with clear message. The count check in `addLocation()` counts non-archived locations only.

7. **Primary location archived:** Blocked by `archiveLocation()`. But if somehow the DB ends up with no primary (e.g., direct DB manipulation), `getActiveLocationId()` falls back to oldest location. The locations page should detect this state and show a "No primary location set" warning with a CTA to set one.

8. **Multi-location org: member added before locations existed:** If a member accepted an invitation before any locations were added beyond the primary, `location_permissions` has no rows for them — they fall back to org-level role on all locations (correct Sprint 99 behavior).

9. **`setPrimaryLocation` atomicity:** Must not leave the org temporarily with zero primaries. The UPDATE should use a single statement that clears old primary and sets new primary: `UPDATE locations SET is_primary = CASE WHEN id = $newId THEN true ELSE false END WHERE org_id = $orgId AND is_archived = false`. Do not use two separate UPDATEs.

10. **`LocationSwitcher` renders before server action resolves:** The switcher uses `router.refresh()` after `switchActiveLocation()`. During the refresh, stale data may show briefly. This is acceptable for V1 — add a loading state to the switcher button to indicate the switch is in progress.

11. **`OrgSwitcher` for user with 1 org:** Must be completely hidden (not just disabled). The sidebar should not show any org-switching UI if `userOrgs.length <= 1`.

12. **`getActiveOrgId()` called before `getActiveLocationId()`:** The org must be resolved first — the location is always scoped within the org. Server Components that need both should call `getActiveOrgId()` first, then `getActiveLocationId(orgId)`. Document this ordering requirement in AI_RULES §53.

13. **Settings Locations page for non-Agency plan:** Show `<PlanGate requiredPlan="agency">` over the entire location list (not just the add button). A Starter org owner should not see their competitor's location count or configuration.

14. **`TruthCalibrationForm` extraction must not break onboarding:** After extracting the form to `components/forms/`, run the full onboarding E2E test suite before committing. If any tests fail, fix before proceeding.

15. **`display_name` vs `name`:** The `name` field is the legal/GBP business name. `display_name` is an optional agency override (e.g., "Client: Charcoal N Chill" for agency dashboard clarity). The `display_name` is shown in the LocationSwitcher and settings page, but the `name` is used in all external-facing outputs (llms.txt, JSON-LD, etc.). Never swap these.

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `locations` table | Phase 0–2 | Being extended with is_primary, is_archived, display_name |
| `LocationSwitcher` | Sprint 27A | Being enhanced — read carefully before touching |
| `TruthCalibrationForm` | Sprint 91, 93 | Being extracted/reused — do not duplicate |
| `lib/auth/location-permissions.ts` | Sprint 99 | `getUserLocationAccess()` used in isolation enforcement |
| `lib/auth/org-roles.ts` | Sprint 98 | `assertOrgRole()` used in all location actions |
| `lib/plan-enforcer.ts` | Sprint 3, 96 | Agency plan check in `addLocation()` |
| `<PlanGate>` component | Sprint 96 | Plan gate on Locations settings page |
| `lib/llms-txt/` | Sprint 97 | `llms_txt_updated_at` touched on location update |
| Business Info Editor | Sprint 93 | Form component sharing |
| Onboarding Wizard | Sprint 91 | `TruthCalibrationForm` extraction source |
| Golden Tenant | All sprints | `org_id: a0eebc99` — needs Agency plan + 2 locations for multi-location tests |
| `createServiceRoleClient()` | Sprint 18 | Used in cookie validation (cross-org check) |

---

## 📓 DEVLOG Entry Format

```markdown
## Sprint 100 — Multi-Location Management (Gap #57: 40% → 100%)
**Date:** [DATE]
**Duration:** ~6 hours (Medium sprint — M effort)

### Problem
LocationSwitcher existed but location add/edit/archive was missing.
No form to create new locations. No verified data isolation between locations.
No org-switching UI for multi-org users (Sprint 98 invited them but no way to switch).

### Solution
- TruthCalibrationForm extracted to components/forms/ (if not already standalone)
- addLocation/updateLocation/archiveLocation/setPrimaryLocation/switchActiveLocation actions
- lib/location/active-location.ts: HttpOnly cookie-based resolution, tamper-protected
- lib/auth/active-org.ts: same pattern for org context
- /dashboard/settings/locations: management page with health stats per location
- LocationSwitcher enhanced: archived filtered, primary badge, Manage link, health dot
- OrgSwitcher: new component, only shown for multi-org users
- Data isolation audit: [N] gaps found and fixed
- Integration tests: 24 isolation tests prove location scoping is airtight

### Files Changed
- `supabase/migrations/[timestamp]_multi_location_management.sql` — NEW
- `lib/location/active-location.ts` — NEW: cookie-based active location resolution
- `lib/auth/active-org.ts` — NEW: cookie-based active org resolution
- `app/actions/locations.ts` — NEW: full location CRUD + switch actions
- `app/actions/switch-org.ts` — NEW: org switch action
- `components/forms/TruthCalibrationForm.tsx` — EXTRACTED (if inlined previously)
- `app/dashboard/settings/locations/page.tsx` — NEW: location management page
- `components/layout/LocationSwitcher.tsx` — MODIFIED: enhanced with health + archive filter
- `components/layout/OrgSwitcher.tsx` — NEW: multi-org switcher
- `app/dashboard/settings/layout.tsx` — MODIFIED: Locations tab added
- `app/dashboard/[N pages]` — MODIFIED: location filter gaps fixed (isolation audit)
- `src/__tests__/unit/active-location.test.ts` — NEW: [N] tests
- `src/__tests__/unit/location-actions.test.ts` — NEW: [N] tests
- `src/__tests__/unit/org-switcher.test.ts` — NEW: [N] tests
- `src/__tests__/integration/location-data-isolation.test.ts` — NEW: [N] tests
- `src/__tests__/e2e/multi-location.spec.ts` — NEW: [N] tests

### Isolation Audit Results
[Fill in after audit: "Found N queries missing location_id filter. Fixed in: [list files]"]

### Grep counts (run before committing):
grep -cE "^\s*(it|test)\(" src/__tests__/unit/active-location.test.ts        # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/location-actions.test.ts       # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/org-switcher.test.ts           # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/integration/location-data-isolation.test.ts # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/e2e/multi-location.spec.ts          # [N]

### Gaps Closed
- Gap #57: Multi-Location (Agency) — 40% → 100%
  - Add/edit/archive location form: complete
  - Location-scoped data isolation: verified + all gaps fixed
  - Agency org-switching: complete

### Next Sprint
Sprint 101 — Occasion Alert Feed + Sidebar Badges (Gaps #58 + #59)
```

---

## 🔮 AI_RULES Update — Add Rule §53 to `AI_RULES.md`

```markdown
## §53. 📍 Multi-Location + Active Context Rules (Sprint 100)

### Active location and org resolution
- Active location: always resolved via `getActiveLocationId()` in `lib/location/active-location.ts`.
  NEVER read active location from URL params, query strings, or form input (AI_RULES §18).
- Active org: always resolved via `getActiveOrgId()` in `lib/auth/active-org.ts`.
  Same rule — session + cookie only.
- Resolution order is always: (1) validated cookie, (2) primary, (3) oldest. Never deviate.
- Both utilities validate their cookie value against the DB before using it.
  An invalid cookie value falls back silently — never crashes, never 403s.
- Call order in Server Components: `getActiveOrgId()` FIRST, then `getActiveLocationId(orgId)`.
  Location is always scoped within org. Never resolve location before org.

### Location CRUD
- `app/actions/locations.ts` is the ONLY place location mutations happen. Never inline.
- `TruthCalibrationForm` in `components/forms/` is the ONLY location data entry form.
  Never create a parallel location form. Extend this one.
- `setPrimaryLocation()` uses a SINGLE UPDATE statement with CASE expression.
  Never use two separate UPDATEs (would leave org briefly with no primary).
- `is_primary = true` has a partial unique index: at most 1 active primary per org.
  Do not work around this constraint.

### Isolation guarantee
- Every query against a location-scoped table MUST filter by `location_id`.
  Filtering by `org_id` alone is insufficient — it leaks cross-location data.
- Adding a new dashboard page or data query: check if the table has `location_id`.
  If yes, add `.eq('location_id', activeLocationId)` or `.in('location_id', ...)`.
  If unsure, check `prod_schema.sql` before writing the query.
- `location_id` filter on an empty array `.in('location_id', [])` returns 0 rows (correct).
  Never substitute with `.eq('org_id', orgId)` as a fallback.

### Display name vs name
- `locations.name` = legal/GBP business name. Used in all external outputs.
- `locations.display_name` = optional agency UI override. Used only in internal UI.
  Never use `display_name` in llms.txt, JSON-LD, or any AI-facing output.
```

---

## ✅ Acceptance Criteria

**Location Management:**
- [ ] `locations.is_primary`, `is_archived`, `display_name`, `timezone`, `location_order` columns exist
- [ ] Exactly one primary per org enforced by partial unique index
- [ ] `addLocation()` blocked at 10 active locations, requires Agency plan + admin role
- [ ] `archiveLocation()` blocked when target is primary or only active location
- [ ] `setPrimaryLocation()` uses single atomic UPDATE (no dual-UPDATE race)
- [ ] `/dashboard/settings/locations` page visible for Agency, plan-gated for others
- [ ] `TruthCalibrationForm` is a standalone reusable component (not inlined)
- [ ] Add Location slide-over panel works without full page reload

**Active Context:**
- [ ] `getActiveLocationId()` validates cookie against DB (tamper protection)
- [ ] `getActiveOrgId()` validates cookie against org_members (tamper protection)
- [ ] Both utilities fall back gracefully without crashing
- [ ] `switchActiveLocation()` verifies location belongs to org AND user has access
- [ ] Cookies are HttpOnly, SameSite=Lax, Path=/dashboard

**Org + Location Switchers:**
- [ ] `LocationSwitcher` filters out archived locations
- [ ] `LocationSwitcher` calls `switchActiveLocation()` server action
- [ ] `OrgSwitcher` hidden for single-org users
- [ ] `OrgSwitcher` switches org context and reloads dashboard

**Data Isolation:**
- [ ] All location-scoped table queries in dashboard pages filter by `location_id`
- [ ] Cross-org data leakage: zero (verified by integration tests)
- [ ] Switching location changes dashboard data correctly in E2E tests

**Tests:**
- [ ] All unit + integration tests pass: `npx vitest run` (zero regressions)
- [ ] All E2E tests pass: `npx playwright test src/__tests__/e2e/multi-location.spec.ts`
- [ ] Onboarding E2E still passes after `TruthCalibrationForm` extraction
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] No `activeLocationId` read from URL params anywhere in codebase

---

## 🧾 Test Run Commands

```bash
npx vitest run src/__tests__/unit/active-location.test.ts                       # ~22 tests
npx vitest run src/__tests__/unit/location-actions.test.ts                      # ~36 tests
npx vitest run src/__tests__/unit/org-switcher.test.ts                          # ~14 tests
npx vitest run src/__tests__/integration/location-data-isolation.test.ts        # ~24 tests
npx vitest run                                                                    # Full suite — 0 regressions
npx playwright test src/__tests__/e2e/multi-location.spec.ts                    # ~18 tests
npx playwright test src/__tests__/e2e/onboarding.spec.ts                        # Regression: form extraction safe
npx tsc --noEmit                                                                  # 0 new type errors

# Total new tests: ~96 unit/integration + ~18 E2E
```

---

## 📚 Document Sync + Git Commit (After All Tests Pass)

### Step 1: Update `/docs` files

**`docs/roadmap.md`** — Update Feature #57 (Multi-Location Agency) from `🟡 40%` to `✅ 100%`.

**`docs/MULTI-USER_AGENCY_WHITE_LABEL.md`** — Update to reflect complete multi-location architecture.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 100 to completed sprints list.

### Step 2: Update `DEVLOG.md`

Paste DEVLOG entry above. Replace all `[N]` with actual `grep -cE` counts. Fill in the isolation audit results section.

### Step 3: Update `CLAUDE.md`

```markdown
### Sprint 100 — Multi-Location Management (2026-03-XX)
- `lib/location/active-location.ts` — HttpOnly cookie resolution, tamper-protected
- `lib/auth/active-org.ts` — Same pattern for org context
- `app/actions/locations.ts` — addLocation, updateLocation, archiveLocation, setPrimary, switch
- `app/actions/switch-org.ts` — Org context switch action
- `components/forms/TruthCalibrationForm.tsx` — Extracted standalone (if was inlined)
- `app/dashboard/settings/locations/page.tsx` — Location management with health stats
- `components/layout/LocationSwitcher.tsx` — Enhanced: health dots, archive filter, Manage link
- `components/layout/OrgSwitcher.tsx` — Multi-org context switcher
- Migration: is_primary, is_archived, display_name, timezone, location_order on locations
- Data isolation: [N] query gaps fixed across [N] dashboard pages
- Tests: [N] Vitest + [N] Playwright
- Gap #57 closed: Multi-Location Agency 40% → 100%
```

### Step 4: Update `MEMORY.md`

```markdown
## Decision: Multi-Location Architecture (Sprint 100 — 2026-03-XX)
- Active location: HttpOnly cookie lv_active_location_{orgId}. Validated on every read.
- Active org: HttpOnly cookie lv_active_org. Validated against org_members on every read.
- Resolution order: validated cookie → primary → oldest. Both utilities.
- setPrimaryLocation uses single atomic CASE UPDATE — never dual-UPDATE.
- V1 location limit: 10 active (non-archived) per Agency org.
- display_name = agency UI override. name = GBP/external truth. Never swap in external outputs.
- Isolation audit: [N gaps found]. All fixed. location_id filter now on all scoped tables.
- TruthCalibrationForm extracted to components/forms/ for reuse across onboarding, settings, locations.
- OrgSwitcher hidden for single-org users (majority of V1 base).
```

### Step 5: Update `AI_RULES.md`

Append Rule §53 from the **🔮 AI_RULES Update** section above.

### Step 6: Final sync checklist

- [ ] `DEVLOG.md` — Sprint 100 entry with actual test counts + isolation audit results
- [ ] `CLAUDE.md` — Sprint 100 in implementation inventory
- [ ] `MEMORY.md` — Multi-location architecture decision
- [ ] `AI_RULES.md` — Rule §53
- [ ] `docs/roadmap.md` — Feature #57 → ✅ 100%
- [ ] `docs/MULTI-USER_AGENCY_WHITE_LABEL.md` — Updated
- [ ] `docs/09-BUILD-PLAN.md` — Sprint 100 checked

### Step 7: Git commit

```bash
git add -A
git status

git commit -m "Sprint 100: Multi-Location Management (Gap #57: 40% → 100%)

- migration: is_primary, is_archived, display_name, timezone, location_order on locations
- partial unique index: one active primary per org enforced at DB level
- lib/location/active-location.ts: HttpOnly cookie resolution + tamper protection
- lib/auth/active-org.ts: same pattern for org context switching
- app/actions/locations.ts: addLocation, updateLocation, archiveLocation, setPrimary, switch
- app/actions/switch-org.ts: org context switch (validates membership)
- components/forms/TruthCalibrationForm.tsx: extracted standalone reusable form
- app/dashboard/settings/locations: management page (health stats, add/edit/archive/primary)
- LocationSwitcher: enhanced (archive filter, primary badge, health dot, Manage link)
- OrgSwitcher: new (hidden for single-org users, switches org context)
- data isolation audit: [N] query gaps found + fixed across [N] pages
- tests: [N] Vitest + [N] Playwright passing
- docs: roadmap #57 → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES §53

Closes Gap #57. Agency orgs can manage up to 10 client locations.
All location-scoped data queries verified isolated. Cross-org leakage: zero.
Unblocks Sprint 101 (Occasion Alert Feed + Sidebar Badges)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 100 completes:

- **Multi-Location (Agency): 40% → 100%** (Gap #57 closed)
- Agency owners can add, edit, archive, and switch between up to 10 client locations
- The `TruthCalibrationForm` is a properly extracted reusable component, eliminating duplication across onboarding, settings, and location management
- Active location and org context flow through tamper-protected HttpOnly cookies — never URL params
- A systematic isolation audit has verified that every location-scoped data query correctly filters by `location_id` — zero cross-location data leakage
- The `OrgSwitcher` enables multi-org agency users to jump between client orgs cleanly
- ~96 unit/integration + ~18 Playwright tests protect every path
- **Tier 3 has one sprint remaining:** Sprint 101 — Occasion Alert Feed + Sidebar Badges. The last polish sprint before the Agency tier is fully shippable.
