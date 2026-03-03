# Sprint 111 — Org Membership Foundation

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/plan-enforcer.ts`

---

## 🎯 Objective

Build the **Org Membership Foundation** — the database layer, service layer, RLS policies, and read-only Team Members UI that every subsequent multi-user sprint (112: invitations, 113: billing) depends on.

**What this sprint answers:** "Who else is in my organization, and what can they do?"

**What this sprint does NOT build:** invitations (Sprint 112), seat-based billing (Sprint 113), white-label (Sprint 114+). Scope discipline is critical — `org_members` must be correct before anything else touches it.

### Current State

Today every `organizations` row has exactly one implicit owner: the user who signed up. The `current_user_org_id()` SQL function returns a single org_id by looking up the auth user in an existing membership or owner reference. There is no formal `org_members` table, no roles, no way to add a second user to an org, and no way to remove access without deleting the user entirely.

### Target State After Sprint 111

- `org_members` table exists with `role` enum: `owner | admin | analyst | viewer`
- Every existing org has its owner auto-enrolled as `owner` role via migration backfill
- `current_user_org_id()` updated to query `org_members` instead of whatever it currently uses
- All existing RLS policies continue working without any change to calling code
- `lib/membership/` service module: pure functions for reading membership data
- Plan enforcer updated with `canAddMember()` and `getMaxSeats()` — Agency plan only for multi-seat
- `GET /api/team/members` — list all members for current org
- `DELETE /api/team/members/[memberId]` — remove a member (owner/admin only, cannot remove last owner)
- `/dashboard/team` — read-only team members page showing name, email, role, joined date
- All plan gates in place: Starter/Growth see upgrade prompt; Agency sees full team page

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                           — All rules (48+ rules as of Sprint 110)
Read CLAUDE.md                             — Full implementation inventory
Read supabase/prod_schema.sql
  § FIND: organizations — ALL columns, especially plan_tier enum values
  § FIND: current_user_org_id() — the exact SQL function body (CRITICAL)
  § FIND: any existing org_members or memberships table — check carefully
  § FIND: existing RLS policy pattern on any table (copy this exact pattern)
  § FIND: auth.users references — how users link to orgs today
Read lib/supabase/database.types.ts        — TypeScript types for all tables
Read lib/plan-enforcer.ts                  — Existing plan gating functions + plan_tier values
Read src/__fixtures__/golden-tenant.ts     — Golden Tenant (org_id: a0eebc99, user_id fixed)
Read supabase/seed.sql                     — How seed data is structured
Read app/dashboard/page.tsx               — Pattern for dashboard page layout
Read app/dashboard/_components/            — Existing component patterns to match
```

**Specifically understand before writing a single line:**

1. **`current_user_org_id()` SQL function** — read its exact body from `prod_schema.sql`. This function is used in EVERY RLS policy across EVERY table. After this sprint it must query `org_members`. If you break this function, every RLS policy in the system silently stops working. Treat this as the most dangerous change in the sprint.

2. **`plan_tier` enum values** — read the exact values from `organizations.plan_tier`. The plan enforcer uses these. Do not invent new values. The enum likely is `trial | starter | growth | agency` — verify against the schema.

3. **Whether `org_members` already exists** — search `prod_schema.sql` thoroughly. If any form of this table exists, extend it rather than recreating it.

4. **The golden tenant user_id** — read from `golden-tenant.ts`. The backfill migration must insert this user as `owner` of the golden tenant org.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/membership/
  index.ts              — barrel export
  types.ts              — OrgMember, MemberRole, MembershipContext types
  membership-service.ts — pure functions, caller passes Supabase client

app/api/team/
  members/
    route.ts            — GET (list members)
    [memberId]/
      route.ts          — DELETE (remove member)

app/dashboard/team/
  page.tsx              — Team members page (server component)
  _components/
    TeamMembersTable.tsx — Member list with role badges
    RoleBadge.tsx       — Role pill component (owner/admin/analyst/viewer)
```

---

### Component 1: Types — `lib/membership/types.ts`

```typescript
/**
 * The four roles available in an org.
 * Ordered from most to least privileged.
 */
export type MemberRole = 'owner' | 'admin' | 'analyst' | 'viewer';

/**
 * Permissions matrix — what each role can do.
 * Used by the plan enforcer and API route guards.
 */
export const ROLE_PERMISSIONS = {
  owner: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: true,
    canManageBilling: true,
    canDeleteOrg: true,
    canViewAllData: true,
    canEditContent: true,
    canApproveContent: true,
  },
  admin: {
    canInviteMembers: true,
    canRemoveMembers: true,   // cannot remove owner
    canChangeRoles: true,     // cannot change owner role
    canManageBilling: false,
    canDeleteOrg: false,
    canViewAllData: true,
    canEditContent: true,
    canApproveContent: true,
  },
  analyst: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    canManageBilling: false,
    canDeleteOrg: false,
    canViewAllData: true,
    canEditContent: false,
    canApproveContent: false,
  },
  viewer: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    canManageBilling: false,
    canDeleteOrg: false,
    canViewAllData: true,
    canEditContent: false,
    canApproveContent: false,
  },
} as const satisfies Record<MemberRole, Record<string, boolean>>;

/**
 * A member of an organization, as returned by the membership service.
 */
