-- Sprint 124: Data Health Score — cached score column on locations
-- Populated nightly by cron/data-health-refresh, read by dashboard during day.

ALTER TABLE "public"."locations"
  ADD COLUMN IF NOT EXISTS "data_health_score" integer DEFAULT NULL;

-- Index for cron bulk refresh (scan all non-archived locations)
CREATE INDEX IF NOT EXISTS idx_locations_data_health_active
  ON "public"."locations" ("is_archived", "data_health_score");

COMMENT ON COLUMN "public"."locations"."data_health_score"
  IS 'Cached DataHealth score (0–100). Computed by computeDataHealth(). Refreshed nightly by data-health-refresh cron.';
