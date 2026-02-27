# Sprint 101 — Occasion Alert Feed + Sidebar Badges

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Complete Tier 3 with a focused **engagement and discoverability polish sprint**. Two gaps that both suffer from the same root cause: users don't notice when something needs their attention. Content drafts pile up unread. Occasion opportunities pass because there's no alert on the dashboard home. This sprint fixes both with badges, alerts, and a snooze system.

**Four deliverables:**

1. **Sidebar Badge Counts** — Amber numeric badges on `Content Drafts` and `Visibility` (SOV) sidebar items showing unread/pending counts. Users see immediately when something needs attention without navigating into every page.

2. **`OccasionAlertCard` on Dashboard Home** — A dismissible alert card on `/dashboard` that surfaces upcoming local occasions (holidays, events, seasonal moments) relevant to the business, with a CTA to create a content draft for that occasion. Built from the existing `local_occasions` table (32 seeded occasions).

3. **"Remind Later" Snooze** — Users can snooze an occasion alert for 1 day, 3 days, or 1 week. Snooze state is persisted per user per occasion. The alert re-surfaces after the snooze expires.

4. **Content Drafts Empty State CTA** — When the content drafts page has zero drafts, show a purposeful empty state with a CTA pointing to `/compete` (the competitor analysis page) explaining that beating competitors on AI queries generates drafts.

**Gaps being closed:**
- Gap #58 — Content Draft Sidebar Badge: 80% → 100%
- Gap #59 — Occasion Alert Feed: 50% → 100%

**Effort:** S (Small — 2–4 hours). Everything builds on existing infrastructure. No new tables except the snooze log. No new API integrations. Pure product polish with high daily engagement payoff.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                         — All rules (§53+ after Sprint 100)
Read CLAUDE.md                                                — Full inventory, sidebar patterns
Read MEMORY.md                                                — Prior decisions and constraints
Read supabase/prod_schema.sql                                 — Find: local_occasions, content_drafts,
                                                                sov_queries, visibility_analytics,
                                                                ai_audits. Any existing snooze/dismiss tables.
Read lib/database.types.ts                                    — TypeScript types
Read src/__fixtures__/golden-tenant.ts                        — Golden Tenant: org_id a0eebc99
Read components/layout/Sidebar.tsx                            — THE MOST IMPORTANT FILE for this sprint.
                                                                Read every line. Understand NAV_ITEMS,
                                                                how active states work, whether badges
                                                                are already architected (even partially).
Read app/dashboard/page.tsx                                   — Dashboard home — where OccasionAlertCard lands
Read app/dashboard/content-drafts/page.tsx                    — Empty state to add CTA
Read app/dashboard/share-of-voice/page.tsx                    — SOV page (Visibility badge target)
Read app/dashboard/_components/                               — Existing dashboard cards + components
Read lib/supabase/server.ts                                   — createClient() patterns
Read lib/auth/active-location.ts                              — Sprint 100: active location resolution
Read lib/auth/org-roles.ts                                    — Sprint 98: role enforcement
Read app/actions/                                             — Existing server action patterns
```

**Specifically understand before writing code:**

1. What is the exact schema of `local_occasions`? What columns — `id`, `name`, `date`, `type`, `category`, `description`? Is there a `recurrence` pattern or are dates absolute? Are the 32 seeded occasions in a migration or a seed file?
2. Does `content_drafts` have a `status` column? What are its values — `'pending'`, `'approved'`, `'published'`, `'rejected'`? Which statuses count as "needs attention" for the badge?
3. Does `sov_queries` or `visibility_analytics` have an `unread` or `last_seen_at` field? What counts as "new" for the Visibility badge?
4. Does any existing snooze, dismiss, or notification_state table exist? If so, read it before creating a new one.
5. How does `Sidebar.tsx` currently render nav items? Is it a static array? Does it accept badge props? Does it have a server/client split — server for data, client for interactivity?
6. Is the sidebar a Server Component or Client Component? This determines where badge counts are fetched and how they update.
7. Does `app/dashboard/page.tsx` already have any alert/notification card pattern? If so, extend it rather than creating a competing pattern.
8. What does the seeded `local_occasions` data look like — are dates stored as absolute dates (2026-07-04) or relative (month=7, day=4 for recurring annual)?

---

## 🏗️ Architecture — What to Build

---

### PART 1: Database Schema

#### Migration 1: Occasion snooze + notification state

```sql
-- ============================================================
-- Migration: XXXX_occasion_snooze_sidebar_badges.sql
-- ============================================================

-- -------------------------------------------------------
-- 1. Check if any dismiss/snooze table already exists
--    Read prod_schema.sql before running this migration.
--    Only create if absent.
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS occasion_snoozes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occasion_id     uuid NOT NULL REFERENCES local_occasions(id) ON DELETE CASCADE,
  snoozed_until   timestamptz NOT NULL,
  snoozed_at      timestamptz NOT NULL DEFAULT now(),
  snooze_count    integer NOT NULL DEFAULT 1,  -- How many times this user has snoozed this occasion
  UNIQUE (org_id, user_id, occasion_id)        -- One snooze record per user per occasion per org
);

-- RLS: users can only read/write their own snoozes
ALTER TABLE occasion_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occasion_snoozes_select" ON occasion_snoozes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "occasion_snoozes_insert" ON occasion_snoozes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "occasion_snoozes_update" ON occasion_snoozes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "occasion_snoozes_delete" ON occasion_snoozes
  FOR DELETE USING (user_id = auth.uid());

-- -------------------------------------------------------
-- 2. Sidebar badge last-seen tracking
--    Tracks when a user last "saw" each badge section.
--    Items created after last_seen_at count toward the badge.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sidebar_badge_state (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section         text NOT NULL CHECK (section IN ('content_drafts', 'visibility')),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, section)
);

ALTER TABLE sidebar_badge_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sidebar_badge_state_all" ON sidebar_badge_state
  FOR ALL USING (user_id = auth.uid());

-- -------------------------------------------------------
-- 3. Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_occasion_snoozes_org_user
  ON occasion_snoozes(org_id, user_id);

CREATE INDEX IF NOT EXISTS idx_occasion_snoozes_snoozed_until
  ON occasion_snoozes(snoozed_until);

CREATE INDEX IF NOT EXISTS idx_sidebar_badge_state_lookup
  ON sidebar_badge_state(org_id, user_id, section);
