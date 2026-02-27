# Sprint 98 — Multi-User Foundation: Invitations + Roles

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`

---

## 🎯 Objective

Build the **multi-user foundation** for LocalVector's Agency tier — the single biggest blocker for Agency tier sales. Right now every org has exactly one user (the owner). This sprint introduces:

1. **Role system** — `Owner`, `Admin`, `Viewer` roles with defined permissions per role
2. **Invitation flow** — Owner/Admin sends email invite → invitee receives link → clicks → joins org with assigned role
3. **`pending_invitations` table** — tracks invites (pending / accepted / revoked / expired)
4. **`org_members` table** — tracks which users belong to which orgs and at what role
5. **Invite acceptance UI** — `/invite/[token]` public page where invitees land and accept
6. **Team management UI** — `/dashboard/settings/team` page: list members, invite new, revoke invites, change roles
7. **Role enforcement** — server actions and API routes check role before allowing destructive operations

**Why this matters:** An agency owner managing 10 restaurant clients needs to add account managers who can view dashboards but not delete data, and clients who can see their own reports but not billing. Without roles, every account is single-user — you cannot sell the Agency tier.

**Gap being closed:** Feature #75 (part 1) — Multi-User Agency Workflows. This sprint delivers invitations + roles. Seat-based billing is Sprint 99 (part 2).

**Effort:** L (Large — 1–2 days). This is the most complex sprint in Tier 3. Read all pre-flight files carefully before writing any code.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                        — All rules (§50+ after Sprint 97)
Read CLAUDE.md                                               — Full architecture + implementation inventory
Read MEMORY.md                                               — Key decisions, auth patterns, constraints
Read supabase/prod_schema.sql                                — Find: orgs, auth.users, profiles/users table
                                                               Look for any existing org_members or roles tables
Read lib/database.types.ts                                   — TypeScript types (will need updating)
Read src/__fixtures__/golden-tenant.ts                       — Golden Tenant: org_id a0eebc99
Read lib/supabase/server.ts                                  — createClient() + createServiceRoleClient()
Read lib/supabase/middleware.ts                              — Auth middleware (DO NOT EDIT — AI_RULES §6)
Read app/api/auth/                                           — Existing auth routes (OAuth, callback patterns)
Read app/dashboard/settings/page.tsx                        — Settings page being extended
Read app/actions/                                            — Server action patterns + how orgId is retrieved
Read lib/plan-enforcer.ts                                    — Plan gating (multi-user = Agency tier)
Read app/onboarding/page.tsx                                 — Existing onboarding (to understand user creation flow)
Read app/(auth)/                                             — Login/signup pages (invite acceptance uses similar flow)
Read emails/                                                  — Existing React Email templates (invite email extends these)
```

**Specifically understand before writing code:**
- How the current single-user model works — is there a `user_id` column on `orgs`? A `profiles` table? How does the app know which org the current user belongs to?
- The exact shape of the session/auth context — does `getSafeAuthContext()` or similar return `orgId`? Where does `orgId` come from today?
- Whether any `org_members` or `roles` table already exists in `prod_schema.sql`. If so, read its schema fully before adding anything.
- How existing email templates are structured (React Email) — the invite email must match the visual style of alert emails.
- The Resend API usage pattern — is there a wrapper in `lib/email/` or are emails sent directly?
- What RLS policies currently exist on `orgs` — a member joining an org needs to be able to read it, which may require RLS policy updates.
- Whether `auth.users` has any metadata fields used for org association today.

---

## 🏗️ Architecture — What to Build

---

### PART 1: Database Schema

#### Migration 1: `org_members` table + `pending_invitations` table

