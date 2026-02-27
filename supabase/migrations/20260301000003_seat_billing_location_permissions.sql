-- ============================================================
-- Migration: 20260301000003_seat_billing_location_permissions.sql
-- Sprint 99 — Seat-Based Billing + Agency Permissions
--
-- DEPENDS ON: 20260301000002_multi_user_foundation.sql (memberships, pending_invitations)
--
-- NEW:
--   1. seat_limit + seat_overage columns on organizations
--   2. stripe_webhook_events table (idempotency)
--   3. location_permissions table (per-location role scoping)
--   4. Indexes + RLS policies
-- ============================================================

-- -------------------------------------------------------
-- 1. Seat ceiling on organizations
--    seat_limit = max memberships rows allowed.
--    NULL = unlimited (future enterprise / internal orgs).
--    1 = starter/growth (owner only, no additional members).
-- -------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS seat_limit          integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seats_updated_at    timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS seat_overage_count  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seat_overage_since  timestamptz;

COMMENT ON COLUMN public.organizations.seat_limit IS
  'Maximum memberships rows allowed. Synced from Stripe subscription quantity.
   NULL = unlimited. 1 = single-user plans. Updated by Stripe webhook.';

COMMENT ON COLUMN public.organizations.seat_overage_count IS
  'Number of members over the seat limit after a downgrade. 0 = within limit.
   Set by Stripe webhook. Cleared when members are removed or seats upgraded.';

-- Set existing orgs: starter/growth/trial -> seat_limit=1, agency -> seat_limit=5
UPDATE public.organizations SET seat_limit = 1
  WHERE plan IN ('trial', 'starter', 'growth');

UPDATE public.organizations SET seat_limit = 5
  WHERE plan = 'agency' AND (seat_limit IS NULL OR seat_limit = 1);

-- -------------------------------------------------------
-- 2. Stripe webhook idempotency log
--    Prevents duplicate processing of Stripe events.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type      text NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now(),
  org_id          uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  payload         jsonb,
  error           text
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id
  ON public.stripe_webhook_events(stripe_event_id);

-- RLS: service role only (webhooks use service role — no user RLS needed)
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No SELECT policy = no user can read webhook logs. Service role bypasses RLS.

-- Grants for service_role access
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;

-- -------------------------------------------------------
-- 3. location_permissions
--    Scoped permissions per org member per location.
--    Supplements org-level role — most restrictive wins.
--    If no row exists for (membership_id, location_id),
--    fall back to org-level role from memberships.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.location_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  role          public.membership_role NOT NULL DEFAULT 'viewer',
  granted_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, location_id)
);

-- RLS
ALTER TABLE public.location_permissions ENABLE ROW LEVEL SECURITY;

-- Members can read location permissions for their org
CREATE POLICY "location_permissions_select" ON public.location_permissions
  FOR SELECT USING (
    membership_id IN (
      SELECT id FROM public.memberships
      WHERE org_id = public.current_user_org_id()
    )
  );

-- Only owner can grant/modify location permissions
CREATE POLICY "location_permissions_insert" ON public.location_permissions
  FOR INSERT WITH CHECK (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.org_id IN (
        SELECT m2.org_id FROM public.memberships m2
        WHERE m2.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid()
        )
        AND m2.role = 'owner'
      )
    )
  );

CREATE POLICY "location_permissions_update" ON public.location_permissions
  FOR UPDATE USING (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.org_id IN (
        SELECT m2.org_id FROM public.memberships m2
        WHERE m2.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid()
        )
        AND m2.role = 'owner'
      )
    )
  );

CREATE POLICY "location_permissions_delete" ON public.location_permissions
  FOR DELETE USING (
    membership_id IN (
      SELECT m.id FROM public.memberships m
      WHERE m.org_id IN (
        SELECT m2.org_id FROM public.memberships m2
        WHERE m2.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid()
        )
        AND m2.role = 'owner'
      )
    )
  );

-- -------------------------------------------------------
-- 4. Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_location_permissions_membership ON public.location_permissions(membership_id);
CREATE INDEX IF NOT EXISTS idx_location_permissions_location   ON public.location_permissions(location_id);
CREATE INDEX IF NOT EXISTS idx_orgs_seat_limit                 ON public.organizations(seat_limit);

-- -------------------------------------------------------
-- 5. Grants
-- -------------------------------------------------------
GRANT ALL ON TABLE public.location_permissions TO anon;
GRANT ALL ON TABLE public.location_permissions TO authenticated;
GRANT ALL ON TABLE public.location_permissions TO service_role;
