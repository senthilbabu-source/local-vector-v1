# Sprint 112 — Team Invitations + Permissions

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/plan-enforcer.ts`,
> `lib/membership/types.ts`, `lib/membership/membership-service.ts`

---

## 🎯 Objective

Build the **Team Invitations + Permissions** system — the full invite lifecycle (send → accept → decline → expire), role assignment UI, and the activated [Invite Member →] button that Sprint 111 left disabled.

**What this sprint answers:** "How do I get someone else into my organization?"

**What Sprint 112 delivers:**
- `org_invitations` table with secure token-based invite flow
- `POST /api/team/invitations` — send an invitation (owner/admin only, Agency plan, seat check)
- `GET /api/team/invitations` — list pending invitations for current org
- `DELETE /api/team/invitations/[invitationId]` — revoke a pending invitation
- `GET /api/invitations/accept/[token]` — public route: validate token, show accept UI
- `POST /api/invitations/accept/[token]` — public route: accept invite, enroll in org
- Invite email via Resend with branded template
- `/dashboard/team` updated: [Invite Member →] button now active, pending invitations list
- `/invitations/accept/[token]` — public page for accepting invites (works for new + existing users)
- Role assignment: inviter selects role (admin/analyst/viewer) at invite time — cannot invite as owner
- Remove Member button activated (was disabled in Sprint 111)

**What this sprint does NOT build:** seat-based Stripe billing (Sprint 113), white-label email templates (Sprint 115), role change after enrollment (future sprint).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                                 — All rules (49 rules as of Sprint 111)
Read CLAUDE.md                                   — Full implementation inventory
Read lib/membership/types.ts                     — MemberRole, ROLE_PERMISSIONS, SEAT_LIMITS
Read lib/membership/membership-service.ts        — removeMember(), canAddMember() — extend these
Read lib/plan-enforcer.ts                        — canAddMember() added in Sprint 111
Read supabase/prod_schema.sql
  § FIND: org_members — exact columns (Sprint 111 added this)
  § FIND: organizations — plan_tier enum values
  § FIND: current_user_org_id() — still the RLS anchor
  § FIND: Resend email pattern — how existing emails are sent (lib/email.ts)
Read lib/email.ts                                — Existing email send pattern (DO NOT rewrite)
Read emails/                                     — Existing React Email templates for style
Read lib/supabase/database.types.ts             — All current types
Read src/__fixtures__/golden-tenant.ts           — Golden Tenant fixtures from Sprint 111
Read app/dashboard/team/page.tsx                 — Sprint 111 team page to extend
Read app/dashboard/team/_components/             — Sprint 111 components to extend
Read supabase/seed.sql                           — Seed pattern to follow
```

**Specifically understand before writing code:**

1. **How existing email sending works** — read `lib/email.ts` completely. Use `sendEmail()` or whatever the existing pattern is. Do NOT install a new email library. Resend is already wired.

2. **The `invited_by` column** — Sprint 111 added `invited_by uuid REFERENCES auth.users(id)` to `org_members`. The invitation flow must populate this when the invite is accepted.

3. **Token security** — invitation tokens must be cryptographically random (use `crypto.randomUUID()` or `crypto.getRandomValues()` — available in Node.js and edge runtime). Never use Math.random(). Tokens are single-use and expire after 7 days.

4. **Public vs authenticated routes** — the accept invite page and API route are public (no session required) because the invitee may not have a LocalVector account yet. The send/list/revoke routes are authenticated and Agency-plan-gated.

5. **New user flow** — if the invitee has no LocalVector account, the accept page shows a simple name + password form. On submit: create Supabase auth user, then enroll in org. If they already have an account, show a simpler "Join [Org Name]" confirmation.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/invitations/
  index.ts                    — barrel export
  types.ts                    — OrgInvitation, InvitationStatus, InvitePayload types
  invitation-service.ts       — pure functions (send, list, revoke, validate, accept)
  invitation-email.ts         — email template builder (pure, no side effects)

app/api/team/
  invitations/
    route.ts                  — GET (list), POST (send)
    [invitationId]/
      route.ts                — DELETE (revoke)

app/api/invitations/
  accept/
    [token]/
      route.ts                — GET (validate token), POST (accept)

app/invitations/
  accept/
    [token]/
      page.tsx                — Public accept page (no auth required)
      _components/
        AcceptInviteForm.tsx  — New user signup form
        JoinOrgPrompt.tsx     — Existing user join confirmation

app/dashboard/team/
  _components/
    InviteMemberModal.tsx     — Modal: email input + role selector + send button
    PendingInvitationsTable.tsx — List of pending invites with revoke button

emails/
  OrgInvitation.tsx           — React Email template for invite email
```

---

### Component 1: Types — `lib/invitations/types.ts`

```typescript
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export interface OrgInvitation {
  id: string;
  org_id: string;
  org_name: string;           // denormalized for email — from organizations.name
  invited_by_user_id: string;
  invited_by_name: string;    // denormalized for email — from auth.users
  invited_email: string;      // lowercase, trimmed
  role: Exclude<MemberRole, 'owner'>; // cannot invite as owner
  token: string;              // 64-char hex random token (NOT stored in client responses)
  status: InvitationStatus;
  expires_at: string;         // 7 days from created_at
  created_at: string;
  accepted_at: string | null;
}

// Safe version — token NEVER sent to client after creation
export type OrgInvitationSafe = Omit<OrgInvitation, 'token'>;

export interface InvitePayload {
  email: string;
  role: Exclude<MemberRole, 'owner'>;
}

export interface AcceptInvitePayload {
  // For new users
  full_name?: string;
  password?: string;
  // For existing users: just the token (no additional payload needed)
}

