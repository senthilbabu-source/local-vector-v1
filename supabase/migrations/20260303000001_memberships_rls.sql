-- ============================================================
-- Migration: 20260303000001_memberships_rls.sql
-- Sprint FIX-2 — Close Security Gap: memberships table RLS
--
-- PROBLEM: memberships table was created in the initial schema
-- with no ENABLE ROW LEVEL SECURITY statement. Any authenticated
-- Supabase client can read all membership rows across all orgs.
--
-- SOLUTION: Enable RLS and add org-scoped policies using the
-- existing current_user_org_id() SECURITY DEFINER function,
-- which is the same pattern used on 24 other tables.
--
-- POLICIES:
--   SELECT — org members can see their own org's memberships
--   INSERT — org members can only insert into their own org
--   UPDATE — owner/admin only (role check handled at app layer
--            via org-roles.ts; DB allows any authenticated user
--            in the org to update, app layer enforces role)
--   DELETE — same as update
--
-- SERVICE ROLE BYPASS: All cron routes, webhook handlers, and
-- server-side seed operations use createServiceRoleClient()
-- which bypasses RLS. These are unaffected by this migration.
--
-- NOTE on local_occasions:
-- local_occasions does NOT have an org_id column.
-- It is a shared global lookup table (holidays, celebrations,
-- seasonal events) — same pattern as the directories table.
-- No RLS needed — intentionally public-readable.
-- ============================================================

-- 1. Enable RLS on memberships
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 2. SELECT: any org member can see their org's full member list
--    (needed for team management page, invitation checks)
CREATE POLICY "memberships_org_isolation_select" ON public.memberships
  FOR SELECT
  USING (org_id = public.current_user_org_id());

-- 3. INSERT: only members of the target org can insert
--    (handle_new_user trigger runs as SECURITY DEFINER and bypasses RLS)
--    (invitation acceptance uses service role client — bypasses RLS)
CREATE POLICY "memberships_org_isolation_insert" ON public.memberships
  FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

-- 4. UPDATE: role changes and joined_at updates — org-scoped
--    (role enforcement is at app layer in lib/auth/org-roles.ts)
CREATE POLICY "memberships_org_isolation_update" ON public.memberships
  FOR UPDATE
  USING (org_id = public.current_user_org_id());

-- 5. DELETE: member removal — org-scoped
--    (owner protection is enforced at app layer in seat-actions.ts)
CREATE POLICY "memberships_org_isolation_delete" ON public.memberships
  FOR DELETE
  USING (org_id = public.current_user_org_id());

-- 6. Index: idx_memberships_org already exists from initial schema.
--    DO NOT create duplicate. Verified via:
--    grep "idx_memberships_org" supabase/prod_schema.sql
