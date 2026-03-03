# Sprint 117 — Retention & Onboarding + Weekly Digest Email

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/email.ts`,
> `emails/WeeklyDigest.tsx`, `app/dashboard/page.tsx`,
> `app/dashboard/layout.tsx`

---

## 🎯 Objective

Build **Retention & Onboarding + Weekly Digest Email** — eliminate the empty-dashboard experience for new users, add guided onboarding state tracking, and complete the `WeeklyDigest.tsx` React Email template that has been a scaffold since launch.

**What this sprint answers:**
- New user: "Why is everything blank? Is this broken?"
- Returning user: "What happened while I was away? Do I need to act on anything?"

**What Sprint 117 delivers:**

**Onboarding:**
- `onboarding_state` table — per-org checklist of setup steps with completion tracking
- `GET /api/onboarding/state` — fetch current onboarding state
- `POST /api/onboarding/state/[step]` — mark a step complete
- `OnboardingChecklist` component — persistent sidebar or dashboard widget showing setup progress
- Sample data mode: new orgs with zero SOV data get a seeded demo dataset (clearly labelled "Sample Data") so the dashboard is never blank on first login
- Auto-dismiss: sample data is hidden once real data arrives (first SOV cron run completes)
- Onboarding interstitial: first-login modal walking users through the 5 setup steps

**Weekly Digest Email:**
- Complete `emails/WeeklyDigest.tsx` — full React Email template replacing the scaffold
- Four sections: SOV score trend, where you were cited, where you're missing, First Mover opportunity (conditional)
- `buildWeeklyDigestPayload()` — data assembly service (pure after DB fetches)
- `sendWeeklyDigest()` — wired into the existing SOV cron (`app/api/cron/sov/route.ts`) — called after SOV completes per org
- Send gate: only send if SOV changed ≥ 2 points OR a new First Mover Alert exists (no spam)
- Unsubscribe token: every digest email has a one-click unsubscribe link
- `email_preferences` table — per-user unsubscribe state for digest emails

**What this sprint does NOT build:** in-app notification center (separate from toasts), user-configurable send day/time, digest for non-SOV events (hallucination reports — future).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                                       — All rules (54 rules as of Sprint 116)
Read CLAUDE.md                                         — Full implementation inventory
Read lib/email.ts                                      — CRITICAL: sendSOVReport(), Resend setup,
                                                         existing email send patterns
Read emails/WeeklyDigest.tsx                           — CRITICAL: read the scaffold completely.
                                                         Understand what's built vs what's a stub.
Read app/api/cron/sov/route.ts                         — Where sendWeeklyDigest() will be called
Read app/dashboard/page.tsx                            — Main dashboard — add OnboardingChecklist here
Read app/dashboard/layout.tsx                          — Dashboard layout
Read supabase/prod_schema.sql
  § FIND: organizations — plan_tier, created_at, any onboarding columns
  § FIND: sov_evaluations or sov_snapshots — what SOV history data looks like
  § FIND: sov_first_mover_alerts — columns, status enum
  § FIND: content_drafts — trigger_type, status columns
  § FIND: target_queries or sov_target_queries — query_text, query_category
  § FIND: hallucination_events or similar — count for onboarding
Read lib/supabase/database.types.ts                   — All current types
Read src/__fixtures__/golden-tenant.ts                 — All existing fixtures
Read supabase/seed.sql                                 — Existing seed pattern
```

**Specifically understand before writing code:**

1. **`emails/WeeklyDigest.tsx` is a scaffold — read it completely first.** The file exists with React Email component imports and a rough structure. Understand exactly what's stubbed vs what renders. You are REPLACING the scaffold body with the full implementation — do not delete the file and recreate it. Edit it in place, preserving any imports that are already correct.

2. **`sendSOVReport()` already exists in `lib/email.ts`.** Read it to understand the Resend client initialization, the `from` address, and the error handling pattern. `sendWeeklyDigest()` must follow the exact same pattern — same Resend client, same error handling, same `from` address.

3. **SOV history data shape.** Before writing `buildWeeklyDigestPayload()`, read `prod_schema.sql` carefully to understand exactly what SOV data is available. Find: the table that stores weekly SOV snapshots or evaluations, the columns that give you `share_of_voice` (current and previous), the `sov_first_mover_alerts` table structure, and the `target_queries` table for `query_text`.

4. **Sample data must be clearly labelled.** Every component that renders sample data shows a `SampleDataBanner` — a prominent yellow/amber bar: "This is sample data. Your real data will appear after your first AI visibility scan." Do NOT make sample data look like real data. Users who think sample data is real will be confused when it disappears.

5. **Onboarding steps are org-scoped, not user-scoped.** The 5 setup steps (business profile, first location, first scan, first content draft, invite a teammate) are tracked per org. Any member can complete any step. When one member completes a step, it's complete for the whole org.

6. **`email_preferences` unsubscribe token.** The token must be cryptographically random (32 bytes → 64 hex chars). It is stored in `email_preferences.unsubscribe_token`. The unsubscribe URL is `/unsubscribe?token={token}`. The public route `GET /api/email/unsubscribe?token={token}` processes it — sets `digest_unsubscribed = true`. No auth required (one-click unsubscribe).

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/onboarding/
  index.ts                        — barrel export
  types.ts                        — OnboardingStep, OnboardingState, ONBOARDING_STEPS
  onboarding-service.ts           — DB operations for onboarding state
  sample-data.ts                  — Sample dataset for empty-state dashboards

lib/digest/
  index.ts                        — barrel export
  types.ts                        — WeeklyDigestPayload, DigestSovSection, etc.
  digest-service.ts               — buildWeeklyDigestPayload() (pure after DB fetches)
  send-gate.ts                    — shouldSendDigest() (pure predicate)

emails/
  WeeklyDigest.tsx                — MODIFY: replace scaffold with full template
  components/
    DigestHeader.tsx              — Reusable email header with brand + org name
    SovScoreBlock.tsx             — SOV % + trend arrow block
    CitationList.tsx              — "Where you were cited" list
    MissedQueryList.tsx           — "Where you're missing" list
    FirstMoverAlert.tsx           — Conditional first mover opportunity block

app/api/
  onboarding/
    state/
      route.ts                    — GET onboarding state
      [step]/
        route.ts                  — POST mark step complete
  email/
    unsubscribe/
      route.ts                    — GET one-click unsubscribe (public, no auth)

app/dashboard/
  _components/
    OnboardingChecklist.tsx       — Setup progress widget
    OnboardingInterstitial.tsx    — First-login modal
    SampleDataBanner.tsx          — "This is sample data" banner
    SampleDashboard.tsx           — Full demo state for empty orgs

app/unsubscribe/
  page.tsx                        — Unsubscribe confirmation page (public)
```

---

### Component 1: Onboarding Types — `lib/onboarding/types.ts`

```typescript
export type OnboardingStepId =
  | 'business_profile'    // org name, industry, location added
  | 'first_scan'          // first SOV cron has completed
  | 'first_draft'         // first content_draft exists
  | 'invite_teammate'     // at least one org_member besides owner exists
  | 'connect_domain';     // custom domain configured (Sprint 114)

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  description: string;
  action_label: string;
  action_url: string;
  // Can this step be auto-completed by the system (vs requires user action)?
  auto_completable: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'business_profile',
    label: 'Complete your business profile',
    description: 'Add your business name, industry, and first location.',
    action_label: 'Set up profile',
    action_url: '/dashboard/settings/profile',
    auto_completable: false,
  },
  {
    id: 'first_scan',
    label: 'Run your first AI visibility scan',
    description: 'See how AI models answer questions about your business.',
    action_label: 'View your score',
    action_url: '/dashboard/visibility',
    auto_completable: true,  // completed by SOV cron
  },
  {
    id: 'first_draft',
    label: 'Review your first content recommendation',
    description: 'LocalVector has generated content to improve your AI presence.',
    action_label: 'Review drafts',
    action_url: '/dashboard/content',
    auto_completable: true,  // completed when first content_draft exists
  },
  {
    id: 'invite_teammate',
    label: 'Invite a teammate',
    description: 'Collaborate with your team on AI visibility strategy.',
    action_label: 'Invite team',
    action_url: '/dashboard/team',
    auto_completable: false,
  },
  {
    id: 'connect_domain',
    label: 'Connect your custom domain',
    description: 'White-label LocalVector under your own brand.',
    action_label: 'Set up domain',
    action_url: '/dashboard/settings/domain',
    auto_completable: false,
  },
];

