-- Sprint 5: Root-cause source linking for hallucinations
ALTER TABLE public.ai_hallucinations
  ADD COLUMN IF NOT EXISTS root_cause_sources jsonb;

COMMENT ON COLUMN public.ai_hallucinations.root_cause_sources IS
  'Sprint 5: Sources likely responsible for this hallucination. '
  'Array of { url, title, category, platform, confidence } objects derived from '
  'sov_evaluations.cited_sources and source_mentions for the same org/engine.';
