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
  actor_email     text,
  target_user_id  uuid                REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email    text                NOT NULL,
  target_role     public.membership_role,
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

CREATE POLICY "activity_log: org members can read"
  ON public.activity_log FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "activity_log: service role insert"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 4. Add stripe_subscription_item_id to organizations
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