export interface OnboardingStepState {
  step_id: OnboardingStepId;
  completed: boolean;
  completed_at: string | null;
  completed_by_user_id: string | null;
}

export interface OnboardingState {
  org_id: string;
  steps: OnboardingStepState[];
  total_steps: number;
  completed_steps: number;
  is_complete: boolean;        // all 5 steps done
  show_interstitial: boolean;  // true if < 2 steps complete AND org < 7 days old
  has_real_data: boolean;      // true if first_scan is complete
}
```

---

### Component 2: Migration — `supabase/migrations/[timestamp]_onboarding_digest.sql`

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 117: Onboarding State + Email Preferences
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. onboarding_steps table
CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_id               text          NOT NULL
                                      CHECK (step_id IN (
                                        'business_profile', 'first_scan', 'first_draft',
                                        'invite_teammate', 'connect_domain'
                                      )),
  completed             boolean       NOT NULL DEFAULT false,
  completed_at          timestamptz,
  completed_by_user_id  uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz   NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, step_id)
);

COMMENT ON TABLE public.onboarding_steps IS
  'Per-org onboarding checklist state. Sprint 117. '
  'Steps are org-scoped — any member completing a step marks it done for all.';

ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

-- All org members can read onboarding state
CREATE POLICY "onboarding_steps: members can read"
  ON public.onboarding_steps FOR SELECT
  USING (org_id = public.current_user_org_id());

-- Any org member can mark a step complete (INSERT or UPDATE)
CREATE POLICY "onboarding_steps: members can insert"
  ON public.onboarding_steps FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "onboarding_steps: members can update"
  ON public.onboarding_steps FOR UPDATE
  USING (org_id = public.current_user_org_id());

-- Service role full access (auto-completion by cron)
CREATE POLICY "onboarding_steps: service role full access"
  ON public.onboarding_steps
  USING (auth.role() = 'service_role');

-- 2. email_preferences table (one row per user per org)
CREATE TABLE IF NOT EXISTS public.email_preferences (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id                uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  digest_unsubscribed   boolean       NOT NULL DEFAULT false,
  -- Cryptographically random token for one-click unsubscribe
  -- Format: 64 hex chars (32 random bytes)
  unsubscribe_token     text          NOT NULL UNIQUE
                                      DEFAULT encode(gen_random_bytes(32), 'hex'),
  unsubscribed_at       timestamptz,
  created_at            timestamptz   NOT NULL DEFAULT NOW(),
  updated_at            timestamptz   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

COMMENT ON TABLE public.email_preferences IS
  'Per-user per-org email preferences. Sprint 117. '
  'unsubscribe_token is used for one-click unsubscribe in digest emails. '
  'digest_unsubscribed blocks the weekly digest from being sent.';

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- User can read and update their own preferences
CREATE POLICY "email_preferences: user can read own"
  ON public.email_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "email_preferences: user can update own"
  ON public.email_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "email_preferences: user can insert own"
  ON public.email_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Service role full access (digest sending + unsubscribe route)
CREATE POLICY "email_preferences: service role full access"
  ON public.email_preferences
  USING (auth.role() = 'service_role');

-- Public read for unsubscribe token lookup (no auth)
-- The unsubscribe endpoint queries by token without a user session.
-- We use a restrictive policy that only allows lookup by token match.
-- Note: this policy allows SELECT on the specific row whose token matches
-- a query parameter. In practice this requires service role from the API route.
-- The unsubscribe API route uses service role — this policy is belt-and-suspenders.

-- 3. Backfill email_preferences for existing org members
-- Create a row for each existing org member (owner) so they have an unsubscribe token.
INSERT INTO public.email_preferences (user_id, org_id)
SELECT om.user_id, om.org_id
FROM public.org_members om
WHERE om.role = 'owner'
ON CONFLICT (user_id, org_id) DO NOTHING;

-- 4. Backfill onboarding_steps for existing orgs
-- Existing orgs that have SOV data are considered past the 'first_scan' step.
-- We'll mark all steps incomplete for existing orgs — onboarding-service.ts
-- will auto-check and complete steps on first load.
INSERT INTO public.onboarding_steps (org_id, step_id, completed)
SELECT o.id, steps.step_id, false
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('business_profile'),
    ('first_scan'),
    ('first_draft'),
    ('invite_teammate'),
    ('connect_domain')
) AS steps(step_id)
ON CONFLICT (org_id, step_id) DO NOTHING;
```

---

### Component 3: Onboarding Service — `lib/onboarding/onboarding-service.ts`

```typescript
/**
 * Pure onboarding service. Caller passes Supabase client.
 *
 * ── getOnboardingState(supabase, orgId) ──────────────────────────────────────
 * 1. SELECT all rows from onboarding_steps WHERE org_id = $orgId
 * 2. If no rows exist: call initOnboardingSteps(supabase, orgId) first
 * 3. Run auto-completion checks (see below)
 * 4. Compute is_complete, show_interstitial, has_real_data
 * 5. Return OnboardingState
 *
 * show_interstitial logic:
 *   completed_steps < 2
 *   AND org was created_at < 7 days ago
 *   AND user has not explicitly dismissed (no dismissal tracking in Sprint 117
 *       — use localStorage on the client, not DB)
 *
 * ── initOnboardingSteps(supabase, orgId) ─────────────────────────────────────
 * INSERT 5 rows into onboarding_steps for the org (one per step_id).
 * ON CONFLICT DO NOTHING. Returns void.
 * Called lazily on first getOnboardingState() call.
 *
 * ── markStepComplete(supabase, orgId, stepId, userId) ────────────────────────
 * UPDATE onboarding_steps SET
 *   completed = true, completed_at = NOW(), completed_by_user_id = $userId
 * WHERE org_id = $orgId AND step_id = $stepId AND completed = false
 * Returns the updated OnboardingStepState.
 * Idempotent — no error if already complete.
 *
 * ── autoCompleteSteps(supabase, orgId) ───────────────────────────────────────
 * Checks real DB state to auto-complete eligible steps.
 * Called within getOnboardingState().
 * Service role client required (reads across tables).
 *
 * Auto-completion checks:
 *
 * 'first_scan':
 *   SELECT 1 FROM sov_evaluations (or whatever the SOV results table is)
 *   WHERE org_id = $orgId LIMIT 1
 *   If exists → markStepComplete(supabase, orgId, 'first_scan', null)
 *   (null userId = system completion)
 *
 * 'first_draft':
 *   SELECT 1 FROM content_drafts WHERE org_id = $orgId LIMIT 1
 *   If exists → markStepComplete(supabase, orgId, 'first_draft', null)
 *
 * 'invite_teammate':
 *   SELECT COUNT(*) FROM org_members WHERE org_id = $orgId
 *   If count > 1 → markStepComplete(supabase, orgId, 'invite_teammate', null)
 *
 * 'connect_domain':
 *   SELECT 1 FROM org_domains
 *   WHERE org_id = $orgId AND domain_type = 'custom'
 *     AND verification_status = 'verified'
 *   If exists → markStepComplete(supabase, orgId, 'connect_domain', null)
 *
 * 'business_profile':
 *   NOT auto-completable. Requires explicit user action via POST /api/onboarding/state/business_profile.
 *   But check: if organizations.name is not null/empty AND locations count > 0
 *   → auto-complete. Reasonable heuristic for existing orgs.
 *
 * IMPORTANT: Read prod_schema.sql to find the EXACT table and column names
 * for SOV results before writing these queries. The table may be called
 * sov_evaluations, sov_snapshots, sov_results, or similar.
 */
```

