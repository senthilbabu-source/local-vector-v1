# Sprint 99 — Seat-Based Billing + Agency Permissions

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Complete the Agency tier by wiring seat-based billing into Stripe and adding granular per-location permissions. This is **the sprint that makes the Agency tier commercially real** — without it, multi-user teams exist in the product but cannot be monetized or access-controlled at scale.

**Three deliverables:**

### Deliverable 1 — Stripe Seat Quantity Management
Every time an org member is added or removed, the Stripe subscription's `quantity` updates automatically. Proration is handled correctly so customers are charged the right amount mid-cycle. If a customer downgrades their seat count below their current member count, they are locked out of adding new members until they remove existing ones.

### Deliverable 2 — Seat Limit Enforcement (Bidirectional)
Two enforcement paths must both work:
- **App → Stripe:** When `sendInvitation` fires, check seat count before allowing. Block if at seat ceiling.
- **Stripe → App:** When Stripe sends a `customer.subscription.updated` or `invoice.payment_failed` webhook, sync the seat ceiling to the DB. If a customer downgrades via Stripe's portal, the app must immediately reflect the new seat limit.

### Deliverable 3 — Per-Location Permissions
A `location_permissions` table maps `(org_member_id, location_id)` to a scoped role. An agency can assign an account manager as Admin on 3 client locations and Viewer on the rest. All dashboard data queries respect location-level permissions in addition to org-level roles.

**Gap being closed:** Feature #75 (part 2) — Multi-User Agency Workflows. Sprint 98 delivered invitations + roles (60%). This sprint closes it to 100%.

**Effort:** L (Large). Stripe proration, webhook idempotency, seat ceiling sync, and permission scoping each carry real complexity. Read every pre-flight file before writing a single line.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any. This sprint touches billing infrastructure — mistakes here cost real money.

```
Read docs/AI_RULES.md                                        — All rules (§51+ after Sprint 98)
Read CLAUDE.md                                               — Full architecture, billing patterns
Read MEMORY.md                                               — Prior decisions, Stripe setup notes
Read supabase/prod_schema.sql                                — Find: orgs (plan, stripe_customer_id,
                                                               stripe_subscription_id), org_members,
                                                               locations, pending_invitations
Read lib/database.types.ts                                   — TypeScript DB types (needs updating)
Read src/__fixtures__/golden-tenant.ts                       — Golden Tenant: org_id a0eebc99
Read lib/supabase/server.ts                                  — createClient() vs createServiceRoleClient()
Read app/api/webhooks/stripe/route.ts                        — THE MOST IMPORTANT FILE. Read every
                                                               line. Understand: how events are verified,
                                                               how idempotency is handled, how orgs are
                                                               looked up by stripe_customer_id, which
                                                               events are already handled.
Read lib/stripe/                                             — All files. Find: stripe client init,
                                                               price IDs, plan → priceId mapping,
                                                               existing checkout/portal helpers
Read app/dashboard/settings/                                 — Billing page, settings structure
Read app/actions/invitations.ts                              — Sprint 98 invitations (being modified)
Read lib/auth/org-roles.ts                                   — Sprint 98 roles (being extended)
Read lib/plan-enforcer.ts                                    — planSatisfies() (being extended)
Read app/dashboard/                                          — All pages that query location data
                                                               (must respect location permissions)
Read app/api/cron/                                           — Cron patterns (seat sync cron reference)
Read docs/MULTI-USER_AGENCY_WHITE_LABEL.md                   — Original Agency tier spec
```

**Answer these questions before writing any code — document answers as comments:**

1. What is the exact Stripe Price ID for the Agency plan seat? Is it a per-seat price or a flat price? Is it metered or licensed?
2. Does the existing Stripe subscription use `quantity` for seat tracking, or is the Agency plan a flat rate with no quantity?
3. What is the current `stripe_subscription_id` column type and where is it stored — on `orgs`, on a separate `subscriptions` table, or in Stripe metadata?
4. How does the existing webhook handler look up an org from a Stripe event? By `customer_id`? By `subscription_id`? By metadata?
5. Does the existing webhook handler have idempotency key tracking? If so, what table/mechanism?
6. What is the `stripe-signature` header verification pattern used? (`constructEvent` or `constructEventAsync`?)
7. Does `prod_schema.sql` have a `seat_limit` or `max_seats` column on `orgs`? If not, it needs to be added.
8. Are there existing Stripe test fixtures or mock patterns in the test suite? Find them — do not create a competing mock strategy.

---

## 🏗️ Architecture — What to Build

---

### PART 1: Database Schema

#### Migration 1: Seat tracking + location permissions

```sql
-- ============================================================
-- Migration: XXXX_seat_billing_location_permissions.sql
-- ============================================================

-- -------------------------------------------------------
-- 1. Seat ceiling on orgs
--    seat_limit = max members allowed by current subscription.
--    NULL = unlimited (Agency Enterprise / internal orgs).
--    1 = starter/growth (owner only, no additional members).
-- -------------------------------------------------------
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS seat_limit        integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seats_updated_at  timestamptz DEFAULT now();

COMMENT ON COLUMN orgs.seat_limit IS
  'Maximum org_members rows allowed. Synced from Stripe subscription quantity.
   NULL = unlimited. 1 = single-user plans. Updated by Stripe webhook on subscription change.';

-- Set existing orgs: starter/growth → seat_limit=1, agency → seat_limit=5 (default)
-- Read plan column values from prod_schema.sql before running this UPDATE.
-- Replace 'starter','growth','professional' with actual plan string values if different.
UPDATE orgs SET seat_limit = 1
  WHERE plan IN ('starter', 'growth', 'professional');

UPDATE orgs SET seat_limit = 5
  WHERE plan = 'agency' AND seat_limit = 1;
-- NOTE: 5 is the default Agency seat count. Real seat_limit is overwritten by Stripe webhook
-- when the subscription is loaded/updated. This is just a safe default.

-- -------------------------------------------------------
-- 2. Stripe webhook idempotency log
--    Prevents duplicate processing of Stripe events.
--    (Only add if not already present — check prod_schema.sql first.)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,   -- Stripe's evt_xxx ID
  event_type      text NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now(),
  org_id          uuid REFERENCES orgs(id) ON DELETE SET NULL,
  payload         jsonb,                   -- Store for debugging only, never re-process from here
  error           text                     -- Non-null if processing failed
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id
  ON stripe_webhook_events(stripe_event_id);

-- RLS: service role only (webhooks use service role — no user RLS needed)
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No SELECT policy = no user can read webhook logs. Service role bypasses RLS.

-- -------------------------------------------------------
-- 3. location_permissions
--    Scoped permissions per org member per location.
--    Supplements org-level role — most restrictive wins.
--    If no row exists for (org_member_id, location_id),
--    fall back to org-level role from org_members.
-- -------------------------------------------------------
CREATE TABLE location_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id uuid NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  role          org_role NOT NULL DEFAULT 'viewer',
  granted_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_member_id, location_id)
);

-- RLS
ALTER TABLE location_permissions ENABLE ROW LEVEL SECURITY;

-- Members can read location permissions for their org
CREATE POLICY "location_permissions_select" ON location_permissions
  FOR SELECT USING (
    org_member_id IN (
      SELECT id FROM org_members
      WHERE org_id IN (
        SELECT org_id FROM org_members om2
        WHERE om2.user_id = auth.uid()
      )
    )
  );

-- Only owner can grant/modify location permissions
CREATE POLICY "location_permissions_insert" ON location_permissions
  FOR INSERT WITH CHECK (
    org_member_id IN (
      SELECT om.id FROM org_members om
      WHERE om.org_id IN (
        SELECT org_id FROM org_members om2
        WHERE om2.user_id = auth.uid()
        AND om2.role = 'owner'
      )
    )
  );

CREATE POLICY "location_permissions_update" ON location_permissions
  FOR UPDATE USING (
    org_member_id IN (
      SELECT om.id FROM org_members om
      WHERE om.org_id IN (
        SELECT org_id FROM org_members om2
        WHERE om2.user_id = auth.uid()
        AND om2.role = 'owner'
      )
    )
  );

CREATE POLICY "location_permissions_delete" ON location_permissions
  FOR DELETE USING (
    org_member_id IN (
      SELECT om.id FROM org_members om
      WHERE om.org_id IN (
        SELECT org_id FROM org_members om2
        WHERE om2.user_id = auth.uid()
        AND om2.role = 'owner'
      )
    )
  );

-- -------------------------------------------------------
-- 4. Indexes
-- -------------------------------------------------------
CREATE INDEX idx_location_permissions_org_member ON location_permissions(org_member_id);
CREATE INDEX idx_location_permissions_location   ON location_permissions(location_id);
CREATE INDEX idx_orgs_seat_limit                 ON orgs(seat_limit);
```