```sql
-- ============================================================
-- Migration: XXXX_multi_user_foundation.sql
-- ============================================================

-- -------------------------------------------------------
-- 1. Role enum
-- -------------------------------------------------------
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'viewer');

-- -------------------------------------------------------
-- 2. org_members — who belongs to which org at what role
-- -------------------------------------------------------
CREATE TABLE org_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         org_role NOT NULL DEFAULT 'viewer',
  invited_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)   -- one membership per user per org
);

-- RLS
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- Members can read their own org's member list
CREATE POLICY "org_members_select" ON org_members
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members om2
      WHERE om2.user_id = auth.uid()
    )
  );

-- Only owner/admin can insert (invite acceptance handled via service role)
CREATE POLICY "org_members_insert" ON org_members
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members om2
      WHERE om2.user_id = auth.uid()
      AND om2.role IN ('owner', 'admin')
    )
  );

-- Only owner can delete members (remove from org)
CREATE POLICY "org_members_delete" ON org_members
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM org_members om2
      WHERE om2.user_id = auth.uid()
      AND om2.role = 'owner'
    )
  );

-- Owner can update roles; admin can update viewer roles only
CREATE POLICY "org_members_update" ON org_members
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM org_members om2
      WHERE om2.user_id = auth.uid()
      AND om2.role IN ('owner', 'admin')
    )
  );

-- -------------------------------------------------------
-- 3. pending_invitations
-- -------------------------------------------------------
CREATE TABLE pending_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         org_role NOT NULL DEFAULT 'viewer',
  token        text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)   -- one pending invite per email per org at a time
);

-- RLS
ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- Members can read their org's invitations
CREATE POLICY "invitations_select" ON pending_invitations
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
    )
  );

-- Owner/admin can create invitations
CREATE POLICY "invitations_insert" ON pending_invitations
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Owner/admin can update (revoke) invitations
CREATE POLICY "invitations_update" ON pending_invitations
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- -------------------------------------------------------
-- 4. Backfill: existing org owners → org_members
-- -------------------------------------------------------
-- Read prod_schema.sql to determine how current owner user_id is stored on orgs.
-- If orgs has a user_id or owner_id column:
INSERT INTO org_members (org_id, user_id, role)
SELECT id, [owner_column], 'owner'
FROM orgs
WHERE [owner_column] IS NOT NULL
ON CONFLICT (org_id, user_id) DO NOTHING;

-- ⚠️ Replace [owner_column] with the actual column name after reading prod_schema.sql.
-- If the relationship is stored differently (e.g. in auth.users metadata), adjust accordingly.
-- Document your finding in a comment before this INSERT.

-- -------------------------------------------------------
-- 5. Indexes
-- -------------------------------------------------------
CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_pending_invitations_token ON pending_invitations(token);
CREATE INDEX idx_pending_invitations_org_id ON pending_invitations(org_id);
CREATE INDEX idx_pending_invitations_email ON pending_invitations(email);
```

⚠️ **Before writing the backfill INSERT:** Read `prod_schema.sql` carefully to find the exact column that associates an org with its owner user. Do not guess. If you cannot determine it from the schema, add a comment and skip the backfill — it can be run manually after verification.

---

### PART 2: Role Enforcement Library

#### `lib/auth/org-roles.ts`

**The single source of truth for role logic.** All role checks in server actions, API routes, and Server Components import from here.

```typescript
/**
 * Org role system — LocalVector V1
 *
 * Roles (lowest → highest privilege):
 *   viewer  — read-only. Can see dashboards, reports, download CSV/PDF.
 *             Cannot create, edit, delete, or invite.
 *   admin   — all viewer permissions + can invite new members (viewer/admin role),
 *             edit business info, trigger audits, publish content drafts.
 *             Cannot delete the org, remove the owner, or change billing.
 *   owner   — full control. Can do everything including billing, org deletion,
 *             removing any member, and promoting/demoting admins.
 *
 * One owner per org minimum. Owner cannot be removed if they are the last member.
 */

export type OrgRole = 'owner' | 'admin' | 'viewer'

export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  viewer: 0,
  admin: 1,
  owner: 2,
}

/** True if currentRole meets or exceeds requiredRole */
export function roleSatisfies(currentRole: OrgRole, requiredRole: OrgRole): boolean

/** Gets the current user's role in a given org. Returns null if not a member. */
export async function getOrgRole(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<OrgRole | null>

/**
 * Asserts the current session user has at least requiredRole in the org.
 * Throws a typed error if not. Use in server actions + API routes.
 *
 * @throws { code: 'INSUFFICIENT_ROLE', required: OrgRole, actual: OrgRole | null }
 */
export async function assertOrgRole(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  requiredRole: OrgRole
): Promise<void>

/** Permission matrix — what each action requires */
export const ROLE_PERMISSIONS = {
  viewDashboard:        'viewer',
  editBusinessInfo:     'admin',
  triggerAudit:         'admin',
  publishContent:       'admin',
  inviteMembers:        'admin',
  revokeInvite:         'admin',
  removeMember:         'owner',
  changeRole:           'owner',
  manageBilling:        'owner',
  deleteOrg:            'owner',
} as const satisfies Record<string, OrgRole>
```

---

### PART 3: Invitation Server Actions

#### `app/actions/invitations.ts`

