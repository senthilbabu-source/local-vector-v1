-- ---------------------------------------------------------------------------
-- Sprint L: Listing Verification
--
-- Adds verification columns to location_integrations for storing
-- platform verification results (Yelp Fusion API, etc.).
-- ---------------------------------------------------------------------------

ALTER TABLE public.location_integrations
  ADD COLUMN IF NOT EXISTS verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS verification_result jsonb,
  ADD COLUMN IF NOT EXISTS has_discrepancy     boolean DEFAULT false;

COMMENT ON COLUMN public.location_integrations.verified_at IS
  'Timestamp of last verification check against the platform API.';
COMMENT ON COLUMN public.location_integrations.verification_result IS
  'Cached JSON result from platform verification API. Shape varies by platform.';
COMMENT ON COLUMN public.location_integrations.has_discrepancy IS
  'True when verification found data on the platform that differs from org verified data.';