export interface OrgMember {
  id: string;              // org_members.id (UUID)
  org_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;       // ISO timestamp
  // From auth.users via JOIN — populated by getOrgMembers()
  email: string;
  full_name: string | null;
}

/**
 * The calling user's membership context.
 * Used in API routes to authorize actions.
 */
export interface MembershipContext {
  member_id: string;
  user_id: string;
  org_id: string;
  role: MemberRole;
  permissions: typeof ROLE_PERMISSIONS[MemberRole];
}

/**
 * Seat limits per plan tier.
 * 'null' means unlimited (Agency with Enterprise billing — future).
 */
export const SEAT_LIMITS: Record<string, number | null> = {
  trial:   1,
  starter: 1,
  growth:  1,
  agency:  10,
} as const;
// Note: growth is 1 seat (solo) — multi-seat is Agency-exclusive.
// Sprint 113 (billing) will wire seat-based Stripe metering.
// Sprint 111 stores the limit; Sprint 113 enforces it on invite.
```

---

### Component 2: Migration — `supabase/migrations/[timestamp]_org_members.sql`

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 111: Org Membership Foundation
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Role enum
--    Check if it exists first — safe to run multiple times
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role') THEN
    CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');
  END IF;
END
$$;

-- 2. org_members table
CREATE TABLE IF NOT EXISTS public.org_members (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        member_role  NOT NULL DEFAULT 'viewer',
  joined_at   timestamptz  NOT NULL DEFAULT NOW(),
  invited_by  uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  -- invited_by is NULL for the owner (self-enrolled via backfill or registration)
  UNIQUE (org_id, user_id)
);

COMMENT ON TABLE public.org_members IS
  'Members of each organization with their role. Sprint 111. '
  'Every organization must have exactly one owner at all times.';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org_id
  ON public.org_members (org_id);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON public.org_members (user_id);

-- 4. RLS
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Members can read their own org's member list
CREATE POLICY "org_members: members can read own org"
  ON public.org_members FOR SELECT
  USING (org_id = public.current_user_org_id());

-- Only owner/admin can insert (invite flow — Sprint 112 adds invite token logic)
CREATE POLICY "org_members: owner/admin can insert"
  ON public.org_members FOR INSERT
  WITH CHECK (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id   = public.current_user_org_id()
        AND om.user_id  = auth.uid()
        AND om.role     IN ('owner', 'admin')
    )
  );

-- Only owner/admin can update roles
CREATE POLICY "org_members: owner/admin can update"
  ON public.org_members FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    IN ('owner', 'admin')
    )
  );

-- Only owner/admin can delete (with application-level guard: cannot remove last owner)
CREATE POLICY "org_members: owner/admin can delete"
  ON public.org_members FOR DELETE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    IN ('owner', 'admin')
    )
  );

-- Service role full access (cron routes, invite acceptance)
CREATE POLICY "org_members: service role full access"
  ON public.org_members
  USING (auth.role() = 'service_role');

-- 5. Backfill existing orgs
--    For every organization that has no entry in org_members yet,
--    find the owner and insert them as 'owner'.
--
--    IMPORTANT: Read prod_schema.sql to understand how organizations.owner_id
--    is currently stored. The field may be named owner_id, created_by, or similar.
--    Adjust the SELECT below to match the ACTUAL column name in your schema.
--
INSERT INTO public.org_members (org_id, user_id, role, joined_at, invited_by)
SELECT
  o.id            AS org_id,
  o.owner_id      AS user_id,   -- ← VERIFY: replace with actual owner column name
  'owner'         AS role,
  o.created_at    AS joined_at,
  NULL            AS invited_by
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.org_members om WHERE om.org_id = o.id
)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 6. Update current_user_org_id() to query org_members
--
--    CRITICAL: This replaces the existing function.
--    Read the existing function body FIRST from prod_schema.sql.
--    If the existing function does something additional, preserve it.
--    The replacement MUST return the same type (uuid) and work the same way.
--
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT org_id
  FROM public.org_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_user_org_id() IS
  'Returns the org_id for the currently authenticated user. '
  'Updated Sprint 111 to query org_members table. '
  'Used in every RLS policy across all tenant-scoped tables.';

-- 7. Add seat_count column to organizations (for Sprint 113 billing — foundation here)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS seat_count integer NOT NULL DEFAULT 1
  CHECK (seat_count >= 1);

COMMENT ON COLUMN public.organizations.seat_count IS
  'Current active seat count. Maintained by triggers or application logic. '
  'Sprint 113 will wire this to Stripe seat metering.';

-- 8. Trigger to keep seat_count in sync automatically
CREATE OR REPLACE FUNCTION public.sync_org_seat_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.organizations
     SET seat_count = (
       SELECT COUNT(*) FROM public.org_members
       WHERE org_id = COALESCE(NEW.org_id, OLD.org_id)
     )
   WHERE id = COALESCE(NEW.org_id, OLD.org_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_seat_count ON public.org_members;
CREATE TRIGGER trg_sync_seat_count
  AFTER INSERT OR DELETE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_org_seat_count();

-- Backfill seat_count for all existing orgs
UPDATE public.organizations o
   SET seat_count = (
     SELECT COUNT(*) FROM public.org_members om WHERE om.org_id = o.id
   );
```