---

### Component 4: Sample Data — `lib/onboarding/sample-data.ts`

```typescript
/**
 * Sample data for new orgs with no real SOV data.
 * Shown when has_real_data = false (first_scan not complete).
 * All sample data is clearly labelled in the UI with SampleDataBanner.
 *
 * SAMPLE_SOV_DATA: object matching the SOV dashboard data shape.
 * Use realistic-looking but clearly fictional values.
 * Business name: "Your Business" (generic — not org-specific)
 * SOV score: 34 (first run — room for improvement, motivating)
 * Last week: 29 (positive trend — shows the product working)
 * Total queries tracked: 12
 * Cited in: 4 queries (the motivating examples)
 * Missing from: 8 queries (the opportunity)
 *
 * SAMPLE_CITATION_EXAMPLES: array of 4 query examples where the business was cited.
 * Use realistic question formats matching the product's query library.
 * Example: "best hookah lounge near downtown Atlanta" → "Cited as top pick"
 *
 * SAMPLE_MISSING_QUERIES: array of 4 queries not yet winning.
 * Example: "hookah bar with food options" → "Not yet cited — content opportunity"
 *
 * SAMPLE_CONTENT_DRAFT: one example content draft (not created in DB — pure display).
 * Title: "Why [Business Name] Is Atlanta's Best Hookah Experience"
 * Status: draft
 * trigger_type: 'sov_gap'
 *
 * SAMPLE_FIRST_MOVER_ALERT: one example alert.
 * query_text: "hookah lounge for private events"
 * message: "No business is being recommended for this query. Be first."
 *
 * ── isSampleData(): boolean ────────────────────────────────────────────────
 * Pure function. Returns true if the passed data object is the sample dataset
 * (check by a sentinel property: { _is_sample: true }).
 * Used by components to conditionally show SampleDataBanner.
 */
```

---

### Component 5: Digest Types — `lib/digest/types.ts`

```typescript
export interface DigestSovTrend {
  current_sov: number;       // e.g. 42.0
  previous_sov: number;      // previous week
  delta: number;             // current - previous (can be negative)
  trend: 'up' | 'down' | 'flat'; // up if delta >= 2, down if <= -2, flat otherwise
  total_queries: number;
  cited_count: number;
}

export interface DigestCitation {
  query_text: string;
  cited_at: string; // ISO date
}

export interface DigestMissedQuery {
  query_text: string;
  competitor_cited: string | null; // name of competitor that was cited, if any
}

export interface DigestFirstMoverAlert {
  query_text: string;
  detected_at: string;
  action_url: string;   // link to create content for this query
}

export interface WeeklyDigestPayload {
  org_id: string;
  org_name: string;
  recipient_email: string;
  recipient_name: string | null;
  unsubscribe_token: string;
  week_of: string;             // ISO date string for the week start (Monday)
  sov_trend: DigestSovTrend;
  citations: DigestCitation[];   // where the business was cited this week (max 5)
  missed_queries: DigestMissedQuery[]; // top missed (max 3)
  first_mover_alert: DigestFirstMoverAlert | null; // null if none this week
  // Theme from Sprint 115 (logo + primary color for branded email)
  org_logo_url: string | null;
  org_primary_color: string;    // default '#6366f1'
  org_text_on_primary: string;  // default '#ffffff'
}

export interface DigestSendResult {
  sent: boolean;
  skipped: boolean;
  skip_reason?: 'unsubscribed' | 'send_gate_not_met' | 'no_sov_data' | 'resend_error';
  message_id?: string;
}
```

---

### Component 6: Digest Service — `lib/digest/digest-service.ts`

```typescript
/**
 * Data assembly for the weekly digest. Pure after DB fetches.
 *
 * ── buildWeeklyDigestPayload(supabase, orgId, recipientUserId) ───────────────
 * Assembles the complete WeeklyDigestPayload for one recipient.
 *
 * DB reads required (read prod_schema.sql to get exact table/column names):
 *
 * 1. Org info:
 *    SELECT name FROM organizations WHERE id = $orgId
 *
 * 2. Recipient info:
 *    SELECT email, raw_user_meta_data->>'full_name' FROM auth.users WHERE id = $recipientUserId
 *
 * 3. Unsubscribe token:
 *    SELECT unsubscribe_token FROM email_preferences
 *    WHERE user_id = $recipientUserId AND org_id = $orgId
 *    If not found: INSERT new row (lazy creation), return generated token
 *
 * 4. SOV trend:
 *    Read the SOV results table to get:
 *    - Current week's share_of_voice for the org
 *    - Previous week's share_of_voice
 *    - total_queries evaluated, cited_count
 *    IMPORTANT: Read prod_schema.sql to find the exact SOV table structure.
 *    The table may store one row per cron run with a timestamp.
 *    "Current week" = most recent row. "Previous week" = second most recent.
 *
 * 5. Citations (where cited this week):
 *    Read SOV evaluation results for the current week where our business appeared.
 *    Return up to 5, with query_text and evaluated_at as cited_at.
 *
 * 6. Missed queries (top 3 where competitors appeared but we didn't):
 *    Return the 3 queries where our business was NOT cited this week,
 *    with competitor name if available. Prioritize queries where a competitor
 *    WAS cited (the most actionable misses).
 *
 * 7. First Mover Alert (most recent unactioned):
 *    SELECT * FROM sov_first_mover_alerts
 *    WHERE org_id = $orgId AND status = 'new'
 *    ORDER BY detected_at DESC LIMIT 1
 *    If found: action_url = '/dashboard/content/new?query=' + encodeURIComponent(query_text)
 *
 * 8. Org theme (Sprint 115):
 *    SELECT logo_url, primary_color, text_on_primary FROM org_themes
 *    WHERE org_id = $orgId
 *    Use defaults if no theme row.
 *
 * Returns WeeklyDigestPayload.
 * Throws if org or recipient not found.
 *
 * ── getDigestRecipients(supabase, orgId) ─────────────────────────────────────
 * Returns array of { user_id, email, full_name } for all org members
 * who have NOT unsubscribed from the digest.
 *
 * SELECT au.id, au.email, au.raw_user_meta_data->>'full_name' AS full_name
 * FROM org_members om
 * JOIN auth.users au ON au.id = om.user_id
 * LEFT JOIN email_preferences ep ON ep.user_id = om.user_id AND ep.org_id = om.org_id
 * WHERE om.org_id = $orgId
 *   AND (ep.digest_unsubscribed IS NULL OR ep.digest_unsubscribed = false)
 */
```

---

### Component 7: Send Gate — `lib/digest/send-gate.ts`

```typescript
/**
 * Pure predicate — zero DB calls. All data passed in.
 *
 * shouldSendDigest(params: {
 *   sov_delta: number;           // current_sov - previous_sov
 *   has_first_mover_alert: boolean;
 *   is_first_digest: boolean;    // first digest ever sent for this org
 * }): { should_send: boolean; reason: string }
 *
 * Send conditions (OR logic — any one is sufficient):
 * 1. is_first_digest = true → always send (welcome digest)
 * 2. |sov_delta| >= 2 → significant change worth reporting
 * 3. has_first_mover_alert = true → actionable opportunity available
 *
 * Returns { should_send: false, reason: 'send_gate_not_met' } if none apply.
 *
 * ── isFirstDigest(supabase, orgId) ───────────────────────────────────────────
 * Checks whether this org has ever had a digest sent.
 * Uses a simple sentinel: check if any email_preferences row for this org
 * has last_digest_sent_at populated.
 * Or: check organizations table for a digest_last_sent_at column (see migration).
 *
 * Add to organizations table:
 *   digest_last_sent_at timestamptz — null means never sent
 *
 * Returns true if digest_last_sent_at IS NULL.
 */
```