---

### PART 2: Seat Plan Configuration

#### `lib/stripe/seat-plans.ts`

**Single source of truth for seat plan definitions.** Never hardcode seat counts or price IDs outside this file.

```typescript
/**
 * Seat plan configuration.
 *
 * IMPORTANT: Read lib/stripe/ carefully before filling in price IDs.
 * The actual Stripe Price IDs must come from:
 *   1. Your Stripe dashboard (Products → Agency → Price ID)
 *   2. OR from existing price ID constants in lib/stripe/
 * NEVER hardcode price IDs that differ from what's in your Stripe account.
 *
 * Seat model options (determine which applies by reading MEMORY.md + Stripe dashboard):
 *   A) Per-seat licensed: Agency = $X/seat/month. quantity = seat count.
 *   B) Flat Agency tier: Fixed price regardless of seats. quantity always 1.
 *   C) Tiered: price per seat drops at volume thresholds.
 *
 * For V1 LocalVector, implement Model A (per-seat) unless MEMORY.md says otherwise.
 */

export interface SeatPlanConfig {
  /** Stripe Price ID for this plan's per-seat charge */
  stripePriceId: string
  /** Default seat limit when org upgrades to this plan */
  defaultSeats: number
  /** Minimum seats (cannot go below this) */
  minSeats: number
  /** Maximum seats (null = unlimited) */
  maxSeats: number | null
  /** Whether this plan supports multiple seats at all */
  multiUserEnabled: boolean
}

export const SEAT_PLANS: Record<string, SeatPlanConfig> = {
  starter: {
    stripePriceId: process.env.STRIPE_PRICE_STARTER!,
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    multiUserEnabled: false,
  },
  growth: {
    stripePriceId: process.env.STRIPE_PRICE_GROWTH!,
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    multiUserEnabled: false,
  },
  professional: {
    stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL!,
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    multiUserEnabled: false,
  },
  agency: {
    stripePriceId: process.env.STRIPE_PRICE_AGENCY_PER_SEAT!,
    defaultSeats: 5,
    minSeats: 1,
    maxSeats: null,     // Unlimited seats for Agency (Stripe quantity = actual seat count)
    multiUserEnabled: true,
  },
}

/**
 * Returns the seat limit for a given plan.
 * For non-Agency plans: always 1.
 * For Agency: reads from the subscription quantity (passed in).
 */
export function getSeatLimit(plan: string, subscriptionQuantity?: number): number {
  const config = SEAT_PLANS[plan]
  if (!config) return 1
  if (!config.multiUserEnabled) return 1
  return subscriptionQuantity ?? config.defaultSeats
}

/**
 * Returns true if the given plan supports multi-user.
 */
export function isMultiUserPlan(plan: string): boolean {
  return SEAT_PLANS[plan]?.multiUserEnabled ?? false
}
```

---

### PART 3: Seat Management Library

#### `lib/stripe/seat-manager.ts`

**All Stripe seat quantity operations in one place.** Never call Stripe's subscription update API outside this file.

```typescript
/**
 * Seat Manager — all Stripe seat quantity operations.
 *
 * Design principles:
 * 1. DB-first: always update orgs.seat_limit AFTER Stripe confirms the change.
 *    If Stripe fails, the DB is not updated — user retries.
 * 2. Idempotent: calling updateSeatQuantity(5) when already at 5 is a no-op (no Stripe call).
 * 3. Error-typed: all functions return typed error codes, never throw to callers.
 * 4. Atomic seat check: checkSeatAvailability reads current member count + seat_limit
 *    in a single DB query to avoid TOCTOU race conditions.
 */

export type SeatManagerError =
  | 'no_subscription'           // Org has no active Stripe subscription
  | 'not_agency_plan'           // Plan doesn't support multiple seats
  | 'seat_limit_reached'        // currentMembers >= seat_limit
  | 'below_minimum_seats'       // Requested quantity below minSeats
  | 'stripe_error'              // Stripe API call failed
  | 'db_error'                  // Supabase update failed
  | 'subscription_not_active'   // Subscription status is not 'active' or 'trialing'

export interface SeatAvailability {
  canAdd: boolean
  currentMembers: number
  seatLimit: number
  seatsRemaining: number
  error?: SeatManagerError
}

/**
 * Checks whether the org can add another member.
 * Atomic: reads member count and seat_limit in one query.
 * Does NOT call Stripe — DB only.
 *
 * Use before sendInvitation to gate the invite.
 */
export async function checkSeatAvailability(
  supabase: SupabaseClient,
  orgId: string
): Promise<SeatAvailability>

/**
 * Updates the Stripe subscription quantity to newSeatCount.
 * Handles proration automatically (Stripe default = prorate immediately).
 *
 * Steps:
 * 1. Load org's stripe_subscription_id
 * 2. Validate: subscription exists + is active/trialing
 * 3. Check newSeatCount >= minSeats for plan
 * 4. If current quantity === newSeatCount: no-op, return success
 * 5. Call stripe.subscriptions.update({ quantity: newSeatCount, proration_behavior: 'create_prorations' })
 * 6. On Stripe success: update orgs.seat_limit = newSeatCount, orgs.seats_updated_at = now()
 * 7. Return { success: true, previousQuantity, newQuantity, prorationAmount }
 *
 * @param newSeatCount — the TOTAL desired seat count (not a delta)
 */
export async function updateSeatQuantity(
  supabase: SupabaseClient,
  orgId: string,
  newSeatCount: number
): Promise<{
  success: boolean
  error?: SeatManagerError
  previousQuantity?: number
  newQuantity?: number
  stripeSubscriptionId?: string
}>

/**
 * Syncs seat_limit from Stripe to DB.
 * Called by the webhook handler when subscription quantity changes externally
 * (e.g. customer changes seats via Stripe portal or Stripe downgrades on payment failure).
 *
 * Uses service role client — called from webhook handler.
 * Does NOT call Stripe — only reads from the Stripe event payload and writes to DB.
 *
 * @param stripeCustomerId — from the Stripe event object
 * @param newQuantity — from the Stripe subscription object in the event
 * @param subscriptionStatus — 'active' | 'trialing' | 'past_due' | 'canceled' | etc.
 */
export async function syncSeatLimitFromWebhook(
  serviceRoleClient: SupabaseClient,
  stripeCustomerId: string,
  newQuantity: number,
  subscriptionStatus: string
): Promise<{ success: boolean; orgId?: string; error?: string }>

/**
 * Enforces seat ceiling after a downgrade.
 * If org.member_count > new seat_limit after a Stripe downgrade,
 * this does NOT automatically remove members (destructive — requires owner action).
 * Instead it sets a flag or returns the overage count so the UI can warn the owner.
 *
 * Returns: { overage: number } — 0 if within limit, N if N members over the new limit.
 * The caller (webhook handler) decides what to do with overage > 0.
 */
export async function calculateSeatOverage(
  serviceRoleClient: SupabaseClient,
  orgId: string
): Promise<{ overage: number; currentMembers: number; seatLimit: number }>
```

---

### PART 4: Stripe Webhook Extensions

#### Extend `app/api/webhooks/stripe/route.ts`

⚠️ **This is the most dangerous file to edit.** Read it entirely before touching a single line. The existing webhook handler is already in production. Follow these rules:
- Add new event handlers without modifying existing ones
- Preserve the exact signature verification logic
- Preserve the exact idempotency mechanism (or add one if missing — see Migration 1)
- Never change error response format
- All new handlers follow the exact pattern of existing handlers

**New Stripe events to handle:**