```

---

### PART 2: Badge Count Library

#### `lib/badges/badge-counts.ts`

**All badge count queries in one place.** Returns counts used by the sidebar. Designed to be called once per page load, not once per nav item.

```typescript
/**
 * Badge count resolution — all sidebar badges computed in one DB round trip.
 *
 * Counts are intentionally conservative:
 * - Content Drafts badge: pending drafts that need human review (HITL)
 * - Visibility badge: new SOV query results since last seen
 *
 * Performance contract:
 * - Single DB call (count queries, not full row fetches)
 * - Wrapped in React.cache() at the call site (Server Component usage)
 * - Returns 0 on any DB error (never throws, never crashes sidebar)
 * - Counts capped at 99 for display (shows "99+" if > 99)
 */

export interface SidebarBadgeCounts {
  contentDrafts: number     // Pending drafts awaiting HITL review
  visibility: number        // New SOV results since last_seen_at
}

/**
 * Fetches all badge counts for the current user + active location.
 *
 * @param orgId      — from session
 * @param userId     — from session
 * @param locationId — active location (from Sprint 100 getActiveLocationId)
 */
export async function getSidebarBadgeCounts(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  locationId: string | null
): Promise<SidebarBadgeCounts>

/**
 * Marks a sidebar section as "seen" — resets the badge count to 0.
 * Called when the user navigates TO the section page.
 * Upserts sidebar_badge_state.last_seen_at = now().
 */
export async function markSectionSeen(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  section: 'content_drafts' | 'visibility'
): Promise<void>

/**
 * Returns the cap-applied display string for a badge count.
 * 0 → null (no badge shown)
 * 1–99 → "7"
 * 100+ → "99+"
 */
export function formatBadgeCount(count: number): string | null
```

**Badge count logic — document clearly:**

```typescript
// Content Drafts badge count:
// SELECT COUNT(*) FROM content_drafts
// WHERE org_id = $orgId
//   AND location_id = $locationId   (if location scoped — check schema)
//   AND status = 'pending'          (or whatever "needs review" status is — read schema first)
//   AND created_at > (
//     SELECT COALESCE(last_seen_at, '1970-01-01')
//     FROM sidebar_badge_state
//     WHERE org_id = $orgId AND user_id = $userId AND section = 'content_drafts'
//   )
//
// Visibility badge count:
// SELECT COUNT(*) FROM visibility_analytics   (or sov_queries — check schema)
// WHERE org_id = $orgId
//   AND location_id = $locationId
//   AND created_at > (
//     SELECT COALESCE(last_seen_at, '1970-01-01')
//     FROM sidebar_badge_state
//     WHERE org_id = $orgId AND user_id = $userId AND section = 'visibility'
//   )
//
// ⚠️ Read prod_schema.sql to confirm:
//   - content_drafts.status values
//   - Whether visibility_analytics or sov_queries is the right table
//   - Whether these tables have location_id (likely yes — Sprint 100 isolation audit)
```

---

### PART 3: Sidebar Badge Integration

#### Extend `components/layout/Sidebar.tsx`

⚠️ This is the most architecturally sensitive file in this sprint. Read it completely before touching a single line. The existing sidebar likely has a Server/Client split — understand it before adding badge state.

**Strategy:**

The badge counts require a DB read per page load. The cleanest approach depends on whether the sidebar is already a Server Component:

**If Sidebar is a Server Component (or has a server wrapper):**
```typescript
// Fetch counts server-side and pass as props to a Client Component for the badge UI
// In the server wrapper:
const badges = await getSidebarBadgeCounts(supabase, orgId, userId, locationId)
// Pass to <SidebarClient badges={badges} navItems={NAV_ITEMS} />
```

**If Sidebar is a Client Component with no server wrapper:**
```typescript
// Introduce a server wrapper: app/dashboard/layout.tsx already fetches session —
// add badge count fetch there and pass down via props.
// DO NOT convert the client sidebar to a server component — this will break
// any existing interactivity (open/close, mobile nav, etc.)
```

**Badge UI requirements:**

```typescript
// The badge is an amber pill shown to the right of the nav item label.
// Amber = attention needed, not error.
// Exact Tailwind classes (literal — AI_RULES §12):
// Pill wrapper:   "ml-auto flex items-center justify-center"
// Pill badge:     "min-w-[1.25rem] h-5 px-1 rounded-full bg-amber-100 text-amber-700
//                  text-xs font-semibold leading-none flex items-center justify-center"
//
// data-testid values:
// - sidebar-badge-content-drafts      (the amber pill on Content Drafts nav item)
// - sidebar-badge-visibility          (the amber pill on Visibility/SOV nav item)
// - sidebar-nav-content-drafts        (the nav item itself — for click testing)
// - sidebar-nav-visibility            (the nav item itself)
//
// Behavior:
// - Badge is visible only when count > 0
// - Shows formatted count: "7", "99+"
// - When user navigates to the page: markSectionSeen() is called,
//   badge resets to 0 on next render
// - Badge does NOT update in real-time (next page load picks up new count)
//   Real-time badge updates are out of scope for V1.
```

**`markSectionSeen()` call site:**

```typescript
// In app/dashboard/content-drafts/page.tsx (Server Component):
// At the top of the page, after auth check:
await markSectionSeen(supabase, orgId, userId, 'content_drafts')
// This resets the badge. Called on every visit to the page.

// Same for share-of-voice page → section 'visibility'
```

---

### PART 4: Occasion Alert System

#### `lib/occasions/occasion-feed.ts`

**Pure data layer for occasion alerts.** No UI logic here.

```typescript
/**
 * Occasion alert feed — surfaces upcoming occasions relevant to the business.
 *
 * Algorithm:
 * 1. Load all local_occasions where the occasion date falls within the next 14 days
 *    (14-day lookahead window — enough lead time to create content)
 * 2. Filter out occasions the user has snoozed (snoozed_until > now())
 * 3. Filter out occasions where a content_draft already exists for this occasion
 *    (already acted on — no need to re-alert)
 * 4. Limit to 3 occasions max (don't overwhelm the dashboard)
 * 5. Sort by date ASC (most urgent first)
 *
 * Recurrence handling:
 * - If local_occasions stores absolute dates (2026-07-04): compare directly
 * - If local_occasions stores recurring dates (month=7, day=4): compute
 *   next occurrence from today and use that for the 14-day window
 * - Read the schema to determine which pattern is used before implementing
 */