**After writing the migration, update:**
- `supabase/prod_schema.sql` — append org_members table + updated function + trigger
- `lib/supabase/database.types.ts` — add `org_members` row/insert/update types, `member_role` enum

---

### Component 3: Membership Service — `lib/membership/membership-service.ts`

```typescript
/**
 * Pure membership service functions.
 * Caller always passes the Supabase client — never creates its own.
 * This allows the same functions to work with:
 *   - RLS-scoped browser client (dashboard server components)
 *   - Service role client (cron routes, invite acceptance in Sprint 112)
 *
 * ── FUNCTION SPECS ────────────────────────────────────────────────────────────
 *
 * getOrgMembers(supabase, orgId):
 *   SELECT org_members JOIN auth.users ON user_id
 *   Returns OrgMember[] sorted by: owner first, then admin, then analyst, then viewer,
 *   then by joined_at ASC within each role group.
 *   Note: Joining auth.users requires service role client.
 *   With RLS-scoped client, omit the auth.users join and return email/full_name as null.
 *   Detect which client is being used by checking if org_id filter returns data.
 *
 * getCallerMembership(supabase):
 *   SELECT * FROM org_members WHERE user_id = auth.uid() LIMIT 1
 *   Returns MembershipContext | null
 *   Returns null if user has no org membership (should not happen post-backfill).
 *
 * getMemberById(supabase, memberId):
 *   SELECT * FROM org_members WHERE id = $memberId AND org_id = current_user_org_id()
 *   Returns OrgMember | null
 *   RLS already enforces org isolation — this is a secondary guard.
 *
 * removeMember(supabase, memberId):
 *   Application-level guards BEFORE deleting:
 *   1. Fetch the target member. If not found → throw 'member_not_found'
 *   2. If target.role === 'owner' → throw 'cannot_remove_owner'
 *   3. Count remaining members WHERE role = 'owner' in the org
 *      (This is belt-and-suspenders — the constraint above already prevents owner removal,
 *       but this catches any future edge case where owner role was changed)
 *   4. DELETE from org_members WHERE id = memberId
 *   Returns { success: true }
 *
 * getOrgSeatCount(supabase, orgId):
 *   SELECT seat_count FROM organizations WHERE id = orgId
 *   Returns number
 *
 * canAddMember(supabase, orgId):
 *   1. Fetch org plan_tier and seat_count
 *   2. Look up SEAT_LIMITS[plan_tier]
 *   3. Return { allowed: boolean; current: number; max: number | null }
 *   Used by Sprint 112 invite flow to gate the invitation before sending.
 *
 * ROLE ORDER for sorting:
 * const ROLE_ORDER: Record<MemberRole, number> = {
 *   owner: 0, admin: 1, analyst: 2, viewer: 3
 * };
 */
```

---

### Component 4: Plan Enforcer Updates — `lib/plan-enforcer.ts`

Add these two functions to the existing plan enforcer. Do NOT rewrite the file — add to it:

```typescript
/**
 * Returns the maximum number of seats for the given plan tier.
 * null = unlimited (future Agency Enterprise tier).
 *
 * Import SEAT_LIMITS from lib/membership/types.ts
 */
export function getMaxSeats(planTier: string): number | null {
  return SEAT_LIMITS[planTier] ?? 1;
}

/**
 * Returns true if the org can add another member given its current plan.
 * Used by invite flow (Sprint 112) and the team page upgrade prompt.
 *
 * currentSeatCount is passed in (not fetched) — keeps the function pure.
 */
export function canAddMember(planTier: string, currentSeatCount: number): boolean {
  const max = getMaxSeats(planTier);
  if (max === null) return true; // unlimited
  return currentSeatCount < max;
}
```

---

### Component 5: API Routes

#### `app/api/team/members/route.ts`

```typescript
/**
 * GET /api/team/members
 * Returns all members of the authenticated user's org.
 *
 * Plan gate: Agency only for >1 seat. But ALL plans can GET their own
 * members (an org always has at least 1 member — the owner).
 * No plan gate on GET — you can always see who's in your org.
 *
 * Auth: session required. Uses createServiceRoleClient() to join auth.users.
 *
 * Response: {
 *   members: OrgMember[];
 *   seat_count: number;
 *   max_seats: number | null;
 *   can_add: boolean;       // whether plan allows adding more members
 * }
 *
 * Error codes:
 * - 401: not authenticated
 * - 500: unexpected error
 */
```

#### `app/api/team/members/[memberId]/route.ts`

```typescript
/**
 * DELETE /api/team/members/[memberId]
 * Removes a member from the org.
 *
 * Plan gate: Agency only — only Agency orgs have multi-seat.
 * Auth: session required. Caller must be owner or admin.
 *
 * Guards (in order):
 * 1. Caller authenticated → 401 if not
 * 2. Caller is owner or admin → 403 'insufficient_role' if not
 * 3. Member exists in caller's org → 404 'member_not_found' if not
 * 4. Target is not an owner → 403 'cannot_remove_owner' if they are
 * 5. Caller is not removing themselves if they are the last owner →
 *    403 'last_owner' (cannot remove yourself if sole owner)
 *
 * Response on success: { ok: true }
 *
 * Error codes:
 * - 401: not authenticated
 * - 403: insufficient_role | cannot_remove_owner | last_owner
 * - 404: member_not_found
 * - 500: unexpected error
 *
 * IMPORTANT: Uses createServiceRoleClient() for the delete operation
 * because RLS on org_members only allows deletes by owner/admin but
 * the current_user_org_id() check requires the session. Use service role
 * ONLY AFTER application-level authorization checks pass.
 */
```

