-- Sprint E: Add industry column to organizations
-- Enables multi-vertical support (restaurant, medical_dental, legal, real_estate)
-- Default: 'restaurant' — existing orgs implicitly remain restaurant vertical
-- getIndustryConfig(null) also falls back to restaurant, so no backfill needed

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS industry text DEFAULT 'restaurant';

COMMENT ON COLUMN public.organizations.industry IS
  'Industry vertical. Values: restaurant | medical_dental | legal | real_estate. Sprint E.';