```typescript
'use server'

/**
 * sendInvitation
 * Owner or Admin sends an email invitation to a new team member.
 *
 * Checks:
 * 1. orgId from session (NEVER from args — AI_RULES §18)
 * 2. Calling user has role >= 'admin' in org
 * 3. Invitee email is not already an org member
 * 4. No existing pending invite for this email in this org (upsert or error)
 * 5. Admin cannot invite 'owner' role — only owner can assign owner
 * 6. Plan check: Agency plan required for > 1 member (planSatisfies)
 *
 * On success:
 * - Inserts pending_invitations row
 * - Sends invite email via Resend (React Email template)
 * - Returns { success: true, invitationId: string }
 */
export async function sendInvitation(input: {
  email: string
  role: 'admin' | 'viewer'   // owner role not assignable via invite
}): Promise<{ success: boolean; error?: string; invitationId?: string }>

/**
 * revokeInvitation
 * Owner or Admin revokes a pending invitation.
 * Sets status = 'revoked'. Does not delete the row (audit trail).
 */
export async function revokeInvitation(input: {
  invitationId: string
}): Promise<{ success: boolean; error?: string }>

/**
 * removeMember
 * Owner removes a member from the org.
 * Cannot remove self if last owner.
 * Cannot remove another owner (only owner can, and only if another owner exists).
 */
export async function removeMember(input: {
  memberId: string   // org_members.id (not user_id — avoids ambiguity)
}): Promise<{ success: boolean; error?: string }>

/**
 * updateMemberRole
 * Owner changes a member's role.
 * Cannot demote self if last owner.
 * Cannot promote to 'owner' via this action — use transferOwnership instead.
 */
export async function updateMemberRole(input: {
  memberId: string
  newRole: 'admin' | 'viewer'
}): Promise<{ success: boolean; error?: string }>
```

---

### PART 4: Invite Acceptance Flow

#### `app/api/invitations/accept/route.ts`

**Public API route** — no auth required to reach it (invitee may not be logged in yet).

```typescript
/**
 * GET /api/invitations/accept?token=[token]
 *
 * Token validation + redirect logic:
 *
 * 1. Look up pending_invitations by token using service role client
 * 2. Validate:
 *    - Token exists
 *    - Status = 'pending'
 *    - expires_at > now()
 * 3. If invitee is already logged in (session exists):
 *    - Check if their email matches the invitation email
 *    - If yes: accept immediately → redirect to /dashboard
 *    - If no (different account): redirect to /invite/[token]?error=wrong_account
 * 4. If invitee is NOT logged in:
 *    - Redirect to /invite/[token] (the acceptance UI page)
 *
 * Never expose the token in error messages or logs.
 */
export async function GET(request: Request) { ... }
```

#### `app/(public)/invite/[token]/page.tsx`

**Public-facing invitation acceptance page.** No dashboard layout — uses a minimal centered card layout similar to the auth pages.

```typescript
/**
 * /invite/[token]
 *
 * States:
 * - LOADING: validating token
 * - INVALID: token not found, expired, or already used → show clear error + link to homepage
 * - PENDING_LOGIN: token valid, user not logged in → show org name, inviter name,
 *   role being offered, and two CTAs: "Sign in to accept" + "Create account to accept"
 * - PENDING_ACCEPT: token valid, user logged in, email matches → show confirmation card
 *   with org name + role + "Accept Invitation" button
 * - WRONG_ACCOUNT: logged in but email doesn't match invite → show message + sign out option
 * - SUCCESS: invitation accepted → auto-redirect to /dashboard after 2 seconds
 *
 * data-testid values:
 * - invite-page-loading
 * - invite-page-invalid
 * - invite-page-pending-login
 * - invite-page-pending-accept
 * - invite-page-wrong-account
 * - invite-page-success
 * - invite-accept-btn
 * - invite-org-name
 * - invite-role-badge
 * - invite-inviter-name
 */
```

#### `app/actions/accept-invitation.ts`

```typescript
'use server'

/**
 * Accepts a pending invitation.
 * Called from the /invite/[token] page after user confirms.
 *
 * Steps:
 * 1. Load invitation by token using service role client
 * 2. Validate: pending + not expired
 * 3. Get current session user — auth.uid() must match invite email
 * 4. Insert into org_members (org_id, user_id, role, invited_by)
 * 5. Update pending_invitations: status='accepted', accepted_at=now()
 * 6. If user has no current org context (first org join): update their
 *    active org context so they land on the right org dashboard
 * 7. Revalidate /dashboard path
 * 8. Return { success: true, orgId, orgName }
 *
 * Uses service role client for steps 1, 4, 5 (bypasses RLS for atomic accept).
 * Never expose the raw token in return values or error messages.
 */
export async function acceptInvitation(input: {
  token: string
}): Promise<{ success: boolean; error?: string; orgId?: string; orgName?: string }>
```

---

### PART 5: Invite Email Template

#### `emails/InvitationEmail.tsx`

React Email template. Match the visual style of existing email templates in `emails/`.