---

### Component 6: Dashboard Page — `app/dashboard/team/page.tsx`

```typescript
/**
 * Server Component. Fetches members server-side.
 *
 * Plan gate:
 * - trial/starter/growth: show upgrade prompt
 *   "Team collaboration is available on the Agency plan."
 *   Show a blurred/locked version of the team table with 1 example row.
 *   Include [Upgrade to Agency →] CTA button.
 * - agency: show full team page
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Team Members                          [Invite Member →]     │
 * │  Seats: 1 / 10  ████░░░░░░                                   │
 * ├──────────────────────────────────────────────────────────────┤
 * │  Name           Email               Role    Joined            │
 * │  Aruna Babu     aruna@...           Owner   Jan 2026          │
 * │  (empty state if solo)                                        │
 * └──────────────────────────────────────────────────────────────┘
 *
 * [Invite Member →] button: renders but is DISABLED in Sprint 111.
 *   Add tooltip: "Invite flow coming soon."
 *   data-testid="invite-member-btn" with aria-disabled="true"
 *   Sprint 112 will activate this button.
 *
 * Empty state (sole owner, no other members):
 *   "Your team is just you right now."
 *   "Invite teammates to collaborate on content, review AI answers, and manage locations."
 *   Show [Invite Member →] as the primary CTA (disabled for now).
 *
 * Seat progress bar:
 *   Shows current / max seats visually.
 *   Colors: < 80% usage = green, 80-99% = yellow, 100% = red.
 *
 * Add to sidebar navigation:
 *   Route: /dashboard/team
 *   Label: "Team"
 *   Icon: UsersIcon (from lucide-react)
 *   Position: below Settings, above Billing
 *   Plan badge: "Agency" pill next to the label for non-Agency plans
 *
 * data-testid attributes required:
 *   "team-page"
 *   "team-members-table"
 *   "invite-member-btn"
 *   "seat-progress-bar"
 *   "upgrade-prompt" (for non-Agency plans)
 */
```

---

### Component 7: TeamMembersTable — `app/dashboard/team/_components/TeamMembersTable.tsx`

```typescript
/**
 * 'use client' — for future interactivity (remove button in Sprint 112)
 *
 * Props: { members: OrgMember[]; canRemove: boolean; currentUserId: string }
 *
 * Renders a table with columns: Name, Email, Role, Joined, Actions
 *
 * Actions column:
 *   - Owner row: no remove button (cannot remove owner)
 *   - Caller's own row: no remove button (use account settings to leave)
 *   - Other rows: [Remove] button — renders but calls alert("Coming in next update")
 *     in Sprint 111. Sprint 112 activates the real API call.
 *   - canRemove=false (viewer/analyst): hide actions column entirely
 *
 * RoleBadge renders as a pill:
 *   owner   = indigo background
 *   admin   = blue background
 *   analyst = green background
 *   viewer  = gray background
 *
 * data-testid attributes:
 *   "member-row-{userId}" on each <tr>
 *   "role-badge-{userId}"
 *   "remove-member-{userId}"
 */
```

---

### Component 8: Sidebar Navigation Update

Find the existing sidebar navigation component (likely `app/dashboard/_components/Sidebar.tsx` or similar — verify the actual filename from CLAUDE.md). Add:

```typescript
// Add to nav items array, in position between Settings and Billing
{
  href: '/dashboard/team',
  label: 'Team',
  icon: UsersIcon,
  planBadge: 'Agency', // shows pill for non-Agency plans
},
```

Use the **exact same pattern** as other nav items. Do not invent a new pattern.

---

### Component 9: Seed Data — `supabase/seed.sql`

```sql
-- Sprint 111: org_members seed for golden tenant
DO $$
DECLARE
  v_org_id  uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_user_id uuid;  -- read from auth.users for the golden tenant user
BEGIN
  -- Read the golden tenant user_id from golden-tenant.ts fixture
  -- and hardcode it here. It must match the seed user created in the
  -- original seed.sql. Check the existing seed.sql for the user UUID.
  -- Example (replace with actual value):
  -- v_user_id := 'b1234567-...';

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'aruna@charcoalnchill.com'  -- verify actual seed email
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.org_members (org_id, user_id, role, joined_at, invited_by)
    VALUES (v_org_id, v_user_id, 'owner', NOW() - INTERVAL '60 days', NULL)
    ON CONFLICT (org_id, user_id) DO NOTHING;

    -- Update seat_count
    UPDATE public.organizations SET seat_count = 1 WHERE id = v_org_id;
  END IF;
END $$;
```

---

### Component 10: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

Add:

```typescript
// Sprint 111 — membership fixtures
import type { OrgMember, MemberRole, MembershipContext } from '@/lib/membership/types';

export const GOLDEN_MEMBER_ID = 'mem-owner-golden-001';
export const GOLDEN_MEMBER_ROLE: MemberRole = 'owner';

export const MOCK_ORG_MEMBER_OWNER: OrgMember = {
  id: GOLDEN_MEMBER_ID,
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  user_id: 'golden-user-id', // replace with actual golden user UUID from existing fixtures
  role: 'owner',
  joined_at: '2026-01-01T00:00:00.000Z',
  email: 'aruna@charcoalnchill.com',
  full_name: 'Aruna Babu',
};

export const MOCK_ORG_MEMBER_ADMIN: OrgMember = {
  id: 'mem-admin-golden-002',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  user_id: 'mock-admin-user-id',
  role: 'admin',
  joined_at: '2026-02-01T00:00:00.000Z',
  email: 'admin@charcoalnchill.com',
  full_name: 'Test Admin',
};

export const MOCK_ORG_MEMBER_ANALYST: OrgMember = {
  id: 'mem-analyst-golden-003',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  user_id: 'mock-analyst-user-id',
  role: 'analyst',
  joined_at: '2026-02-15T00:00:00.000Z',
  email: 'analyst@charcoalnchill.com',
  full_name: 'Test Analyst',
};

export const MOCK_MEMBERSHIP_CONTEXT_OWNER: MembershipContext = {
  member_id: GOLDEN_MEMBER_ID,
  user_id: 'golden-user-id',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  role: 'owner',
  permissions: ROLE_PERMISSIONS.owner,
};

export const MOCK_MEMBERS_LIST: OrgMember[] = [
  MOCK_ORG_MEMBER_OWNER,
  MOCK_ORG_MEMBER_ADMIN,
  MOCK_ORG_MEMBER_ANALYST,
];
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/membership-service.test.ts`

**Supabase mocked. Pure function tests have zero mocks.**

```
describe('getMaxSeats — pure (from plan-enforcer)')
  1.  'trial' → 1
  2.  'starter' → 1
  3.  'growth' → 1
  4.  'agency' → 10
  5.  unknown plan → 1 (safe default)

describe('canAddMember — pure (from plan-enforcer)')
  6.  agency plan, 0 current seats → true
  7.  agency plan, 9 current seats → true
  8.  agency plan, 10 current seats → false (at limit)
  9.  growth plan, 0 current seats → false (growth = 1 seat, owner already counts)
  10. growth plan, 1 current seat → false (at limit)
  11. trial plan, 0 seats → false

describe('ROLE_PERMISSIONS — pure object checks')
  12. owner.canManageBilling === true
  13. admin.canManageBilling === false
  14. analyst.canEditContent === false
  15. viewer.canEditContent === false
  16. owner.canDeleteOrg === true
  17. admin.canDeleteOrg === false

describe('getOrgMembers — Supabase mocked')
  18. returns MOCK_MEMBERS_LIST sorted: owner first, then admin, then analyst
  19. returns empty array when no members found (no crash)

describe('getCallerMembership — Supabase mocked')
  20. returns MembershipContext with correct role for authenticated user
  21. returns null when user has no org membership

describe('getMemberById — Supabase mocked')
  22. returns OrgMember when found in caller's org
  23. returns null when member_id not in caller's org

describe('removeMember — Supabase mocked')
  24. throws 'member_not_found' when member does not exist
  25. throws 'cannot_remove_owner' when target role is 'owner'
  26. calls DELETE on org_members when all guards pass
  27. returns { success: true } on successful removal

describe('canAddMember (service) — Supabase mocked')
  28. returns { allowed: false, current: 1, max: 1 } for growth plan with 1 member
  29. returns { allowed: true, current: 3, max: 10 } for agency plan with 3 members
  30. returns { allowed: false, current: 10, max: 10 } for agency plan at limit
```

**30 tests.**

---

### Test File 2: `src/__tests__/unit/membership-routes.test.ts`

```
describe('GET /api/team/members')
  1.  returns 401 when not authenticated
  2.  returns { members, seat_count, max_seats, can_add } on success
  3.  members array sorted owner-first
  4.  can_add = false for growth plan (even with 0 non-owner members)
  5.  can_add = true for agency plan with < 10 seats

describe('DELETE /api/team/members/[memberId]')
  6.  returns 401 when not authenticated
  7.  returns 403 'insufficient_role' when caller is analyst or viewer
  8.  returns 404 'member_not_found' when memberId not in org
  9.  returns 403 'cannot_remove_owner' when target is owner
  10. returns 403 'last_owner' when caller tries to remove themselves as sole owner
  11. returns { ok: true } when all guards pass and delete succeeds
  12. does NOT call DELETE if any guard fails
```

**12 tests.**

---

### Test File 3: `src/__tests__/unit/role-badge.test.ts`

```
describe('RoleBadge component')
  1.  renders 'owner' with indigo class
  2.  renders 'admin' with blue class
  3.  renders 'analyst' with green class
  4.  renders 'viewer' with gray class
  5.  renders role text capitalized
```

**5 tests.**

---

### Test File 4: `src/__tests__/e2e/team-page.spec.ts` — Playwright

