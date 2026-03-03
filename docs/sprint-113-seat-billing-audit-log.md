# Sprint 113 — Seat-Based Billing + Audit Log

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/plan-enforcer.ts`,
> `lib/membership/types.ts`, `lib/membership/membership-service.ts`,
> `lib/invitations/types.ts`

---

## 🎯 Objective

Build **Seat-Based Billing + Audit Log** — wire Stripe seat metering to `seat_count`, update the billing portal when membership changes, and capture a permanent audit trail of every membership event.

**What this sprint answers:** "How does adding a team member affect my bill, and who did what to my organization?"

**What Sprint 113 delivers:**
- `activity_log` table — append-only record of all membership events
- Stripe seat quantity updated automatically when members are added/removed/invited
- Billing portal page (`/dashboard/billing`) updated to show current seat usage and cost
- `GET /api/billing/seats` — current seat state for the billing UI
- `POST /api/billing/seats/sync` — force-sync seat count to Stripe (recovery tool)
- `GET /api/team/activity` — paginated audit log for org owners
- Activity log entries written by: invite sent, invite accepted, invite revoked, member removed, member role changed (stub for future)
- Seat overage guard: if `seat_count` exceeds plan max at billing sync time, flag the org for review (no hard block — Sprint 113 is billing infrastructure, not enforcement lockout)
- Stripe webhook handler extended: `customer.subscription.updated` now syncs seat quantity back to LocalVector if changed externally (e.g. via Stripe dashboard)

**What this sprint does NOT build:** hard seat enforcement lockout (that is a policy decision post-launch), role change UI (future sprint), Stripe subscription cancellation flow (existing billing handles plan downgrade).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                                 — All rules (50 rules as of Sprint 112)
Read CLAUDE.md                                   — Full implementation inventory
Read lib/membership/types.ts                     — MemberRole, SEAT_LIMITS
Read lib/membership/membership-service.ts        — removeMember(), canAddMember()
Read lib/invitations/types.ts                    — OrgInvitation, InvitationStatus
Read lib/plan-enforcer.ts                        — canAddMember(), getMaxSeats()
Read supabase/prod_schema.sql
  § FIND: organizations — plan_tier, seat_count (added Sprint 111), stripe_subscription_id
  § FIND: org_members — exact columns
  § FIND: org_invitations — exact columns (Sprint 112)
  § FIND: existing Stripe webhook handler location and pattern
  § FIND: existing billing page location (/dashboard/billing or similar)
Read app/api/webhooks/stripe/route.ts            — CRITICAL: existing webhook handler
Read app/dashboard/billing/page.tsx             — Existing billing page to extend
Read lib/supabase/database.types.ts             — All current types
Read src/__fixtures__/golden-tenant.ts           — Sprint 111 + 112 fixtures
Read supabase/seed.sql                           — Seed pattern
```

**Specifically understand before writing code:**

1. **The existing Stripe webhook handler** — read `app/api/webhooks/stripe/route.ts` completely. It already handles `checkout.session.completed` and `customer.subscription.updated`. You are EXTENDING it, not replacing it. Understand what it currently does with `customer.subscription.updated` before adding seat sync logic.

2. **`organizations.stripe_subscription_id`** — verify this column name and type from `prod_schema.sql`. This is how you find the Stripe subscription to update. If the column name differs, use the actual name.

3. **Stripe API for quantity updates** — seat metering uses `stripe.subscriptions.update(subscriptionId, { items: [{ id: itemId, quantity: newSeatCount }] })`. You need both the subscription ID AND the subscription item ID (the line item within the subscription). Plan the lookup carefully.

4. **Append-only audit log** — `activity_log` has NO DELETE policy and NO UPDATE policy. Rows are permanent. This is intentional for compliance. RLS only allows INSERT (service role) and SELECT (org members).

5. **Existing billing page** — read its current structure. You are adding a "Seat Usage" section to it, not rewriting it.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/billing/
  index.ts                  — barrel export
  types.ts                  — SeatState, ActivityLogEntry, ActivityEventType
  seat-billing-service.ts   — Stripe seat sync + seat state queries (pure after DB fetch)
  activity-log-service.ts   — append-only log write + paginated read

app/api/billing/
  seats/
    route.ts                — GET seat state
    sync/
      route.ts              — POST force-sync seats to Stripe

app/api/team/
  activity/
    route.ts                — GET paginated audit log

app/api/webhooks/stripe/
  route.ts                  — MODIFY: add seat sync on subscription.updated

app/dashboard/billing/
  _components/
    SeatUsageCard.tsx        — Seat count + cost breakdown widget
    ActivityLogTable.tsx     — Paginated audit log (owners only)
```

---

### Component 1: Types — `lib/billing/types.ts`

```typescript
import type { MemberRole } from '@/lib/membership/types';

/**
 * All membership-related events that get written to activity_log.
 */
export type ActivityEventType =
  | 'member_invited'       // invitation sent
  | 'member_joined'        // invitation accepted
  | 'member_removed'       // member removed by owner/admin
  | 'invitation_revoked'   // pending invitation revoked
  | 'role_changed'         // member role changed (stub — UI not built yet)
  | 'seat_sync'            // Stripe seat count synced (automated or manual)
  | 'member_left';         // future: member left voluntarily

/**
 * A single audit log entry.
 */
export interface ActivityLogEntry {
  id: string;
  org_id: string;
  event_type: ActivityEventType;
  actor_user_id: string | null;    // null for system events (automated seat sync)
  actor_email: string | null;      // denormalized for display
  target_user_id: string | null;   // the user the event is about (null for invite_sent)
  target_email: string;            // denormalized — always present
  target_role: MemberRole | null;  // the role at time of event
  metadata: Record<string, unknown>; // flexible JSON for event-specific data
  created_at: string;
}

