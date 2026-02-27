-- ---------------------------------------------------------------------------
-- Sprint 88: Phase 5 SOV Cleanup — UNIQUE constraint + is_active column
--
-- 1. UNIQUE(location_id, query_text) — prevents duplicate query seeding.
--    sov-seed.ts and addTargetQuery() both assume this constraint exists.
-- 2. is_active BOOLEAN — soft-disable queries without losing sov_evaluations
--    history (which cascades on DELETE).
--
-- Supersedes the intent of docs/20260223000001_sov_engine.sql (never promoted).
-- ---------------------------------------------------------------------------

-- 1. Add is_active column (default TRUE — all existing queries stay active)
ALTER TABLE public.target_queries
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add UNIQUE constraint on (location_id, query_text)
--    Dedupe any existing duplicates first (keep earliest created_at)
DELETE FROM public.target_queries a
USING public.target_queries b
WHERE a.location_id = b.location_id
  AND a.query_text = b.query_text
  AND a.created_at > b.created_at;

ALTER TABLE public.target_queries
  ADD CONSTRAINT uq_target_queries_location_text
  UNIQUE (location_id, query_text);

-- 3. Partial index for active-only queries (used by SOV cron and dashboard)
CREATE INDEX IF NOT EXISTS idx_target_queries_active
  ON public.target_queries (location_id)
  WHERE is_active = TRUE;

-- 4. Comment for clarity
COMMENT ON CONSTRAINT uq_target_queries_location_text ON public.target_queries
  IS 'Prevents duplicate SOV queries per location. Required by sov-seed.ts upsert logic.';

COMMENT ON COLUMN public.target_queries.is_active
  IS 'Soft-disable toggle. FALSE = paused (hidden from cron + dashboard). Preserves sov_evaluations history.';
