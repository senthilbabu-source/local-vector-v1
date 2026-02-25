-- ---------------------------------------------------------------------------
-- Migration: Add query_category, occasion_tag, intent_modifier to target_queries
--
-- The SOV engine service (lib/services/sov-engine.service.ts) references
-- query_category for First Mover Alert filtering but the column was never
-- created. This migration adds it along with two optional enrichment columns
-- from the planned spec (docs/20260223000001_sov_engine.sql).
--
-- Backfills all existing rows with 'discovery' (safe default).
-- ---------------------------------------------------------------------------

-- 1. Add the three new columns
ALTER TABLE public.target_queries
  ADD COLUMN IF NOT EXISTS query_category VARCHAR(50) NOT NULL DEFAULT 'discovery',
  ADD COLUMN IF NOT EXISTS occasion_tag   VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS intent_modifier VARCHAR(50) NULL;

-- 2. CHECK constraint on query_category — mirrors the 5-category taxonomy
--    from docs/15-LOCAL-PROMPT-INTELLIGENCE.md §2
ALTER TABLE public.target_queries
  ADD CONSTRAINT target_queries_category_check
  CHECK (query_category IN ('discovery', 'comparison', 'occasion', 'near_me', 'custom'));

-- 3. Index for cron query batching by category
CREATE INDEX IF NOT EXISTS idx_target_queries_category
  ON public.target_queries (query_category);
