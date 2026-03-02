-- Sprint 119: Add embedding vector(1536) columns to 5 tables.
-- text-embedding-3-small produces 1536-dimensional vectors.
-- All columns nullable — rows backfilled by the embed-backfill cron.

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

ALTER TABLE public.ai_hallucinations
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

ALTER TABLE public.target_queries
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

ALTER TABLE public.content_drafts
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

-- Document the source text for each column
COMMENT ON COLUMN public.menu_items.embedding IS
  'text-embedding-3-small (1536d). Source: name || '' '' || coalesce(description, '''')';

COMMENT ON COLUMN public.ai_hallucinations.embedding IS
  'text-embedding-3-small (1536d). Source: claim_text';

COMMENT ON COLUMN public.target_queries.embedding IS
  'text-embedding-3-small (1536d). Source: query_text';

COMMENT ON COLUMN public.content_drafts.embedding IS
  'text-embedding-3-small (1536d). '
  'Source: draft_title || '' '' || coalesce(target_prompt, '''')';

COMMENT ON COLUMN public.locations.embedding IS
  'text-embedding-3-small (1536d). '
  'Source: business_name || '' '' || coalesce(categories::text, '''') || '' '' || coalesce(city, '''')';