```typescript
/**
 * customer.subscription.updated
 * Fires when: quantity changes (seat add/remove via portal), plan upgrades/downgrades,
 *             trial ends, subscription pauses/resumes.
 *
 * New handling for Sprint 99:
 * - Extract new quantity from subscription object
 * - Call syncSeatLimitFromWebhook(stripeCustomerId, quantity, status)
 * - If new quantity < current member count: calculateSeatOverage() and
 *   store overage in orgs.seat_overage_count (add column — see migration note below)
 *   This triggers a warning email + dashboard banner. Does NOT remove members.
 * - If subscription status → 'canceled': seat_limit = 1 (owner only), plan → downgraded tier
 *
 * customer.subscription.deleted
 * Fires when: subscription is canceled and period ends (not immediately on cancel request).
 * New handling:
 * - Set seat_limit = 1
 * - Org plan should already have been downgraded by prior webhook events
 *
 * invoice.payment_failed
 * Fires when: payment fails on renewal.
 * New handling for Sprint 99:
 * - If existing handler doesn't already handle this: add grace period logic
 * - Do NOT immediately revoke seats on first failure — Stripe retries 3x over ~1 week
 * - On subscription status = 'past_due': set a flag but do not lock out members yet
 * - On subscription status = 'unpaid' (after all retries failed): seat_limit = 1
 *
 * invoice.payment_succeeded
 * Fires when: payment succeeds (including recovery from past_due).
 * New handling:
 * - If org was in overage or past_due state: clear the overage flag
 * - Re-sync seat_limit from subscription quantity
 */
```

**Add `seat_overage_count` to orgs (add to migration):**
```sql
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS seat_overage_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seat_overage_since  timestamptz;

COMMENT ON COLUMN orgs.seat_overage_count IS
  'Number of members over the seat limit after a downgrade. 0 = within limit.
   Set by Stripe webhook. Cleared when members are removed or seats upgraded.';
```

**Idempotency wrapper for new webhook handlers:**

```typescript
/**
 * Wrap every new event handler with idempotency check:
 *
 * async function handleSubscriptionUpdated(event: Stripe.Event) {
 *   // 1. Check stripe_webhook_events for event.id
 *   const existing = await serviceRole
 *     .from('stripe_webhook_events')
 *     .select('id')
 *     .eq('stripe_event_id', event.id)
 *     .single()
 *
 *   if (existing.data) return // Already processed — silently skip
 *
 *   // 2. Process the event
 *   const result = await syncSeatLimitFromWebhook(...)
 *
 *   // 3. Log to stripe_webhook_events (success or failure)
 *   await serviceRole.from('stripe_webhook_events').insert({
 *     stripe_event_id: event.id,
 *     event_type: event.type,
 *     org_id: result.orgId ?? null,
 *     error: result.error ?? null,
 *   })
 * }
 *
 * If stripe_webhook_events table already exists with a different idempotency mechanism,
 * adapt to match that existing pattern exactly.
 */
```

---

### PART 5: Modify `sendInvitation` (Sprint 98) — Seat Check Integration

Extend `app/actions/invitations.ts` from Sprint 98 to enforce seat limits:

```typescript
/**
 * Add seat check to sendInvitation — insert BEFORE the existing plan check:
 *
 * Step 2a (new): Check seat availability
 *   const availability = await checkSeatAvailability(supabase, orgId)
 *   if (!availability.canAdd) {
 *     if (availability.error === 'seat_limit_reached') {
 *       return {
 *         success: false,
 *         error: 'seat_limit_reached',
 *         seatsRemaining: 0,
 *         seatLimit: availability.seatLimit,
 *         currentMembers: availability.currentMembers,
 *       }
 *     }
 *   }
 *
 * The existing Agency plan check (planSatisfies) remains — seat check is an
 * additional guard, not a replacement.
 *
 * Return type extension: add seatsRemaining and seatLimit to the return object
 * so the UI can show "You've used 4 of 5 seats" without a separate API call.
 */
```

---

### PART 6: Seat Management UI

#### `app/dashboard/settings/billing/page.tsx` — Seat Management Card

Add a "Team Seats" card to the billing settings page (Agency plan orgs only):

```typescript
/**
 * Seat Management Card — visible to owner only on Agency plan
 *
 * Displays:
 * - Current seat count: "4 of 5 seats used"
 * - Progress bar: seats used / seat_limit
 * - Per-seat monthly cost (from SEAT_PLANS config)
 * - "Add Seat" button → calls addSeat() server action (increments quantity by 1)
 * - "Remove Seat" button → calls removeSeat() server action (decrements by 1)
 *   Disabled when currentMembers >= seatLimit (can't remove a seat that's in use)
 *   Disabled when seatLimit <= minSeats
 * - Overage warning banner: visible when seat_overage_count > 0
 *   "You have [N] members over your seat limit. Remove [N] member(s) or add seats."
 * - Past due warning: visible when subscription is past_due
 *
 * data-testid:
 * - seat-management-card
 * - seat-count-display         ("4 of 5 seats used")
 * - seat-progress-bar
 * - seat-add-btn
 * - seat-remove-btn
 * - seat-overage-banner
 * - seat-past-due-banner
 * - seat-cost-display
 */
```

#### `app/actions/seat-actions.ts`

```typescript
'use server'

/**
 * addSeat
 * Increments the org's Stripe subscription quantity by 1.
 * Owner only. Agency plan only.
 *
 * Steps:
 * 1. orgId from session (never from args)
 * 2. assertOrgRole(owner)
 * 3. Verify plan = 'agency'
 * 4. Load current subscription quantity
 * 5. Call updateSeatQuantity(currentQuantity + 1)
 * 6. Revalidate billing page
 * 7. Return { success, newSeatLimit, prorationAmount }
 */
export async function addSeat(): Promise<{
  success: boolean
  error?: SeatManagerError | string
  newSeatLimit?: number
  prorationDescription?: string
}>

/**
 * removeSeat
 * Decrements the org's Stripe subscription quantity by 1.
 * Owner only. Agency plan only.
 * Blocked if: currentMembers >= newSeatCount (would create overage).
 * Blocked if: newSeatCount < minSeats.
 *
 * Steps:
 * 1. orgId from session
 * 2. assertOrgRole(owner)
 * 3. Load current seat_limit + current member count
 * 4. Check: (seat_limit - 1) >= currentMembers — if not, block with 'would_create_overage'
 * 5. Check: (seat_limit - 1) >= minSeats — if not, block with 'below_minimum_seats'
 * 6. Call updateSeatQuantity(seat_limit - 1)
 * 7. Return { success, newSeatLimit }
 */
export async function removeSeat(): Promise<{
  success: boolean
  error?: SeatManagerError | 'would_create_overage' | string
  newSeatLimit?: number
}>

/**
 * getSeatSummary
 * Returns current seat usage for the billing page. Read-only.
 * Uses regular server client (owner can read their own org).
 */
export async function getSeatSummary(): Promise<{
  seatLimit: number
  currentMembers: number
  seatsRemaining: number
  seatOverage: number
  plan: string
  subscriptionStatus: string | null
  monthlyCostPerSeat: number | null
  isAgencyPlan: boolean
}>
```

---

### PART 7: Per-Location Permissions

#### `lib/auth/location-permissions.ts`

```typescript
/**
 * Location-level permission resolution.
 *
 * Permission hierarchy (most → least permissive wins for access, most restrictive wins for security):
 *
 * For a given (user, location) pair:
 * 1. If user is org owner → full access to all locations (no location_permissions row needed)
 * 2. If location_permissions row exists for (org_member_id, location_id):
 *    → use location-specific role
 * 3. If no location_permissions row exists:
 *    → fall back to org-level role from org_members
 *
 * This means:
 * - Owner always has access to all locations
 * - Admin with no location override → admin on all locations (org-level fallback)
 * - Admin with location override → specific role on that location only
 * - Viewer always gets viewer-level access (can't be promoted above org role at location level)
 *
 * NOTE: Location permissions CANNOT elevate a user above their org role.
 *   A Viewer org member cannot be given Admin location permissions.
 *   The resolved role = min(org_role, location_role).
 */

/**
 * Resolves the effective role for a user on a specific location.
 * Returns the most restrictive of (org_role, location_role).
 */
export async function resolveLocationRole(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  locationId: string
): Promise<OrgRole | null>

/**
 * Returns all locations a user can access, with their effective role per location.
 * Used to filter dashboard data and build the location switcher.
 */
export async function getUserLocationAccess(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<{ locationId: string; effectiveRole: OrgRole }[]>

/**
 * Asserts a user has at least requiredRole on a specific location.
 * Throws typed error if not. Use in server actions that operate on location-specific data.
 *
 * @throws { code: 'INSUFFICIENT_LOCATION_ROLE', locationId, required, actual }
 */
export async function assertLocationRole(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  locationId: string,
  requiredRole: OrgRole
): Promise<void>

/**
 * Grants or updates a location-level permission for an org member.
 * Owner only. Cannot elevate above org-level role.
 *
 * @param orgMemberId — org_members.id (not user_id)
 * @param locationId  — locations.id
 * @param role        — must be <= org-level role of the member
 */
export async function setLocationPermission(
  supabase: SupabaseClient,
  grantedByUserId: string,
  orgId: string,
  orgMemberId: string,
  locationId: string,
  role: OrgRole
): Promise<{ success: boolean; error?: string }>

/**
 * Revokes a location-level permission (falls back to org-level role).
 */
export async function revokeLocationPermission(
  supabase: SupabaseClient,
  revokedByUserId: string,
  orgId: string,
  orgMemberId: string,
  locationId: string
): Promise<{ success: boolean; error?: string }>
```