/**
 * Current seat state for billing display and Stripe sync.
 */
export interface SeatState {
  org_id: string;
  plan_tier: string;
  current_seat_count: number;   // from organizations.seat_count
  max_seats: number | null;     // from SEAT_LIMITS[plan_tier]
  usage_percent: number;        // current / max * 100 (null if unlimited)
  stripe_subscription_id: string | null;
  stripe_quantity: number | null;  // what Stripe currently has — may differ from DB
  in_sync: boolean;               // stripe_quantity === current_seat_count
  monthly_seat_cost_cents: number; // current_seat_count × per_seat_price_cents
  per_seat_price_cents: number;    // from SEAT_PRICE_CENTS[plan_tier]
}

/**
 * Per-seat monthly price in cents.
 * Agency plan: $15/seat/month (above the base plan price).
 * Other plans: no seat pricing (single seat included in plan).
 */
export const SEAT_PRICE_CENTS: Record<string, number> = {
  trial:   0,
  starter: 0,
  growth:  0,
  agency:  1500,  // $15.00 per additional seat per month
} as const;
// Note: seat 1 (the owner) is included in the Agency base price.
// Additional seats (seat_count > 1) are billed at $15/seat.
// monthly_seat_cost_cents = max(0, seat_count - 1) * 1500

/**
 * Pagination params for activity log.
 */
export interface ActivityLogParams {
  page: number;       // 1-indexed
  per_page: number;   // default 20, max 50
}

