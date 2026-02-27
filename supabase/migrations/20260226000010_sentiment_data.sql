-- Sprint 81: Add sentiment analysis data to SOV evaluations
-- Stores extracted sentiment (score, label, descriptors, tone) from raw_response
ALTER TABLE public.sov_evaluations
  ADD COLUMN IF NOT EXISTS sentiment_data JSONB;

-- Index for querying sentiment by org over time (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_sov_evaluations_sentiment
  ON public.sov_evaluations (org_id, created_at DESC)
  WHERE sentiment_data IS NOT NULL;

COMMENT ON COLUMN public.sov_evaluations.sentiment_data IS 'Extracted sentiment analysis from raw_response: { score, label, descriptors, tone, recommendation_strength }';