---

### Component 8: `sendWeeklyDigest()` — add to `lib/email.ts`

```typescript
/**
 * MODIFY lib/email.ts to add sendWeeklyDigest().
 *
 * Follow the EXACT same pattern as sendSOVReport() — same Resend client,
 * same from address, same error handling.
 *
 * sendWeeklyDigest(payload: WeeklyDigestPayload): Promise<DigestSendResult>
 *
 * 1. Check shouldSendDigest():
 *    { should_send, reason } = shouldSendDigest({
 *      sov_delta: payload.sov_trend.delta,
 *      has_first_mover_alert: payload.first_mover_alert !== null,
 *      is_first_digest: false  // caller determines this
 *    })
 *    If !should_send → return { sent: false, skipped: true, skip_reason: reason }
 *
 * 2. Render WeeklyDigest React Email component to HTML string.
 *
 * 3. Send via Resend:
 *    subject: `Your AI Visibility Report — Week of ${formatWeekOf(payload.week_of)}`
 *    from: (same from address as sendSOVReport)
 *    to: payload.recipient_email
 *    html: rendered HTML
 *
 * 4. On success: return { sent: true, skipped: false, message_id }
 *    Also: UPDATE organizations SET digest_last_sent_at = NOW()
 *          (fire-and-forget via void)
 *
 * 5. On Resend error: return { sent: false, skipped: false, skip_reason: 'resend_error' }
 *    Never throw.
 *
 * ── formatWeekOf(isoDate: string): string ─────────────────────────────────────
 * Pure function. Input: '2026-03-02' → Output: 'March 2, 2026'
 * Used in both email subject and template body.
 */
```

---

### Component 9: SOV Cron Update — `app/api/cron/sov/route.ts`

```typescript
/**
 * MODIFY the SOV cron to call sendWeeklyDigest() after completion.
 * Read the cron file completely before modifying.
 *
 * After notifyOrg() (Sprint 116) and after all SOV work for the org is done:
 *
 * // Send weekly digest to all recipients
 * const recipients = await getDigestRecipients(serviceClient, orgId);
 * const isFirst = await isFirstDigest(serviceClient, orgId);
 *
 * for (const recipient of recipients) {
 *   const payload = await buildWeeklyDigestPayload(
 *     serviceClient, orgId, recipient.user_id
 *   );
 *   void sendWeeklyDigest({ ...payload, is_first_digest: isFirst });
 * }
 *
 * Fire-and-forget with void. Never await in the cron response path.
 * The cron returns 200 regardless of email send results.
 *
 * DO NOT change any existing SOV cron logic.
 */
```

---

### Component 10: Weekly Digest Email — `emails/WeeklyDigest.tsx`

```typescript
/**
 * REPLACE the scaffold with the full React Email template.
 *
 * Read the existing scaffold COMPLETELY before editing.
 * Preserve any correct imports. Replace the render output entirely.
 *
 * Props: WeeklyDigestPayload
 *
 * Template sections:
 *
 * ── HEADER ────────────────────────────────────────────────────────────────────
 * Background: org_primary_color (default #6366f1)
 * Text: org_text_on_primary (default #ffffff)
 * If org_logo_url: <Img> max-width 120px, centered
 * Org name as heading
 * "Your AI Visibility Report — Week of {formatWeekOf(week_of)}"
 *
 * ── SOV SCORE BLOCK ──────────────────────────────────────────────────────────
 * Large: "34%" (current_sov formatted as integer %)
 * Trend arrow: ↑ if trend='up' (green), ↓ if 'down' (red), → if 'flat' (gray)
 * Delta text: "+5 points this week" or "-3 points this week" or "No change"
 * Subtext: "Based on {total_queries} AI queries tracked"
 *
 * ── WHERE YOU WERE CITED ─────────────────────────────────────────────────────
 * Section heading: "✅ Where AI recommended you this week"
 * If citations.length === 0: "No citations this week. See opportunities below."
 * Else: list of up to 5 query_text items, each on its own row
 *   Format: "• When asked '{query_text}' — your business was recommended"
 *
 * ── WHERE YOU'RE MISSING ─────────────────────────────────────────────────────
 * Section heading: "📍 Where you're not yet being recommended"
 * List of up to 3 missed_queries:
 *   If competitor_cited: "• '{query_text}' — {competitor_cited} was recommended instead"
 *   Else: "• '{query_text}' — no local business is being recommended"
 * CTA button: "Create Content to Win These Queries →"
 *   href: '/dashboard/content'
 *   Background: org_primary_color
 *   Text: org_text_on_primary
 *
 * ── FIRST MOVER ALERT (conditional) ─────────────────────────────────────────
 * Only render if first_mover_alert !== null
 * Yellow/amber background box
 * "🚀 First Mover Opportunity"
 * "No business is being recommended when people ask: '{query_text}'"
 * "Be the first to create content for this query before your competitors do."
 * CTA button: "Claim This Query →"
 *   href: first_mover_alert.action_url
 *
 * ── FOOTER ───────────────────────────────────────────────────────────────────
 * "You're receiving this because you're a member of {org_name} on LocalVector."
 * Unsubscribe link: "/api/email/unsubscribe?token={unsubscribe_token}"
 *   Text: "Unsubscribe from weekly reports"
 * "Powered by LocalVector" (if show_powered_by — default true)
 *
 * IMPORTANT: Use React Email components (@react-email/components):
 * Html, Head, Preview, Body, Container, Section, Heading, Text, Link, Img, Hr, Button
 * Check which ones are already imported in the scaffold and use the same set.
 *
 * All colors as inline styles (React Email requires this).
 * No external CSS. No Tailwind.
 * Max width: 600px container.
 */
```

---

### Component 11: API Routes

#### `app/api/onboarding/state/route.ts`

```typescript
/**
 * GET /api/onboarding/state
 * Returns OnboardingState for the authenticated user's org.
 * All org members can view.
 *
 * Calls getOnboardingState(serviceClient, orgId).
 * Uses service role client so autoCompleteSteps() can read across tables.
 *
 * Response: OnboardingState
 *
 * Error codes:
 * - 401: not authenticated
 */
```

#### `app/api/onboarding/state/[step]/route.ts`

```typescript
/**
 * POST /api/onboarding/state/[step]
 * Marks an onboarding step complete.
 * Any org member can mark any step complete (steps are org-scoped).
 *
 * Params: step = OnboardingStepId
 * Validation: step must be in ONBOARDING_STEPS map → 400 'invalid_step'
 *
 * Calls markStepComplete(supabase, orgId, step, userId).
 * Returns: { ok: true; step: OnboardingStepState }
 *
 * Error codes:
 * - 400: invalid_step
 * - 401: not authenticated
 */
```

#### `app/api/email/unsubscribe/route.ts`

```typescript
/**
 * GET /api/email/unsubscribe?token={token}
 * One-click unsubscribe from weekly digest emails.
 * PUBLIC — no auth required.
 *
 * Flow:
 * 1. Validate token: non-empty, 64 hex chars → 400 'invalid_token'
 * 2. Look up: SELECT * FROM email_preferences WHERE unsubscribe_token = $token
 *    Use service role client (no user session).
 *    If not found → 404 'token_not_found'
 * 3. If already unsubscribed → redirect to /unsubscribe?already=true
 * 4. UPDATE email_preferences SET digest_unsubscribed = true, unsubscribed_at = NOW()
 * 5. Redirect to /unsubscribe?success=true
 *
 * This is a GET (not POST) because email clients pre-fetch links and some
 * automatically follow them. Standard unsubscribe pattern for email.
 *
 * Note: Add /api/email/unsubscribe to middleware.ts public routes allowlist.
 * This is an AUTHORIZED middleware.ts edit (public route addition, same as Sprint 112).
 */
```