```typescript
/**
 * Invitation email sent via Resend.
 *
 * Props:
 * - inviterName: string (first name of person who sent the invite)
 * - orgName: string
 * - role: 'admin' | 'viewer'
 * - inviteUrl: string (full URL: https://[domain]/invite/[token])
 * - expiresAt: string (human-readable: "in 7 days")
 *
 * Content:
 * - Subject: "[inviterName] invited you to join [orgName] on LocalVector"
 * - Header: LocalVector logo (same as other emails)
 * - Body: "You've been invited to join [orgName] as a [Role]."
 * - Role description: one line explaining what the role can do
 * - CTA button: "Accept Invitation" → inviteUrl
 * - Expiry note: "This invitation expires [expiresAt]."
 * - Footer: "If you weren't expecting this, you can safely ignore it."
 *
 * data-testid: not applicable for emails — use subject line matching in tests
 */
```

---

### PART 6: Team Management UI

#### `app/dashboard/settings/team/page.tsx`

New settings sub-page. Accessible at `/dashboard/settings/team`.

```typescript
/**
 * Team Management Page
 *
 * Sections:
 * 1. Current Members table
 *    Columns: Avatar/Name, Email, Role (badge), Joined, Actions
 *    Actions (role-dependent):
 *      - Owner: change role dropdown, remove button
 *      - Admin: change role (viewer only), remove viewer
 *      - Viewer: no actions
 *    data-testid="team-members-table"
 *    data-testid="member-row-[userId]"
 *    data-testid="member-role-[userId]"
 *    data-testid="member-remove-btn-[userId]"
 *    data-testid="member-role-select-[userId]"
 *
 * 2. Pending Invitations table (only visible to owner/admin)
 *    Columns: Email, Role, Sent by, Expires, Status, Actions
 *    Actions: Revoke button
 *    data-testid="pending-invitations-table"
 *    data-testid="invitation-row-[invitationId]"
 *    data-testid="invitation-revoke-btn-[invitationId]"
 *
 * 3. Invite New Member card (only visible to owner/admin)
 *    Fields: Email input, Role select (Admin / Viewer)
 *    Submit: "Send Invitation" button
 *    data-testid="invite-email-input"
 *    data-testid="invite-role-select"
 *    data-testid="invite-send-btn"
 *    data-testid="invite-success-message"
 *    data-testid="invite-error-message"
 *
 * Plan gate: Agency plan required to have > 1 member.
 *   If org is on Growth or Starter, show <PlanGate requiredPlan="agency"> around
 *   the "Invite New Member" card. Members table still visible (shows current owner).
 *
 * Settings nav: Add "Team" tab to the settings page navigation.
 * data-testid="settings-team-tab"
 */
```

---

### PART 7: Sidebar + Nav Updates

Update `components/layout/Sidebar.tsx` or equivalent to:
- Add Settings → Team sub-link (visible to all members, since viewers can see the team list)
- If multi-org support exists (LocationSwitcher), ensure the org context is preserved when navigating to team settings

Do **not** change the middleware (AI_RULES §6). Do not change the sidebar's authentication logic — only add the nav item.

---

## 🧪 Tests — Write These FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/org-roles.test.ts`

**~20 Vitest tests.**

```typescript
describe('roleSatisfies', () => {
  it('viewer satisfies viewer')
  it('admin satisfies viewer')
  it('owner satisfies viewer')
  it('admin satisfies admin')
  it('owner satisfies admin')
  it('owner satisfies owner')
  it('viewer does NOT satisfy admin')
  it('viewer does NOT satisfy owner')
  it('admin does NOT satisfy owner')
  it('unknown role treated as viewer (graceful)')
})

describe('ROLE_PERMISSIONS', () => {
  it('viewDashboard requires viewer (lowest)')
  it('inviteMembers requires admin')
  it('removeMember requires owner')
  it('manageBilling requires owner')
  it('deleteOrg requires owner')
  it('editBusinessInfo requires admin')
  it('publishContent requires admin')
  it('changeRole requires owner')
})

describe('assertOrgRole', () => {
  it('resolves when user meets required role')
  it('throws INSUFFICIENT_ROLE when user is viewer and admin required')
  it('throws INSUFFICIENT_ROLE when user is not a member (null role)')
  it('includes actual and required role in thrown error')
})
```

### Test File 2: `src/__tests__/unit/invitations.test.ts`

**~22 Vitest tests.** Mock Supabase + Resend via MSW.

```typescript
describe('sendInvitation', () => {
  it('inserts pending_invitations row on success')
  it('sends email via Resend on success')
  it('returns error when caller is viewer (not admin/owner)')
  it('returns error when invitee is already a member')
  it('returns error when pending invite already exists for this email')
  it('returns error when trying to invite as owner role')
  it('returns error when org is not on Agency plan (plan gate)')
  it('orgId comes from session — not from input args')
  it('generates a unique token (not predictable)')
  it('sets expires_at to 7 days from now')
})

describe('revokeInvitation', () => {
  it('sets status=revoked on valid pending invite')
  it('returns error when invite not found')
  it('returns error when invite already accepted')
  it('returns error when caller lacks admin role')
  it('orgId verified against session — cannot revoke another org\'s invite')
})

describe('removeMember', () => {
  it('deletes org_members row on success')
  it('returns error when caller is not owner')
  it('returns error when removing self as last owner')
  it('returns error when trying to remove another owner')
})

describe('updateMemberRole', () => {
  it('updates role on success')
  it('returns error when caller is not owner')
  it('returns error when trying to promote to owner (blocked)')
  it('returns error when demoting self as last owner')
})
```

