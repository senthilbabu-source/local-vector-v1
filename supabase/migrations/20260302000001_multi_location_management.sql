-- ============================================================
-- Migration: 20260302000001_multi_location_management.sql
-- Sprint 100 — Multi-Location Management
--
-- Adds management columns to locations table:
--   is_archived, display_name, timezone, location_order
-- Creates partial unique index for one-primary-per-org.
-- ============================================================

-- -------------------------------------------------------
-- 1. Add missing columns
-- -------------------------------------------------------
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS is_archived    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name   character varying(100),
  ADD COLUMN IF NOT EXISTS timezone       character varying(50) DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS location_order integer DEFAULT 0;

COMMENT ON COLUMN public.locations.is_archived IS
  'Soft-delete flag. Archived locations are excluded from switcher and dashboard queries but retain historical data.';
COMMENT ON COLUMN public.locations.display_name IS
  'Short label for LocationSwitcher UI (e.g. "Downtown" vs full business_name). Falls back to business_name when null.';
COMMENT ON COLUMN public.locations.timezone IS
  'IANA timezone string for location-local time display (e.g. America/New_York).';
COMMENT ON COLUMN public.locations.location_order IS
  'Sort order within org. 0 = auto (created_at order).';

-- -------------------------------------------------------
-- 2. Dedup primaries before creating unique index
--    Ensure at most one is_primary=true per org.
-- -------------------------------------------------------
UPDATE public.locations
SET is_primary = false
WHERE is_primary = true
  AND id NOT IN (
    SELECT DISTINCT ON (org_id) id
    FROM public.locations
    WHERE is_primary = true
    ORDER BY org_id, created_at ASC
  );

-- -------------------------------------------------------
-- 3. Backfill: set oldest location as primary for orgs
--    that have no primary location at all.
-- -------------------------------------------------------
UPDATE public.locations
SET is_primary = true
WHERE id IN (
  SELECT DISTINCT ON (org_id) id
  FROM public.locations
  WHERE org_id NOT IN (
    SELECT org_id FROM public.locations WHERE is_primary = true
  )
  ORDER BY org_id, created_at ASC
);

-- -------------------------------------------------------
-- 4. Partial unique index: exactly one active primary per org
-- -------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_one_primary_per_org
  ON public.locations (org_id)
  WHERE is_primary = true AND is_archived = false;

-- -------------------------------------------------------
-- 5. Backfill display_name from business_name where null
-- -------------------------------------------------------
UPDATE public.locations
SET display_name = business_name
WHERE display_name IS NULL;

-- -------------------------------------------------------
-- 6. Backfill location_order based on created_at
-- -------------------------------------------------------
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY created_at ASC) AS rn
  FROM public.locations
)
UPDATE public.locations
SET location_order = ordered.rn
FROM ordered
WHERE public.locations.id = ordered.id
  AND public.locations.location_order = 0;

-- -------------------------------------------------------
-- 7. Index for filtering non-archived locations
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_locations_not_archived
  ON public.locations (org_id, is_archived)
  WHERE is_archived = false;