---

### Component 12: Unsubscribe Confirmation Page — `app/unsubscribe/page.tsx`

```typescript
/**
 * PUBLIC server component.
 * Route: /unsubscribe?success=true OR ?already=true
 *
 * success=true: "You've been unsubscribed. You won't receive weekly AI visibility
 *   reports anymore. You can re-subscribe in your settings."
 *   [Go to Dashboard →]
 *
 * already=true: "You're already unsubscribed from weekly reports."
 *   [Go to Dashboard →]
 *
 * No params: "Invalid unsubscribe link. If you need help, contact support."
 *
 * Simple, clean page. No auth required. Brand-neutral (no org theming).
 * Add /unsubscribe to middleware.ts public routes (same authorized edit as above).
 */
```

---

### Component 13: OnboardingChecklist — `app/dashboard/_components/OnboardingChecklist.tsx`

```typescript
/**
 * 'use client'
 * Fetches from GET /api/onboarding/state on mount.
 * Shows on the main dashboard page (/dashboard) until all steps complete.
 * Hides permanently when is_complete = true.
 *
 * Layout: collapsible card below the main dashboard header.
 * Header: "Getting Started ({completed_steps}/{total_steps})"
 * Progress bar: filled portion = completed_steps / total_steps
 *   Use bg-indigo-600 (or var(--brand-primary) — CSS custom property from Sprint 115)
 *
 * Step list: each ONBOARDING_STEPS entry rendered as:
 * ✅ [label]                    (completed — green check, strikethrough text)
 * ○  [label]  [action_label →]  (incomplete — action link)
 *
 * Clicking [action_label →]: navigates to action_url (router.push).
 * For auto_completable steps: no action link shown ("Will complete automatically")
 * Exception: 'first_scan' shows "Scan runs every Sunday. First scan pending."
 *
 * Marking manual steps complete:
 * 'business_profile' and 'invite_teammate' and 'connect_domain' have action links.
 * After the user navigates to the action URL and returns, the checklist re-fetches
 * automatically (poll every 30 seconds while visible, or on window focus).
 *
 * Dismiss: small [✕] button in corner hides the checklist for the session
 * (localStorage: 'lv_onboarding_dismissed'). Does NOT mark steps complete.
 * Reappears on next session if still incomplete.
 *
 * data-testid:
 *   "onboarding-checklist"
 *   "onboarding-step-{stepId}"
 *   "onboarding-step-{stepId}-action"
 *   "onboarding-progress-bar"
 *   "onboarding-dismiss-btn"
 */
```

---

### Component 14: OnboardingInterstitial — `app/dashboard/_components/OnboardingInterstitial.tsx`

```typescript
/**
 * 'use client'
 * Full-screen modal overlay shown on first login.
 * Only shown when show_interstitial = true from OnboardingState.
 *
 * Condition: show_interstitial = (completed_steps < 2 AND org < 7 days old)
 * Dismissed: localStorage 'lv_interstitial_dismissed' = 'true'
 *   Set on dismiss. Not shown again even if show_interstitial remains true.
 *
 * Content:
 * "Welcome to LocalVector 👋"
 * "Here's how to get the most out of your AI visibility platform in 5 minutes:"
 *
 * Steps 1-3 (simplified):
 *   1. "Complete your profile" → "So we know which AI queries to track"
 *   2. "Your first scan runs Sunday" → "We'll email you when your score is ready"
 *   3. "Review content recommendations" → "AI-generated drafts to improve visibility"
 *
 * CTA: [Let's get started →] → dismisses modal, navigates to /dashboard/settings/profile
 * Secondary: [Skip for now] → dismisses modal only
 *
 * Uses React createPortal to render over the dashboard.
 * Semi-transparent backdrop.
 *
 * data-testid:
 *   "onboarding-interstitial"
 *   "onboarding-interstitial-cta"
 *   "onboarding-interstitial-skip"
 */
```

---

### Component 15: SampleDataBanner — `app/dashboard/_components/SampleDataBanner.tsx`

```typescript
/**
 * Pure display component. No state. No API calls.
 * Renders when has_real_data = false.
 *
 * Amber/yellow banner, full-width, at the top of the dashboard content area:
 *
 * "📊 You're viewing sample data.
 *  Your real AI visibility data will appear here after your first scan (runs every Sunday)."
 *
 * No dismiss button — it disappears automatically when real data arrives
 * (has_real_data flips to true after first_scan step completes).
 *
 * data-testid: "sample-data-banner"
 */
```

---

### Component 16: SampleDashboard — `app/dashboard/_components/SampleDashboard.tsx`

```typescript
/**
 * 'use client'
 * Full demo state for orgs with no real SOV data.
 * Renders SAMPLE_SOV_DATA, SAMPLE_CITATION_EXAMPLES, etc. from sample-data.ts.
 *
 * Used in app/dashboard/page.tsx when has_real_data = false.
 * The real dashboard component is rendered when has_real_data = true.
 *
 * Shows: mock SOV score (34%), mock citations list, mock missed queries,
 *        mock content draft card, mock first mover alert.
 *
 * Every section is visually identical to the real dashboard but with
 * SAMPLE_* data. SampleDataBanner is shown above the whole thing.
 *
 * This is NOT a separate page — it renders in the same layout as the real
 * dashboard, just with sample data injected.
 *
 * data-testid:
 *   "sample-dashboard"
 *   "sample-sov-score"
 *   "sample-citation-list"
 */
```

---

### Component 17: Dashboard Page Update — `app/dashboard/page.tsx`

```typescript
/**
 * MODIFY app/dashboard/page.tsx.
 * Read the current dashboard page completely first.
 *
 * Add at the top (server component logic):
 * 1. Fetch onboarding state: const onboardingState = await getOnboardingState(serviceClient, orgId)
 *
 * 2. Conditional rendering:
 *    if (!onboardingState.has_real_data) {
 *      return (
 *        <>
 *          <SampleDataBanner />
 *          <SampleDashboard />
 *          <OnboardingChecklist onboardingState={onboardingState} />
 *          <OnboardingInterstitial show={onboardingState.show_interstitial} />
 *        </>
 *      )
 *    }
 *
 * 3. Real data path: existing dashboard content PLUS:
 *    <OnboardingChecklist onboardingState={onboardingState} />
 *    (hidden via is_complete check inside the component)
 *
 * Minimize changes to the existing dashboard page structure.
 * Only add the onboarding state fetch and the conditional render block.
 */
```

---

### Component 18: Middleware Update — `middleware.ts`

```typescript
/**
 * AUTHORIZED MODIFICATION (public routes only — same pattern as Sprint 112).
 *
 * Add to public routes allowlist:
 * - '/api/email/unsubscribe'
 * - '/unsubscribe'
 * - '/login' (already present — confirm)
 *
 * These routes must be accessible without authentication.
 * Find the existing public routes array/list in middleware.ts and append.
 * Change ONLY the public routes list. Nothing else.
 */
```

---

### Component 19: Seed Data