#### Location Permission UI — `app/dashboard/settings/team/page.tsx` extension

Extend the Sprint 98 team settings page with a **Location Access** section per member (Agency + multi-location orgs only):

```typescript
/**
 * Per each non-owner member row in the team table, add an expandable
 * "Location Access" panel (collapsed by default):
 *
 * For each location in the org:
 * - Location name
 * - Effective role badge (shows resolved role: location override or org fallback)
 * - Role select dropdown (owner only): "Org Default (Admin)" | "Admin" | "Viewer" | "No Access"
 *   "No Access" = explicit viewer-blocked: sets role to null equivalent (future sprint)
 *   For V1: just Admin and Viewer options + "Org Default"
 *
 * data-testid per row:
 * - location-access-panel-[memberId]
 * - location-role-select-[memberId]-[locationId]
 * - location-role-badge-[memberId]-[locationId]
 *
 * Only show this section if:
 *   - Org has > 1 location (org.locations.count > 1)
 *   - Current user is owner
 * For V1 single-location orgs: hide the section entirely (no meaningful difference).
 */
```

---

### PART 8: Dashboard Data Queries — Location Permission Enforcement

All dashboard pages that query location-specific data must respect location permissions. This is not a UI change — it's a query-level enforcement.

**Pattern to apply in each affected server component:**

```typescript
// In any Server Component page that queries location-specific data:

// 1. Get the user's location access
const locationAccess = await getUserLocationAccess(supabase, userId, orgId)
const accessibleLocationIds = locationAccess.map(a => a.locationId)

// 2. Filter all queries to accessible locations only
// Example — hallucinations:
const { data: audits } = await supabase
  .from('ai_audits')
  .select('*')
  .eq('org_id', orgId)
  .in('location_id', accessibleLocationIds)  // ← add this line

// For single-location orgs (V1 majority): accessibleLocationIds has 1 entry.
// Owner always has accessibleLocationIds = all org location IDs.
// Performance: getUserLocationAccess() result should be memoized per request via React cache().
```

**Pages to update:**
- `app/dashboard/page.tsx` — main dashboard
- `app/dashboard/citations/page.tsx`
- `app/dashboard/page-audits/page.tsx`
- `app/dashboard/content-drafts/page.tsx`
- `app/dashboard/sentiment/page.tsx`
- `app/dashboard/source-intelligence/page.tsx`
- `app/dashboard/share-of-voice/page.tsx`
- Any other page that queries `location_id`-scoped data

Use `React.cache()` to memoize `getUserLocationAccess()` within a single request so it's called once, not once per page section.

---

### PART 9: Overage Warning Email

#### `emails/SeatOverageEmail.tsx`

```typescript
/**
 * Sent to org owner when a Stripe downgrade creates a seat overage.
 * Props:
 * - ownerName: string
 * - orgName: string
 * - overage: number (N members over limit)
 * - seatLimit: number (new limit after downgrade)
 * - currentMembers: number
 * - manageTeamUrl: string (/dashboard/settings/team)
 * - manageBillingUrl: string (/dashboard/settings/billing)
 *
 * Subject: "Action required: [orgName] has [N] members over the seat limit"
 * Body: Explains the situation, lists options (add seats or remove members),
 *       two CTA buttons side by side: "Add Seats" + "Manage Team"
 * Tone: Urgent but not alarming. No member data is removed automatically.
 */
```

---

## 🧪 Tests — Write These FIRST (AI_RULES §4)

Write all test files before any implementation. Tests define the contract.

---

### Test File 1: `src/__tests__/unit/seat-manager.test.ts`

**~38 Vitest tests.** Mock Stripe SDK and Supabase via MSW + vi.mock.

```typescript
describe('checkSeatAvailability', () => {
  it('returns canAdd=true when members < seat_limit')
  it('returns canAdd=false when members === seat_limit')
  it('returns canAdd=false when members > seat_limit (overage state)')
  it('returns correct seatsRemaining count')
  it('returns correct currentMembers count')
  it('returns error=seat_limit_reached when at limit')
  it('returns canAdd=false for non-Agency plan (seat_limit=1, already 1 owner)')
  it('handles DB error gracefully — returns canAdd=false with db_error code')
  it('atomic read: member count and seat_limit from same query (no TOCTOU)')
})

describe('updateSeatQuantity', () => {
  it('calls stripe.subscriptions.update with correct quantity')
  it('uses proration_behavior=create_prorations')
  it('updates orgs.seat_limit after Stripe success')
  it('does NOT update DB if Stripe call fails')
  it('returns no-op success when quantity unchanged')
  it('returns error=no_subscription when org has no stripe_subscription_id')
  it('returns error=subscription_not_active when status is canceled')
  it('returns error=subscription_not_active when status is past_due (blocks new seat purchase)')
  it('returns error=below_minimum_seats when newSeatCount < minSeats')
  it('returns error=not_agency_plan when org is on growth plan')
  it('returns error=stripe_error when Stripe API throws')
  it('returns previousQuantity and newQuantity on success')
  it('sets seats_updated_at timestamp on DB update')
})

describe('syncSeatLimitFromWebhook', () => {
  it('updates orgs.seat_limit by stripeCustomerId lookup')
  it('handles unknown stripeCustomerId gracefully (no crash, returns error)')
  it('sets seat_limit=1 when subscription status=canceled')
  it('preserves seat_limit when status=past_due (grace period)')
  it('handles multiple orgs with same customer gracefully (should be 1:1 — logs warning)')
  it('returns orgId on success for webhook event logging')
  it('handles DB update failure — returns error string')
})

describe('calculateSeatOverage', () => {
  it('returns overage=0 when members <= seat_limit')
  it('returns overage=2 when 7 members and seat_limit=5')
  it('returns correct currentMembers count')
  it('returns correct seatLimit')
  it('handles empty org_members gracefully')
})

describe('getSeatLimit helper', () => {
  it('returns 1 for starter plan regardless of quantity')
  it('returns 1 for growth plan regardless of quantity')
  it('returns subscriptionQuantity for agency plan')
  it('returns defaultSeats when subscriptionQuantity undefined for agency')
})

describe('isMultiUserPlan', () => {
  it('returns false for starter')
  it('returns false for growth')
  it('returns false for professional')
  it('returns true for agency')
  it('returns false for unknown plan (graceful)')
})
```

---

### Test File 2: `src/__tests__/unit/location-permissions.test.ts`

**~32 Vitest tests.**