export interface InvitationValidation {
  valid: boolean;
  invitation: OrgInvitationSafe | null;
  error: 'not_found' | 'expired' | 'already_accepted' | 'revoked' | null;
  // Whether the invitee already has a LocalVector account
  existing_user: boolean;
}

export const INVITATION_EXPIRY_DAYS = 7;
export const INVITATION_TOKEN_BYTES = 32; // 32 bytes → 64 hex chars
```

---

### Component 2: Migration — `supabase/migrations/[timestamp]_org_invitations.sql`

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 112: Team Invitations + Permissions
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. org_invitations table
CREATE TABLE IF NOT EXISTS public.org_invitations (
  id               uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid             NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by       uuid             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email    text             NOT NULL,  -- lowercase, trimmed on insert
  role             public.member_role NOT NULL
                                    CHECK (role != 'owner'),  -- cannot invite as owner
  token            text             NOT NULL UNIQUE,          -- 64-char hex, not exposed to client
  status           text             NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','accepted','declined','expired','revoked')),
  expires_at       timestamptz      NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at       timestamptz      NOT NULL DEFAULT NOW(),
  accepted_at      timestamptz,
  -- Prevent duplicate pending invites to the same email for the same org
  CONSTRAINT uq_org_pending_invite UNIQUE NULLS NOT DISTINCT (org_id, invited_email, status)
  -- Note: NULLS NOT DISTINCT is Postgres 15+. If on older version, use partial unique index below.
);

-- Partial unique index (fallback if NULLS NOT DISTINCT not available):
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_org_pending_invite_unique
--   ON public.org_invitations (org_id, invited_email)
--   WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id
  ON public.org_invitations (org_id, status);

CREATE INDEX IF NOT EXISTS idx_org_invitations_token
  ON public.org_invitations (token);  -- token lookup must be fast

CREATE INDEX IF NOT EXISTS idx_org_invitations_email
  ON public.org_invitations (invited_email, status);

COMMENT ON TABLE public.org_invitations IS
  'Pending/historical invitations to join an org. Sprint 112. '
  'Token is a 64-char hex string. Never expose token in client-facing API responses '
  'except in the invite URL (which is sent only via email).';

-- 2. RLS
ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

-- Owner/admin can view invitations for their org
CREATE POLICY "org_invitations: owner/admin can read"
  ON public.org_invitations FOR SELECT
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    IN ('owner', 'admin')
    )
  );

-- Owner/admin can insert (send invitations)
CREATE POLICY "org_invitations: owner/admin can insert"
  ON public.org_invitations FOR INSERT
  WITH CHECK (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    IN ('owner', 'admin')
    )
  );

-- Owner/admin can update (revoke)
CREATE POLICY "org_invitations: owner/admin can update"
  ON public.org_invitations FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    IN ('owner', 'admin')
    )
  );

-- Service role full access (accept flow runs without session for new users)
CREATE POLICY "org_invitations: service role full access"
  ON public.org_invitations
  USING (auth.role() = 'service_role');

-- 3. Expire pending invitations older than 7 days
--    This runs as a cron job (no new cron — reuse existing cron infrastructure).
--    Add to vercel.json as a lightweight monthly job or run inline on invitation fetch.
--    Implementation: in getOrgInvitations(), run a soft-expire UPDATE first:
--
-- UPDATE public.org_invitations
--    SET status = 'expired'
--  WHERE status = 'pending' AND expires_at < NOW();
--
-- This soft-expiry approach avoids a separate cron entirely.
-- Run it at the top of invitation-service.ts getOrgInvitations() and validateToken().
```

---

### Component 3: Invitation Service — `lib/invitations/invitation-service.ts`

