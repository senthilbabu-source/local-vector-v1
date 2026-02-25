-- ---------------------------------------------------------------------------
-- Migration: Add missing INSERT, UPDATE, DELETE RLS policies to competitor_intercepts
--
-- The competitor_intercepts table had RLS enabled but only an org_isolation_select
-- policy. INSERT (from runCompetitorIntercept), UPDATE (from markInterceptActionComplete),
-- and DELETE were all blocked by RLS — causing "new row violates row-level security
-- policy" errors.
-- ---------------------------------------------------------------------------

-- INSERT — allows authenticated users to insert rows for their own org
CREATE POLICY "org_isolation_insert" ON "public"."competitor_intercepts"
  FOR INSERT
  WITH CHECK (("org_id" = "public"."current_user_org_id"()));

-- UPDATE — allows authenticated users to update their own org's rows (e.g., action_status)
CREATE POLICY "org_isolation_update" ON "public"."competitor_intercepts"
  FOR UPDATE
  USING (("org_id" = "public"."current_user_org_id"()))
  WITH CHECK (("org_id" = "public"."current_user_org_id"()));

-- DELETE — allows authenticated users to delete their own org's rows
CREATE POLICY "org_isolation_delete" ON "public"."competitor_intercepts"
  FOR DELETE
  USING (("org_id" = "public"."current_user_org_id"()));
