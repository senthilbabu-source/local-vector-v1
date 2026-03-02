-- ══════════════════════════════════════════════════════════════
-- Sprint 109: VAIO — Voice & Conversational AI Optimization
-- ══════════════════════════════════════════════════════════════

-- 1. Extend target_queries with voice support columns
--    query_mode: separates voice queries from existing typed SOV queries
--    citation_rate: per-query citation performance (0.0–1.0)
--    last_run_at: when this query was last evaluated
--    is_system_seeded: true = seeded from voice taxonomy template

ALTER TABLE public.target_queries
  ADD COLUMN IF NOT EXISTS query_mode       varchar(10) NOT NULL DEFAULT 'typed'
    CHECK (query_mode IN ('typed', 'voice')),
  ADD COLUMN IF NOT EXISTS citation_rate    double precision,
  ADD COLUMN IF NOT EXISTS last_run_at      timestamptz,
  ADD COLUMN IF NOT EXISTS is_system_seeded boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.target_queries.query_mode IS
  'Whether this is a typed search query (SOV engine) or a voice/conversational
   query (VAIO). Default typed preserves existing rows. Sprint 109.';

-- 2. Extend query_category CHECK to include voice categories
--    Existing: discovery, comparison, occasion, near_me, custom
--    Adding: action, information (voice-specific categories)
ALTER TABLE public.target_queries
  DROP CONSTRAINT IF EXISTS target_queries_category_check;

ALTER TABLE public.target_queries
  ADD CONSTRAINT target_queries_category_check
  CHECK (query_category::text = ANY (ARRAY[
    'discovery', 'comparison', 'occasion', 'near_me', 'custom',
    'action', 'information'
  ]::text[]));

-- 3. Composite index for voice query lookups
CREATE INDEX IF NOT EXISTS idx_target_queries_mode_active
  ON public.target_queries (location_id, query_mode, is_active)
  WHERE is_active = true;

-- ──────────────────────────────────────────────────────────────

-- 4. vaio_profiles — current VAIO state per location
CREATE TABLE IF NOT EXISTS public.vaio_profiles (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                   uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  voice_readiness_score    integer     NOT NULL DEFAULT 0
                                       CHECK (voice_readiness_score BETWEEN 0 AND 100),

  -- llms.txt state
  llms_txt_standard        text,
  llms_txt_full            text,
  llms_txt_generated_at    timestamptz,
  llms_txt_status          text        NOT NULL DEFAULT 'not_generated'
                                       CHECK (llms_txt_status IN ('generated', 'stale', 'not_generated')),

  -- AI crawler audit (stored as JSONB — AICrawlerAuditResult)
  crawler_audit            jsonb,

  -- Voice query stats
  voice_queries_tracked    integer     NOT NULL DEFAULT 0,
  voice_citation_rate      numeric(4,3) NOT NULL DEFAULT 0,

  -- Gaps + issues (stored as JSONB arrays)
  voice_gaps               jsonb       NOT NULL DEFAULT '[]'::jsonb,
  top_content_issues       jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  last_run_at              timestamptz,

  UNIQUE (location_id)
);

ALTER TABLE public.vaio_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vaio_profiles: org members read own"
  ON public.vaio_profiles FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "vaio_profiles: service role full access"
  ON public.vaio_profiles FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.vaio_profiles IS
  'Voice & Conversational AI Optimization state per location. Sprint 109.';

-- ──────────────────────────────────────────────────────────────

-- 5. Add voice readiness columns to locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS voice_readiness_score  integer CHECK (voice_readiness_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS vaio_last_run_at       timestamptz;

CREATE INDEX IF NOT EXISTS idx_locations_voice_readiness
  ON public.locations (org_id, voice_readiness_score)
  WHERE voice_readiness_score IS NOT NULL;

COMMENT ON COLUMN public.locations.voice_readiness_score IS
  'Voice readiness score 0–100. NULL = never run. Sprint 109.';
COMMENT ON COLUMN public.locations.vaio_last_run_at IS
  'Timestamp of last successful VAIO run. Sprint 109.';

-- ──────────────────────────────────────────────────────────────

-- 6. Extend content_drafts trigger_type to include voice_gap
ALTER TABLE public.content_drafts
  DROP CONSTRAINT IF EXISTS content_drafts_trigger_type_check;

ALTER TABLE public.content_drafts
  ADD CONSTRAINT content_drafts_trigger_type_check
  CHECK (trigger_type::text = ANY (ARRAY[
    'competitor_gap', 'occasion', 'prompt_missing',
    'first_mover', 'manual', 'hallucination_correction',
    'review_gap', 'schema_gap', 'voice_gap'
  ]::text[]));

-- ──────────────────────────────────────────────────────────────

-- 7. Grants
GRANT ALL ON TABLE public.vaio_profiles TO anon;
GRANT ALL ON TABLE public.vaio_profiles TO authenticated;
GRANT ALL ON TABLE public.vaio_profiles TO service_role;