```typescript
/**
 * Pure invitation service. Caller passes the Supabase client.
 *
 * ── sendInvitation(supabase, orgId, invitedBy, payload) ───────────────────────
 * Guards (in order):
 * 1. Normalize email: lowercase + trim
 * 2. Check canAddMember(): if false → throw 'seat_limit_reached'
 * 3. Check if invitee is already an org member:
 *    SELECT 1 FROM org_members WHERE org_id = $orgId AND user_id IN
 *    (SELECT id FROM auth.users WHERE email = $email)
 *    If found → throw 'already_member'
 * 4. Check for existing pending invitation:
 *    SELECT 1 FROM org_invitations WHERE org_id = $orgId AND invited_email = $email
 *    AND status = 'pending' AND expires_at > NOW()
 *    If found → throw 'invitation_already_pending'
 * 5. Generate token: use generateSecureToken() (32 random bytes → 64 hex chars)
 * 6. INSERT into org_invitations
 * 7. Fetch org name and inviter name for email
 * 8. Call sendInvitationEmail() from invitation-email.ts
 * 9. Return OrgInvitationSafe (token OMITTED from return value)
 *
 * ── getOrgInvitations(supabase, orgId) ────────────────────────────────────────
 * 1. Soft-expire: UPDATE org_invitations SET status='expired'
 *    WHERE org_id = $orgId AND status='pending' AND expires_at < NOW()
 * 2. SELECT pending invitations only (status = 'pending')
 * 3. Return OrgInvitationSafe[] sorted by created_at DESC
 *
 * ── revokeInvitation(supabase, invitationId, orgId) ───────────────────────────
 * 1. Fetch invitation — must exist and belong to orgId
 * 2. Must be 'pending' → if not: throw 'invitation_not_revocable'
 * 3. UPDATE status = 'revoked'
 * 4. Return { success: true }
 *
 * ── validateToken(supabase, token) ────────────────────────────────────────────
 * Uses service role client (public route, no session).
 * 1. Soft-expire stale invitations (same UPDATE as above)
 * 2. SELECT * FROM org_invitations WHERE token = $token
 * 3. If not found → return { valid: false, error: 'not_found' }
 * 4. If status = 'expired' → return { valid: false, error: 'expired' }
 * 5. If status = 'accepted' → return { valid: false, error: 'already_accepted' }
 * 6. If status = 'revoked' → return { valid: false, error: 'revoked' }
 * 7. Check if invited_email exists in auth.users:
 *    SELECT id FROM auth.users WHERE email = invited_email LIMIT 1
 * 8. Return { valid: true, invitation: OrgInvitationSafe, existing_user: boolean }
 * NOTE: token field NEVER returned in InvitationValidation — use OrgInvitationSafe
 *
 * ── acceptInvitation(supabase, token, payload) ────────────────────────────────
 * Uses service role client (new user has no session yet).
 * 1. validateToken() — if not valid: throw the error code
 * 2. If existing_user = false AND no password in payload → throw 'password_required'
 * 3. If existing_user = false:
 *    a. Create Supabase auth user: supabase.auth.admin.createUser({
 *         email: invitation.invited_email,
 *         password: payload.password,
 *         user_metadata: { full_name: payload.full_name },
 *         email_confirm: true  // auto-confirm — they clicked the invite link
 *       })
 *    b. On error: throw 'user_creation_failed' + original error message
 * 4. Get user_id (from existing user lookup or new user creation)
 * 5. Check if already a member (race condition guard):
 *    If already in org_members → just mark invitation accepted, return success
 * 6. INSERT into org_members:
 *    { org_id, user_id, role: invitation.role, invited_by: invitation.invited_by }
 * 7. UPDATE org_invitations SET status='accepted', accepted_at=NOW()
 *    WHERE token = $token
 * 8. Return { success: true; org_name: string; role: MemberRole }
 *
 * ── generateSecureToken() ─────────────────────────────────────────────────────
 * Pure function. No API calls.
 * const bytes = new Uint8Array(32);
 * crypto.getRandomValues(bytes);
 * return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
 * Returns a 64-character lowercase hex string.
 * Available in Node.js 18+ and Vercel Edge runtime.
 */
```

---

### Component 4: Invitation Email — `lib/invitations/invitation-email.ts`

```typescript
/**
 * Pure email template builder. No side effects. No API calls.
 * Imported by invitation-service.ts which calls the actual sendEmail().
 *
 * buildInvitationEmailHtml(params):
 *   params: {
 *     inviterName: string;
 *     orgName: string;
 *     role: MemberRole;
 *     acceptUrl: string;    // https://app.localvector.ai/invitations/accept/{token}
 *     expiresAt: string;    // formatted: "March 8, 2026"
 *   }
 *   Returns: { subject: string; html: string; text: string }
 *
 * Subject: "{inviterName} invited you to join {orgName} on LocalVector"
 *
 * IMPORTANT: buildInvitationEmailHtml is a pure function that returns strings.
 * The actual send call uses the existing sendEmail() pattern from lib/email.ts.
 * Do NOT call Resend directly in this file.
 */
```

---

### Component 5: React Email Template — `emails/OrgInvitation.tsx`

```typescript
/**
 * React Email template for the org invitation.
 * Follow the exact same style as existing templates in emails/.
 * Match their imports, component structure, and export pattern.
 *
 * Props:
 *   inviterName: string
 *   orgName: string
 *   role: string  (e.g. "Admin", "Analyst", "Viewer")
 *   acceptUrl: string
 *   expiresAt: string  (e.g. "March 8, 2026")
 *
 * Content:
 *   Heading: "{inviterName} invited you to join {orgName}"
 *   Body: "You've been invited to join {orgName} as {role}. Click below to accept."
 *   CTA Button: "Accept Invitation" → links to acceptUrl
 *   Footer: "This invitation expires on {expiresAt}. If you didn't expect this, ignore it."
 *
 * DO NOT hardcode any business-specific content.
 * Sprint 115 (white-label) will add org-specific branding to this template.
 */
```

---

### Component 6: API Routes

#### `app/api/team/invitations/route.ts`

```typescript
/**
 * GET /api/team/invitations
 * Returns all pending invitations for the authenticated user's org.
 *
 * Plan gate: Agency only. Non-Agency → 403 'plan_upgrade_required'
 * Auth: session required. Caller must be owner or admin.
 * Non-owner/admin → 403 'insufficient_role'
 *
 * Response: { invitations: OrgInvitationSafe[] }
 * Tokens NEVER included in response.
 *
 * POST /api/team/invitations
 * Sends a new invitation.
 *
 * Body: { email: string; role: 'admin' | 'analyst' | 'viewer' }
 *
 * Validation (in order):
 * 1. email: valid email format (use simple regex — not a library)
 * 2. role: must be admin | analyst | viewer (not owner)
 * 3. Plan: Agency only → 403 'plan_upgrade_required'
 * 4. Auth: owner or admin → 403 'insufficient_role'
 * 5. canAddMember() check → 429 'seat_limit_reached'
 * 6. Already a member → 409 'already_member'
 * 7. Pending invite exists → 409 'invitation_already_pending'
 *
 * Response on success: { ok: true; invitation: OrgInvitationSafe }
 *
 * Error codes:
 * - 400: invalid_email | invalid_role
 * - 401: not authenticated
 * - 403: plan_upgrade_required | insufficient_role
 * - 409: already_member | invitation_already_pending
 * - 429: seat_limit_reached
 * - 500: send_failed (email send failed — invitation still created, warn user)
 */
```

#### `app/api/team/invitations/[invitationId]/route.ts`