export interface OccasionAlert {
  id: string
  name: string                  // "Independence Day", "Mother's Day"
  date: Date                    // Computed next occurrence
  daysUntil: number             // 0 = today, 1 = tomorrow, 14 = in 2 weeks
  category: string | null       // "holiday", "seasonal", "local_event"
  description: string | null
  isUrgent: boolean             // daysUntil <= 3
  contentDraftExists: boolean   // Always false after filter step 3, but kept for type clarity
}

/**
 * Returns occasions to show on the dashboard home for this org + location.
 * Returns [] on any error (never throws — dashboard must always load).
 *
 * @param orgId      — from session
 * @param userId     — from session (for snooze lookup)
 * @param locationId — active location
 */
export async function getOccasionAlerts(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  locationId: string | null
): Promise<OccasionAlert[]>

/**
 * Returns the total count of active (non-snoozed, non-actioned) occasion alerts.
 * Used by the occasion badge on the sidebar (future sprint — not built here).
 * Built now so the data layer is complete.
 */
export async function getOccasionAlertCount(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<number>
```

---

### PART 5: Occasion Server Actions

#### `app/actions/occasions.ts`

```typescript
'use server'

/**
 * snoozeOccasion
 * Snoozes an occasion alert for the current user.
 * Does not affect other users in the org (per-user snooze).
 *
 * Validations:
 * 1. orgId + userId from session (never from input)
 * 2. occasionId must reference a valid local_occasions row
 * 3. duration must be '1_day', '3_days', or '1_week'
 *
 * On success:
 * - Upserts occasion_snoozes row (inserts or updates snoozed_until)
 * - Increments snooze_count
 * - Revalidates /dashboard path (removes card from feed)
 */
export async function snoozeOccasion(input: {
  occasionId: string
  duration: '1_day' | '3_days' | '1_week'
}): Promise<{ success: boolean; error?: string; snoozedUntil?: string }>

/**
 * dismissOccasionPermanently
 * Permanently dismisses an occasion for the current user by setting
 * snoozed_until to far future (year 9999 — effectively permanent in V1).
 *
 * Use case: User never wants to see "Valentine's Day" alerts (e.g., a hardware store).
 * Different from snooze — this is "never show me this again."
 *
 * In V1 there is no "undo dismiss" UI — acceptable given the use case.
 */
export async function dismissOccasionPermanently(input: {
  occasionId: string
}): Promise<{ success: boolean; error?: string }>

/**
 * createDraftFromOccasion
 * Creates a new content_draft seeded with the occasion context.
 * Navigates user to the content-drafts page after creation.
 *
 * This is the primary CTA on the OccasionAlertCard.
 *
 * Validations:
 * 1. orgId + locationId from session/active context (never from input)
 * 2. occasionId valid
 * 3. Admin+ role required (viewers cannot create drafts)
 * 4. Plan check: content drafts are Growth+ (planSatisfies)
 *
 * On success: redirect to /dashboard/content-drafts?new=[draftId]
 */
export async function createDraftFromOccasion(input: {
  occasionId: string
}): Promise<{ success: boolean; error?: string; draftId?: string }>
```

---

### PART 6: `OccasionAlertCard` Component

#### `app/dashboard/_components/OccasionAlertCard.tsx`

```typescript
/**
 * OccasionAlertCard — dismissible occasion alert for dashboard home.
 *
 * Shows a card for each OccasionAlert (max 3 at a time).
 * Each card has:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 🎆  Independence Day · In 3 days          [×] dismiss       │
 * │ Create AI-optimized content before July 4th to capture      │
 * │ "best [category] near me for the 4th" search intent.        │
 * │                                                             │
 * │ [Create Draft]  [Remind me ▾]                               │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Urgency styling:
 * - isUrgent (≤3 days): amber left border + amber background tint
 * - Normal (4-14 days): gray border, white background
 *
 * "Remind me ▾" dropdown options:
 * - Remind me tomorrow
 * - Remind me in 3 days
 * - Remind me next week
 * - Don't show again
 *
 * Interactions:
 * - [Create Draft] → calls createDraftFromOccasion(), redirects on success
 * - [×] dismiss → calls dismissOccasionPermanently() instantly (optimistic UI)
 * - Remind me options → calls snoozeOccasion() with appropriate duration
 * - On snooze/dismiss success: card animates out (CSS transition, not JS animation library)
 *
 * Loading states:
 * - [Create Draft] button shows spinner while action is pending
 * - [×] and snooze options disable while any action is pending
 *
 * Plan gating:
 * - [Create Draft] button is wrapped in a tooltip for Starter users:
 *   "Upgrade to Growth to create drafts"
 *   The button is visually present but disabled (not hidden) — shows what they're missing.
 *
 * data-testid values:
 * - occasion-alert-card-[occasionId]
 * - occasion-alert-name-[occasionId]
 * - occasion-alert-days-until-[occasionId]
 * - occasion-alert-create-draft-btn-[occasionId]
 * - occasion-alert-snooze-trigger-[occasionId]     (the "Remind me ▾" button)
 * - occasion-alert-snooze-1day-[occasionId]
 * - occasion-alert-snooze-3days-[occasionId]
 * - occasion-alert-snooze-1week-[occasionId]
 * - occasion-alert-dismiss-btn-[occasionId]        (the [×] button)
 *
 * Accessibility:
 * - [×] dismiss button: aria-label="Dismiss [occasion name] alert"
 * - Snooze dropdown: role="menu", each option role="menuitem"
 * - Urgency: aria-live="polite" on the card container (announces when card disappears)
 */
```

#### `app/dashboard/_components/OccasionAlertFeed.tsx`

```typescript
/**
 * OccasionAlertFeed — container for the occasion cards on dashboard home.
 *
 * Server Component that:
 * 1. Calls getOccasionAlerts() to load up to 3 active alerts
 * 2. If 0 alerts: renders nothing (no empty state — just hides)
 * 3. If 1–3 alerts: renders OccasionAlertCard for each
 *
 * Positioned on dashboard home: between the Reality Score card
 * and the hallucination feed (wherever makes most visual sense —
 * read app/dashboard/page.tsx layout carefully and insert accordingly).
 *
 * data-testid:
 * - occasion-alert-feed              (the container)
 * - occasion-alert-feed-empty        (only for testing — hidden in real UI)
 */
```

---

### PART 7: Content Drafts Empty State

#### Extend `app/dashboard/content-drafts/page.tsx`

Add an empty state when `content_drafts` has zero results for the current org + location.

```typescript
/**
 * Empty state design:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                                                             │
 * │              📄  No content drafts yet                      │
 * │                                                             │
 * │   Content drafts are auto-generated when LocalVector        │
 * │   detects a competitor outranking you on an AI query.       │
 * │                                                             │
 * │   To generate your first draft:                             │
 * │   1. Add competitors on the Compete page                    │
 * │   2. LocalVector detects intercepts overnight               │
 * │   3. AI drafts appear here for your review                  │
 * │                                                             │
 * │              [→ Go to Compete]                              │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Placement: replaces whatever currently shows for zero results
 *            (could be an empty table, could be nothing — read the page)
 *
 * The CTA button links to /dashboard/compete (or /dashboard/competitors —
 * check what the actual route is in NAV_ITEMS before hardcoding).
 *
 * data-testid:
 * - content-drafts-empty-state
 * - content-drafts-empty-cta
 *
 * Plan gating:
 * - If Starter plan: empty state CTA is still shown (Starter can see the Compete page)
 * - The PlanGate blur is on the content above this — empty state is always unblurred
 */
```

---

### PART 8: Sidebar Badge — `markSectionSeen` Integration

In `app/dashboard/content-drafts/page.tsx` and `app/dashboard/share-of-voice/page.tsx`:

```typescript
// At the start of each Server Component page, after auth + org context:
import { markSectionSeen } from '@/lib/badges/badge-counts'

// In the page component body (Server Component — no useEffect needed):
// Fire-and-forget is acceptable here — do not await if it would slow page load.
// Use a detached Promise or Edge-compatible background pattern.
void markSectionSeen(supabase, orgId, userId, 'content_drafts')
// OR
void markSectionSeen(supabase, orgId, userId, 'visibility')

// Alternatively, await it before the data fetches — it's a fast single-row upsert.
// Choose the pattern that matches how other side-effect calls are handled in the codebase.
// Read existing pages for precedent before deciding.
```

---

## 🧪 Tests — Write These FIRST (AI_RULES §4)

---

### Test File 1: `src/__tests__/unit/badge-counts.test.ts`

**~24 Vitest tests.**

```typescript
describe('getSidebarBadgeCounts', () => {
  // Content drafts badge
  it('returns contentDrafts=0 when no pending drafts')
  it('returns correct pending draft count')
  it('only counts drafts newer than last_seen_at')
  it('returns 0 when last_seen_at is very recent (just visited)')
  it('counts all pending drafts when sidebar_badge_state row absent (first visit)')
  it('respects locationId filter on content_drafts')

  // Visibility badge
  it('returns visibility=0 when no new SOV results')
  it('returns correct new SOV result count')
  it('only counts results newer than last_seen_at for visibility section')
  it('counts all new results when no sidebar_badge_state row for visibility')

  // Error handling
  it('returns { contentDrafts: 0, visibility: 0 } on DB error (never throws)')
  it('handles null locationId gracefully (returns counts without location filter)')

  // Cap
  it('returns exactly 99 when count is 99')
  it('returns 100 when count is 100 (not capped — formatBadgeCount handles display)')
})

describe('markSectionSeen', () => {
  it('inserts sidebar_badge_state row when absent (first visit)')
  it('updates last_seen_at when row already exists')
  it('upserts correctly — no duplicate rows on repeated calls')
  it('does not throw on DB error (fire-and-forget safe)')
  it('uses org_id + user_id + section as unique key')
})

describe('formatBadgeCount', () => {
  it('returns null for 0 (no badge shown)')
  it('returns "1" for 1')
  it('returns "99" for 99')
  it('returns "99+" for 100')
  it('returns "99+" for 999')
  it('returns null for negative numbers (defensive)')
})
```

---

### Test File 2: `src/__tests__/unit/occasion-feed.test.ts`

**~26 Vitest tests.**

```typescript
describe('getOccasionAlerts', () => {
  // 14-day window
  it('returns occasions within the next 14 days')
  it('does NOT return occasions more than 14 days away')
  it('does NOT return occasions in the past')
  it('returns occasion for today (daysUntil=0)')

  // Snooze filtering
  it('filters out occasions with active snooze (snoozed_until > now)')
  it('includes occasions whose snooze has expired (snoozed_until < now)')
  it('snooze is per-user — other users still see the snoozed occasion')

  // Already-actioned filtering
  it('filters out occasions where content_draft exists for this org')
  it('includes occasions where draft was created by another org (correct isolation)')

  // Limit
  it('returns at most 3 occasions even when more qualify')
  it('sorts by date ASC (most urgent first)')

  // Urgency
  it('sets isUrgent=true when daysUntil <= 3')
  it('sets isUrgent=false when daysUntil >= 4')

  // Edge cases
  it('returns [] when local_occasions table is empty')
  it('returns [] on DB error (never throws)')
  it('handles null locationId gracefully')
  it('handles recurring occasion dates correctly (if recurrence pattern used)')
})

describe('getOccasionAlertCount', () => {
  it('returns count of active (non-snoozed, non-actioned) occasions in next 14 days')
  it('returns 0 when all occasions snoozed')
  it('returns 0 on DB error (never throws)')
})
```

---

### Test File 3: `src/__tests__/unit/occasion-actions.test.ts`

**~22 Vitest tests.**

```typescript
describe('snoozeOccasion', () => {
  it('inserts occasion_snoozes row with correct snoozed_until for 1_day')
  it('inserts occasion_snoozes row with correct snoozed_until for 3_days')
  it('inserts occasion_snoozes row with correct snoozed_until for 1_week')
  it('updates existing snooze row (upsert on conflict)')
  it('increments snooze_count on re-snooze')
  it('orgId and userId from session — never from input')
  it('returns error for invalid duration string')
  it('returns error when occasionId does not exist')
  it('revalidates /dashboard path on success')
  it('returns snoozedUntil ISO string on success')
})

describe('dismissOccasionPermanently', () => {
  it('sets snoozed_until to far future (≥ year 9000)')
  it('upserts — works whether previous snooze exists or not')
  it('orgId and userId from session')
  it('revalidates /dashboard path on success')
})

describe('createDraftFromOccasion', () => {
  it('inserts content_draft with occasion context in title/body')
  it('sets location_id from active location (session — not input)')
  it('sets org_id from session (not input)')
  it('returns error when caller is viewer (admin+ required)')
  it('returns error when plan is not Growth+ (planSatisfies check)')
  it('returns draftId on success')
  it('returns error when occasionId does not exist')
  it('draft title includes occasion name')
  it('draft status = "pending" on creation')
})
```

---

### Test File 4: `src/__tests__/unit/occasion-alert-card.test.tsx`

**~18 Vitest tests.** Component tests using `@testing-library/react`.

```typescript
describe('OccasionAlertCard', () => {
  // Rendering
  it('renders occasion name')
  it('renders "Today" when daysUntil=0')
  it('renders "Tomorrow" when daysUntil=1')
  it('renders "In N days" when daysUntil >= 2')
  it('applies urgent styling when isUrgent=true')
  it('applies normal styling when isUrgent=false')

  // data-testid
  it('has correct data-testid attributes on all interactive elements')

  // Create Draft CTA
  it('calls createDraftFromOccasion when Create Draft clicked')
  it('shows loading spinner while createDraftFromOccasion is pending')
  it('disables all buttons while action is pending')
  it('shows disabled Create Draft with tooltip for Starter plan')

  // Dismiss
  it('calls dismissOccasionPermanently when × clicked')
  it('card disappears after dismiss (optimistic removal)')
  it('× button has correct aria-label')

  // Snooze dropdown
  it('snooze menu opens on trigger click')
  it('calls snoozeOccasion with 1_day when "Tomorrow" selected')
  it('calls snoozeOccasion with 3_days when "In 3 days" selected')
  it('calls snoozeOccasion with 1_week when "Next week" selected')
  it('card disappears after snooze (optimistic removal)')
})
```

---

### Test File 5: `src/__tests__/e2e/occasion-badges.spec.ts`

**~16 Playwright tests.**

```typescript
describe('Occasion Alert Feed E2E', () => {
  // Feed appears on dashboard
  it('occasion alert feed visible on dashboard home when active occasions exist')
  it('occasion alert feed hidden when no upcoming occasions')
  it('shows at most 3 occasion cards')
  it('most urgent occasion shown first (fewest days until)')

  // Snooze flow
  it('clicking "Remind me tomorrow" removes card from feed', async ({ page }) => {
    // Login as golden tenant
    // Navigate to /dashboard
    // Assert: occasion-alert-feed has at least one card
    // Click occasion-alert-snooze-trigger-[id]
    // Click occasion-alert-snooze-1day-[id]
    // Assert: card disappears from feed (optimistic)
    // Reload page
    // Assert: card still absent (snooze persisted)
  })

  it('snoozed occasion reappears after snooze expiry (tested with mock date)')
  it('clicking "Don\'t show again" permanently removes card')
  it('Create Draft button redirects to content-drafts page on success')
  it('Create Draft disabled with tooltip for Starter plan user')
})

describe('Sidebar Badges E2E', () => {
  it('amber badge visible on Content Drafts nav item when pending drafts exist')
  it('badge count matches actual pending draft count')
  it('badge disappears after visiting Content Drafts page')
  it('badge shows "99+" when count exceeds 99')

  it('amber badge visible on Visibility nav item when new SOV results exist')
  it('Visibility badge disappears after visiting SOV page')

  it('no badge shown when section is up to date (count = 0)')
})

describe('Content Drafts Empty State E2E', () => {
  it('empty state shown when no drafts exist')
  it('empty state CTA button links to Compete page')
  it('empty state hidden when drafts exist')
})
```

---

## 🔍 Pre-Implementation Diagnosis

Run every command. Document findings before writing code.

```bash
# ============================================================
# SIDEBAR INVESTIGATION
# ============================================================

# 1. Read sidebar completely
cat components/layout/Sidebar.tsx

# 2. Determine if it is a Server or Client Component
head -5 components/layout/Sidebar.tsx
# "use client" at top = Client Component. No directive = Server Component.

# 3. Check if badges are already architected
grep -n "badge\|Badge\|count\|Count\|pill\|Pill" components/layout/Sidebar.tsx

# 4. Find how dashboard layout passes data to sidebar
cat app/dashboard/layout.tsx 2>/dev/null || find app/dashboard -name "layout*"

# ============================================================
# LOCAL OCCASIONS INVESTIGATION
# ============================================================

# 5. Read local_occasions schema
grep -A30 "CREATE TABLE.*local_occasions" supabase/prod_schema.sql

# 6. Find seed data for local_occasions (32 occasions)
grep -r "local_occasions" supabase/ --include="*.sql" --include="*.ts" -l
find supabase -name "*occasion*" -o -name "*seed*" 2>/dev/null

# 7. Check date format: absolute or recurring?
grep -E "date|month|day|recur" supabase/prod_schema.sql | grep -i occasion

# ============================================================
# CONTENT DRAFTS INVESTIGATION
# ============================================================

# 8. Find content_drafts schema and status values
grep -A30 "CREATE TABLE.*content_drafts" supabase/prod_schema.sql
grep -E "status.*check|status.*enum|status.*default" supabase/prod_schema.sql | grep -i draft

# 9. Does content_drafts have location_id?
grep "location_id" supabase/prod_schema.sql | grep -i draft

# 10. Check current empty state handling in content-drafts page
grep -n "empty\|length.*0\|\.length ==" app/dashboard/content-drafts/page.tsx

# 11. Find the Compete page route
grep -r "compete\|competitor" components/layout/Sidebar.tsx
grep -r "compete\|competitor" app/dashboard --include="*.tsx" -l | head -5

# ============================================================
# VISIBILITY / SOV INVESTIGATION
# ============================================================

# 12. Which table represents "new SOV results"?
grep -E "visibility_analytics|sov_queries|sov_results" supabase/prod_schema.sql | head -10
# Look for: created_at column, location_id, org_id

# 13. Check existing SOV/visibility page
cat app/dashboard/share-of-voice/page.tsx 2>/dev/null || \
  find app/dashboard -name "*visibility*" -o -name "*sov*" | head -5

# ============================================================
# EXISTING NOTIFICATION / SNOOZE PATTERNS
# ============================================================

# 14. Check for any existing snooze or dismiss tables
grep -E "snooze|dismiss|notification_state|alert_state" supabase/prod_schema.sql

# 15. Check if occasion alerts are already wired anywhere
grep -r "OccasionAlert\|occasion_alert\|OccasionCard" app/ components/ --include="*.tsx" -l

# ============================================================
# DASHBOARD HOME INVESTIGATION
# ============================================================

# 16. Read dashboard home layout (where to insert OccasionAlertFeed)
cat app/dashboard/page.tsx

# 17. Find existing card components for visual consistency
ls app/dashboard/_components/ 2>/dev/null
```

**After diagnosis, document:**
- Sidebar: Server or Client Component? (determines badge data flow)
- `local_occasions`: absolute dates or recurring? (determines date computation logic)
- `content_drafts.status`: what are the exact values? (determines badge query)
- Is the Compete page at `/dashboard/compete` or `/dashboard/competitors`? (determines CTA link)
- Any existing snooze/dismiss table? (determines if migration is needed)

---

## 🧠 Edge Cases to Handle

1. **Sidebar badge fetch fails silently:** `getSidebarBadgeCounts()` must never throw. A DB error returns `{ contentDrafts: 0, visibility: 0 }`. The sidebar renders without badges. Users don't see an error. Log the failure server-side.

2. **`local_occasions` has no upcoming occasions in the next 14 days:** `getOccasionAlerts()` returns `[]`. `OccasionAlertFeed` renders nothing. The dashboard loads normally. No empty state for the occasion feed — it simply disappears.

3. **All 32 occasions are snoozed:** Same as above — feed is empty. Dashboard loads normally.

4. **User creates a draft manually for an occasion:** `getOccasionAlerts()` filters out occasions where a `content_draft` already exists. The alert disappears automatically after draft creation — even without a snooze. Read the schema to find how to link a draft to an occasion (e.g., `occasion_id` FK on `content_drafts`, or a `title` match). If no link exists, skip this filter for V1 and document it in MEMORY.md as a TODO.

5. **`snoozeOccasion` called twice rapidly (double-click):** The `UNIQUE (org_id, user_id, occasion_id)` constraint on `occasion_snoozes` + the upsert pattern means the second call simply updates the same row. No duplicate rows, no error.

6. **Occasion date is today (daysUntil = 0):** Show as "Today" not "In 0 days". Apply urgent styling. This is the highest-priority card — it sorts first.

7. **Badge count is 0 after visiting the page:** `markSectionSeen()` sets `last_seen_at = now()`. On the next page load, the badge query counts items newer than `now()` — which is 0. Badge disappears correctly. But: if the user opens a new tab and visits the page there first, the original tab still shows the badge until refreshed. Acceptable V1 behavior — no real-time sync.

8. **Sidebar badge count > 99:** `formatBadgeCount(100)` returns `"99+"`. The pill must be wide enough to display "99+" without overflow — `px-1` plus `min-w-[1.25rem]` handles up to 3 characters. Test at 99+ explicitly.

9. **OccasionAlertCard optimistic removal:** When user clicks dismiss or snooze, the card should disappear immediately (optimistic UI) without waiting for the server action to complete. If the server action fails, the card reappears. Implement with React `useState` on the parent `OccasionAlertFeed` — track dismissed IDs client-side.

10. **`createDraftFromOccasion` for Starter plan user:** The button is visually present but disabled. Show a tooltip: "Upgrade to Growth to create drafts." Do not hide the button — the user should see what they're missing. Use the `<PlanGate>` pattern or a simple `disabled` + `title` attribute. Check how other Growth-gated CTAs handle this in the codebase for consistency.

11. **`markSectionSeen` fire-and-forget in Server Component:** In a React Server Component, you cannot use `void promise` in the same way as in a Client Component. Options: (a) `await` it before other data fetches (adds ~10ms latency, cleanest), or (b) use `unstable_noStore()` + deferred pattern. Read the codebase for how other side-effects are handled in Server Components before choosing. Document the decision in MEMORY.md.

12. **Occasion `daysUntil` computation timezone:** Use the org's location `timezone` field (added in Sprint 100) to compute "days until" relative to the business's local time, not UTC. If `timezone` is null, fall back to UTC. A business in Hawaii should not see "July 4th is tomorrow" at UTC midnight on July 3rd.

13. **`OccasionAlertFeed` position on dashboard:** Read `app/dashboard/page.tsx` carefully. Insert the feed where it has the most visual salience without pushing critical data (Reality Score, hallucination feed) below the fold. Ideal: below the top KPI cards, above the hallucination list. If the dashboard layout is complex, add a comment explaining the placement decision.

14. **Snooze dropdown accessibility:** The "Remind me ▾" dropdown must be keyboard-navigable: `Tab` to focus trigger, `Enter`/`Space` to open, arrow keys to navigate options, `Enter` to select, `Escape` to close. Use a `<details>/<summary>` pattern or a proper `role="menu"` implementation. Do not use a `<select>` element (styling constraints).

15. **`dismissOccasionPermanently` uses far-future date:** Setting `snoozed_until = '9999-12-31'` is the simplest approach. The alternative is a separate `is_permanently_dismissed` boolean, but that adds schema complexity. Far-future date is clean and queryable with the same `snoozed_until > now()` filter. Document in MEMORY.md.

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `local_occasions` table (32 seeded occasions) | Sprint 61A | Source data for occasion alerts |
| `content_drafts` table + HITL review UI | Sprint 42, 48 | Badge count source + empty state |
| SOV Dashboard (`/share-of-voice`) | Sprint 61B, 74, 79 | Visibility badge target page |
| `lib/location/active-location.ts` | Sprint 100 | `getActiveLocationId()` for scoped queries |
| `lib/auth/org-roles.ts` | Sprint 98 | `assertOrgRole()` in `createDraftFromOccasion` |
| `lib/plan-enforcer.ts` + `planSatisfies()` | Sprint 3, 96 | Growth+ check in `createDraftFromOccasion` |
| `<PlanGate>` component | Sprint 96 | Plan gate on Create Draft button |
| `React.cache()` pattern | Sprint 99, 100 | Badge count memoization |
| Competitor analysis page (`/compete` or `/competitors`) | Sprint 3, 13 | Empty state CTA target — verify route |
| Golden Tenant | All sprints | `org_id: a0eebc99` — needs seeded occasions in test window |

---

## 📓 DEVLOG Entry Format

```markdown
## Sprint 101 — Occasion Alert Feed + Sidebar Badges (Gaps #58 + #59: 80%/50% → 100%)
**Date:** [DATE]
**Duration:** ~4 hours (Small sprint — S effort)

### Problem
Gap #58: Content Draft sidebar badge (amber count) never implemented.
  Users don't know drafts are waiting — engagement drops.
Gap #59: Occasion alerts exist in the DB but never surface to dashboard home.
  No snooze. No CTA. 32 seeded occasions sitting unused.
Content drafts empty state: blank page with no guidance on what to do next.

### Solution
- lib/badges/badge-counts.ts: getSidebarBadgeCounts() + markSectionSeen() + formatBadgeCount()
- Sidebar: amber badge pills on Content Drafts + Visibility nav items
- lib/occasions/occasion-feed.ts: 14-day window, snooze filter, draft-exists filter
- OccasionAlertCard + OccasionAlertFeed: dismissible, snoozeable, urgency-styled
- app/actions/occasions.ts: snooze, dismiss, createDraftFromOccasion
- Content drafts empty state: purposeful CTA to /dashboard/compete
- Migration: occasion_snoozes + sidebar_badge_state tables

### Files Changed
- `supabase/migrations/[timestamp]_occasion_snooze_sidebar_badges.sql` — NEW
- `lib/badges/badge-counts.ts` — NEW: badge count queries + markSectionSeen
- `lib/occasions/occasion-feed.ts` — NEW: occasion alert feed logic
- `app/actions/occasions.ts` — NEW: snooze, dismiss, createDraftFromOccasion
- `components/layout/Sidebar.tsx` — MODIFIED: amber badge pills
- `app/dashboard/page.tsx` — MODIFIED: OccasionAlertFeed inserted
- `app/dashboard/_components/OccasionAlertCard.tsx` — NEW
- `app/dashboard/_components/OccasionAlertFeed.tsx` — NEW
- `app/dashboard/content-drafts/page.tsx` — MODIFIED: empty state + markSectionSeen
- `app/dashboard/share-of-voice/page.tsx` — MODIFIED: markSectionSeen
- `src/__tests__/unit/badge-counts.test.ts` — NEW: [N] tests
- `src/__tests__/unit/occasion-feed.test.ts` — NEW: [N] tests
- `src/__tests__/unit/occasion-actions.test.ts` — NEW: [N] tests
- `src/__tests__/unit/occasion-alert-card.test.tsx` — NEW: [N] tests
- `src/__tests__/e2e/occasion-badges.spec.ts` — NEW: [N] tests

### Grep counts (run before committing):
grep -cE "^\s*(it|test)\(" src/__tests__/unit/badge-counts.test.ts              # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/occasion-feed.test.ts             # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/occasion-actions.test.ts          # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/occasion-alert-card.test.tsx      # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/e2e/occasion-badges.spec.ts            # [N]

### Gaps Closed
- Gap #58: Content Draft Sidebar Badge — 80% → 100%
- Gap #59: Occasion Alert Feed — 50% → 100%

### Next Sprint
Sprint 102 — Apple Business Connect Sync (Tier 4 begins)
  → Apple API registration should be submitted NOW if not already done.
```

---

## 🔮 AI_RULES Update — Add Rule §54 to `AI_RULES.md`

```markdown
## §54. 🔔 Badges + Occasion Alerts — Architecture Rules (Sprint 101)

### Sidebar badges
- `lib/badges/badge-counts.ts` is the ONLY place sidebar badge counts are computed.
  Never inline badge count queries in Sidebar.tsx or layout components.
- `getSidebarBadgeCounts()` returns 0 on any error — never throws.
  Sidebar must always render, with or without badges.
- `markSectionSeen()` is called at the top of the Server Component for each
  badged section page (content-drafts, share-of-voice). It is fire-and-forget
  safe but prefer awaiting it to avoid unhandled promise rejections.
- Badge counts use `sidebar_badge_state.last_seen_at` as the "seen" watermark.
  Items older than last_seen_at do not count toward the badge.
- `formatBadgeCount()` is the ONLY place the "99+" cap logic lives.
  Never implement the cap inline.

### Occasion alerts
- `lib/occasions/occasion-feed.ts` is the ONLY place occasion alert queries live.
  Never query `local_occasions` directly in page components.
- `getOccasionAlerts()` returns [] on any error — never throws.
  Dashboard must always load even if occasion query fails.
- Snooze uses far-future date (year 9999) for permanent dismiss — not a
  separate boolean column. Filter is always `snoozed_until > now()`.
- `occasion_snoozes` is per-user, not per-org. One user snoozed ≠ all users snoozed.
- Occasion urgency threshold: `daysUntil <= 3` = urgent. Hardcoded. Do not make
  this a config value in V1.
- OccasionAlertFeed shows maximum 3 cards. Never more.
- Optimistic UI on dismiss/snooze: card removes immediately client-side.
  Server action failure restores the card. Never leave the user waiting.

### Timezone
- Occasion `daysUntil` is computed in the location's IANA timezone
  (locations.timezone from Sprint 100). Fall back to UTC if null.
  Never compute daysUntil in server UTC time without timezone adjustment.
```

---

## ✅ Acceptance Criteria

**Sidebar Badges:**
- [ ] Amber badge visible on Content Drafts nav item when pending drafts exist
- [ ] Amber badge visible on Visibility nav item when new SOV results exist
- [ ] Badges show correct count (1–99) or "99+" when over limit
- [ ] Badge disappears after visiting the corresponding page
- [ ] No badge shown when count is 0
- [ ] `getSidebarBadgeCounts()` returns `{ 0, 0 }` on DB error (never crashes sidebar)

**Occasion Alert Feed:**
- [ ] `OccasionAlertFeed` visible on dashboard home when upcoming occasions exist
- [ ] Maximum 3 cards shown, sorted by urgency (fewest days first)
- [ ] Urgent occasions (≤3 days) have amber styling
- [ ] [×] dismiss removes card immediately (optimistic) and persists
- [ ] "Remind me" dropdown has 3 durations + "Don't show again"
- [ ] Snoozed occasion disappears and reappears after snooze expiry
- [ ] [Create Draft] creates a content_draft and redirects to content-drafts page
- [ ] [Create Draft] disabled with tooltip for Starter plan users
- [ ] `getOccasionAlerts()` returns [] on DB error (never crashes dashboard)
- [ ] All snooze dropdown options keyboard-accessible

**Content Drafts Empty State:**
- [ ] Empty state shown when `content_drafts` has zero pending items
- [ ] CTA button links to the Compete page (verify route is correct)
- [ ] Empty state hidden when drafts exist

**Tests + Quality:**
- [ ] All unit + component tests pass: `npx vitest run` (zero regressions)
- [ ] All E2E tests pass: `npx playwright test src/__tests__/e2e/occasion-badges.spec.ts`
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] No badge count queries inlined outside `lib/badges/badge-counts.ts`
- [ ] No `local_occasions` queries inlined outside `lib/occasions/occasion-feed.ts`
- [ ] `daysUntil` computed in location timezone, not raw UTC

---

## 🧾 Test Run Commands

```bash
npx vitest run src/__tests__/unit/badge-counts.test.ts              # ~24 tests
npx vitest run src/__tests__/unit/occasion-feed.test.ts             # ~26 tests
npx vitest run src/__tests__/unit/occasion-actions.test.ts          # ~22 tests
npx vitest run src/__tests__/unit/occasion-alert-card.test.tsx      # ~18 tests
npx vitest run                                                        # Full suite — 0 regressions
npx playwright test src/__tests__/e2e/occasion-badges.spec.ts       # ~16 tests
npx tsc --noEmit                                                      # 0 new type errors

# Total new tests: ~90 unit/component + ~16 E2E
```

---

## 📚 Document Sync + Git Commit (After All Tests Pass)

### Step 1: Update `/docs` files

**`docs/roadmap.md`** — Update Feature #58 (Content Draft Sidebar Badge) from `🟡 80%` to `✅ 100%`. Update Feature #59 (Occasion Alert Feed) from `🟡 50%` to `✅ 100%`.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 101 to completed sprints list. **Tier 3 is now complete.**

### Step 2: Update `DEVLOG.md`

Paste DEVLOG entry above. Replace all `[N]` with actual `grep -cE` counts.

### Step 3: Update `CLAUDE.md`

```markdown
### Sprint 101 — Occasion Alert Feed + Sidebar Badges (2026-03-XX)
- `lib/badges/badge-counts.ts` — Badge count queries + markSectionSeen + formatBadgeCount
- `lib/occasions/occasion-feed.ts` — 14-day occasion feed with snooze + draft filtering
- `app/actions/occasions.ts` — snooze, dismiss, createDraftFromOccasion
- `app/dashboard/_components/OccasionAlertCard.tsx` — Dismissible occasion card
- `app/dashboard/_components/OccasionAlertFeed.tsx` — Feed container (max 3)
- `components/layout/Sidebar.tsx` — Amber badge pills on Content Drafts + Visibility
- `app/dashboard/content-drafts/page.tsx` — Empty state CTA + markSectionSeen
- `app/dashboard/share-of-voice/page.tsx` — markSectionSeen on visit
- Migration: occasion_snoozes + sidebar_badge_state tables
- Tests: [N] Vitest + [N] Playwright
- Gap #58 closed: Content Draft Sidebar Badge 80% → 100%
- Gap #59 closed: Occasion Alert Feed 50% → 100%
- ✅ TIER 3 COMPLETE
```

### Step 4: Update `MEMORY.md`

```markdown
## Decision: Badge + Occasion Alert Architecture (Sprint 101 — 2026-03-XX)
- Badge watermark: sidebar_badge_state.last_seen_at per (org, user, section).
  Reset on page visit. Badge counts items newer than watermark.
- Occasion snooze: far-future date (year 9999) for permanent dismiss.
  Filter always uses snoozed_until > now(). No separate boolean column.
- Occasion alerts: per-user snooze (not per-org). Max 3 shown. 14-day window.
- daysUntil computed in location IANA timezone (falls back to UTC if null).
- Optimistic UI on dismiss/snooze — card removes immediately, restores on error.
- Tier 3 (Sprints 98–101) is now complete. Agency tier is fully shippable.
  Next: Tier 4 (Apple BC + Bing + FAQ injection). Register for APIs NOW.
```

### Step 5: Update `AI_RULES.md`

Append Rule §54 from the **🔮 AI_RULES Update** section above.

### Step 6: Final sync checklist

- [ ] `DEVLOG.md` — Sprint 101 entry with actual test counts
- [ ] `CLAUDE.md` — Sprint 101 in inventory + "✅ TIER 3 COMPLETE" note
- [ ] `MEMORY.md` — Badge + occasion architecture + Tier 3 completion note
- [ ] `AI_RULES.md` — Rule §54
- [ ] `docs/roadmap.md` — Features #58 + #59 → ✅ 100%
- [ ] `docs/09-BUILD-PLAN.md` — Sprint 101 checked, Tier 3 marked complete

### Step 7: Git commit

```bash
git add -A
git status

git commit -m "Sprint 101: Occasion Alert Feed + Sidebar Badges (Gaps #58+#59: 80%/50% → 100%)

- migration: occasion_snoozes (per-user snooze, far-future dismiss) + sidebar_badge_state
- lib/badges/badge-counts.ts: getSidebarBadgeCounts, markSectionSeen, formatBadgeCount
- lib/occasions/occasion-feed.ts: 14-day window, snooze+draft filter, timezone-aware
- app/actions/occasions.ts: snooze (3 durations), dismiss permanently, createDraftFromOccasion
- OccasionAlertCard: urgency styling, optimistic dismiss/snooze, plan-gated Create Draft
- OccasionAlertFeed: dashboard home (max 3 cards, sorted by urgency)
- Sidebar: amber badge pills on Content Drafts + Visibility (getSidebarBadgeCounts)
- content-drafts: empty state CTA → /dashboard/compete + markSectionSeen
- share-of-voice: markSectionSeen on visit
- tests: [N] Vitest + [N] Playwright passing
- docs: roadmap #58+#59 → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES §54

Closes Gap #58 + Gap #59.
✅ TIER 3 COMPLETE — Agency tier fully shippable (Sprints 98–101).
Next: Tier 4 — Apple Business Connect + Bing Places + Dynamic FAQ injection."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 101 completes:

- **Content Draft Sidebar Badge: 80% → 100%** (Gap #58 closed)
- **Occasion Alert Feed: 50% → 100%** (Gap #59 closed)
- **✅ TIER 3 IS COMPLETE** — The Agency tier is fully shippable across Sprints 98–101
- Users see amber badge counts the moment new drafts or SOV results arrive — no more silent accumulation
- The dashboard home surfaces upcoming occasions with contextual CTAs, driving content creation from calendar opportunities
- The snooze system gives users control without permanently losing the signal
- Content drafts' empty state turns a dead end into a clear path forward
- ~90 unit + ~16 Playwright tests protect every interaction path
- **Action required before Sprint 102:** Submit Apple Business Connect API registration + Bing Places API registration now if not already done. Tier 4 has external approval dependencies that cannot be code-solved.