### Test File 3: `src/__tests__/unit/accept-invitation.test.ts`

**~12 Vitest tests.**

```typescript
describe('acceptInvitation', () => {
  it('inserts org_members row on valid token + matching email')
  it('sets invitation status=accepted + accepted_at timestamp')
  it('returns error when token not found')
  it('returns error when invitation already accepted')
  it('returns error when invitation revoked')
  it('returns error when invitation expired (expires_at < now)')
  it('returns error when session user email does not match invite email')
  it('returns orgId and orgName on success')
  it('does not expose token in error messages')
  it('uses service role client for DB write (bypasses RLS)')
  it('does not double-accept: second call with same token returns error')
  it('sets invited_by in org_members from invitation.invited_by')
})
```

### Test File 4: `src/__tests__/e2e/multi-user-invitations.spec.ts`

**~14 Playwright tests.**

```typescript
describe('Multi-User Invitations E2E', () => {
  // Team settings page
  it('owner sees team management page at /dashboard/settings/team')
  it('viewer sees member list but not invite form')
  it('non-member redirected away from settings/team')

  // Send invitation flow
  it('owner can send invitation to new email', async ({ page }) => {
    // Login as golden tenant owner
    // Navigate to /dashboard/settings/team
    // Fill invite-email-input + invite-role-select
    // Click invite-send-btn
    // Assert: invite-success-message visible
    // Assert: new row appears in pending-invitations-table
  })
  it('duplicate invite to same email shows error')
  it('viewer role invite shows "Viewer" in pending table')

  // Revoke invitation
  it('owner can revoke pending invitation', async ({ page }) => {
    // Click invitation-revoke-btn-[id]
    // Assert: row disappears from pending table (or status changes)
  })

  // Invite acceptance — valid flow
  it('valid invite token shows acceptance page with org name and role')
  it('accept button creates org_members row and redirects to dashboard')
  it('accepted invitation cannot be accepted again (expired state)')

  // Invite acceptance — invalid flows
  it('expired token shows invalid page')
  it('revoked token shows invalid page')
  it('nonexistent token shows invalid page')

  // Role enforcement
  it('admin cannot access billing settings (owner only)')
  it('viewer cannot see invite form on team page')

  // Plan gate
  it('Growth plan org shows PlanGate on invite form (agency required)')
})
```

---

## 🔍 Pre-Implementation Diagnosis

Run before writing any code:

```bash
# 1. Find existing org → user relationship
grep -E "user_id|owner_id|created_by" supabase/prod_schema.sql | grep -i "orgs\|org"

# 2. Check for any existing org_members or roles tables
grep -E "org_members|org_roles|user_roles|memberships" supabase/prod_schema.sql

# 3. Check for any multi-user code already written
grep -r "org_members\|pending_invitations\|OrgRole\|org_role" lib/ app/ --include="*.ts" --include="*.tsx" -l

# 4. Check existing email patterns
ls emails/
cat emails/*.tsx | head -60  # Check structure of one existing email template

# 5. Check Resend usage pattern
grep -r "resend\|Resend\|sendEmail\|from.*@" lib/ app/ --include="*.ts" -l

# 6. Check how orgId flows through server actions today
grep -r "orgId\|org_id" app/actions/ --include="*.ts" | grep -v "// " | head -20

# 7. Check LocationSwitcher for multi-org context hints
cat components/layout/LocationSwitcher.tsx 2>/dev/null || echo "not found"

# 8. Check plan values on orgs table for 'agency'
grep -E "plan.*check|plan.*enum|plan.*default" supabase/prod_schema.sql
```

Document all findings as a comment block at the top of `lib/auth/org-roles.ts` before writing implementation.

---

## 🧠 Edge Cases to Handle

1. **Last owner protection:** An org must always have at least one owner. Block: demoting the last owner, removing the last owner, owner leaving if they're the only owner. Every mutation that could remove the last owner must query `org_members` for `role='owner' AND org_id=?` and fail if count would drop to 0.

2. **Invite email case sensitivity:** `john@Example.com` and `john@example.com` are the same. Normalize all emails to lowercase before inserting invitations and before checking for duplicates.

3. **Invitee signs up with Google OAuth:** The invite flow assumes email/password. If the invitee uses Google OAuth, their `auth.users.email` may differ from the invite email (e.g. alias). The acceptance action checks `session.user.email` against `invitation.email` — this check must be case-insensitive. If emails don't match, show the "wrong account" error with instructions to sign in with the invited email.