```typescript
/**
 * DELETE /api/team/invitations/[invitationId]
 * Revokes a pending invitation.
 *
 * Auth: session required. Owner or admin only.
 * Plan: Agency only.
 *
 * Error codes:
 * - 401: not authenticated
 * - 403: plan_upgrade_required | insufficient_role
 * - 404: invitation_not_found
 * - 409: invitation_not_revocable (already accepted/expired/revoked)
 *
 * Response: { ok: true }
 */
```

#### `app/api/invitations/accept/[token]/route.ts`

```typescript
/**
 * GET /api/invitations/accept/[token]
 * Validates a token. PUBLIC — no auth required.
 * Used by the accept page to determine which UI to show.
 *
 * Response: InvitationValidation (token NEVER included)
 * Always 200 — errors encoded in { valid: false, error: string }
 *
 * POST /api/invitations/accept/[token]
 * Accepts an invitation. PUBLIC — no auth required for new users.
 *
 * Body:
 *   For new users:  { full_name: string; password: string }
 *   For existing users: {} (empty — just the token in the URL)
 *
 * Validation:
 * - token valid → else 400 with error code
 * - new user: full_name non-empty, password ≥ 8 chars
 *
 * Response on success:
 *   { ok: true; org_name: string; role: string }
 *   Client redirects to /dashboard after success.
 *
 * Error codes (400):
 *   not_found | expired | already_accepted | revoked |
 *   password_required | password_too_short | user_creation_failed
 *
 * SECURITY: This route uses createServiceRoleClient() ONLY after token
 * validation passes. The token itself is the authentication mechanism.
 * Never expose the token in response bodies or logs.
 */
```

---

### Component 7: Accept Invite Page — `app/invitations/accept/[token]/page.tsx`

```typescript
/**
 * PUBLIC page — no Supabase session required.
 * No sidebar, no dashboard chrome. Standalone page.
 *
 * On load: calls GET /api/invitations/accept/[token]
 *
 * States:
 *
 * LOADING: skeleton spinner
 *
 * INVALID (valid=false):
 *   Show error card based on error code:
 *   - 'not_found':        "This invitation link is invalid or has already been used."
 *   - 'expired':          "This invitation has expired. Ask your team admin to send a new one."
 *   - 'already_accepted': "You've already joined this organization. Sign in to continue."
 *   - 'revoked':          "This invitation was revoked by your team admin."
 *   All show a [Go to LocalVector →] button linking to /
 *
 * VALID + existing_user = true:
 *   Show JoinOrgPrompt:
 *   "You've been invited to join {orgName} as {role}."
 *   "{inviterName} sent you this invitation."
 *   [Accept Invitation] button → POST /api/invitations/accept/[token]
 *   On success: redirect to /dashboard
 *   On error: show error message inline
 *
 * VALID + existing_user = false:
 *   Show AcceptInviteForm:
 *   "Create your LocalVector account to join {orgName}."
 *   Fields: Full Name (required), Password (required, ≥ 8 chars), Confirm Password
 *   [Create Account & Join] button → POST /api/invitations/accept/[token]
 *   On success: sign in the new user automatically, redirect to /dashboard
 *   On error: show field-level errors inline
 *
 * After successful accept (new user):
 *   Auto-sign-in: call supabase.auth.signInWithPassword({
 *     email: invitation.invited_email,
 *     password: payload.password
 *   })
 *   Then redirect to /dashboard
 *
 * data-testid attributes:
 *   "accept-invite-page"
 *   "accept-invite-error-card"
 *   "join-org-prompt"
 *   "accept-invite-form"
 *   "full-name-input"
 *   "password-input"
 *   "confirm-password-input"
 *   "accept-invite-btn"
 *   "create-account-btn"
 */
```

---

### Component 8: InviteMemberModal — `app/dashboard/team/_components/InviteMemberModal.tsx`

```typescript
/**
 * 'use client'
 * Modal triggered by [Invite Member →] button (now active in Sprint 112).
 *
 * Fields:
 *   Email: text input, validated as email format on blur
 *   Role: dropdown selector — options: Admin, Analyst, Viewer
 *         Include a one-line description for each role:
 *         Admin:   "Can invite, remove, and manage all content"
 *         Analyst: "Can view all data and generate reports"
 *         Viewer:  "Read-only access to dashboard data"
 *
 * Submit: POST /api/team/invitations
 *
 * Success state: "Invitation sent to {email}" — close modal after 2 seconds
 * Error states:
 *   - 'seat_limit_reached': "You've reached the seat limit for your plan."
 *   - 'already_member':     "{email} is already a member of this organization."
 *   - 'invitation_already_pending': "An invitation is already pending for {email}."
 *   - 'send_failed':        "Invitation created but email failed to send. Share the invite link manually." + copy link button (shows masked URL — NOT the actual token)
 *
 * IMPORTANT: The [Invite Member →] button on the team page must now be
 * wired to open this modal. In Sprint 111 it was aria-disabled. Remove the
 * aria-disabled and connect onClick to open the modal.
 *
 * data-testid:
 *   "invite-member-modal"
 *   "invite-email-input"
 *   "invite-role-select"
 *   "invite-submit-btn"
 *   "invite-success-message"
 *   "invite-error-message"
 */
```

---

### Component 9: PendingInvitationsTable — `app/dashboard/team/_components/PendingInvitationsTable.tsx`