```typescript
describe('resolveLocationRole', () => {
  // Owner always wins
  it('owner gets owner role on any location regardless of location_permissions rows')
  it('owner gets owner role even when explicit location_permissions row exists for them')

  // Location override present
  it('admin with viewer location override gets viewer role on that location')
  it('admin with no location override gets admin role (org fallback)')
  it('viewer with no location override gets viewer role (org fallback)')

  // Cannot elevate above org role
  it('viewer CANNOT get admin role even if location_permissions says admin')
  // → resolved role = min(org_role=viewer, location_role=admin) = viewer
  it('viewer with location admin gets viewer (most restrictive wins)')

  // Not a member
  it('returns null for user not in org_members')
  it('returns null for user not in org_members even with explicit location row')

  // Unknown location
  it('returns null for locationId not in org (user has no access)')

  // DB errors
  it('handles supabase error gracefully — returns null (fail closed)')
})

describe('getUserLocationAccess', () => {
  it('owner gets all org locations with owner role')
  it('admin gets all locations with admin role (no overrides)')
  it('admin gets viewer role on location with explicit viewer override')
  it('viewer gets all locations with viewer role (no overrides)')
  it('viewer gets viewer role even with admin location override')
  it('returns empty array for user not in org')
  it('returns only accessible locations (not all org locations for restricted user)')
  it('handles org with single location correctly')
  it('handles org with 10 locations correctly (Agency scale)')
})

describe('assertLocationRole', () => {
  it('resolves when user meets required role on location')
  it('throws INSUFFICIENT_LOCATION_ROLE when viewer hits admin requirement')
  it('includes locationId in thrown error')
  it('includes required and actual roles in thrown error')
  it('throws when user is not org member (null role)')
})

describe('setLocationPermission', () => {
  it('inserts location_permissions row on success')
  it('updates existing row on conflict (upsert)')
  it('returns error when caller is not owner')
  it('returns error when orgMemberId not in org (cross-org attempt)')
  it('returns error when role would elevate above org role (viewer → admin blocked)')
  it('sets granted_by to calling user id')
  it('sets updated_at on update')
})

describe('revokeLocationPermission', () => {
  it('deletes location_permissions row on success')
  it('returns success even when no row exists (idempotent)')
  it('returns error when caller is not owner')
  it('returns error when orgMemberId not in org (cross-org attempt)')
})
```

---

### Test File 3: `src/__tests__/unit/seat-actions.test.ts`

**~28 Vitest tests.** Mock server actions context + Stripe + Supabase.

```typescript
describe('addSeat', () => {
  it('calls updateSeatQuantity with currentSeatLimit + 1')
  it('returns new seat limit on success')
  it('returns error when caller is not owner')
  it('returns error when plan is not agency')
  it('returns error when subscription not active')
  it('returns error=stripe_error and does NOT update DB when Stripe fails')
  it('orgId comes from session — not from any argument')
  it('revalidates billing page path on success')
  it('returns prorationDescription string on success')
})

describe('removeSeat', () => {
  it('calls updateSeatQuantity with currentSeatLimit - 1')
  it('returns new seat limit on success')
  it('returns error when caller is not owner')
  it('returns error=would_create_overage when currentMembers >= newSeatCount')
  it('returns error=below_minimum_seats when newSeatCount < minSeats')
  it('does not call Stripe when validation fails')
  it('returns error when plan is not agency')
  it('does NOT remove any members from org_members (removal is manual)')
})

describe('getSeatSummary', () => {
  it('returns correct seatLimit from orgs.seat_limit')
  it('returns correct currentMembers count from org_members')
  it('returns seatsRemaining = seatLimit - currentMembers')
  it('returns seatOverage from orgs.seat_overage_count')
  it('returns isAgencyPlan=true for agency plan')
  it('returns isAgencyPlan=false for growth plan')
  it('returns subscriptionStatus from Stripe or orgs table')
  it('returns monthlyCostPerSeat null for non-Agency plans')
  it('handles missing stripe_subscription_id gracefully')
  it('orgId from session only — not from args')
})
```

---

### Test File 4: `src/__tests__/unit/stripe-webhook-seats.test.ts`

**~30 Vitest tests.** This is the most critical test file — webhook failures cost money.

```typescript
/**
 * All tests use the Stripe webhook test helper pattern from the existing test suite.
 * Read existing stripe webhook tests before writing these to match the mock pattern exactly.
 */

describe('Stripe webhook — customer.subscription.updated', () => {
  it('syncs seat_limit when quantity increases')
  it('syncs seat_limit when quantity decreases')
  it('sets seat_overage_count when new quantity < current member count')
  it('sends SeatOverageEmail when overage > 0')
  it('clears seat_overage_count when quantity restored above member count')
  it('sets seat_limit=1 when subscription becomes canceled')
  it('does NOT immediately lock seats when status becomes past_due (grace period)')
  it('logs event to stripe_webhook_events on success')
  it('logs error to stripe_webhook_events on failure (does not rethrow)')
  it('is idempotent — second call with same event.id is no-op')
  it('verifies Stripe signature before processing')
  it('returns 400 on invalid signature (does not process)')
  it('returns 200 even when event processing fails (Stripe retry prevention)')
})

describe('Stripe webhook — customer.subscription.deleted', () => {
  it('sets seat_limit=1 on subscription deleted')
  it('is idempotent')
  it('logs to stripe_webhook_events')
})

describe('Stripe webhook — invoice.payment_failed', () => {
  it('does NOT change seat_limit on first payment failure')
  it('sets seat_limit=1 when subscription status becomes unpaid')
  it('is idempotent')
  it('logs to stripe_webhook_events')
})

describe('Stripe webhook — invoice.payment_succeeded', () => {
  it('clears seat_overage_since when payment succeeds after past_due')
  it('re-syncs seat_limit from subscription quantity')
  it('is idempotent')
})

describe('Stripe webhook — idempotency', () => {
  it('skips processing when stripe_event_id already in stripe_webhook_events')
  it('still returns 200 for duplicate events (not 409)')
  it('does not insert duplicate rows even under concurrent requests')
})

describe('Stripe webhook — signature verification', () => {
  it('returns 400 when stripe-signature header missing')
  it('returns 400 when stripe-signature header malformed')
  it('returns 400 when STRIPE_WEBHOOK_SECRET not set in env')
  it('processes correctly with valid signature')
})
```

---

### Test File 5: `src/__tests__/unit/send-invitation-seat-check.test.ts`

**~10 Vitest tests.** Tests the seat check integration in Sprint 98's `sendInvitation`.

```typescript
describe('sendInvitation — seat limit enforcement', () => {
  it('allows invitation when seats available (currentMembers < seat_limit)')
  it('blocks invitation when at seat limit — returns seat_limit_reached error')
  it('blocks invitation when over seat limit (overage state)')
  it('returns seatsRemaining in success response')
  it('returns seatLimit in seat_limit_reached error response')
  it('still blocks if Agency plan but seat_limit=1 (subscription not configured yet)')
  it('seat check runs BEFORE Resend email — no email sent when seat check fails')
  it('seat check is atomic — concurrent invitations cannot both pass when 1 seat remains')
  it('does not block owner (owner is already counted in member list)')
  it('does not call Stripe — check is DB-only (seat_limit column)')
})
```

---

### Test File 6: `src/__tests__/e2e/seat-billing.spec.ts`

**~16 Playwright tests.** Uses Stripe test mode. All Stripe calls use test Price IDs.

```typescript
describe('Seat Billing E2E — Agency Owner', () => {
  // Billing page
  it('billing page shows seat management card for Agency plan owner')
  it('seat-count-display shows correct "X of Y seats used"')
  it('seat-progress-bar reflects usage percentage')
  it('seat-add-btn is visible and enabled when below max')
  it('seat-remove-btn is disabled when current members == seat_limit (would create overage)')

  // Add seat flow
  it('clicking add seat increments seat_limit and updates UI', async ({ page }) => {
    // Navigate to billing settings as Agency owner
    // Assert seat-count-display shows "1 of 5 seats used" (initial state)
    // Click seat-add-btn
    // Assert: loading state appears
    // Assert: seat-count-display updates to "1 of 6 seats used"
    // Assert: Stripe subscription quantity = 6 (verify via test API)
  })

  // Remove seat flow
  it('clicking remove seat decrements seat_limit', async ({ page }) => {
    // Set up: 5 seat limit, 3 members
    // Navigate to billing settings
    // Click seat-remove-btn
    // Assert: seat_limit becomes 4
  })

  // Overage banner
  it('overage banner appears when seat_overage_count > 0', async ({ page }) => {
    // Simulate a downgrade via Stripe test webhook
    // Navigate to billing page
    // Assert: seat-overage-banner is visible with correct member count
    // Assert: "Manage Team" link points to /dashboard/settings/team
  })

  // Seat gate on invitation
  it('invite form shows seat limit reached error when at capacity', async ({ page }) => {
    // Set org to 5/5 seats
    // Navigate to /dashboard/settings/team
    // Fill invite form and submit
    // Assert: invite-error-message contains "seat limit reached"
    // Assert: no email sent (mock Resend)
  })

  it('invite succeeds after adding a seat')
})

describe('Seat Billing E2E — Webhook Simulation', () => {
  it('subscription.updated webhook syncs seat_limit to DB')
  it('overage email triggered when downgrade creates overage')
  it('duplicate webhook event is silently ignored (idempotency)')
})

describe('Location Permissions E2E', () => {
  // Only meaningful for multi-location — skip for single-location golden tenant
  // These tests use a seeded multi-location Agency org
  it('location-role-select visible in team settings for multi-location Agency org')
  it('owner can set viewer location permission for admin member')
  it('admin member sees only their accessible locations in dashboard nav')
})
```

