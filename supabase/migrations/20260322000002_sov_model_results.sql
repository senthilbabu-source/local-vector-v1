-- Sprint 123: Multi-Model SOV Expansion
-- Stores per-model citation results for each target query run.
-- Separate from sov_evaluations (which stores the aggregate/overall score).
-- sov_evaluations continues to be written as before — this is purely additive.

-- ── sov_model_results table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sov_model_results (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid          NOT NULL
                                REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid          REFERENCES public.locations(id) ON DELETE SET NULL,
  query_id        uuid          REFERENCES public.target_queries(id) ON DELETE SET NULL,
  query_text      text          NOT NULL,
  model_provider  text          NOT NULL
                                CHECK (model_provider IN (
                                  'perplexity_sonar',
                                  'openai_gpt4o_mini',
                                  'gemini_flash'
                                )),
  cited           boolean       NOT NULL,
  citation_count  int           NOT NULL DEFAULT 0,
  ai_response     text,
  confidence      text          NOT NULL DEFAULT 'high'
                                CHECK (confidence IN ('high','medium','low')),
  week_of         date          NOT NULL,
  run_at          timestamptz   NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, query_id, model_provider, week_of)
);

COMMENT ON TABLE public.sov_model_results IS
  'Per-model citation results for SOV queries. Sprint 123. Additive to sov_evaluations (aggregate score). Populated by the SOV cron when multi-model is enabled by plan.';

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sov_model_results_org_week
  ON public.sov_model_results (org_id, week_of DESC);

CREATE INDEX IF NOT EXISTS idx_sov_model_results_query
  ON public.sov_model_results (query_id, week_of DESC)
  WHERE query_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sov_model_results_model
  ON public.sov_model_results (org_id, model_provider, week_of DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.sov_model_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sov_model_results: members can read"
  ON public.sov_model_results FOR SELECT
  USING (org_id IN (
    SELECT m.org_id FROM public.memberships m
    WHERE m.user_id = auth.uid()
  ));

CREATE POLICY "sov_model_results: service role full access"
  ON public.sov_model_results FOR ALL
  USING (auth.role() = 'service_role');