```typescript
/**
 * 'use client'
 * Shows below the team members table on /dashboard/team.
 * Only visible to owner/admin roles.
 * Only shown when there are pending invitations.
 *
 * Columns: Email, Role, Invited By, Expires, Actions
 *
 * Actions:
 *   [Revoke] button → DELETE /api/team/invitations/[invitationId]
 *   On success: remove row from local state (optimistic update)
 *   On error: show inline error toast
 *
 * Empty state: hidden (section not shown when no pending invitations)
 *
 * data-testid:
 *   "pending-invitations-table"
 *   "pending-invite-row-{invitationId}"
 *   "revoke-invite-{invitationId}"
 */
```

---

### Component 10: Remove Member Activation

In `app/dashboard/team/_components/TeamMembersTable.tsx` (created in Sprint 111):

```typescript
/**
 * ACTIVATE the Remove Member button.
 * In Sprint 111 it called alert("Coming soon").
 * Replace that with:
 *   1. Show a confirmation dialog: "Remove {name} from {orgName}? They will lose access immediately."
 *      Buttons: [Cancel] [Remove Member]
 *   2. On confirm: DELETE /api/team/members/[memberId]
 *   3. On success: remove row from local state (optimistic update) + show success toast
 *   4. On error: show inline error message
 *
 * Use a simple window.confirm() for the confirmation dialog in Sprint 112.
 * Sprint 116 (settings expansion) may upgrade this to a proper modal.
 */
```

---

### Component 11: Seed Data Updates

```sql
-- In supabase/seed.sql — add golden tenant invitation fixtures

DO $$
DECLARE
  v_org_id    uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_owner_id  uuid; -- fetch from org_members for the golden tenant
  v_token     text := 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222'; -- deterministic test token (64 chars)
BEGIN
  SELECT user_id INTO v_owner_id
  FROM public.org_members
  WHERE org_id = v_org_id AND role = 'owner'
  LIMIT 1;

  -- Seed one pending invitation
  INSERT INTO public.org_invitations (
    id, org_id, invited_by, invited_email, role,
    token, status, expires_at, created_at, accepted_at
  ) VALUES (
    'inv-seed-001',
    v_org_id, v_owner_id,
    'newmember@example.com', 'analyst',
    v_token, 'pending',
    NOW() + INTERVAL '6 days',
    NOW() - INTERVAL '1 hour',
    NULL
  )
  ON CONFLICT DO NOTHING;
END $$;
```

---

### Component 12: Golden Tenant Fixtures — `src/__fixtures__/golden-tenant.ts`

```typescript
// Sprint 112 — invitation fixtures
import type { OrgInvitation, OrgInvitationSafe, InvitationValidation } from '@/lib/invitations/types';

export const MOCK_INVITATION_TOKEN = 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222';

export const MOCK_ORG_INVITATION_SAFE: OrgInvitationSafe = {
  id: 'inv-seed-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_name: 'Charcoal N Chill',
  invited_by_user_id: 'golden-user-id',
  invited_by_name: 'Aruna Babu',
  invited_email: 'newmember@example.com',
  role: 'analyst',
  status: 'pending',
  expires_at: '2026-03-08T00:00:00.000Z',
  created_at: '2026-03-01T00:00:00.000Z',
  accepted_at: null,
};

export const MOCK_INVITATION_VALIDATION_NEW_USER: InvitationValidation = {
  valid: true,
  invitation: MOCK_ORG_INVITATION_SAFE,
  error: null,
  existing_user: false,
};

export const MOCK_INVITATION_VALIDATION_EXISTING_USER: InvitationValidation = {
  valid: true,
  invitation: MOCK_ORG_INVITATION_SAFE,
  error: null,
  existing_user: true,
};

export const MOCK_INVITATION_VALIDATION_EXPIRED: InvitationValidation = {
  valid: false,
  invitation: null,
  error: 'expired',
  existing_user: false,
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/invitation-service.test.ts`

**Supabase and Resend mocked. generateSecureToken() pure — zero mocks.**

```
describe('generateSecureToken — pure')
  1.  returns 64-character string
  2.  contains only hex characters [0-9a-f]
  3.  two calls return different values (probabilistic — run 100 times)

describe('sendInvitation — Supabase + Resend mocked')
  4.  normalizes email to lowercase
  5.  throws 'seat_limit_reached' when canAddMember returns false
  6.  throws 'already_member' when email matches existing org member
  7.  throws 'invitation_already_pending' when pending invite exists for email
  8.  inserts into org_invitations with correct role and expires_at (+7 days)
  9.  calls sendEmail() with correct subject and acceptUrl containing token
  10. returns OrgInvitationSafe — token NOT present in return value
  11. token NOT present in returned object even if accidentally included

describe('getOrgInvitations — Supabase mocked')
  12. runs soft-expire UPDATE before SELECT
  13. returns only 'pending' status invitations
  14. returns sorted by created_at DESC
  15. returns empty array when no pending invitations (no crash)

describe('revokeInvitation — Supabase mocked')
  16. throws 'invitation_not_revocable' when status is 'accepted'
  17. throws 'invitation_not_revocable' when status is 'expired'
  18. UPDATE sets status = 'revoked' when status is 'pending'
  19. returns { success: true }

describe('validateToken — Supabase mocked (service role)')
  20. returns { valid: false, error: 'not_found' } for unknown token
  21. returns { valid: false, error: 'expired' } for expired invitation
  22. returns { valid: false, error: 'already_accepted' } for accepted invitation
  23. returns { valid: false, error: 'revoked' } for revoked invitation
  24. returns { valid: true, existing_user: false } for new email
  25. returns { valid: true, existing_user: true } for email in auth.users

describe('acceptInvitation — Supabase mocked (service role)')
  26. throws 'expired' when validateToken fails
  27. creates auth user via admin.createUser() for new users
  28. skips createUser() for existing users
  29. inserts into org_members with correct role and invited_by
  30. updates invitation status to 'accepted' and sets accepted_at
  31. handles race condition: if already in org_members, still marks invitation accepted
  32. returns { success: true, org_name, role }
```

