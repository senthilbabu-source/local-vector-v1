-- ---------------------------------------------------------------------------
-- Migration: google_oauth_tokens RLS policies (Sprint 57B)
--
-- The google_oauth_tokens table has RLS enabled but NO policies.
-- This migration adds org-isolation policies matching the standard pattern
-- used by other org-scoped tables.
--
-- Access model:
--   • authenticated users can SELECT their own org's row
--   • INSERT/UPDATE/DELETE are service_role only (OAuth flow + token refresh)
--
-- The table only grants to service_role in prod_schema.sql, but we add a
-- SELECT policy for authenticated so the integrations page can check if
-- a GBP connection exists without needing service_role.
-- ---------------------------------------------------------------------------

-- Grant SELECT to authenticated role so RLS policy can work
GRANT SELECT ON "public"."google_oauth_tokens" TO "authenticated";

-- Allow authenticated users to read their own org's OAuth token row
CREATE POLICY "org_isolation_select"
  ON "public"."google_oauth_tokens"
  FOR SELECT
  TO "authenticated"
  USING (
    "org_id" IN (
      SELECT "org_id" FROM "public"."memberships"
      WHERE "user_id" = auth.uid()
    )
  );