```typescript
describe('Team Members Page', () => {
  test('Agency plan: shows team page with member table', async ({ page }) => {
    // Mock GET /api/team/members → MOCK_MEMBERS_LIST, agency plan
    // Navigate to /dashboard/team
    // Assert: "Team Members" heading visible
    // Assert: data-testid="team-members-table" visible
    // Assert: 3 rows visible (owner, admin, analyst)
    // Assert: role badge for owner shows "Owner"
  });

  test('Agency plan: seat progress bar visible', async ({ page }) => {
    // Assert: data-testid="seat-progress-bar" visible
    // Assert: "3 / 10" text visible
  });

  test('Agency plan: Invite Member button is disabled (Sprint 111)', async ({ page }) => {
    // Assert: data-testid="invite-member-btn" visible
    // Assert: button has aria-disabled="true"
  });

  test('Agency plan: cannot remove owner row', async ({ page }) => {
    // Assert: data-testid="remove-member-{ownerId}" does NOT exist
  });

  test('Growth plan: shows upgrade prompt', async ({ page }) => {
    // Mock plan = 'growth'
    // Navigate to /dashboard/team
    // Assert: data-testid="upgrade-prompt" visible
    // Assert: "Agency plan" text in upgrade prompt
    // Assert: team members table NOT visible
  });

  test('Sidebar shows Team nav item', async ({ page }) => {
    // Navigate to /dashboard
    // Assert: "Team" link visible in sidebar
    // Assert: href="/dashboard/team"
  });

  test('Empty state: sole owner sees encouraging message', async ({ page }) => {
    // Mock GET /api/team/members → [MOCK_ORG_MEMBER_OWNER] (just one member)
    // Mock plan = 'agency'
    // Navigate to /dashboard/team
    // Assert: empty state message visible ("Your team is just you right now")
  });
});
```

**7 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/membership-service.test.ts   # 30 tests
npx vitest run src/__tests__/unit/membership-routes.test.ts    # 12 tests
npx vitest run src/__tests__/unit/role-badge.test.ts           # 5 tests
npx vitest run                                                   # ALL — zero regressions
npx playwright test src/__tests__/e2e/team-page.spec.ts        # 7 Playwright tests
npx tsc --noEmit                                                 # 0 type errors
```

**Total: 47 Vitest + 7 Playwright = 54 tests**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/membership/types.ts` | **CREATE** | MemberRole, OrgMember, MembershipContext, ROLE_PERMISSIONS, SEAT_LIMITS |
| 2 | `lib/membership/membership-service.ts` | **CREATE** | Pure membership service functions |
| 3 | `lib/membership/index.ts` | **CREATE** | Barrel export |
| 4 | `lib/plan-enforcer.ts` | **MODIFY** | Add getMaxSeats(), canAddMember() |
| 5 | `app/api/team/members/route.ts` | **CREATE** | GET members |
| 6 | `app/api/team/members/[memberId]/route.ts` | **CREATE** | DELETE member |
| 7 | `app/dashboard/team/page.tsx` | **CREATE** | Team page (server component) |
| 8 | `app/dashboard/team/_components/TeamMembersTable.tsx` | **CREATE** | Member table |
| 9 | `app/dashboard/team/_components/RoleBadge.tsx` | **CREATE** | Role pill |
| 10 | `app/dashboard/_components/Sidebar.tsx` (or equivalent) | **MODIFY** | Add Team nav item |
| 11 | `supabase/migrations/[timestamp]_org_members.sql` | **CREATE** | Full migration |
| 12 | `supabase/prod_schema.sql` | **MODIFY** | Append org_members + function + trigger |
| 13 | `lib/supabase/database.types.ts` | **MODIFY** | Add org_members types + member_role enum |
| 14 | `supabase/seed.sql` | **MODIFY** | Golden tenant org_members seed |
| 15 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 5 membership fixtures |
| 16 | `src/__tests__/unit/membership-service.test.ts` | **CREATE** | 30 tests |
| 17 | `src/__tests__/unit/membership-routes.test.ts` | **CREATE** | 12 tests |
| 18 | `src/__tests__/unit/role-badge.test.ts` | **CREATE** | 5 tests |
| 19 | `src/__tests__/e2e/team-page.spec.ts` | **CREATE** | 7 Playwright tests |

**Total: 19 files**

---

## 🚫 What NOT to Do

1. **DO NOT build the invite flow** — that is Sprint 112. The [Invite Member →] button renders disabled in Sprint 111 with tooltip "Coming soon." Sprint 112 wires the actual flow.

2. **DO NOT build seat-based Stripe metering** — that is Sprint 113. Sprint 111 only stores seat_count and exposes getMaxSeats(). No Stripe calls this sprint.

3. **DO NOT change ANY existing RLS policy** on any other table — only `org_members` gets new policies and `current_user_org_id()` gets updated. Every other table's policies stay identical. The updated function makes them all work with the new membership model automatically.

4. **DO NOT allow removal of the last owner** — the service layer must enforce this. If the org has only one owner and someone tries to remove them, return 403 'last_owner'. This is not enforced at the DB level (too complex) — enforce it in `removeMember()` and the API route.

5. **DO NOT invent new plan_tier values** — read the exact values from `organizations.plan_tier` in prod_schema.sql and use only those. Do not add 'enterprise' or other tiers.

6. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