```sql
-- In supabase/seed.sql — onboarding state for golden tenant

DO $$
DECLARE
  v_org_id   uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_user_id  uuid; -- will be set from org_members
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.org_members
  WHERE org_id = v_org_id AND role = 'owner'
  LIMIT 1;

  -- Mark first 3 steps complete for golden tenant (established org)
  INSERT INTO public.onboarding_steps (
    org_id, step_id, completed, completed_at, completed_by_user_id
  ) VALUES
  (v_org_id, 'business_profile', true, NOW() - INTERVAL '30 days', v_user_id),
  (v_org_id, 'first_scan',       true, NOW() - INTERVAL '29 days', null),
  (v_org_id, 'first_draft',      true, NOW() - INTERVAL '28 days', null),
  (v_org_id, 'invite_teammate',  false, null, null),
  (v_org_id, 'connect_domain',   false, null, null)
  ON CONFLICT (org_id, step_id) DO NOTHING;

  -- Email preferences with unsubscribe token
  INSERT INTO public.email_preferences (user_id, org_id)
  VALUES (v_user_id, v_org_id)
  ON CONFLICT (user_id, org_id) DO NOTHING;

END $$;
```

---

### Component 20: Golden Tenant Fixtures

```typescript
// Sprint 117 — onboarding + digest fixtures
import type { OnboardingState, WeeklyDigestPayload } from '@/lib/onboarding/types';

export const MOCK_ONBOARDING_STATE_IN_PROGRESS: OnboardingState = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  steps: [
    { step_id: 'business_profile', completed: true,  completed_at: '2026-01-01T00:00:00Z', completed_by_user_id: 'golden-user-id' },
    { step_id: 'first_scan',       completed: true,  completed_at: '2026-01-02T00:00:00Z', completed_by_user_id: null },
    { step_id: 'first_draft',      completed: true,  completed_at: '2026-01-03T00:00:00Z', completed_by_user_id: null },
    { step_id: 'invite_teammate',  completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'connect_domain',   completed: false, completed_at: null, completed_by_user_id: null },
  ],
  total_steps: 5,
  completed_steps: 3,
  is_complete: false,
  show_interstitial: false,
  has_real_data: true,
};

export const MOCK_ONBOARDING_STATE_NEW_USER: OnboardingState = {
  org_id: 'new-org-id',
  steps: [
    { step_id: 'business_profile', completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'first_scan',       completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'first_draft',      completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'invite_teammate',  completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'connect_domain',   completed: false, completed_at: null, completed_by_user_id: null },
  ],
  total_steps: 5,
  completed_steps: 0,
  is_complete: false,
  show_interstitial: true,
  has_real_data: false,
};

export const MOCK_WEEKLY_DIGEST_PAYLOAD: WeeklyDigestPayload = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_name: 'Charcoal N Chill',
  recipient_email: 'aruna@charcoalnchill.com',
  recipient_name: 'Aruna Babu',
  unsubscribe_token: 'abc123def456abc123def456abc123def456abc123def456abc123def456ab12',
  week_of: '2026-03-02',
  sov_trend: {
    current_sov: 42,
    previous_sov: 37,
    delta: 5,
    trend: 'up',
    total_queries: 12,
    cited_count: 5,
  },
  citations: [
    { query_text: 'best hookah lounge near Alpharetta', cited_at: '2026-03-01T00:00:00Z' },
    { query_text: 'upscale hookah bar Atlanta', cited_at: '2026-03-01T00:00:00Z' },
  ],
  missed_queries: [
    { query_text: 'hookah bar with private events', competitor_cited: null },
    { query_text: 'Indian fusion restaurant Alpharetta', competitor_cited: 'Zyka Restaurant' },
  ],
  first_mover_alert: {
    query_text: 'hookah lounge open late night',
    detected_at: '2026-03-01T10:00:00Z',
    action_url: '/dashboard/content/new?query=hookah+lounge+open+late+night',
  },
  org_logo_url: null,
  org_primary_color: '#1a1a2e',
  org_text_on_primary: '#ffffff',
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/onboarding-service.test.ts`

**Supabase mocked.**

```
describe('getOnboardingState — Supabase mocked')
  1.  initializes 5 steps if no rows exist (calls initOnboardingSteps)
  2.  returns correct completed_steps count
  3.  is_complete = true when all 5 steps done
  4.  is_complete = false when any step incomplete
  5.  has_real_data = true when first_scan step complete
  6.  has_real_data = false when first_scan not complete
  7.  show_interstitial = true for new org with < 2 steps done
  8.  show_interstitial = false for org > 7 days old

describe('autoCompleteSteps — Supabase mocked')
  9.  auto-completes first_scan when SOV data exists
  10. auto-completes first_draft when content_drafts row exists
  11. auto-completes invite_teammate when org has > 1 member
  12. auto-completes connect_domain when verified custom domain exists
  13. auto-completes business_profile when org name set + location exists
  14. does not auto-complete already-completed steps (idempotent)

describe('markStepComplete — Supabase mocked')
  15. updates completed = true with timestamp and userId
  16. idempotent — no error when step already complete
  17. returns updated OnboardingStepState
```

**17 tests.**

---

### Test File 2: `src/__tests__/unit/digest-service.test.ts`

**Supabase mocked.**

```
describe('shouldSendDigest — pure')
  1.  is_first_digest = true → should_send = true (always)
  2.  sov_delta >= 2 → should_send = true
  3.  sov_delta <= -2 → should_send = true (negative change also significant)
  4.  |sov_delta| < 2 AND no alert AND not first → should_send = false
  5.  has_first_mover_alert = true → should_send = true regardless of delta
  6.  returns skip_reason when should_send = false

describe('buildWeeklyDigestPayload — Supabase mocked')
  7.  includes org name from organizations table
  8.  includes recipient email from auth.users
  9.  creates email_preferences row if not exists (lazy creation)
  10. sov_trend.delta = current - previous sov
  11. sov_trend.trend = 'up' when delta >= 2
  12. sov_trend.trend = 'down' when delta <= -2
  13. sov_trend.trend = 'flat' when |delta| < 2
  14. citations capped at 5
  15. missed_queries capped at 3
  16. first_mover_alert = null when no unactioned alerts
  17. first_mover_alert populated from sov_first_mover_alerts

describe('getDigestRecipients — Supabase mocked')
  18. returns all non-unsubscribed org members
  19. excludes members with digest_unsubscribed = true
  20. includes members with no email_preferences row (default = subscribed)
```

**20 tests.**

---

### Test File 3: `src/__tests__/unit/digest-email.test.ts`

**React Email render + pure functions — no DB mocks needed.**

```
describe('WeeklyDigest email rendering')
  1.  renders without crashing with MOCK_WEEKLY_DIGEST_PAYLOAD
  2.  contains org name in output
  3.  contains SOV score as percentage
  4.  trend up → contains upward arrow (↑ or similar)
  5.  trend down → contains downward arrow
  6.  trend flat → no directional arrow
  7.  citations section renders query_text values
  8.  missed_queries section renders query_text values
  9.  first_mover_alert section renders when alert present
  10. first_mover_alert section absent when alert = null
  11. unsubscribe link contains unsubscribe_token
  12. org_primary_color applied to header background style
  13. org_logo_url present → img tag rendered

describe('formatWeekOf — pure')
  14. '2026-03-02' → 'March 2, 2026'
  15. '2026-01-01' → 'January 1, 2026'
  16. '2026-12-28' → 'December 28, 2026'
```

**16 tests.**

---

### Test File 4: `src/__tests__/unit/onboarding-routes.test.ts`

```
describe('GET /api/onboarding/state')
  1.  returns 401 when not authenticated
  2.  returns OnboardingState shape with all 5 steps

describe('POST /api/onboarding/state/[step]')
  3.  returns 401 when not authenticated
  4.  returns 400 'invalid_step' for unknown step name
  5.  returns { ok: true, step } on success
  6.  any org member can mark a step complete (not owner-only)

describe('GET /api/email/unsubscribe?token={token}')
  7.  returns 400 'invalid_token' for empty token
  8.  returns 400 'invalid_token' for non-hex token
  9.  returns 404 'token_not_found' for unknown valid-format token
  10. redirects to /unsubscribe?already=true if already unsubscribed
  11. sets digest_unsubscribed = true on valid token
  12. redirects to /unsubscribe?success=true on success
  13. no auth required (public route)
```

