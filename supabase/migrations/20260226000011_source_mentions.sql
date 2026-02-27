-- Sprint 82: Add source_mentions to sov_evaluations
-- Stores extracted source references for engines that don't return structured citations.
ALTER TABLE public.sov_evaluations
  ADD COLUMN IF NOT EXISTS source_mentions JSONB;

COMMENT ON COLUMN public.sov_evaluations.source_mentions IS
  'Extracted source references from raw_response for engines without cited_sources (OpenAI, Copilot). Uses SourceMentionExtractionSchema.';