4. **Token collision:** `gen_random_bytes(32)` produces 256 bits of entropy — collision is cryptographically impossible in practice. But the `UNIQUE` constraint on `token` provides a safety net. If an INSERT fails on token uniqueness (astronomically unlikely), retry once with a new token.

5. **Invitation to existing member:** If the invitee is already in `org_members`, `sendInvitation` must return a clear error: `'already_member'`. Do not silently succeed or overwrite the existing membership.

6. **Org switches for multi-member users:** In V1, a user belongs to one org. When they accept an invitation to a second org, they need a way to switch between orgs. This is Sprint 100 (Multi-Location Management). For Sprint 98: if a user accepts an invite to a second org, just add them to `org_members` — the org-switching UI is deferred. Document this in MEMORY.md.

7. **Admin inviting another admin:** Allowed. Admin can invite viewers and other admins. Admin cannot invite or create owners — only the owner role can assign owner.

8. **Revoked invite token visit:** If someone visits `/invite/[token]` for a revoked invite, show the invalid state with message: "This invitation has been revoked. Contact the team owner for a new invite."

9. **`sendInvitation` re-invite after revoke:** If a previous invite was revoked, a new invite to the same email should be allowed. The `UNIQUE (org_id, email)` constraint on `pending_invitations` blocks this. Use an upsert or delete the old revoked row before inserting the new one. Use upsert with `ON CONFLICT (org_id, email) DO UPDATE SET status='pending', token=..., expires_at=..., invited_by=...` — but only if the existing row is `revoked` or `expired`. If it's `pending`, return error `'already_invited'`.