**32 tests.**

---

### Test File 2: `src/__tests__/unit/invitation-routes.test.ts`

```
describe('POST /api/team/invitations')
  1.  returns 401 when not authenticated
  2.  returns 403 'plan_upgrade_required' for non-Agency plan
  3.  returns 403 'insufficient_role' for analyst/viewer callers
  4.  returns 400 'invalid_email' for malformed email
  5.  returns 400 'invalid_role' for role='owner'
  6.  returns 429 'seat_limit_reached' when at seat limit
  7.  returns 409 'already_member' when email is existing member
  8.  returns 409 'invitation_already_pending'
  9.  returns { ok: true, invitation: OrgInvitationSafe } on success
  10. token NOT present in success response

describe('GET /api/team/invitations')
  11. returns 401 when not authenticated
  12. returns 403 for non-Agency plan
  13. returns { invitations: OrgInvitationSafe[] } on success

describe('DELETE /api/team/invitations/[invitationId]')
  14. returns 401 when not authenticated
  15. returns 403 for insufficient role (analyst/viewer)
  16. returns 404 'invitation_not_found'
  17. returns 409 'invitation_not_revocable'
  18. returns { ok: true } on success

describe('GET /api/invitations/accept/[token] — PUBLIC')
  19. returns InvitationValidation with valid=true for valid token
  20. returns valid=false for expired token (200, not 4xx)
  21. returns existing_user=true when email exists in auth.users

describe('POST /api/invitations/accept/[token] — PUBLIC')
  22. returns 400 'expired' for expired token
  23. returns 400 'password_required' for new user without password
  24. returns 400 'password_too_short' for password < 8 chars
  25. returns { ok: true, org_name, role } on success
  26. does NOT require session (no auth header needed)
```

**26 tests.**

---

### Test File 3: `src/__tests__/unit/invitation-email.test.ts`

```
describe('buildInvitationEmailHtml — pure')
  1.  subject contains inviterName and orgName
  2.  html contains acceptUrl
  3.  html contains role string (capitalized)
  4.  html contains expiresAt formatted date
  5.  text fallback does not contain HTML tags
  6.  token NOT present anywhere in subject, html, or text output
     (token is embedded only in acceptUrl — test that acceptUrl contains the full URL)
```

**6 tests.**

---

### Test File 4: `src/__tests__/e2e/invitations.spec.ts` — Playwright

```typescript
describe('Team Invitations Flow', () => {

  test('Invite Member button opens modal', async ({ page }) => {
    // Mock plan = 'agency', caller role = 'owner'
    // Navigate to /dashboard/team
    // Assert: invite-member-btn NOT aria-disabled (Sprint 112 activates it)
    // Click invite-member-btn
    // Assert: data-testid="invite-member-modal" visible
  });

  test('InviteMemberModal: validation — invalid email', async ({ page }) => {
    // Open modal
    // Type "notanemail" into invite-email-input
    // Click invite-submit-btn
    // Assert: error message about invalid email visible
  });

  test('InviteMemberModal: validation — owner role blocked', async ({ page }) => {
    // Role dropdown should NOT contain "Owner" option
    // Assert: role select has options admin, analyst, viewer only
  });

  test('InviteMemberModal: successful invite shows success state', async ({ page }) => {
    // Mock POST /api/team/invitations → { ok: true, invitation: MOCK_ORG_INVITATION_SAFE }
    // Fill email + select analyst role
    // Click invite-submit-btn
    // Assert: data-testid="invite-success-message" visible
    // Assert: modal closes after 2 seconds
  });

  test('Pending invitations table shows after invite sent', async ({ page }) => {
    // Mock GET /api/team/invitations → [MOCK_ORG_INVITATION_SAFE]
    // Navigate to /dashboard/team
    // Assert: data-testid="pending-invitations-table" visible
    // Assert: "newmember@example.com" row visible
    // Assert: "Analyst" role visible in row
    // Assert: data-testid="revoke-invite-inv-seed-001" visible
  });

  test('Revoke invitation removes row', async ({ page }) => {
    // Mock DELETE /api/team/invitations/inv-seed-001 → { ok: true }
    // Click revoke-invite-inv-seed-001
    // Assert: row removed from table (optimistic update)
  });

  test('Accept invite page — expired token shows error', async ({ page }) => {
    // Mock GET /api/invitations/accept/[token] → MOCK_INVITATION_VALIDATION_EXPIRED
    // Navigate to /invitations/accept/some-token
    // Assert: data-testid="accept-invite-error-card" visible
    // Assert: "expired" error message visible
  });

  test('Accept invite page — new user sees signup form', async ({ page }) => {
    // Mock GET /api/invitations/accept/[token] → MOCK_INVITATION_VALIDATION_NEW_USER
    // Navigate to /invitations/accept/aaaa1111...
    // Assert: data-testid="accept-invite-form" visible
    // Assert: full-name-input, password-input, confirm-password-input visible
    // Assert: org name "Charcoal N Chill" visible on page
  });

  test('Accept invite page — existing user sees join prompt', async ({ page }) => {
    // Mock GET /api/invitations/accept/[token] → MOCK_INVITATION_VALIDATION_EXISTING_USER
    // Navigate to /invitations/accept/aaaa1111...
    // Assert: data-testid="join-org-prompt" visible
    // Assert: data-testid="accept-invite-form" NOT visible
    // Assert: accept-invite-btn visible
  });

  test('Remove member button triggers confirmation and API call', async ({ page }) => {
    // Mock DELETE /api/team/members/mem-admin-golden-002 → { ok: true }
    // Navigate to /dashboard/team (with MOCK_MEMBERS_LIST = 3 members)
    // Assert: remove-member-{adminId} visible
    // Click remove button
    // Accept window.confirm dialog
    // Assert: admin row removed from table
  });
});
```