7. **DO NOT use dynamic Tailwind class construction** for role badge colors (AI_RULES §12). Use a lookup object with full static class strings:
   ```typescript
   const ROLE_COLORS: Record<MemberRole, string> = {
     owner:   'bg-indigo-100 text-indigo-800',
     admin:   'bg-blue-100 text-blue-800',
     analyst: 'bg-green-100 text-green-800',
     viewer:  'bg-gray-100 text-gray-800',
   };
   ```

8. **DO NOT read the owner from `auth.users` directly in RLS policies** — RLS policies use `public.current_user_org_id()` exclusively. Never inline `auth.uid()` lookups against `organizations` in policies.

9. **DO NOT forget the backfill** — every existing org must have its owner in `org_members` after this migration. If the backfill fails, every existing user loses access to their data immediately. Test the backfill against the golden tenant seed data.

10. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.

11. **DO NOT edit `middleware.ts`** (AI_RULES §6).

---

## ✅ Definition of Done

- [ ] `lib/membership/types.ts` — MemberRole (4 values), ROLE_PERMISSIONS (16 permission keys × 4 roles), OrgMember, MembershipContext, SEAT_LIMITS (trial/starter/growth=1, agency=10)
- [ ] `lib/membership/membership-service.ts` — getOrgMembers() sorted owner-first, getCallerMembership(), getMemberById(), removeMember() with all 4 guards, canAddMember() returning {allowed, current, max}
- [ ] `lib/plan-enforcer.ts` — getMaxSeats() + canAddMember() added cleanly, no existing functions modified
- [ ] `GET /api/team/members` — returns {members, seat_count, max_seats, can_add}, 401 on unauth
- [ ] `DELETE /api/team/members/[memberId]` — all 5 guards implemented, correct error codes
- [ ] `/dashboard/team/page.tsx` — Agency plan shows table, non-Agency shows upgrade prompt
- [ ] `TeamMembersTable.tsx` — 4 columns, remove button disabled for owner rows, data-testid on all rows
- [ ] `RoleBadge.tsx` — 4 static color classes (no dynamic Tailwind)
- [ ] Sidebar updated with Team nav item + Agency plan badge for non-Agency users
- [ ] Migration: org_members table + RLS (4 policies) + updated current_user_org_id() + seat_count column + trigger + backfill
- [ ] prod_schema.sql updated
- [ ] database.types.ts updated — org_members row/insert/update types, member_role enum
- [ ] seed.sql: golden tenant owner enrolled in org_members
- [ ] golden-tenant.ts: 5 fixtures added
- [ ] `data-testid` on: team-page, team-members-table, invite-member-btn, seat-progress-bar, upgrade-prompt, member-row-{userId}, role-badge-{userId}
- [ ] `npx vitest run src/__tests__/unit/membership-service.test.ts` — **30 tests passing**
- [ ] `npx vitest run src/__tests__/unit/membership-routes.test.ts` — **12 tests passing**
- [ ] `npx vitest run src/__tests__/unit/role-badge.test.ts` — **5 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/team-page.spec.ts` — **7 tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 49 written
- [ ] roadmap.md Sprint 111 marked ✅

---

## ⚠️ Edge Cases

1. **User belongs to multiple orgs** — `current_user_org_id()` returns `LIMIT 1`. In Sprint 111, one user = one org is the constraint. Multi-org support (agency managing client orgs) is a future feature. If a user somehow has two `org_members` rows (shouldn't happen), they get the first one. No crash.

2. **Backfill: org has no owner_id** — If any `organizations` row has a NULL owner_id (shouldn't happen but check), the backfill INSERT will fail with a NOT NULL violation on `user_id`. Add a WHERE owner_id IS NOT NULL guard to the backfill SELECT to skip these rows silently.

3. **Owner tries to remove themselves (sole owner)** — API returns 403 'last_owner'. Display message: "You are the only owner. Transfer ownership to another member before removing yourself."

4. **Owner tries to remove themselves (multiple owners exist)** — This is allowed at the API level. The owner can remove themselves, leaving the other owner in charge. Sprint 112 will add a proper "leave organization" flow.

5. **Growth/Starter user navigates directly to `/dashboard/team`** — Server component checks plan_tier. Returns upgrade prompt UI. Does NOT redirect — they can see the page, just not the data. This matches the blur-teaser pattern from Sprint 96.

6. **Migration already partially applied** — All DDL uses `IF NOT EXISTS`. The `current_user_org_id()` replacement uses `CREATE OR REPLACE`. The backfill uses `ON CONFLICT DO NOTHING`. Safe to run twice.

7. **`current_user_org_id()` returns NULL (user not in org_members)** — This happens between migration application and backfill completion, or if a user somehow has no membership. All RLS policies that use `org_id = public.current_user_org_id()` will return NULL = NULL (no rows, not an error). The user sees empty data, not an error. Acceptable edge state.

8. **seat_count trigger fires on backfill** — The INSERT-per-org in the backfill will fire the `trg_sync_seat_count` trigger for each row. This is fine — it just updates seat_count to 1 for each org. At the end of backfill, all orgs have seat_count = 1.

---

## 📓 DEVLOG Entry Format

```markdown
## 2026-03-01 — Sprint 111: Org Membership Foundation (COMPLETED)

**Goal:** Build the database layer, RLS policies, service module, and read-only
Team Members UI that multi-user agency features depend on.