10. **Email delivery failure:** If Resend throws, do not leave the `pending_invitations` row in the DB (user thinks invite was sent but it wasn't). Use a try/catch: if Resend fails, delete the row and return `{ error: 'email_delivery_failed' }`. Or better: insert first, attempt send, if send fails set status='failed' and return the error. Do not silently swallow Resend errors.

11. **Viewer accessing restricted pages:** Role enforcement on server actions covers mutations. But a viewer visiting `/dashboard/settings/billing` should be redirected or shown an access denied state. Add a simple role check in each sensitive Server Component page (`assertOrgRole` or equivalent). Billing page = owner only. Settings/team = all members (read), admin+ for invite actions. Business info edit = admin+.

12. **Plan gate for Agency:** The Agency plan check gates the *invite form*. But technically the owner is always on the org, so any org has at least 1 member. The plan gate blocks adding a *second* member. Check: `org_members count > 1 requires agency plan`. The check in `sendInvitation` should be: `if (currentMemberCount >= 1 && !planSatisfies(org.plan, 'agency')) return error`.

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| Auth flow (email/password + Google OAuth) | Sprint 0, 60B | User creation, session management — invitation acceptance builds on this |
| `lib/plan-enforcer.ts` + `planSatisfies()` | Sprint 3, 96 | Agency plan check in `sendInvitation` |
| `<PlanGate>` component | Sprint 96 | Plan gate on invite form in team settings |
| Alert emails (Resend + React Email) | Sprint 1 | Invite email extends existing template infrastructure |
| Settings page | Sprint 24B, 62E | Team tab being added |
| Business Info Editor | Sprint 93 | Settings page modified — coordinate to avoid conflicts |
| `createServiceRoleClient()` | Sprint 18 | Used in acceptance action and public invite API route |
| Golden Tenant | All sprints | `org_id: a0eebc99` — will need a second test user for multi-user E2E |

---

## 📓 DEVLOG Entry Format

```markdown
## Sprint 98 — Multi-User Foundation: Invitations + Roles (Gap #75 part 1)
**Date:** [DATE]
**Duration:** ~8 hours (Large sprint — L effort)

### Problem
Every LocalVector org is single-user. No way to add team members, assign roles,
or sell Agency tier access. The biggest blocker for Agency tier revenue.

### Solution
Built complete multi-user foundation:
- org_members table with Owner/Admin/Viewer roles + RLS
- pending_invitations table with 7-day expiry, token-based acceptance
- sendInvitation / revokeInvitation / removeMember / updateMemberRole server actions
- /invite/[token] public acceptance page (5 states)
- InvitationEmail React Email template via Resend
- /dashboard/settings/team management UI
- assertOrgRole() + roleSatisfies() role enforcement library
- Plan gate: Agency plan required to add members beyond owner

### Files Changed
- `supabase/migrations/[timestamp]_multi_user_foundation.sql` — NEW
- `lib/auth/org-roles.ts` — NEW: role hierarchy + assertOrgRole + permissions matrix
- `app/actions/invitations.ts` — NEW: send, revoke, remove, update role actions
- `app/actions/accept-invitation.ts` — NEW: token-based acceptance
- `app/api/invitations/accept/route.ts` — NEW: public token redirect handler
- `app/(public)/invite/[token]/page.tsx` — NEW: acceptance UI (5 states)
- `emails/InvitationEmail.tsx` — NEW: React Email invite template
- `app/dashboard/settings/team/page.tsx` — NEW: team management page
- `components/layout/Sidebar.tsx` — MODIFIED: Team nav item added
- `src/__tests__/unit/org-roles.test.ts` — NEW: [N] tests
- `src/__tests__/unit/invitations.test.ts` — NEW: [N] tests
- `src/__tests__/unit/accept-invitation.test.ts` — NEW: [N] tests
- `src/__tests__/e2e/multi-user-invitations.spec.ts` — NEW: [N] tests

### Grep counts (run before committing):
grep -cE "^\s*(it|test)\(" src/__tests__/unit/org-roles.test.ts              # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/invitations.test.ts            # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/unit/accept-invitation.test.ts      # [N]
grep -cE "^\s*(it|test)\(" src/__tests__/e2e/multi-user-invitations.spec.ts  # [N]

### Gaps Closed
- Gap #75 (part 1): Multi-User Foundation — 0% → 60%
  - Invitations, roles, acceptance, team UI: complete
  - Seat-based billing + granular per-location permissions: Sprint 99

### Next Sprint
Sprint 99 — Seat-Based Billing + Agency Permissions (Gap #75 part 2)
```

---

## 🔮 AI_RULES Update — Add Rule §51 to `AI_RULES.md`

```markdown
## §51. 👥 Multi-User Role System — Architecture Rules (Sprint 98)

### Role enforcement
- `roleSatisfies()` and `assertOrgRole()` in `lib/auth/org-roles.ts` are the ONLY
  place role logic lives. Never compare role strings inline (e.g. `role === 'owner'`).
- All server actions that mutate org data call `assertOrgRole()` before any DB write.
- `ROLE_PERMISSIONS` in `lib/auth/org-roles.ts` is the canonical permission matrix.
  Add new permissions there — do not scatter role requirements across action files.

### Invitation system
- Invite tokens are generated with `gen_random_bytes(32)` — never predictable IDs.
- Tokens are never exposed in error messages, logs, or return values beyond the initial send.
- Acceptance uses service role client — the invitee is not yet an org member when accepting,
  so RLS would block the insert. This is intentional and documented.
- Email normalization: always lowercase before insert and comparison.
- Last-owner protection: every role mutation checks owner count. Block if count would reach 0.

### OrgId source
- orgId always comes from the authenticated session — never from action input args,
  never from URL params, never from form data. (AI_RULES §18 — reiterated for multi-user context.)
- In multi-user context, a user may belong to multiple orgs (Sprint 100+). The active
  org context is resolved from session/cookie — not from the URL.

### Plan gate
- Adding members beyond the owner requires Agency plan.
- Check: `currentMemberCount >= 1 && !planSatisfies(org.plan, 'agency')` → block invite.
- The team page itself (read-only view) is accessible to all plans.
  Only the invite form is plan-gated.
```

---

## ✅ Acceptance Criteria

- [ ] `org_members` and `pending_invitations` tables exist with correct schema + RLS
- [ ] Existing org owners backfilled into `org_members` as 'owner'
- [ ] `assertOrgRole()` throws correctly for insufficient roles
- [ ] `sendInvitation` inserts invitation row + sends Resend email
- [ ] `/invite/[token]` page renders all 5 states correctly
- [ ] `acceptInvitation` creates `org_members` row + marks invitation accepted
- [ ] Cannot accept expired, revoked, or already-accepted invitation
- [ ] Cannot remove last owner from org
- [ ] Cannot promote to owner via `updateMemberRole` (owner-only operation)
- [ ] `/dashboard/settings/team` shows member list + pending invitations + invite form
- [ ] Viewer sees member list but not invite form (role-gated)
- [ ] Agency plan gate on invite form (Growth/Starter sees `<PlanGate>`)
- [ ] All unit tests pass: `npx vitest run`
- [ ] All E2E tests pass: `npx playwright test src/__tests__/e2e/multi-user-invitations.spec.ts`
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] No inline role string comparisons outside `lib/auth/org-roles.ts`

---

## 🧾 Test Run Commands

```bash
npx vitest run src/__tests__/unit/org-roles.test.ts              # ~20 tests
npx vitest run src/__tests__/unit/invitations.test.ts            # ~22 tests
npx vitest run src/__tests__/unit/accept-invitation.test.ts      # ~12 tests
npx vitest run                                                     # Full suite — 0 regressions
npx playwright test src/__tests__/e2e/multi-user-invitations.spec.ts  # ~14 tests
npx tsc --noEmit                                                   # 0 new type errors
```