export interface ActivityLogPage {
  entries: ActivityLogEntry[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}
```

---

### Component 2: Migration — `supabase/migrations/[timestamp]_activity_log.sql`

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 113: Seat-Based Billing + Audit Log
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. activity_log table (append-only — no UPDATE, no DELETE in RLS)
CREATE TABLE IF NOT EXISTS public.activity_log (
  id              uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid                NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type      text                NOT NULL
                                      CHECK (event_type IN (
                                        'member_invited', 'member_joined', 'member_removed',
                                        'invitation_revoked', 'role_changed', 'seat_sync', 'member_left'
                                      )),
  actor_user_id   uuid                REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     text,               -- denormalized, preserved even if user deleted
  target_user_id  uuid                REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email    text                NOT NULL,
  target_role     public.member_role,
  metadata        jsonb               NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.activity_log IS
  'Append-only audit log of all membership events. Sprint 113. '
  'NO DELETE or UPDATE policies — rows are permanent for compliance. '
  'Actor_email and target_email are denormalized to preserve history '
  'even when the user account is later deleted.';

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_org_id
  ON public.activity_log (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_target_user
  ON public.activity_log (target_user_id) WHERE target_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_event_type
  ON public.activity_log (org_id, event_type);

-- 3. RLS — append-only
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- All org members can read the audit log (transparency)
CREATE POLICY "activity_log: org members can read"
  ON public.activity_log FOR SELECT
  USING (org_id = public.current_user_org_id());

-- NO INSERT policy for user role — only service role writes
-- (all writes go through activity-log-service.ts with service role client)

-- Service role full access (INSERT only in practice — no UPDATE/DELETE)
CREATE POLICY "activity_log: service role insert"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Explicitly NO UPDATE policy (append-only)
-- Explicitly NO DELETE policy (append-only)

-- 4. Add stripe_item_id to organizations (needed for seat quantity updates)
--    Stripe subscriptions have a subscription_id AND a subscription_item_id
--    (the line item). We need both to update quantity.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_subscription_item_id text;

COMMENT ON COLUMN public.organizations.stripe_subscription_item_id IS
  'The Stripe subscription item ID (si_xxx) for the main plan line item. '
  'Required for updating seat quantity via stripe.subscriptions.update(). '
  'Populated when subscription is created or on first seat sync. Sprint 113.';

-- 5. Add seat_overage_flagged column (soft flag, no hard block)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS seat_overage_flagged boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.seat_overage_flagged IS
  'True if seat_count exceeds plan max at last billing sync. '
  'Not a hard block — used for admin review. Sprint 113.';
```

---

### Component 3: Seat Billing Service — `lib/billing/seat-billing-service.ts`

```typescript
/**
 * Seat metering service. All Stripe calls isolated here.
 * Caller passes Supabase client. Stripe client initialized internally.
 *
 * ── getSeatState(supabase, orgId) ─────────────────────────────────────────────
 * 1. Fetch org: plan_tier, seat_count, stripe_subscription_id,
 *               stripe_subscription_item_id from organizations
 * 2. If no stripe_subscription_id: stripe_quantity = null, in_sync = true
 *    (free/trial orgs have no Stripe subscription)
 * 3. If stripe_subscription_id present: fetch subscription from Stripe
 *    to get current quantity on the main item
 *    stripe.subscriptions.retrieve(subscriptionId, { expand: ['items'] })
 *    Find the item matching stripe_subscription_item_id (or first item if null)
 *    stripe_quantity = item.quantity
 *    in_sync = (stripe_quantity === seat_count)
 * 4. Compute monthly_seat_cost_cents:
 *    max(0, seat_count - 1) * SEAT_PRICE_CENTS[plan_tier]
 *    (first seat included in base plan)
 * 5. Return SeatState
 *
 * ── syncSeatsToStripe(supabase, orgId, newSeatCount) ─────────────────────────
 * Called after any membership change (invite accepted, member removed).
 * Uses service role client.
 * 1. Fetch org stripe_subscription_id and stripe_subscription_item_id
 * 2. If no stripe_subscription_id: log 'no_stripe_subscription', return early (no error)
 * 3. If no stripe_subscription_item_id:
 *    a. Fetch subscription from Stripe to find the item ID
 *    b. stripe.subscriptions.retrieve(subscriptionId, { expand: ['items'] })
 *    c. Save item ID to organizations.stripe_subscription_item_id
 * 4. Update Stripe:
 *    stripe.subscriptions.update(subscriptionId, {
 *      items: [{ id: itemId, quantity: newSeatCount }],
 *      proration_behavior: 'create_prorations',  // prorate mid-cycle additions
 *    })
 * 5. On Stripe error: log error, write 'seat_sync' activity_log with
 *    metadata: { success: false, error: error.message, attempted_quantity: newSeatCount }
 *    DO NOT throw — billing sync failure must never block membership operations
 * 6. On success: write 'seat_sync' activity_log with
 *    metadata: { success: true, previous_quantity, new_quantity: newSeatCount }
 * 7. Check for overage: if newSeatCount > SEAT_LIMITS[plan_tier]:
 *    UPDATE organizations SET seat_overage_flagged = true
 *    Log warning (do not block)
 * 8. Return { success: boolean; stripe_quantity: number }
 *
 * ── syncSeatsFromStripe(supabase, orgId, stripeQuantity) ─────────────────────
 * Called by webhook when Stripe subscription.updated fires.
 * If stripeQuantity differs from DB seat_count:
 * 1. If stripeQuantity < seat_count: this means seats were reduced externally
 *    (e.g. admin reduced via Stripe dashboard). Update seat_count in DB.
 *    Write activity_log: seat_sync with metadata: { source: 'stripe_webhook',
 *    previous: seat_count, new: stripeQuantity }
 * 2. If stripeQuantity > seat_count: possible manual upgrade via Stripe.
 *    Update seat_count. Write activity_log with same pattern.
 * 3. If equal: no-op.
 *
 * ── STRIPE CLIENT INIT ────────────────────────────────────────────────────────
 * Initialize Stripe at the top of the service file (not in each function):
 * import Stripe from 'stripe';
 * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
 *   apiVersion: '2024-12-18.acacia', // use the version already in the codebase
 * });
 * Verify the Stripe API version by reading the existing webhook handler.
 * Use the SAME version string.
 *
 * ── ERROR HANDLING PHILOSOPHY ─────────────────────────────────────────────────
 * Billing sync failure MUST NOT block membership operations.
 * Always catch Stripe errors. Log them. Write a failed seat_sync log entry.
 * Return { success: false } — never throw from syncSeatsToStripe.
 * The membership operation (invite accepted, member removed) already succeeded.
 * The billing will be reconciled by the force-sync endpoint if needed.
 */
```

---

### Component 4: Activity Log Service — `lib/billing/activity-log-service.ts`

```typescript
/**
 * Append-only audit log service.
 * All writes use service role client — RLS has no user INSERT policy.
 *
 * ── logActivity(supabase, entry) ──────────────────────────────────────────────
 * INSERT INTO activity_log (org_id, event_type, actor_user_id, actor_email,
 *   target_user_id, target_email, target_role, metadata)
 * VALUES (...)
 * Returns the created ActivityLogEntry.
 * On error: log to console. DO NOT throw — audit logging must never
 * block the primary operation.
 *
 * ── getActivityLog(supabase, orgId, params) ────────────────────────────────────
 * SELECT from activity_log WHERE org_id = $orgId
 * ORDER BY created_at DESC
 * OFFSET (page - 1) * per_page LIMIT per_page
 * Also runs COUNT(*) for total.
 * Returns ActivityLogPage.
 *
 * ── Convenience wrappers (pure builders that call logActivity) ────────────────
 * Each wrapper builds the correct entry shape and calls logActivity().
 *
 * logInviteSent(supabase, { orgId, actorUserId, actorEmail,
 *   targetEmail, targetRole, invitationId }):
 *   event_type: 'member_invited'
 *   metadata: { invitation_id: invitationId }
 *
 * logInviteAccepted(supabase, { orgId, targetUserId, targetEmail,
 *   targetRole, invitationId }):
 *   event_type: 'member_joined'
 *   actor_user_id: null (invitee accepted — they initiated it)
 *   metadata: { invitation_id: invitationId }
 *
 * logInviteRevoked(supabase, { orgId, actorUserId, actorEmail,
 *   targetEmail, invitationId }):
 *   event_type: 'invitation_revoked'
 *   metadata: { invitation_id: invitationId }
 *
 * logMemberRemoved(supabase, { orgId, actorUserId, actorEmail,
 *   targetUserId, targetEmail, targetRole }):
 *   event_type: 'member_removed'
 *   metadata: {}
 *
 * logSeatSync(supabase, { orgId, previousCount, newCount, success, source, error? }):
 *   event_type: 'seat_sync'
 *   actor_user_id: null (system event)
 *   target_email: 'system'
 *   metadata: { previous_count, new_count, success, source, error }
 */
```

---

### Component 5: Integration Points

**Where to call `syncSeatsToStripe()` and `logActivity()`:**

After Sprint 112 built the invite and remove flows, those service functions need activity logging and seat sync wired in. The call sites are:

#### In `lib/invitations/invitation-service.ts` — MODIFY `acceptInvitation()`

After the successful `INSERT INTO org_members` and UPDATE invitation status:
```typescript
// Fire-and-forget — do not await, do not block the response
void syncSeatsToStripe(supabase, orgId, newSeatCount);
void logInviteAccepted(supabase, { orgId, targetUserId, targetEmail, targetRole, invitationId });
```

After the successful `INSERT INTO org_invitations` in `sendInvitation()`:
```typescript
void logInviteSent(supabase, { orgId, actorUserId, actorEmail, targetEmail, targetRole, invitationId });
```

After `UPDATE status='revoked'` in `revokeInvitation()`:
```typescript
void logInviteRevoked(supabase, { orgId, actorUserId, actorEmail, targetEmail, invitationId });
```

#### In `lib/membership/membership-service.ts` — MODIFY `removeMember()`

After the successful DELETE:
```typescript
void syncSeatsToStripe(supabase, orgId, newSeatCount);
void logMemberRemoved(supabase, { orgId, actorUserId, actorEmail, targetUserId, targetEmail, targetRole });
```

**Fire-and-forget pattern:** use `void functionCall()` — the primary operation has already succeeded. Audit logging and billing sync run asynchronously without blocking the API response.

---

### Component 6: API Routes

#### `app/api/billing/seats/route.ts`

```typescript
/**
 * GET /api/billing/seats
 * Returns current seat state for the billing UI.
 *
 * Auth: session required. Any org member can view.
 * Plan: all plans (trial/starter/growth show seat_count=1, no Stripe sync).
 *
 * Response: SeatState
 *
 * Note: This calls getSeatState() which may call the Stripe API to get
 * current quantity. Add a 5-second timeout guard. If Stripe call times out,
 * return SeatState with stripe_quantity=null, in_sync=true (conservative).
 *
 * Error codes:
 * - 401: not authenticated
 * - 500: unexpected error
 */
```

#### `app/api/billing/seats/sync/route.ts`

```typescript
/**
 * POST /api/billing/seats/sync
 * Force-syncs seat count to Stripe. Recovery tool for admins.
 *
 * Auth: session required. Owner only.
 * Plan: Agency only (only Agency has Stripe seat billing).
 *
 * What it does:
 * 1. Fetch current seat_count from DB
 * 2. Call syncSeatsToStripe(supabase, orgId, seat_count)
 * 3. Return { ok: true; previous_stripe_quantity; new_quantity; success }
 *
 * Error codes:
 * - 401: not authenticated
 * - 403: not_owner | plan_upgrade_required
 * - 500: unexpected error
 */
```

#### `app/api/team/activity/route.ts`

```typescript
/**
 * GET /api/team/activity?page=1&per_page=20
 * Returns paginated audit log for the org.
 *
 * Auth: session required. Owner and admin only.
 * Plan: Agency only (others see empty state with upgrade prompt).
 *
 * Query params:
 *   page: integer ≥ 1 (default: 1)
 *   per_page: integer 1–50 (default: 20)
 *
 * Response: ActivityLogPage
 *
 * Error codes:
 * - 401: not authenticated
 * - 403: insufficient_role (analyst/viewer)
 */
```

#### `app/api/webhooks/stripe/route.ts` — MODIFY

```typescript
/**
 * EXTEND the existing webhook handler.
 * Find the existing switch/if block handling event types.
 * Add handling for 'customer.subscription.updated':
 *
 * When event.type === 'customer.subscription.updated':
 * 1. Find org by stripe_subscription_id:
 *    SELECT id FROM organizations WHERE stripe_subscription_id = event.data.object.id
 * 2. If not found: log warning, return 200 (webhook must always return 200)
 * 3. Get the new quantity from event.data.object.items.data[0].quantity
 * 4. Call syncSeatsFromStripe(supabase, orgId, newQuantity)
 *
 * IMPORTANT: Read the existing handler carefully before modifying.
 * Do not change any existing event handling.
 * Add ONLY the new case. Return 200 for all cases (Stripe requirement).
 */
```

---

### Component 7: Dashboard Updates

#### `app/dashboard/billing/_components/SeatUsageCard.tsx`

```typescript
/**
 * 'use client'
 * Shows on the /dashboard/billing page.
 * Fetches from GET /api/billing/seats on mount.
 *
 * Layout:
 * ┌──────────────────────────────────────────────┐
 * │  Team Seats                                  │
 * │  ──────────────────────────────────────────  │
 * │  3 / 10 seats used                           │
 * │  ████████░░░░░░░░░░░░░░░ 30%                 │
 * │                                              │
 * │  Monthly seat cost:                          │
 * │  2 additional seats × $15.00 = $30.00/mo    │
 * │  (first seat included in Agency plan)        │
 * │                                              │
 * │  Stripe sync: ✅ In sync                     │
 * │  [Force Sync →]  (owner only)                │
 * └──────────────────────────────────────────────┘
 *
 * States:
 * - Loading: skeleton
 * - Non-Agency plan: "Team seats are available on the Agency plan."
 *   No cost breakdown shown.
 * - Agency, in_sync=true: green sync badge
 * - Agency, in_sync=false: yellow "⚠️ Out of sync" + [Force Sync →] button
 * - seat_overage_flagged=true: red banner
 *   "Your team exceeds the plan seat limit. Contact support."
 *
 * [Force Sync →]: calls POST /api/billing/seats/sync
 *   Only rendered for owner role.
 *   Shows loading spinner during call.
 *   On success: shows "Synced ✅" for 3 seconds.
 *   On error: shows "Sync failed. Try again."
 *
 * data-testid:
 *   "seat-usage-card"
 *   "seat-count-text"
 *   "seat-usage-bar"
 *   "monthly-cost-text"
 *   "stripe-sync-status"
 *   "force-sync-btn"
 *   "seat-overage-banner"
 */
```

#### `app/dashboard/billing/page.tsx` — MODIFY

```typescript
/**
 * Add SeatUsageCard to the existing billing page.
 * Insert it ABOVE the current plan/invoice section.
 * Do not rewrite the existing page — add the new section.
 *
 * Also add ActivityLogTable below the existing content
 * (only for Agency plan owners/admins).
 */
```

#### `app/dashboard/team/_components/ActivityLogTable.tsx`

```typescript
/**
 * 'use client'
 * Paginated audit log table. Shown on /dashboard/billing (below seat usage).
 * Also accessible from /dashboard/team (link: "View full audit log →").
 *
 * Columns: Date/Time, Event, Actor, Target, Role
 *
 * Event display names:
 *   member_invited      → "Invitation sent"
 *   member_joined       → "Member joined"
 *   member_removed      → "Member removed"
 *   invitation_revoked  → "Invitation revoked"
 *   seat_sync           → "Seat sync" (show success/failed badge from metadata)
 *   role_changed        → "Role changed"
 *   member_left         → "Member left"
 *
 * Pagination: [← Previous] [Page 1 of N] [Next →]
 * Fetches GET /api/team/activity?page=N&per_page=20
 *
 * Empty state: "No membership activity yet."
 *
 * Plan gate: Agency + owner/admin only.
 *   Others see: "Activity log is available to Agency plan owners and admins."
 *
 * data-testid:
 *   "activity-log-table"
 *   "activity-log-row-{id}"
 *   "activity-log-prev-btn"
 *   "activity-log-next-btn"
 *   "activity-log-empty"
 */
```

---

### Component 8: Seed Data

```sql
-- In supabase/seed.sql — add activity log entries for golden tenant

DO $$
DECLARE
  v_org_id    uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_owner_id  uuid;
BEGIN
  SELECT user_id INTO v_owner_id
  FROM public.org_members
  WHERE org_id = v_org_id AND role = 'owner'
  LIMIT 1;

  INSERT INTO public.activity_log (
    id, org_id, event_type, actor_user_id, actor_email,
    target_user_id, target_email, target_role, metadata, created_at
  ) VALUES
  (
    gen_random_uuid(), v_org_id, 'member_invited', v_owner_id, 'aruna@charcoalnchill.com',
    NULL, 'newmember@example.com', 'analyst',
    '{"invitation_id": "inv-seed-001"}'::jsonb,
    NOW() - INTERVAL '1 hour'
  ),
  (
    gen_random_uuid(), v_org_id, 'seat_sync', NULL, NULL,
    NULL, 'system', NULL,
    '{"success": true, "source": "seed", "previous_count": 0, "new_count": 1}'::jsonb,
    NOW() - INTERVAL '60 days'
  )
  ON CONFLICT DO NOTHING;
END $$;
```

---

### Component 9: Golden Tenant Fixtures

```typescript
// Sprint 113 — billing + audit log fixtures
import type { SeatState, ActivityLogEntry, ActivityLogPage } from '@/lib/billing/types';

export const MOCK_SEAT_STATE_AGENCY: SeatState = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  plan_tier: 'agency',
  current_seat_count: 3,
  max_seats: 10,
  usage_percent: 30,
  stripe_subscription_id: 'sub_mock_agency_001',
  stripe_quantity: 3,
  in_sync: true,
  monthly_seat_cost_cents: 3000,   // 2 additional seats × $15 = $30
  per_seat_price_cents: 1500,
};

export const MOCK_SEAT_STATE_OUT_OF_SYNC: SeatState = {
  ...MOCK_SEAT_STATE_AGENCY,
  stripe_quantity: 2,   // Stripe has 2 but DB has 3
  in_sync: false,
};

export const MOCK_SEAT_STATE_GROWTH: SeatState = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  plan_tier: 'growth',
  current_seat_count: 1,
  max_seats: 1,
  usage_percent: 100,
  stripe_subscription_id: null,
  stripe_quantity: null,
  in_sync: true,
  monthly_seat_cost_cents: 0,
  per_seat_price_cents: 0,
};

export const MOCK_ACTIVITY_LOG_ENTRIES: ActivityLogEntry[] = [
  {
    id: 'log-001',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    event_type: 'member_invited',
    actor_user_id: 'golden-user-id',
    actor_email: 'aruna@charcoalnchill.com',
    target_user_id: null,
    target_email: 'newmember@example.com',
    target_role: 'analyst',
    metadata: { invitation_id: 'inv-seed-001' },
    created_at: '2026-03-01T23:00:00.000Z',
  },
  {
    id: 'log-002',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    event_type: 'seat_sync',
    actor_user_id: null,
    actor_email: null,
    target_user_id: null,
    target_email: 'system',
    target_role: null,
    metadata: { success: true, source: 'seed', previous_count: 0, new_count: 1 },
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

export const MOCK_ACTIVITY_LOG_PAGE: ActivityLogPage = {
  entries: MOCK_ACTIVITY_LOG_ENTRIES,
  total: 2,
  page: 1,
  per_page: 20,
  has_more: false,
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/seat-billing-service.test.ts`

**Stripe and Supabase mocked.**

```
describe('getSeatState — Supabase + Stripe mocked')
  1.  returns correct seat_count and max_seats for agency plan
  2.  returns stripe_quantity from Stripe API when subscription exists
  3.  in_sync = true when DB seat_count === stripe_quantity
  4.  in_sync = false when DB seat_count !== stripe_quantity
  5.  returns stripe_quantity=null and in_sync=true when no stripe_subscription_id
  6.  monthly_seat_cost_cents = 0 for growth plan (no seat billing)
  7.  monthly_seat_cost_cents = 3000 for agency with 3 seats (2 additional × $15)
  8.  monthly_seat_cost_cents = 0 for agency with 1 seat (first seat included)
  9.  handles Stripe API timeout gracefully: returns in_sync=true, stripe_quantity=null

describe('syncSeatsToStripe — Stripe + Supabase mocked')
  10. calls stripe.subscriptions.update with correct quantity
  11. fetches stripe_subscription_item_id from Stripe if not cached in DB
  12. saves stripe_subscription_item_id to organizations table after fetch
  13. returns { success: false } (does NOT throw) when Stripe returns error
  14. writes seat_sync activity_log entry on success
  15. writes seat_sync activity_log entry with success=false on Stripe error
  16. sets seat_overage_flagged=true when newSeatCount > SEAT_LIMITS[plan_tier]
  17. returns early (no error) when org has no stripe_subscription_id

describe('syncSeatsFromStripe — Supabase mocked')
  18. updates seat_count when stripeQuantity < DB seat_count
  19. updates seat_count when stripeQuantity > DB seat_count
  20. no-op when stripeQuantity === DB seat_count
  21. writes seat_sync log with source='stripe_webhook'
```

**21 tests.**

---

### Test File 2: `src/__tests__/unit/activity-log-service.test.ts`

**Supabase mocked. Pure builder functions zero mocks.**

```
describe('logActivity — Supabase mocked (service role)')
  1.  INSERT called with correct org_id and event_type
  2.  returns created ActivityLogEntry on success
  3.  does NOT throw on Supabase error (fire-and-forget pattern)

describe('logInviteSent — calls logActivity with correct shape')
  4.  event_type = 'member_invited'
  5.  metadata contains invitation_id
  6.  target_user_id = null (invitee not yet a user)

describe('logInviteAccepted — calls logActivity')
  7.  event_type = 'member_joined'
  8.  actor_user_id = null (invitee accepted — no external actor)

describe('logInviteRevoked — calls logActivity')
  9.  event_type = 'invitation_revoked'
  10. actor_user_id = revoker's user_id

describe('logMemberRemoved — calls logActivity')
  11. event_type = 'member_removed'
  12. target_role = role at time of removal

describe('logSeatSync — calls logActivity')
  13. event_type = 'seat_sync'
  14. actor_user_id = null (system event)
  15. metadata.success = false when sync failed

describe('getActivityLog — Supabase mocked')
  16. returns entries sorted created_at DESC
  17. respects page and per_page params
  18. returns has_more=true when total > page * per_page
  19. returns empty entries array when no log entries (no crash)
  20. returns correct total count
```

**20 tests.**

---

### Test File 3: `src/__tests__/unit/billing-routes.test.ts`

```
describe('GET /api/billing/seats')
  1.  returns 401 when not authenticated
  2.  returns SeatState with correct shape
  3.  returns non-Agency state (no Stripe fields) for growth plan

describe('POST /api/billing/seats/sync')
  4.  returns 401 when not authenticated
  5.  returns 403 'not_owner' for admin/analyst/viewer callers
  6.  returns 403 'plan_upgrade_required' for non-Agency plan
  7.  calls syncSeatsToStripe with current seat_count
  8.  returns { ok: true, previous_stripe_quantity, new_quantity, success }

describe('GET /api/team/activity')
  9.  returns 401 when not authenticated
  10. returns 403 'insufficient_role' for analyst and viewer
  11. returns ActivityLogPage with entries for owner/admin
  12. respects page query param
  13. respects per_page query param (max 50 enforced)
  14. returns empty ActivityLogPage when no logs exist (not 404)

describe('Stripe webhook — subscription.updated')
  15. calls syncSeatsFromStripe when event type matches
  16. returns 200 even when org not found for subscription_id
  17. returns 200 even when syncSeatsFromStripe throws
  18. does not affect other webhook event handling (regression test)
```

**18 tests.**

---

### Test File 4: `src/__tests__/e2e/seat-billing.spec.ts` — Playwright

```typescript
describe('Seat-Based Billing UI', () => {

  test('Billing page shows SeatUsageCard for Agency plan', async ({ page }) => {
    // Mock GET /api/billing/seats → MOCK_SEAT_STATE_AGENCY
    // Navigate to /dashboard/billing
    // Assert: data-testid="seat-usage-card" visible
    // Assert: "3 / 10 seats used" text visible
    // Assert: data-testid="monthly-cost-text" shows "$30.00/mo"
    // Assert: data-testid="stripe-sync-status" shows "In sync"
  });

  test('Out-of-sync state shows warning and force sync button', async ({ page }) => {
    // Mock GET /api/billing/seats → MOCK_SEAT_STATE_OUT_OF_SYNC
    // Assert: "⚠️ Out of sync" visible
    // Assert: data-testid="force-sync-btn" visible
  });

  test('Force sync button calls API and shows success', async ({ page }) => {
    // Mock POST /api/billing/seats/sync → { ok: true, success: true, new_quantity: 3 }
    // Click force-sync-btn
    // Assert: loading spinner visible during call
    // Assert: "Synced ✅" appears after success
  });

  test('Non-Agency plan shows no seat cost breakdown', async ({ page }) => {
    // Mock GET /api/billing/seats → MOCK_SEAT_STATE_GROWTH
    // Assert: seat-usage-card visible
    // Assert: "Agency plan" upgrade text visible
    // Assert: monthly-cost-text NOT visible (or shows $0)
  });

  test('Activity log table shows membership events', async ({ page }) => {
    // Mock GET /api/team/activity → MOCK_ACTIVITY_LOG_PAGE
    // Navigate to /dashboard/billing
    // Assert: data-testid="activity-log-table" visible
    // Assert: "Invitation sent" row visible
    // Assert: "newmember@example.com" visible in table
    // Assert: "Seat sync" row visible
  });

  test('Activity log pagination controls', async ({ page }) => {
    // Mock 25 total entries (2 pages)
    // Assert: next-btn visible and enabled
    // Assert: prev-btn disabled on page 1
    // Click next-btn
    // Assert: page 2 data loads
    // Assert: prev-btn enabled
  });

  test('Overage banner visible when seat_overage_flagged', async ({ page }) => {
    // Mock seat state with seat_overage_flagged: true
    // Assert: data-testid="seat-overage-banner" visible
    // Assert: "Contact support" text in banner
  });
});
```

**7 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/seat-billing-service.test.ts  # 21 tests
npx vitest run src/__tests__/unit/activity-log-service.test.ts  # 20 tests
npx vitest run src/__tests__/unit/billing-routes.test.ts        # 18 tests
npx vitest run                                                    # ALL — zero regressions
npx playwright test src/__tests__/e2e/seat-billing.spec.ts      # 7 Playwright tests
npx tsc --noEmit                                                  # 0 type errors
```

**Total: 59 Vitest + 7 Playwright = 66 tests**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/billing/types.ts` | **CREATE** | ActivityEventType, ActivityLogEntry, SeatState, SEAT_PRICE_CENTS |
| 2 | `lib/billing/seat-billing-service.ts` | **CREATE** | Stripe seat sync + getSeatState |
| 3 | `lib/billing/activity-log-service.ts` | **CREATE** | Append-only log write + read |
| 4 | `lib/billing/index.ts` | **CREATE** | Barrel export |
| 5 | `lib/invitations/invitation-service.ts` | **MODIFY** | Add logInviteSent/Accepted/Revoked + syncSeats calls |
| 6 | `lib/membership/membership-service.ts` | **MODIFY** | Add logMemberRemoved + syncSeats in removeMember |
| 7 | `app/api/billing/seats/route.ts` | **CREATE** | GET seat state |
| 8 | `app/api/billing/seats/sync/route.ts` | **CREATE** | POST force-sync |
| 9 | `app/api/team/activity/route.ts` | **CREATE** | GET paginated audit log |
| 10 | `app/api/webhooks/stripe/route.ts` | **MODIFY** | Add subscription.updated seat sync |
| 11 | `app/dashboard/billing/page.tsx` | **MODIFY** | Add SeatUsageCard + ActivityLogTable |
| 12 | `app/dashboard/billing/_components/SeatUsageCard.tsx` | **CREATE** | Seat usage widget |
| 13 | `app/dashboard/team/_components/ActivityLogTable.tsx` | **CREATE** | Paginated audit log |
| 14 | `supabase/migrations/[timestamp]_activity_log.sql` | **CREATE** | activity_log table + 2 new org columns |
| 15 | `supabase/prod_schema.sql` | **MODIFY** | Append activity_log + org columns |
| 16 | `lib/supabase/database.types.ts` | **MODIFY** | Add activity_log types + ActivityEventType |
| 17 | `supabase/seed.sql` | **MODIFY** | 2 activity log entries for golden tenant |
| 18 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 4 billing fixtures |
| 19 | `src/__tests__/unit/seat-billing-service.test.ts` | **CREATE** | 21 tests |
| 20 | `src/__tests__/unit/activity-log-service.test.ts` | **CREATE** | 20 tests |
| 21 | `src/__tests__/unit/billing-routes.test.ts` | **CREATE** | 18 tests |
| 22 | `src/__tests__/e2e/seat-billing.spec.ts` | **CREATE** | 7 Playwright tests |

**Total: 22 files**

---

## 🚫 What NOT to Do

1. **DO NOT add a DELETE or UPDATE RLS policy to `activity_log`** — the table is append-only by design. If someone asks to delete a log entry, that operation is not supported. Rows are permanent.

2. **DO NOT throw from `syncSeatsToStripe()`** — Stripe failures must never block membership operations. Always catch, log, and return `{ success: false }`. The force-sync endpoint exists precisely to recover from failed syncs.

3. **DO NOT throw from `logActivity()`** — same principle. Audit log failures must never block primary operations. Catch and console.error only.

4. **DO NOT hardcode the Stripe API version** — read it from the existing webhook handler (`app/api/webhooks/stripe/route.ts`) and use the same string exactly.

5. **DO NOT rewrite the existing Stripe webhook handler** — extend it with one new event case. All existing event handling stays identical.

6. **DO NOT call `syncSeatsToStripe()` synchronously** — use fire-and-forget (`void fn()`). The invite accept and member remove API responses should not wait for Stripe.

7. **DO NOT expose `seat_overage_flagged` as a hard block** — it is a soft flag for admin review only. Users can still log in and use the product. Do not add any middleware or guard that blocks access based on this flag.

8. **DO NOT charge for the first seat** — `monthly_seat_cost_cents = max(0, seat_count - 1) * SEAT_PRICE_CENTS[plan_tier]`. The owner's seat is included in the base Agency plan price.

9. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).