**9 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/invitation-service.test.ts   # 32 tests
npx vitest run src/__tests__/unit/invitation-routes.test.ts    # 26 tests
npx vitest run src/__tests__/unit/invitation-email.test.ts     # 6 tests
npx vitest run                                                   # ALL — zero regressions
npx playwright test src/__tests__/e2e/invitations.spec.ts      # 9 Playwright tests
npx tsc --noEmit                                                 # 0 type errors
```

**Total: 64 Vitest + 9 Playwright = 73 tests**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/invitations/types.ts` | **CREATE** | All invitation types + constants |
| 2 | `lib/invitations/invitation-service.ts` | **CREATE** | Full invitation lifecycle |
| 3 | `lib/invitations/invitation-email.ts` | **CREATE** | Pure email content builder |
| 4 | `lib/invitations/index.ts` | **CREATE** | Barrel export |
| 5 | `emails/OrgInvitation.tsx` | **CREATE** | React Email template |
| 6 | `app/api/team/invitations/route.ts` | **CREATE** | GET + POST invitations |
| 7 | `app/api/team/invitations/[invitationId]/route.ts` | **CREATE** | DELETE (revoke) |
| 8 | `app/api/invitations/accept/[token]/route.ts` | **CREATE** | GET (validate) + POST (accept) — PUBLIC |
| 9 | `app/invitations/accept/[token]/page.tsx` | **CREATE** | Public accept page |
| 10 | `app/invitations/accept/[token]/_components/AcceptInviteForm.tsx` | **CREATE** | New user form |
| 11 | `app/invitations/accept/[token]/_components/JoinOrgPrompt.tsx` | **CREATE** | Existing user prompt |
| 12 | `app/dashboard/team/_components/InviteMemberModal.tsx` | **CREATE** | Invite modal |
| 13 | `app/dashboard/team/_components/PendingInvitationsTable.tsx` | **CREATE** | Pending invites list |
| 14 | `app/dashboard/team/_components/TeamMembersTable.tsx` | **MODIFY** | Activate remove button |
| 15 | `app/dashboard/team/page.tsx` | **MODIFY** | Add pending invites section |
| 16 | `supabase/migrations/[timestamp]_org_invitations.sql` | **CREATE** | Full migration |
| 17 | `supabase/prod_schema.sql` | **MODIFY** | Append org_invitations |
| 18 | `lib/supabase/database.types.ts` | **MODIFY** | Add org_invitations types |
| 19 | `supabase/seed.sql` | **MODIFY** | 1 pending invitation seed |
| 20 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 4 invitation fixtures |
| 21 | `src/__tests__/unit/invitation-service.test.ts` | **CREATE** | 32 tests |
| 22 | `src/__tests__/unit/invitation-routes.test.ts` | **CREATE** | 26 tests |
| 23 | `src/__tests__/unit/invitation-email.test.ts` | **CREATE** | 6 tests |
| 24 | `src/__tests__/e2e/invitations.spec.ts` | **CREATE** | 9 Playwright tests |

**Total: 24 files**

---

## 🚫 What NOT to Do

1. **DO NOT allow owner role as an invite target** — the `org_invitations.role` column has `CHECK (role != 'owner')`. The API validates this. The UI dropdown excludes "Owner". There is no code path that results in an invited owner. Ownership transfer is a separate feature (not in this sprint).

2. **DO NOT expose the raw token in any API response** — the token is only ever sent in the invitation email URL. Return `OrgInvitationSafe` (token omitted) from all API routes. The test for this is explicit (test #10, test #11).

3. **DO NOT use Math.random() for token generation** — use `crypto.getRandomValues()`. This is available in Node.js 18+ and Vercel Edge runtime. Never use UUID v4 from a library that wraps Math.random().

4. **DO NOT create a new cron for invitation expiry** — soft-expire by running an UPDATE at the start of `getOrgInvitations()` and `validateToken()`. No new vercel.json entry needed.

5. **DO NOT rewrite `lib/email.ts`** — extend it if needed. Use the existing `sendEmail()` pattern. The OrgInvitation.tsx template follows the same React Email pattern as existing templates.

6. **DO NOT require authentication on the accept invite routes** — `/api/invitations/accept/[token]` is a public route. The token IS the authentication. The service role client is used for DB operations after token validation.

7. **DO NOT auto-confirm the invited user's email with a separate confirmation email** — setting `email_confirm: true` in `createUser()` is correct. They confirmed their email intent by clicking the invite link. Skip the separate confirmation flow.

8. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).

9. **DO NOT edit `middleware.ts`** (AI_RULES §6). The `/invitations/accept/[token]` page must be excluded from auth middleware. Check `middleware.ts` — it likely has a public routes allowlist. Add `/invitations` to that list if it's not already covered.

10. **DO NOT skip the duplicate invite guard** — `CONSTRAINT uq_org_pending_invite` prevents duplicate DB inserts, but the application layer must also check and return `409 'invitation_already_pending'` before attempting the insert, so the error message is clean.

11. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

12. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.

---

## ✅ Definition of Done