---

## 📚 Document Sync + Git Commit (After All Tests Pass)

### Step 1: Update `/docs` files

**`docs/roadmap.md`** — Update Feature #75 (Multi-User Agency Workflows) from `❌ 0%` to `🟡 60%`. Note Sprint 98 delivers invitations + roles; billing is Sprint 99.

**`docs/MULTI-USER_AGENCY_WHITE_LABEL.md`** — This doc is the spec for multi-user architecture. Update it to reflect what was built vs. what is deferred to Sprint 99+.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 98 to completed sprints list.

### Step 2: Update `DEVLOG.md`

Paste DEVLOG entry above. Replace all `[N]` with actual `grep -cE` counts.

### Step 3: Update `CLAUDE.md`

```markdown
### Sprint 98 — Multi-User Foundation: Invitations + Roles (2026-03-XX)
- `lib/auth/org-roles.ts` — Role hierarchy, assertOrgRole(), ROLE_PERMISSIONS
- `app/actions/invitations.ts` — send, revoke, remove, update role
- `app/actions/accept-invitation.ts` — token-based acceptance (service role)
- `app/api/invitations/accept/route.ts` — public token redirect handler
- `app/(public)/invite/[token]/page.tsx` — acceptance UI (5 states)
- `emails/InvitationEmail.tsx` — React Email invite template
- `app/dashboard/settings/team/page.tsx` — team management UI
- Migration: org_members + pending_invitations tables + RLS
- Tests: [N] Vitest + [N] Playwright
- Gap #75 part 1: Multi-User Foundation 0% → 60%
```

### Step 4: Update `MEMORY.md`

```markdown
## Decision: Multi-User Architecture (Sprint 98 — 2026-03-XX)
- org_members table: source of truth for org membership + roles
- pending_invitations: token-based, 7-day expiry, upsert on re-invite after revoke
- Role hierarchy: viewer < admin < owner. One owner minimum always enforced.
- Admin cannot invite owners — only owner can assign owner role
- Acceptance uses service role client (invitee not yet member when accepting)
- Org-switching for users in multiple orgs: deferred to Sprint 100
- V1: user belongs to one active org context at a time
- Plan gate: Agency required to add members beyond the owner
- Email normalization: always lowercase before DB operations
```

### Step 5: Update `AI_RULES.md`

Append Rule §51 from the **🔮 AI_RULES Update** section above.

### Step 6: Final sync checklist

- [ ] `DEVLOG.md` has Sprint 98 entry with actual test counts
- [ ] `CLAUDE.md` has Sprint 98 in implementation inventory
- [ ] `MEMORY.md` has multi-user architecture decision
- [ ] `AI_RULES.md` has Rule §51
- [ ] `docs/roadmap.md` shows Feature #75 as 🟡 60%
- [ ] `docs/MULTI-USER_AGENCY_WHITE_LABEL.md` updated
- [ ] `docs/09-BUILD-PLAN.md` has Sprint 98 checked

### Step 7: Git commit

```bash
git add -A
git status

git commit -m "Sprint 98: Multi-User Foundation — Invitations + Roles (Gap #75 pt1: 0% → 60%)

- migration: org_members + pending_invitations tables with RLS policies
- backfill: existing org owners inserted into org_members as owner role
- lib/auth/org-roles.ts: roleSatisfies, assertOrgRole, ROLE_PERMISSIONS
- app/actions/invitations.ts: send, revoke, removeMember, updateMemberRole
- app/actions/accept-invitation.ts: token acceptance (service role, atomic)
- app/api/invitations/accept/route.ts: public token redirect + session check
- app/(public)/invite/[token]: acceptance page (invalid/login/accept/wrong-acct/success)
- emails/InvitationEmail.tsx: React Email template via Resend
- app/dashboard/settings/team: member list + pending invites + invite form
- plan gate: Agency required to invite beyond owner
- last-owner protection on all role mutations
- tests: [N] Vitest + [N] Playwright passing
- docs: roadmap #75 → 60%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES §51

Gap #75 part 1 closed. Agency tier can now have multi-user teams.
Seat-based billing + per-location permissions → Sprint 99."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 98 completes:

- **Multi-User Foundation: 0% → 60%** (Gap #75 part 1 closed)
- An Agency org owner can invite team members by email with role assignment
- Invitees receive a branded email, click through to `/invite/[token]`, and accept
- The team management page shows all members + pending invites + role controls
- Role enforcement (`assertOrgRole`) protects all mutations from unauthorized access
- Last-owner protection prevents accidental org lockout
- Agency plan gate prevents Growth/Starter orgs from adding members
- **Sprint 99** completes the picture: seat-based billing and granular per-location permissions
