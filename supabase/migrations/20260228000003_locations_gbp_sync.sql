-- ---------------------------------------------------------------------------
-- Sprint 89: Add gbp_synced_at to locations for tracking last GBP import
--
-- 1. Adds gbp_synced_at timestamptz column (NULL = never synced)
-- 2. Partial index for dashboard queries: "locations synced > 30 days ago"
-- ---------------------------------------------------------------------------

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS gbp_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_locations_gbp_synced_at
  ON public.locations (org_id, gbp_synced_at)
  WHERE gbp_synced_at IS NOT NULL;

COMMENT ON COLUMN public.locations.gbp_synced_at IS
  'Timestamp of last successful GBP data import. NULL = never synced. Sprint 89.';