- [ ] `lib/invitations/types.ts` — InvitationStatus (5 values), OrgInvitation, OrgInvitationSafe (token omitted), InvitePayload, AcceptInvitePayload, InvitationValidation, INVITATION_EXPIRY_DAYS=7, INVITATION_TOKEN_BYTES=32
- [ ] `invitation-service.ts` — generateSecureToken() (crypto, 64 hex), sendInvitation() (4 guards + INSERT + email), getOrgInvitations() (soft-expire + pending only), revokeInvitation() (status guard), validateToken() (5 states), acceptInvitation() (new/existing user paths + race condition guard)
- [ ] `invitation-email.ts` — buildInvitationEmailHtml() pure, returns {subject, html, text}, token NOT in output
- [ ] `emails/OrgInvitation.tsx` — React Email template matching existing style
- [ ] `POST /api/team/invitations` — 7 validation guards, correct error codes, token NOT in response
- [ ] `GET /api/team/invitations` — Agency + owner/admin gated
- [ ] `DELETE /api/team/invitations/[invitationId]` — revoke flow, correct error codes
- [ ] `GET /api/invitations/accept/[token]` — PUBLIC, returns InvitationValidation, always 200
- [ ] `POST /api/invitations/accept/[token]` — PUBLIC, new/existing user paths, auto-confirm new users
- [ ] `/invitations/accept/[token]` page — 4 states (loading, invalid, new user form, existing user prompt), correct data-testid on all elements
- [ ] `InviteMemberModal` — email + role fields, role dropdown excludes owner, success/error states, data-testid
- [ ] `PendingInvitationsTable` — revoke button, optimistic update on success
- [ ] `TeamMembersTable` — remove button activated (window.confirm + API call + optimistic update)
- [ ] `/dashboard/team` — pending invitations section added, invite button no longer aria-disabled
- [ ] `/invitations` added to middleware.ts public routes allowlist
- [ ] Migration: org_invitations table, 4 RLS policies, partial unique index on (org_id, invited_email) WHERE status='pending'
- [ ] prod_schema.sql updated
- [ ] database.types.ts updated
- [ ] seed.sql: 1 pending invitation for golden tenant
- [ ] golden-tenant.ts: 4 invitation fixtures
- [ ] `npx vitest run src/__tests__/unit/invitation-service.test.ts` — **32 tests passing**
- [ ] `npx vitest run src/__tests__/unit/invitation-routes.test.ts` — **26 tests passing**
- [ ] `npx vitest run src/__tests__/unit/invitation-email.test.ts` — **6 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/invitations.spec.ts` — **9 tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 50 written
- [ ] roadmap.md Sprint 112 marked ✅

---

## ⚠️ Edge Cases

1. **Invitee already has a LocalVector account under a different org** — `acceptInvitation()` will find the existing user, insert into `org_members` for the new org, and mark the invite accepted. One user can now be in two orgs. `current_user_org_id()` returns LIMIT 1 — they'll land on the first org. Multi-org switching is a future feature. Document this behavior; do not block it.

2. **Token URL visited twice (double-click / share)** — Second GET returns `{ valid: false, error: 'already_accepted' }`. Show the "already accepted" error card with a [Sign In →] link. No double-enrollment possible.

3. **Invite email fails to send (Resend error)** — The invitation is still created in the DB. Return `{ ok: true }` but with a warning: `{ warning: 'send_failed', message: '...' }`. The modal shows "Invitation created but email failed to send" with a copy-link button. The link shows the accept page URL without the token exposed in the UI (show masked version like `/invitations/accept/[invitation ID]` — let admins copy the DB token separately if needed).

4. **Password too short on new user form** — Client-side validation catches this before submit. Server-side also validates (≥ 8 chars). Return `400 'password_too_short'`.

5. **Passwords don't match (confirm field)** — Client-side only validation. Show "Passwords do not match" inline. Do not submit if mismatch.

6. **Invitation to an email that belongs to a Supabase auth user in a different org** — `validateToken()` returns `existing_user: true`. The accept flow creates an org_member row for this user in the invited org. They are now in two orgs. Covered by edge case #1.

7. **Seat limit race condition** — Two admins simultaneously invite two different people, both pass the `canAddMember()` check, both inserts succeed, seat count becomes 11 (over limit of 10 for Agency). The `trg_sync_seat_count` trigger keeps `seat_count` accurate. Sprint 113 (billing) will add a DB-level constraint on seat_count vs plan. Sprint 112 only has the application-level check, which is sufficient for MVP.

---

## 🔮 AI_RULES Update (Add Rule 50)

```markdown
## 50. 📧 Org Invitations in `lib/invitations/` (Sprint 112)

* **Token security:** Always use `crypto.getRandomValues()` for token generation. 
  Never Math.random(). Token = 64 hex chars (32 bytes). Single-use + 7-day expiry.
* **Token never in API responses:** Return OrgInvitationSafe always. Token is sent 
  ONLY in the invite email URL. Never log tokens. Never return in GET responses.
* **Public accept routes:** `/api/invitations/accept/[token]` and 
  `/invitations/accept/[token]` are public — no session required. Service role client
  used after token validation. Add /invitations to middleware public allowlist.
* **Soft-expire pattern:** No cron needed. Run UPDATE ... SET status='expired' WHERE 
  expires_at < NOW() at top of getOrgInvitations() and validateToken(). 
* **Role constraint:** org_invitations.role CHECK (role != 'owner'). No code path
  creates an owner via invitation. Ownership transfer is a separate future feature.
* **Cannot invite owner:** Dropdown excludes 'owner'. API validates. DB enforces.
```

---

## 🗺️ What Comes Next

**Sprint 113 — Seat-Based Billing + Audit Log:** Stripe seat metering wired to `seat_count`, billing portal update when seats change, `activity_log` table capturing all membership events (invite sent, accepted, member removed, role changed), audit trail visible to org owners.