**13 tests.**

---

### Test File 5: `src/__tests__/e2e/onboarding.spec.ts` — Playwright

```typescript
describe('Onboarding', () => {

  test('New user: sample data banner visible', async ({ page }) => {
    // Mock GET /api/onboarding/state → MOCK_ONBOARDING_STATE_NEW_USER
    // Navigate to /dashboard
    // Assert: data-testid="sample-data-banner" visible
    // Assert: data-testid="sample-dashboard" visible
    // Assert: data-testid="sample-sov-score" shows "34%"
  });

  test('New user: onboarding interstitial shows on first login', async ({ page }) => {
    // Mock onboarding state show_interstitial = true
    // Assert: data-testid="onboarding-interstitial" visible
    // Assert: "Welcome to LocalVector" text visible
  });

  test('Interstitial: CTA navigates to profile settings', async ({ page }) => {
    // Click onboarding-interstitial-cta
    // Assert: navigated to /dashboard/settings/profile
    // Assert: interstitial no longer visible
  });

  test('Interstitial: skip dismisses modal', async ({ page }) => {
    // Click onboarding-interstitial-skip
    // Assert: onboarding-interstitial NOT in DOM
    // Navigate away and back — Assert: interstitial still gone (localStorage)
  });

  test('Established user: real data, checklist visible', async ({ page }) => {
    // Mock onboarding state → MOCK_ONBOARDING_STATE_IN_PROGRESS
    // Navigate to /dashboard
    // Assert: sample-data-banner NOT visible
    // Assert: onboarding-checklist visible (3/5 complete)
    // Assert: progress bar visible
  });

  test('Onboarding checklist: incomplete step shows action link', async ({ page }) => {
    // Mock state in progress (invite_teammate incomplete)
    // Assert: onboarding-step-invite_teammate-action visible
    // Assert: action text includes "Invite team"
  });

  test('Onboarding checklist: dismiss hides for session', async ({ page }) => {
    // Click onboarding-dismiss-btn
    // Assert: onboarding-checklist not visible
  });

  test('Complete org: checklist hidden', async ({ page }) => {
    // Mock all steps complete → is_complete = true
    // Navigate to /dashboard
    // Assert: onboarding-checklist NOT rendered
  });

  test('Unsubscribe: success page renders', async ({ page }) => {
    // Navigate to /unsubscribe?success=true
    // Assert: "You've been unsubscribed" text visible
    // Assert: dashboard link visible
  });
});
```

**9 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/onboarding-service.test.ts   # 17 tests
npx vitest run src/__tests__/unit/digest-service.test.ts       # 20 tests
npx vitest run src/__tests__/unit/digest-email.test.ts         # 16 tests
npx vitest run src/__tests__/unit/onboarding-routes.test.ts    # 13 tests
npx vitest run                                                   # ALL — zero regressions
npx playwright test src/__tests__/e2e/onboarding.spec.ts       # 9 Playwright tests
npx tsc --noEmit                                                 # 0 type errors
```

**Total: 66 Vitest + 9 Playwright = 75 tests**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/onboarding/types.ts` | **CREATE** | OnboardingStepId, ONBOARDING_STEPS (5 steps), OnboardingState |
| 2 | `lib/onboarding/onboarding-service.ts` | **CREATE** | getOnboardingState(), autoCompleteSteps(), markStepComplete() |
| 3 | `lib/onboarding/sample-data.ts` | **CREATE** | SAMPLE_* constants + isSampleData() |
| 4 | `lib/onboarding/index.ts` | **CREATE** | Barrel export |
| 5 | `lib/digest/types.ts` | **CREATE** | DigestSovTrend, WeeklyDigestPayload, DigestSendResult |
| 6 | `lib/digest/digest-service.ts` | **CREATE** | buildWeeklyDigestPayload(), getDigestRecipients() |
| 7 | `lib/digest/send-gate.ts` | **CREATE** | shouldSendDigest() (pure), isFirstDigest() |
| 8 | `lib/digest/index.ts` | **CREATE** | Barrel export |
| 9 | `lib/email.ts` | **MODIFY** | Add sendWeeklyDigest(), formatWeekOf() |
| 10 | `emails/WeeklyDigest.tsx` | **MODIFY** | Replace scaffold with full template |
| 11 | `app/api/onboarding/state/route.ts` | **CREATE** | GET onboarding state |
| 12 | `app/api/onboarding/state/[step]/route.ts` | **CREATE** | POST mark step complete |
| 13 | `app/api/email/unsubscribe/route.ts` | **CREATE** | GET one-click unsubscribe |
| 14 | `app/unsubscribe/page.tsx` | **CREATE** | Unsubscribe confirmation page |
| 15 | `app/dashboard/page.tsx` | **MODIFY** | Add onboarding state fetch + conditional render |
| 16 | `app/dashboard/_components/OnboardingChecklist.tsx` | **CREATE** | Progress widget |
| 17 | `app/dashboard/_components/OnboardingInterstitial.tsx` | **CREATE** | First-login modal |
| 18 | `app/dashboard/_components/SampleDataBanner.tsx` | **CREATE** | "Sample data" amber banner |
| 19 | `app/dashboard/_components/SampleDashboard.tsx` | **CREATE** | Demo state for empty orgs |
| 20 | `app/api/cron/sov/route.ts` | **MODIFY** | Add sendWeeklyDigest() after SOV completion |
| 21 | `middleware.ts` | **MODIFY** | Add /api/email/unsubscribe + /unsubscribe to public routes |
| 22 | `supabase/migrations/[timestamp]_onboarding_digest.sql` | **CREATE** | onboarding_steps + email_preferences tables |
| 23 | `supabase/prod_schema.sql` | **MODIFY** | Append new tables + digest_last_sent_at on organizations |
| 24 | `lib/supabase/database.types.ts` | **MODIFY** | Add new table types |
| 25 | `supabase/seed.sql` | **MODIFY** | Onboarding steps + email_preferences for golden tenant |
| 26 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 3 new fixtures |
| 27 | `src/__tests__/unit/onboarding-service.test.ts` | **CREATE** | 17 tests |
| 28 | `src/__tests__/unit/digest-service.test.ts` | **CREATE** | 20 tests |
| 29 | `src/__tests__/unit/digest-email.test.ts` | **CREATE** | 16 tests |
| 30 | `src/__tests__/unit/onboarding-routes.test.ts` | **CREATE** | 13 tests |
| 31 | `src/__tests__/e2e/onboarding.spec.ts` | **CREATE** | 9 Playwright tests |

**Total: 31 files**

---

## 🚫 What NOT to Do

1. **DO NOT delete and recreate `emails/WeeklyDigest.tsx`** — edit it in place. Read the scaffold completely first. Preserve correct imports. Replace the render body only.

2. **DO NOT make sample data look real** — `SampleDataBanner` is mandatory whenever sample data is displayed. No exceptions. Users confusing sample for real is a retention killer.

3. **DO NOT track onboarding state per-user** — steps are per-org. Any member completing a step marks it done for everyone. The DB table is `UNIQUE (org_id, step_id)`, not `(org_id, user_id, step_id)`.

4. **DO NOT send digest emails for every org member every time** — `shouldSendDigest()` gates send. Only send if: first digest ever, OR SOV changed ≥ 2 points, OR new first mover alert. No spam.

5. **DO NOT await sendWeeklyDigest() in the SOV cron** — use `void`. The cron response must not wait for email delivery.

