-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 111: Org Membership Foundation
--
-- Enhances existing memberships infrastructure (Sprint 98-99) with:
--   1. 'analyst' role in membership_role enum
--   2. seat_count column on organizations (auto-counted via trigger)
--   3. Trigger to keep seat_count in sync with memberships
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Add 'analyst' to membership_role enum
--    analyst = read-only with data access (between viewer and admin)
--    'member' remains as legacy alias for viewer
ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'analyst';

-- 2. Add seat_count column to organizations
--    Distinct from seat_limit (Stripe-managed maximum):
--      seat_limit  = how many seats the plan allows (set by Stripe/billing)
--      seat_count  = how many seats are actually occupied (trigger-maintained)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS seat_count integer NOT NULL DEFAULT 1;

-- 3. Trigger function to keep seat_count in sync
CREATE OR REPLACE FUNCTION public.sync_org_seat_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.organizations
     SET seat_count = (
       SELECT COUNT(*) FROM public.memberships
       WHERE org_id = COALESCE(NEW.org_id, OLD.org_id)
     )
   WHERE id = COALESCE(NEW.org_id, OLD.org_id);
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_org_seat_count() IS
  'Keeps organizations.seat_count in sync with actual membership count. '
  'Sprint 111. Fires on INSERT/DELETE to memberships.';

DROP TRIGGER IF EXISTS trg_sync_seat_count ON public.memberships;
CREATE TRIGGER trg_sync_seat_count
  AFTER INSERT OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.sync_org_seat_count();

-- 4. Backfill seat_count for all existing orgs
UPDATE public.organizations o
   SET seat_count = (
     SELECT COUNT(*) FROM public.memberships om WHERE om.org_id = o.id
   );