---

### Test File 7: `src/__tests__/unit/location-permission-enforcement.test.ts`

**~14 Vitest tests.** Tests that dashboard query helpers correctly filter by location access.

```typescript
describe('Dashboard query location filtering', () => {
  it('owner query returns all locations')
  it('admin query returns all locations (no overrides)')
  it('admin query returns only permitted locations (with overrides)')
  it('viewer query returns only permitted locations')
  it('empty accessibleLocationIds returns no results (not all results)')

  describe('React.cache() memoization', () => {
    it('getUserLocationAccess called once per request despite multiple page sections')
    it('different requests do not share cached results')
  })

  describe('Query injection safety', () => {
    it('accessibleLocationIds uses .in() — never string interpolation')
    it('empty array passed to .in() returns empty result set (not all records)')
    // Empty .in([]) behavior varies by Supabase version — verify this explicitly
  })
})
```

---

## 🔍 Pre-Implementation Diagnosis

Run every command. Document output as comments before writing code.

```bash
# ============================================================
# STRIPE INVESTIGATION
# ============================================================

# 1. Find all Stripe Price IDs in codebase
grep -r "STRIPE_PRICE\|price_\|price_id\|priceId" lib/ app/ --include="*.ts" --include="*.env*" -l
grep -r "STRIPE_PRICE\|price_" .env.local .env 2>/dev/null

# 2. Find existing Stripe subscription update calls
grep -r "subscriptions.update\|subscriptions.create\|stripe\.subscriptions" lib/ app/ --include="*.ts"

# 3. Find Stripe webhook handler completely
cat app/api/webhooks/stripe/route.ts

# 4. Check which Stripe events are already handled
grep -E "case '|event\.type ==|switch.*event" app/api/webhooks/stripe/route.ts

# 5. Find existing idempotency mechanism (if any)
grep -r "idempotency\|webhook_events\|stripe_event\|event_id" lib/ app/ supabase/ --include="*.ts" --include="*.sql" -l

# 6. Find Stripe client initialization
find lib -name "stripe*" -o -name "*stripe*" 2>/dev/null
grep -r "new Stripe\|Stripe(" lib/ --include="*.ts"

# 7. Find existing subscription quantity handling
grep -r "quantity\|seat" lib/ app/ --include="*.ts" | grep -i "stripe\|subscription"

# ============================================================
# DATABASE INVESTIGATION
# ============================================================

# 8. Inspect orgs table fully
grep -A50 "CREATE TABLE.*orgs" supabase/prod_schema.sql

# 9. Find stripe columns on orgs
grep -E "stripe_customer|stripe_subscription|stripe_price|plan|seat" supabase/prod_schema.sql

# 10. Check for existing seat_limit or max_seats
grep -E "seat_limit|max_seats|seat_count" supabase/prod_schema.sql

# 11. Check org_members from Sprint 98
grep -A30 "CREATE TABLE.*org_members" supabase/prod_schema.sql

# 12. Check location_id presence on data tables
grep -E "location_id" supabase/prod_schema.sql | grep -v "references\|foreign\|index"

# 13. Check existing RLS policies that may conflict
grep -B2 -A10 "CREATE POLICY" supabase/prod_schema.sql | grep -A10 "org_members\|locations"

# ============================================================
# CODE INVESTIGATION
# ============================================================

# 14. Find all places that query location-scoped data (needs permission filter added)
grep -rn "location_id\|from('ai_audits')\|from('content_drafts')\|from('visibility_analytics')" \
  app/dashboard --include="*.tsx" --include="*.ts" | grep -v "test\|spec"

# 15. Check React.cache usage in existing code
grep -r "React.cache\|cache()" app/ lib/ --include="*.ts" --include="*.tsx"

# 16. Find how existing billing page works
cat app/dashboard/settings/billing/page.tsx 2>/dev/null || \
  find app -name "billing*" -path "*/settings/*"

# 17. Verify Stripe test mode setup in tests
find src/__tests__ -name "*stripe*" -o -name "*billing*" 2>/dev/null
grep -r "stripe\|Stripe" src/__tests__/ --include="*.ts" -l 2>/dev/null

# ============================================================
# ENVIRONMENT INVESTIGATION
# ============================================================

# 18. List all Stripe env vars (no values)
grep -E "^STRIPE_" .env.local 2>/dev/null | cut -d= -f1
grep -E "^STRIPE_" .env.example 2>/dev/null | cut -d= -f1
```

**After running diagnosis, answer and document:**
- Is Stripe in test mode or live mode during development?
- What is the Agency per-seat Price ID (or is Agency flat rate)?
- Does the webhook handler have idempotency? What table?
- Are there existing `location_id` filters on any dashboard queries?
- Does `React.cache` already exist in any data fetching pattern?

---

## 🧠 Edge Cases to Handle

**Stripe + Seats:**

1. **Concurrent invitation race:** Two admins send invitations simultaneously when 1 seat remains. Both pass `checkSeatAvailability` before either commits. Solution: add a DB-level constraint or use `FOR UPDATE` locking when reading seat count. At minimum, the `UNIQUE (org_id, email)` on `pending_invitations` prevents double-invite to same email. For true seat-count protection in V1, add an application-level check in `sendInvitation` that counts pending + active members atomically.

2. **Stripe quantity out of sync with DB:** The `seat_limit` on `orgs` is the DB's cached view of Stripe's `quantity`. They can diverge if: a webhook fails, a direct Stripe dashboard edit happens, or a network timeout occurs mid-update. A **nightly seat sync cron** should reconcile: fetch all Agency subscriptions from Stripe, compare to `orgs.seat_limit`, update any mismatches. Add this as a TODO in MEMORY.md for Sprint 103 if not building now.

3. **Subscription in `trialing` state:** Treat `trialing` the same as `active` for seat purposes. Do not block seat additions during trial. This is intentional — let agencies add their team during the trial to increase stickiness.

4. **Subscription in `past_due` state:** Do NOT immediately lock seats. Stripe's default retry schedule is Day 1, Day 3, Day 5, Day 7. Locking seats on first failure creates terrible UX for an admin who hasn't even been notified yet. Lock (seat_limit=1) only when status becomes `unpaid` (all retries exhausted). Add a `past_due` banner to the billing page without locking.

5. **Downgrade from Agency to Professional:** Stripe sends `subscription.updated` with new price. The org's `plan` changes to `professional`. `seat_limit` should immediately become 1. `seat_overage_count` = (currentMembers - 1). Owner gets overage email. Members are NOT removed automatically — owner must manually remove them. This prevents accidental data loss.

6. **Subscription canceled mid-cycle:** Stripe sends `subscription.deleted` at period end. Until then the org is still on Agency (access continues). `seat_limit` stays at current value until `subscription.deleted` fires. On `deleted`: seat_limit=1.

7. **Proration negative invoice:** When removing a seat, Stripe creates a credit note. The `updateSeatQuantity` return value should include this credit so the UI can say "You'll receive a credit of $X on your next invoice."

8. **Stripe API timeout (5xx or network):** `updateSeatQuantity` catches the error, returns `stripe_error`, does NOT update the DB. The UI shows the error. The seat count is unchanged. The user can retry. No partial state.

9. **Admin attempts to add seat (owner-only operation):** `addSeat` checks `assertOrgRole('owner')` first. Admin cannot add seats even though they can invite members. This is intentional — seat billing is a financial operation.

10. **Agency org with `stripe_subscription_id = null`:** This happens when an Agency org was created before Stripe billing was wired (e.g. internal/test orgs). `updateSeatQuantity` returns `no_subscription`. The billing page should handle this gracefully with a "Set up billing" CTA rather than crashing.

**Location Permissions:**

11. **Single-location org (V1 majority):** `getUserLocationAccess` returns one entry. The filtering `.in('location_id', [singleId])` is equivalent to `.eq('location_id', singleId)`. Performance is identical. No special case needed — the general path handles it.

12. **Owner bypasses location permissions:** Owner always has full access to all locations. The `resolveLocationRole` function returns `'owner'` immediately for any user with `org_members.role = 'owner'`, without even querying `location_permissions`. This is both a performance optimization and a safety guarantee.

