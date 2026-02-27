-- Sprint 74: Add cited_sources JSONB column to sov_evaluations
-- Stores the URLs that Google Search grounding cited in its response.
-- Only populated for engine='google'; NULL for other engines.
ALTER TABLE public.sov_evaluations
  ADD COLUMN IF NOT EXISTS cited_sources jsonb;

COMMENT ON COLUMN public.sov_evaluations.cited_sources IS
  'URLs cited by Google Search grounding. Array of {url, title} objects. NULL for non-Google engines.';
