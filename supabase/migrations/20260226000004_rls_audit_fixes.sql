-- ---------------------------------------------------------------------------
-- Migration: Sprint 53 — RLS Audit Fixes
--
-- Fixes three tables flagged in the V1 Implementation Audit:
--
-- 1. citation_source_intelligence
--    - No org_id (shared aggregate market data), RLS was NOT enabled.
--    - Fix: Enable RLS, add SELECT-only for authenticated users.
--    - Writes go through service_role (cron), which bypasses RLS.
--
-- 2. page_audits
--    - Has org_id + RLS enabled, but only SELECT policy existed.
--    - Fix: Add INSERT, UPDATE, DELETE policies.
--    - Writes currently go through service_role (cron), but defense-in-depth
--      requires policies in case future code uses user-scoped client.
--
-- 3. content_drafts
--    - Has org_id + RLS enabled with SELECT/INSERT/UPDATE, but missing DELETE.
--    - Fix: Add DELETE policy for org isolation.
--    - App uses soft-delete (status='archived') by convention, but the policy
--      prevents cross-org data leaks if a hard-delete path is ever added.
-- ---------------------------------------------------------------------------

-- ── 1. citation_source_intelligence ──────────────────────────────────────────

-- Enable RLS (was missing entirely)
ALTER TABLE "public"."citation_source_intelligence" ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read shared market intelligence
CREATE POLICY "authenticated_select" ON "public"."citation_source_intelligence"
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated — service_role only.
-- service_role bypasses RLS, so cron writes continue to work.

-- ── 2. page_audits — add missing write policies ─────────────────────────────

-- INSERT — allows authenticated users to insert rows for their own org
CREATE POLICY "org_isolation_insert" ON "public"."page_audits"
  FOR INSERT
  WITH CHECK (("org_id" = "public"."current_user_org_id"()));

-- UPDATE — allows authenticated users to update their own org's rows
CREATE POLICY "org_isolation_update" ON "public"."page_audits"
  FOR UPDATE
  USING (("org_id" = "public"."current_user_org_id"()))
  WITH CHECK (("org_id" = "public"."current_user_org_id"()));

-- DELETE — allows authenticated users to delete their own org's rows
CREATE POLICY "org_isolation_delete" ON "public"."page_audits"
  FOR DELETE
  USING (("org_id" = "public"."current_user_org_id"()));

-- ── 3. content_drafts — add missing DELETE policy ────────────────────────────

-- DELETE — allows authenticated users to delete their own org's drafts
CREATE POLICY "org_isolation_delete" ON "public"."content_drafts"
  FOR DELETE
  USING (("org_id" = "public"."current_user_org_id"()));
