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
  ON public.onboarding_steps FOR ALL
  USING (auth.role() = 'service_role');

-- 2. email_preferences table (one row per user per org)
CREATE TABLE IF NOT EXISTS public.email_preferences (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id                uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  digest_unsubscribed   boolean       NOT NULL DEFAULT false,
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
  ON public.email_preferences FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Add digest_last_sent_at to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS digest_last_sent_at timestamptz;

-- 4. Backfill onboarding_steps for existing orgs
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

-- 5. Backfill email_preferences for existing org owners
-- Only runs when auth.users already has rows (skips on fresh db reset where
-- users are created by seed.sql after migrations).
INSERT INTO public.email_preferences (user_id, org_id)
SELECT m.user_id, m.org_id
FROM public.memberships m
JOIN auth.users u ON u.id = m.user_id
WHERE m.role = 'owner'
ON CONFLICT (user_id, org_id) DO NOTHING;
