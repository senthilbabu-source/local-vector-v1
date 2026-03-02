-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 110: AI Answer Simulation Sandbox (Capstone)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. simulation_runs — stores complete simulation results per run
CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                   uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Input metadata
  content_source           text        NOT NULL
                                       CHECK (content_source IN (
                                         'freeform','draft','llms_txt','published_faq','published_homepage'
                                       )),
  draft_id                 uuid        REFERENCES public.content_drafts(id) ON DELETE SET NULL,
  content_text             text        NOT NULL,
  content_word_count       integer     NOT NULL DEFAULT 0,
  modes_run                text[]      NOT NULL DEFAULT '{}',

  -- Per-mode results (stored as JSONB)
  ingestion_result         jsonb,
  query_results            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  gap_analysis             jsonb,

  -- Summary scores
  simulation_score         integer     NOT NULL DEFAULT 0
                                       CHECK (simulation_score BETWEEN 0 AND 100),
  ingestion_accuracy       integer     NOT NULL DEFAULT 0
                                       CHECK (ingestion_accuracy BETWEEN 0 AND 100),
  query_coverage_rate      numeric(4,3) NOT NULL DEFAULT 0,
  hallucination_risk       text        NOT NULL DEFAULT 'high'
                                       CHECK (hallucination_risk IN ('low','medium','high','critical')),

  -- API usage tracking
  claude_model             text        NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  input_tokens_used        integer     NOT NULL DEFAULT 0,
  output_tokens_used       integer     NOT NULL DEFAULT 0,

  -- Status + errors
  status                   text        NOT NULL DEFAULT 'completed'
                                       CHECK (status IN ('completed','partial','failed')),
  errors                   text[]      NOT NULL DEFAULT '{}',

  run_at                   timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "simulation_runs: org members read own"
  ON public.simulation_runs FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "simulation_runs: service role full access"
  ON public.simulation_runs FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_simulation_runs_location_run_at
  ON public.simulation_runs (location_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_org_run_at
  ON public.simulation_runs (org_id, run_at DESC);

COMMENT ON TABLE public.simulation_runs IS
  'AI Answer Simulation Sandbox results. Sprint 110.';

-- 2. Add simulation columns to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS last_simulation_score    integer CHECK (last_simulation_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS simulation_last_run_at   timestamptz;

COMMENT ON COLUMN public.locations.last_simulation_score IS
  'Most recent simulation sandbox score 0–100. NULL = never run. Sprint 110.';

COMMENT ON COLUMN public.locations.simulation_last_run_at IS
  'Timestamp of most recent simulation run. Sprint 110.';