13. **Location permission elevation blocked:** If `org_members.role = 'viewer'` and `location_permissions.role = 'admin'`, resolved role = `'viewer'`. The minimum is taken. This is enforced in `resolveLocationRole` and validated in `setLocationPermission` (blocks the insert).

14. **Deleting a member clears their location permissions:** `org_members` has `ON DELETE CASCADE` to `location_permissions` via `org_member_id`. No manual cleanup needed.

15. **Empty `accessibleLocationIds` array in `.in()` query:** Supabase/PostgreSQL `.in('col', [])` behavior: returns 0 rows (correct). But verify this — some Supabase client versions have bugs with empty `.in()` arrays. Add an explicit check: `if (accessibleLocationIds.length === 0) return []` before the query.

16. **`getUserLocationAccess` called N times per page render:** Without memoization, each dashboard section that uses location filtering would make a separate DB call. Use `React.cache()` to memoize per request. Document the pattern in AI_RULES §52.

17. **Location permission on a location the user can't see:** A user might have a `location_permissions` row for a location that was deleted. The `ON DELETE CASCADE` on `location_id` reference in `location_permissions` handles this — the row is deleted when the location is deleted.

18. **Webhook signature verification in test environment:** Stripe's `constructEvent` requires the raw request body, not a parsed JSON. The existing webhook handler must be reading `request.text()` or `request.arrayBuffer()` — not `request.json()`. Verify this before adding new event handlers. If it's using `request.json()`, the signature verification is already broken and needs fixing (log this as a critical finding in the diagnosis).

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| Stripe billing foundation | Sprint 0, Phase 3 | Checkout, webhooks, portal — being extended |
| `org_members` + `pending_invitations` tables | Sprint 98 | Foundation for seat counting + invitation flow |
| `sendInvitation` server action | Sprint 98 | Being extended with seat check |
| `lib/auth/org-roles.ts` | Sprint 98 | `assertOrgRole`, `OrgRole` type — being imported |
| `lib/plan-enforcer.ts` + `planSatisfies()` | Sprint 3, 96 | Plan checks in seat actions |
| `<PlanGate>` component | Sprint 96 | Billing page seat card visibility for non-Agency |
| Alert emails (Resend + React Email) | Sprint 1 | `SeatOverageEmail` extends template infrastructure |
| Business Info Editor / Settings page | Sprint 93 | Billing page being extended |
| Team settings page | Sprint 98 | Location permission UI added to team page |
| `locations` table + Magic Menu | Sprint 2, 89 | `location_permissions` references `locations.id` |
| `createServiceRoleClient()` | Sprint 18 | Webhook handler + `syncSeatLimitFromWebhook` |

---

## 📓 DEVLOG Entry Format

```markdown
## Sprint 99 — Seat-Based Billing + Agency Permissions (Gap #75 pt2: 60% → 100%)
**Date:** [DATE]
**Duration:** ~8 hours (Large sprint — L effort)

### Problem
Multi-user teams (Sprint 98) exist but cannot be monetized or access-controlled.
No seat limits enforced. No billing sync with Stripe. No per-location permissions.
Agency tier exists in UI but has no commercial structure.

### Solution
Three interconnected systems:
1. Stripe seat quantity management: addSeat/removeSeat → updateSeatQuantity → Stripe API
   → DB sync. Proration handled. seat_limit column drives all enforcement.
2. Bidirectional sync: App enforces via checkSeatAvailability. Stripe webhooks sync
   seat_limit back via subscription.updated/deleted/payment events. Full idempotency.
3. Per-location permissions: location_permissions table with resolveLocationRole()
   resolution. Dashboard queries filtered by getUserLocationAccess(). Owner bypasses.

### Files Changed
- `supabase/migrations/[timestamp]_seat_billing_location_permissions.sql` — NEW
- `lib/stripe/seat-plans.ts` — NEW: seat plan config + helpers
- `lib/stripe/seat-manager.ts` — NEW: all seat quantity operations
- `lib/auth/location-permissions.ts` — NEW: location role resolution + enforcement
- `app/api/webhooks/stripe/route.ts` — MODIFIED: 4 new event handlers + idempotency
- `app/actions/seat-actions.ts` — NEW: addSeat, removeSeat, getSeatSummary
- `app/actions/invitations.ts` — MODIFIED: seat check integration
- `app/dashboard/settings/billing/page.tsx` — MODIFIED: seat management card
- `app/dashboard/settings/team/page.tsx` — MODIFIED: location permission UI
- `app/dashboard/[all location-querying pages]` — MODIFIED: location access filter
- `emails/SeatOverageEmail.tsx` — NEW: overage notification email
- `src/__tests__/unit/seat-manager.test.ts` — NEW: [N] tests
- `src/__tests__/unit/location-permissions.test.ts` — NEW: [N] tests
- `src/__tests__/unit/seat-actions.test.ts` — NEW: [N] tests
- `src/__tests__/unit/stripe-webhook-seats.test.ts` — NEW: [N] tests
- `src/__tests__/unit/send-invitation-seat-check.test.ts` — NEW: [N] tests
- `src/__tests__/unit/location-permission-enforcement.test.ts` — NEW: [N] tests
- `src/__tests__/e2e/seat-billing.spec.ts` — NEW: [N] tests

### Grep counts (run before committing):
grep -cE "^\s*(it|test)\(" src/__tests__/unit/seat-manager.test.ts                       # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/location-permissions.test.ts               # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/seat-actions.test.ts                       # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/stripe-webhook-seats.test.ts               # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/send-invitation-seat-check.test.ts         # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/location-permission-enforcement.test.ts    # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/e2e/seat-billing.spec.ts                        # [N]

### Gaps Closed
- Gap #75 (part 2): Multi-User Agency Workflows — 60% → 100%
  - Seat billing: Stripe quantity management + webhook sync complete
  - Location permissions: per-location role resolution in all dashboard queries
  - Agency tier is now commercially complete

### Critical Decisions
- Seat lock on past_due: NO (grace period). Lock only on unpaid (all retries failed).
- Location permission elevation: BLOCKED. min(org_role, location_role) always applies.
- Overage on downgrade: WARNING only (email + banner). No automatic member removal.
- Proration: create_prorations (immediate proration on seat changes).

### Next Sprint
Sprint 100 — Multi-Location Management (Gap #57)
```

---

## 🔮 AI_RULES Update — Add Rule §52 to `AI_RULES.md`

```markdown
## §52. 💳 Seat Billing + Location Permissions — Architecture Rules (Sprint 99)

### Seat management
- `lib/stripe/seat-manager.ts` is the ONLY place that calls Stripe subscription update API.
  Never call `stripe.subscriptions.update()` outside this file.
- `lib/stripe/seat-plans.ts` is the ONLY place seat counts and Price IDs are defined.
  Never hardcode seat counts or Stripe Price IDs in actions or route handlers.
- `checkSeatAvailability()` is DB-only — never calls Stripe. Fast and cheap.
  Call it before every invitation send. Do not bypass.
- `updateSeatQuantity()` is DB-first on success, no-op on Stripe failure.
  If Stripe fails, DB is NOT updated. Caller retries. No partial state.
- `addSeat()` and `removeSeat()` server actions require `assertOrgRole('owner')`.
  Admin cannot modify billing — owner only.

### Stripe webhooks
- All new Stripe event handlers use the idempotency wrapper (check stripe_webhook_events first).
- Always return 200 from the webhook endpoint even on processing errors.
  Returning 4xx/5xx causes Stripe to retry — processing errors should be logged, not retried.
- Never call `request.json()` in the webhook route — use `request.text()` for signature verification.
- Grace period: do NOT lock seats on `past_due`. Lock only on `unpaid`.

### Location permissions
- `resolveLocationRole()` in `lib/auth/location-permissions.ts` is the ONLY place
  effective location roles are computed. Never inline this logic.
- Resolution rule: min(org_role, location_role). Location permissions CANNOT elevate
  a user above their org-level role. This is enforced in both read and write paths.
- Owner bypasses ALL location permission checks. Do not add location_permissions rows for owners.
- `getUserLocationAccess()` MUST be wrapped in `React.cache()` in Server Components.
  It is called multiple times per page render and must not make N DB calls.
- Empty `.in('location_id', [])` returns 0 rows — always check for empty array before querying.
- All dashboard pages that query location-scoped data MUST filter by `accessibleLocationIds`.
  Adding a new dashboard page: add the location access filter before merging.
```