**Scope:**
- `lib/membership/types.ts` — **NEW.** MemberRole (owner|admin|analyst|viewer),
  ROLE_PERMISSIONS (4 roles × 16 permissions), OrgMember, MembershipContext,
  SEAT_LIMITS (trial/starter/growth=1, agency=10).
- `lib/membership/membership-service.ts` — **NEW.** getOrgMembers() sorted
  owner-first, getCallerMembership(), getMemberById(), removeMember() with 4 guards
  (member_not_found, cannot_remove_owner, last_owner), canAddMember() returning
  {allowed, current, max}.
- `lib/plan-enforcer.ts` — **MODIFIED.** Added getMaxSeats() + canAddMember().
- `app/api/team/members/route.ts` — **NEW.** GET: {members, seat_count, max_seats,
  can_add}. 401 on unauth.
- `app/api/team/members/[memberId]/route.ts` — **NEW.** DELETE with 5 ordered
  guards: auth, role (owner/admin only), member_not_found, cannot_remove_owner,
  last_owner.
- `app/dashboard/team/page.tsx` — **NEW.** Server component. Agency: full table.
  Non-agency: upgrade prompt with Agency plan CTA.
- `TeamMembersTable.tsx` + `RoleBadge.tsx` — **NEW.** 4 static color classes for
  roles (no dynamic Tailwind). Remove button renders disabled for owners. All
  data-testid attributes present.
- Sidebar — **MODIFIED.** Team nav item added with Agency badge for non-Agency plans.
- Migration `[timestamp]_org_members.sql` — **NEW.** org_members table, member_role
  enum, 4 RLS policies, updated current_user_org_id() to query org_members, seat_count
  column + sync trigger on organizations, backfill of all existing owners.
- prod_schema.sql, database.types.ts — **MODIFIED.**
- seed.sql: golden tenant owner enrolled in org_members.
- golden-tenant.ts: 5 fixtures (owner, admin, analyst, context, list).

**Tests added:**
- `membership-service.test.ts` — **30 tests**
- `membership-routes.test.ts` — **12 tests**
- `role-badge.test.ts` — **5 tests**
- `team-page.spec.ts` — **7 Playwright tests**
- **Total: 47 Vitest + 7 Playwright — all passing, zero regressions**

**Key decisions:**
- current_user_org_id() is the riskiest change: ALL 62+ RLS policies depend on it.
  Updated to query org_members. Function signature unchanged. Zero downstream changes.
- SEAT_LIMITS: growth=1 (solo only). Multi-seat is Agency-exclusive. Sprint 113 wires
  Stripe metering. Sprint 111 only stores the limit.
- Backfill: ON CONFLICT DO NOTHING + WHERE owner_id IS NOT NULL guards make it safe
  to run in any state.
- seat_count trigger: fires on every INSERT/DELETE to org_members, keeping
  organizations.seat_count always accurate for Sprint 113.
- Invite button: renders disabled with tooltip "Coming soon." Sprint 112 activates.
- Remove button: renders disabled (calls alert) in Sprint 111. Sprint 112 activates.
```

---

## 🔮 AI_RULES Update (Add Rule 49)

```markdown
## 49. 👥 Org Membership in `lib/membership/` (Sprint 111)

Multi-user org membership is managed through `lib/membership/`.

* **Four roles only:** `owner | admin | analyst | viewer`. No others.
* **SEAT_LIMITS:** trial=1, starter=1, growth=1, agency=10. Multi-seat = Agency only.
* **current_user_org_id()** queries `org_members`. Never modify this function signature.
  If you need to change the lookup logic, update ONLY the SQL function body.
* **One owner minimum:** Application layer enforces "cannot remove last owner."
  The DB has no constraint for this — enforcement is in removeMember() and DELETE route.
* **RLS on org_members:** 4 policies (select/insert/update/delete). Service role
  bypass is the only way to process invitations (Sprint 112).
* **canAddMember()** in plan-enforcer.ts is the single source of truth for seat limits.
  Always call it before the invite flow (Sprint 112).
* **Adding a new role:** update MemberRole union, ROLE_PERMISSIONS object, SEAT_LIMITS
  if needed, RoleBadge ROLE_COLORS, and the plan enforcer. Add migration if enum changes.
```

---

## 🔗 Sprint Dependencies

| Dependency | What Sprint 111 Uses |
|-----------|---------------------|
| `organizations` table | org_id, plan_tier, seat_count |
| `current_user_org_id()` SQL function | Read existing body before replacing |
| `lib/plan-enforcer.ts` | Extend with getMaxSeats() + canAddMember() |
| `lib/supabase/server.ts` | createServiceRoleClient() for auth.users join |
| `src/__fixtures__/golden-tenant.ts` | org_id + user_id for seed data |
| Sprint 112 | Depends on org_members + invite_by column |
| Sprint 113 | Depends on seat_count column + SEAT_LIMITS |

---

## 🗺️ What Comes Next

**Sprint 112 — Team Invitations + Permissions:** Invitation tokens, email invites via Resend, accept/decline flow, role assignment on accept, the [Invite Member →] button activated.

**Sprint 113 — Seat-Based Billing + Audit Log:** Stripe seat metering wired to seat_count, billing portal update, activity_log table, audit trail of all membership changes.
```