6. **DO NOT use POST for the unsubscribe endpoint** — use GET. Email clients pre-fetch links. The unsubscribe endpoint must be idempotent and GET-safe.

7. **DO NOT require auth for `/api/email/unsubscribe` or `/unsubscribe`** — these are public routes. Update middleware.ts public routes allowlist.

8. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).

9. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

10. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.

11. **DO NOT add arbitrary CSS to React Email templates** — all styling must be inline styles. React Email components require this. No Tailwind, no external stylesheets.

---

## ✅ Definition of Done

- [ ] `lib/onboarding/types.ts` — OnboardingStepId (5 values), ONBOARDING_STEPS array (5 steps with all fields), OnboardingState, OnboardingStepState
- [ ] `onboarding-service.ts` — getOnboardingState(), initOnboardingSteps(), markStepComplete() (idempotent), autoCompleteSteps() (5 auto-check queries using correct prod_schema table names)
- [ ] `sample-data.ts` — SAMPLE_SOV_DATA, SAMPLE_CITATION_EXAMPLES (4), SAMPLE_MISSING_QUERIES (4), SAMPLE_CONTENT_DRAFT, SAMPLE_FIRST_MOVER_ALERT, isSampleData() pure function, `_is_sample: true` sentinel
- [ ] `lib/digest/types.ts` — DigestSovTrend (with trend: 'up'|'down'|'flat'), WeeklyDigestPayload, DigestSendResult
- [ ] `digest-service.ts` — buildWeeklyDigestPayload() (8 DB reads, lazy email_preferences creation), getDigestRecipients() (excludes unsubscribed)
- [ ] `send-gate.ts` — shouldSendDigest() (pure, 3 OR conditions), isFirstDigest()
- [ ] `lib/email.ts` MODIFIED — sendWeeklyDigest() (same pattern as sendSOVReport, never throws), formatWeekOf() (pure)
- [ ] `emails/WeeklyDigest.tsx` MODIFIED — all 5 sections: header (branded), SOV score + trend, citations, missed queries, first mover alert (conditional), footer with unsubscribe link
- [ ] `GET /api/onboarding/state` — returns OnboardingState, uses service role for auto-complete checks
- [ ] `POST /api/onboarding/state/[step]` — validates step, any member can complete, returns updated step
- [ ] `GET /api/email/unsubscribe?token` — public, validates token format (64 hex), sets digest_unsubscribed=true, redirects
- [ ] `/unsubscribe` page — 3 states: success, already, invalid
- [ ] `app/dashboard/page.tsx` MODIFIED — fetches onboarding state, renders SampleDashboard when !has_real_data, adds OnboardingChecklist
- [ ] `OnboardingChecklist` — progress bar, 5 step rows (completed/incomplete), action links, 30s poll, localStorage dismiss
- [ ] `OnboardingInterstitial` — modal overlay, 3 simplified steps, CTA + skip, localStorage dismiss
- [ ] `SampleDataBanner` — amber, always visible when sample data shown, no dismiss
- [ ] `SampleDashboard` — all sample data sections, SampleDataBanner at top
- [ ] SOV cron MODIFIED — getDigestRecipients() + buildWeeklyDigestPayload() + void sendWeeklyDigest() per recipient, fire-and-forget
- [ ] middleware.ts MODIFIED — /api/email/unsubscribe + /unsubscribe added to public routes
- [ ] Migration: onboarding_steps (UNIQUE org_id+step_id, 4 RLS policies), email_preferences (UNIQUE user_id+org_id, unsubscribe_token DEFAULT, 4 RLS policies), organizations.digest_last_sent_at column, backfills
- [ ] prod_schema.sql updated
- [ ] database.types.ts updated
- [ ] seed.sql: 5 onboarding step rows (3 complete) + email_preferences for golden tenant
- [ ] golden-tenant.ts: 3 new fixtures
- [ ] `npx vitest run` — **66 Vitest tests passing**, zero regressions
- [ ] `npx playwright test` — **9 Playwright tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 55 written
- [ ] roadmap.md Sprint 117 marked ✅

---

## ⚠️ Edge Cases

1. **`autoCompleteSteps()` reads prod_schema.sql table names.** The SOV results table may be `sov_evaluations`, `sov_results`, `sov_snapshots`, or something else. Read the schema before writing the query. Do not guess table names — Claude Code must verify from the uploaded `prod_schema.sql`.

2. **`buildWeeklyDigestPayload()` with only one SOV run.** If only one SOV run exists (current but no previous), `previous_sov = 0` and `delta = current_sov`. This means the first digest always has `trend = 'up'` (assuming any citations). This is a reasonable user experience — "Your initial score is X%."

3. **Email preferences row created lazily.** When `buildWeeklyDigestPayload()` finds no `email_preferences` row for the recipient, it inserts one. This INSERT uses the service role client (no user session in cron context). The auto-generated `unsubscribe_token` from the DB DEFAULT is used. Return the generated token in the payload.

4. **SOV cron sends one digest per recipient per org.** If an org has 5 members, 5 digest emails are sent. Each recipient gets their own email with the same org data but their own `unsubscribe_token`. This is correct — unsubscribing is per-user.

5. **Sample data and real data coexist during transition.** When the first SOV scan completes, `autoCompleteSteps()` marks `first_scan` complete, `has_real_data` flips to `true`, and `SampleDashboard` is replaced by the real dashboard on next load. There is no migration of sample data into real rows — sample data is purely display-level.

6. **Interstitial + checklist both showing.** For a brand-new user, both `OnboardingInterstitial` (modal) and `OnboardingChecklist` (widget) are present. The interstitial appears first (modal overlay). When dismissed, the checklist is visible below. This is intentional — the interstitial is the "here's what to do" intro, the checklist is the persistent reminder.

7. **Weekly digest timing.** The digest is sent by the SOV cron, which runs weekly (Sunday). The `week_of` date in the payload is the Monday of the current week (ISO week start). `formatWeekOf('2026-03-02')` → `'March 2, 2026'`. Since March 2 2026 is a Monday, this is the correct week_of format.

---

## 🔮 AI_RULES Update (Add Rule 55)

```markdown
## 55. 📬 Onboarding + Weekly Digest in `lib/onboarding/` + `lib/digest/` (Sprint 117)

* **Sample data is display-only.** SAMPLE_* constants are never written to the DB.
  SampleDataBanner must always be shown when sample data is displayed.
  isSampleData() checks for { _is_sample: true } sentinel.
* **Onboarding steps are org-scoped.** UNIQUE (org_id, step_id) — not per-user.
  Any member can complete any step. autoCompleteSteps() uses service role client.
* **shouldSendDigest() is a pure predicate.** No DB calls. 3 OR conditions.
  is_first_digest OR |delta| >= 2 OR has_first_mover_alert.
* **WeeklyDigest.tsx uses inline styles only.** No Tailwind, no external CSS.
  React Email requires this. Verify all styling is inline style objects.
* **Unsubscribe endpoint is GET, public, no auth.** Uses service role client.
  Redirects (not JSON) after processing. Add to middleware public routes.
* **email_preferences created lazily** in buildWeeklyDigestPayload().
  Service role INSERT ON CONFLICT DO NOTHING. Return generated unsubscribe_token.
* **sendWeeklyDigest() never throws.** Fire-and-forget from SOV cron via void.
  Returns DigestSendResult with sent/skipped boolean.
```

---

## 🗺️ What Comes Next

**Sprint 118 — Conversion & Reliability + Infrastructure:** Slack webhook alerts (SOV drop below threshold), edge caching for `/m/[slug]` menu pages and `/scan` public pages, Sentry error tracking wired into the existing OpenTelemetry hooks, README rewrite with setup instructions and env var documentation, and API route rate limiting using the existing `lib/redis.ts` infrastructure.