---

## ✅ Acceptance Criteria

**Seat Billing:**
- [ ] `orgs.seat_limit` column exists and is populated for all orgs
- [ ] `stripe_webhook_events` table exists with UNIQUE constraint on `stripe_event_id`
- [ ] `addSeat()` increments Stripe quantity and updates `seat_limit` in DB
- [ ] `removeSeat()` decrements Stripe quantity and is blocked when members = seat_limit
- [ ] `sendInvitation()` blocked when `checkSeatAvailability()` returns `canAdd=false`
- [ ] Stripe `subscription.updated` webhook syncs `seat_limit` to DB
- [ ] Stripe `subscription.updated` with overage sets `seat_overage_count` + sends email
- [ ] Stripe webhooks are idempotent (duplicate event = no-op, returns 200)
- [ ] `past_due` does NOT lock seats (grace period honoured)
- [ ] `unpaid` (all retries failed) DOES set `seat_limit=1`
- [ ] Billing page shows seat management card for Agency plan owner
- [ ] Overage banner visible when `seat_overage_count > 0`

**Location Permissions:**
- [ ] `location_permissions` table exists with correct schema + RLS
- [ ] `resolveLocationRole()` returns min(org_role, location_role)
- [ ] Owner always gets full access regardless of `location_permissions` rows
- [ ] Location permission cannot elevate above org-level role
- [ ] All dashboard pages filter queries by `getUserLocationAccess()` result
- [ ] `getUserLocationAccess()` is memoized with `React.cache()` per request
- [ ] Empty `accessibleLocationIds` returns 0 results (not all results)
- [ ] Team settings page shows location permission UI for multi-location Agency orgs

**Tests + Quality:**
- [ ] All 7 test files pass: `npx vitest run` (zero regressions on existing suite)
- [ ] All E2E tests pass: `npx playwright test src/__tests__/e2e/seat-billing.spec.ts`
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] No inline Stripe subscription calls outside `seat-manager.ts`
- [ ] No hardcoded Price IDs outside `seat-plans.ts`
- [ ] Webhook handler reads `request.text()` not `request.json()` (verify, do not assume)

---

## 🧾 Test Run Commands

```bash
npx vitest run src/__tests__/unit/seat-manager.test.ts                    # ~38 tests
npx vitest run src/__tests__/unit/location-permissions.test.ts            # ~32 tests
npx vitest run src/__tests__/unit/seat-actions.test.ts                    # ~28 tests
npx vitest run src/__tests__/unit/stripe-webhook-seats.test.ts            # ~30 tests
npx vitest run src/__tests__/unit/send-invitation-seat-check.test.ts      # ~10 tests
npx vitest run src/__tests__/unit/location-permission-enforcement.test.ts # ~14 tests
npx vitest run                                                              # Full suite — 0 regressions
npx playwright test src/__tests__/e2e/seat-billing.spec.ts                # ~16 tests
npx tsc --noEmit                                                            # 0 new type errors

# Total new tests: ~168 unit + ~16 E2E
```

---

## 📚 Document Sync + Git Commit (After All Tests Pass)

### Step 1: Update `/docs` files

**`docs/roadmap.md`** — Update Feature #75 (Multi-User Agency Workflows) from `🟡 60%` to `✅ 100%`. Note Sprint 99 closes seat billing and location permissions.

**`docs/MULTI-USER_AGENCY_WHITE_LABEL.md`** — Update to reflect complete multi-user architecture as built across Sprints 98–99.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 99 to completed sprints list.

### Step 2: Update `DEVLOG.md`

Paste DEVLOG entry above. Replace all `[N]` with actual `grep -cE` counts.

### Step 3: Update `CLAUDE.md`

```markdown
### Sprint 99 — Seat-Based Billing + Agency Permissions (2026-03-XX)
- `lib/stripe/seat-plans.ts` — Seat plan config + helpers
- `lib/stripe/seat-manager.ts` — All Stripe seat quantity operations
- `lib/auth/location-permissions.ts` — Location role resolution + enforcement
- `app/api/webhooks/stripe/route.ts` — Extended: 4 new event handlers + idempotency
- `app/actions/seat-actions.ts` — addSeat, removeSeat, getSeatSummary
- `app/actions/invitations.ts` — Extended: seat check in sendInvitation
- `emails/SeatOverageEmail.tsx` — Overage notification email
- Migration: seat_limit/overage columns on orgs, stripe_webhook_events, location_permissions
- Dashboard pages: all updated with getUserLocationAccess() location filter
- Tests: [N] Vitest + [N] Playwright
- Gap #75 closed: Multi-User Agency Workflows 60% → 100%
```

### Step 4: Update `MEMORY.md`

```markdown
## Decision: Seat Billing + Location Permissions Architecture (Sprint 99 — 2026-03-XX)
- seat_limit on orgs = DB cache of Stripe subscription quantity. Source of truth = Stripe.
- Seat lock policy: past_due = grace (no lock). unpaid = lock (seat_limit=1).
- Overage on downgrade: warning only. No automatic member removal. Owner must act.
- Location permissions: min(org_role, location_role). Owner bypasses all checks.
- getUserLocationAccess() memoized per request via React.cache().
- Webhook idempotency: stripe_webhook_events table with UNIQUE on stripe_event_id.
- Proration behavior: create_prorations (immediate billing credit/charge on seat change).
- Stripe webhook uses request.text() — NOT request.json() — for signature verification.
- Nightly seat sync cron (Stripe vs DB reconciliation): TODO for Sprint 103.
```

### Step 5: Update `AI_RULES.md`

Append Rule §52 from the **🔮 AI_RULES Update** section above.

### Step 6: Final sync checklist

- [ ] `DEVLOG.md` has Sprint 99 entry with actual test counts
- [ ] `CLAUDE.md` has Sprint 99 in implementation inventory
- [ ] `MEMORY.md` has billing + location permission decisions
- [ ] `AI_RULES.md` has Rule §52
- [ ] `docs/roadmap.md` shows Feature #75 as ✅ 100%
- [ ] `docs/MULTI-USER_AGENCY_WHITE_LABEL.md` updated to reflect complete architecture
- [ ] `docs/09-BUILD-PLAN.md` has Sprint 99 checked

### Step 7: Git commit

```bash
git add -A
git status

git commit -m "Sprint 99: Seat Billing + Agency Permissions (Gap #75 pt2: 60% → 100%)

- lib/stripe/seat-plans.ts: seat config (defaultSeats, minSeats, priceIds)
- lib/stripe/seat-manager.ts: checkSeatAvailability, updateSeatQuantity, syncFromWebhook
- lib/auth/location-permissions.ts: resolveLocationRole, getUserLocationAccess, assertLocationRole
- app/api/webhooks/stripe: subscription.updated/deleted, invoice.failed/succeeded handlers
- stripe_webhook_events table: full idempotency on all webhook events
- app/actions/seat-actions: addSeat, removeSeat, getSeatSummary (owner only)
- app/actions/invitations: seat check integration (atomic, pre-invite gate)
- billing page: seat management card (count, progress, add/remove, overage banner)
- team page: location permission UI per member (multi-location Agency only)
- dashboard pages: all location queries filtered by getUserLocationAccess()
- emails/SeatOverageEmail: downgrade overage notification to owner
- migration: seat_limit, seat_overage_count, stripe_webhook_events, location_permissions
- tests: [N] Vitest + [N] Playwright passing
- docs: roadmap #75 → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES §52

Closes Gap #75 completely. Agency tier is commercially complete.
Seat billing: Stripe quantity ↔ DB sync. Grace period on past_due. Lock on unpaid.
Location permissions: min(org_role, location_role). Owner bypasses. React.cache().
Unblocks Sprint 100 (Multi-Location Management)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 99 completes:

- **Multi-User Agency Workflows: 60% → 100%** (Gap #75 fully closed across Sprints 98 + 99)
- **The Agency tier is commercially complete** — teams, roles, seat billing, and location permissions are all live
- Stripe subscription quantity stays in sync with team size in both directions
- Downgrade protection is graceful: owners get warned, members are never auto-removed
- Every dashboard page respects location-level access — Agency clients see only their data
- ~168 unit tests + ~16 Playwright E2E tests protect all billing and permission paths
- **Sprint 100** can now build on this foundation: Multi-Location Management (Gap #57) — the Agency org UI for adding, editing, and switching between 10 client locations