10. **DO NOT edit `middleware.ts`** (AI_RULES §6).

11. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

12. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.

---

## ✅ Definition of Done

- [ ] `lib/billing/types.ts` — ActivityEventType (7 values), ActivityLogEntry, ActivityLogPage, SeatState, ActivityLogParams, SEAT_PRICE_CENTS (agency=1500, others=0)
- [ ] `seat-billing-service.ts` — getSeatState() (Stripe fetch + in_sync check), syncSeatsToStripe() (never throws, logs activity), syncSeatsFromStripe() (webhook path), Stripe init using same API version as existing webhook
- [ ] `activity-log-service.ts` — logActivity() (never throws), 5 convenience wrappers, getActivityLog() with pagination
- [ ] `invitation-service.ts` MODIFIED — logInviteSent/Accepted/Revoked + syncSeatsToStripe wired as void fire-and-forget
- [ ] `membership-service.ts` MODIFIED — logMemberRemoved + syncSeatsToStripe wired as void fire-and-forget
- [ ] `GET /api/billing/seats` — SeatState response, 5s Stripe timeout guard
- [ ] `POST /api/billing/seats/sync` — owner + Agency gated, calls syncSeatsToStripe with current DB count
- [ ] `GET /api/team/activity` — owner/admin gated, paginated, per_page max 50 enforced
- [ ] Stripe webhook MODIFIED — `customer.subscription.updated` case added, existing cases untouched
- [ ] `SeatUsageCard` — 4 states (loading, non-Agency, in-sync, out-of-sync), overage banner, force sync button (owner only), all data-testid
- [ ] `ActivityLogTable` — event display names, pagination controls, empty state, plan gate, all data-testid
- [ ] `/dashboard/billing` MODIFIED — SeatUsageCard above existing content, ActivityLogTable below
- [ ] Migration: activity_log table (append-only RLS), stripe_subscription_item_id + seat_overage_flagged on organizations
- [ ] prod_schema.sql updated
- [ ] database.types.ts updated
- [ ] seed.sql: 2 activity log entries for golden tenant
- [ ] golden-tenant.ts: 4 fixtures (MOCK_SEAT_STATE_AGENCY, MOCK_SEAT_STATE_OUT_OF_SYNC, MOCK_SEAT_STATE_GROWTH, MOCK_ACTIVITY_LOG_PAGE)
- [ ] `npx vitest run src/__tests__/unit/seat-billing-service.test.ts` — **21 tests passing**
- [ ] `npx vitest run src/__tests__/unit/activity-log-service.test.ts` — **20 tests passing**
- [ ] `npx vitest run src/__tests__/unit/billing-routes.test.ts` — **18 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/seat-billing.spec.ts` — **7 tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 51 written
- [ ] roadmap.md Sprint 113 marked ✅

---

## ⚠️ Edge Cases

1. **Org has Stripe subscription but no `stripe_subscription_item_id`** — `syncSeatsToStripe()` fetches the subscription from Stripe, reads `items.data[0].id`, saves it to the DB, then proceeds with the update. This lazy-population approach means the column self-populates on first sync.

2. **Stripe subscription has multiple line items** — use `stripe_subscription_item_id` if populated (preferred). If null, fall back to `items.data[0]`. Log a warning if there are multiple items and `stripe_subscription_item_id` is null, since `items.data[0]` may be the wrong item.

3. **`seat_count` trigger (Sprint 111) and `syncSeatsToStripe()` both update after member join** — the trigger runs at DB level synchronously; `syncSeatsToStripe()` runs asynchronously after the API response. Both are correct. The trigger keeps DB accurate; the Stripe sync keeps billing accurate. No conflict.

4. **Webhook fires before DB membership change is committed** — the `customer.subscription.updated` webhook fires when Stripe processes a change, not when LocalVector makes one. `syncSeatsFromStripe()` updates DB from Stripe. `syncSeatsToStripe()` updates Stripe from DB. They are independent. In normal flow, LocalVector changes DB first, then calls Stripe. Stripe webhook confirms. If out of order, the `in_sync` flag catches it for manual force-sync.

5. **Force sync called by two owners simultaneously** — both read the same `seat_count`, both call `stripe.subscriptions.update` with the same quantity. Idempotent — Stripe accepts the same quantity twice without error. Last write wins.

6. **Trial/Starter/Growth plan: no Stripe subscription** — `syncSeatsToStripe()` returns early when `stripe_subscription_id` is null. `getSeatState()` returns `stripe_quantity: null, in_sync: true`. No error. `SeatUsageCard` shows non-Agency state (upgrade prompt).

7. **Activity log query for org with zero entries** — returns `{ entries: [], total: 0, page: 1, per_page: 20, has_more: false }`. Never a 404.

8. **per_page > 50 in query param** — server clamps to 50. Returns 50 entries max regardless of what was requested.

---

## 🔮 AI_RULES Update (Add Rule 51)

```markdown
## 51. 💳 Seat Billing + Audit Log in `lib/billing/` (Sprint 113)

* **Fire-and-forget for billing + logging:** syncSeatsToStripe() and logActivity()
  are always called as `void fn()`. Never await them in API response paths.
  Billing and logging failures MUST NOT block membership operations.
* **syncSeatsToStripe() never throws.** Catch all Stripe errors. Return 
  { success: false }. Write a failed seat_sync log entry. Do not block.
* **activity_log is append-only.** No DELETE or UPDATE policy exists.
  Never add one. Rows are permanent for compliance.
* **First seat is free:** monthly_seat_cost_cents = max(0, seat_count - 1) 
  × SEAT_PRICE_CENTS[plan_tier]. Never charge for seat 1.
* **stripe_subscription_item_id:** lazy-populate on first sync if null.
  Always use this ID (not items[0]) when populated.
* **Stripe API version:** use the same version string as the existing webhook
  handler. Never change it unilaterally.
* **seat_overage_flagged:** soft flag only. Never use it as an access gate.
```

---

## 🗺️ What Comes Next

**Sprint 114 — White-Label: Domains + Routing:** Custom domain registration, subdomain routing, per-org domain config table. The multi-user agency foundation (111–113) is now complete.
