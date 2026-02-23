-- ============================================================
-- MIGRATION: 20260221000004_create_sov_tracking
-- Purpose:   Introduce the Share of Voice (SOV) tracking tables.
--
--            target_queries — user-defined search queries to monitor
--            (e.g. "Best BBQ in Alpharetta GA"). One query can be
--            evaluated by multiple LLM engines over time.
--
--            sov_evaluations — one row per (query, engine, run).
--            Captures the rank position of the business in the LLM
--            response (null = not mentioned), a JSONB array of
--            competitor names that were mentioned, and the raw
--            LLM response text for auditability.
--
-- Applies after: 20260221000003_create_ai_evaluations.sql
-- ============================================================

-- ── 1. CREATE target_queries TABLE ───────────────────────────

CREATE TABLE IF NOT EXISTS public.target_queries (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Tenant isolation — every query belongs to one org
  org_id      UUID          NOT NULL
                            REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- The location this query is scoped to
  -- ON DELETE CASCADE: removing a location cleans up its query definitions
  location_id UUID          NOT NULL
                            REFERENCES public.locations(id) ON DELETE CASCADE,

  -- The natural-language search query to submit to LLM engines
  -- e.g. "Best BBQ restaurant in Alpharetta GA"
  query_text  VARCHAR(500)  NOT NULL,

  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 2. INDEXES — target_queries ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_target_queries_org
  ON public.target_queries(org_id);

CREATE INDEX IF NOT EXISTS idx_target_queries_location
  ON public.target_queries(location_id);

-- ── 3. RLS — target_queries ───────────────────────────────────

ALTER TABLE public.target_queries ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can only read their own query definitions
CREATE POLICY "org_isolation_select" ON public.target_queries
  FOR SELECT
  USING (org_id = public.current_user_org_id());

-- INSERT: org members can only create queries for their org
-- CRITICAL: Without this policy, inserts are silently rejected (RLS Shadowban).
CREATE POLICY "org_isolation_insert" ON public.target_queries
  FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

-- UPDATE: org members can only update their own query rows
CREATE POLICY "org_isolation_update" ON public.target_queries
  FOR UPDATE
  USING  (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

-- DELETE: org members can only delete their own query rows
CREATE POLICY "org_isolation_delete" ON public.target_queries
  FOR DELETE
  USING (org_id = public.current_user_org_id());

-- ── 4. CREATE sov_evaluations TABLE ──────────────────────────

CREATE TABLE IF NOT EXISTS public.sov_evaluations (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Tenant isolation — every evaluation belongs to one org
  org_id                UUID          NOT NULL
                                      REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- The location being evaluated (denormalised for query efficiency)
  location_id           UUID          NOT NULL
                                      REFERENCES public.locations(id) ON DELETE CASCADE,

  -- The target query that triggered this evaluation
  -- ON DELETE CASCADE: removing a query cleans up its evaluation history
  query_id              UUID          NOT NULL
                                      REFERENCES public.target_queries(id) ON DELETE CASCADE,

  -- Which LLM engine ran this evaluation
  -- Allowed values: 'openai' | 'perplexity'
  engine                VARCHAR(20)   NOT NULL,

  -- Position of the business in the LLM response (1 = first mention).
  -- NULL means the business was not mentioned at all.
  rank_position         INTEGER,

  -- Array of competitor business names mentioned in the LLM response.
  -- Empty array ([]) means no competitors were identified.
  mentioned_competitors JSONB         NOT NULL DEFAULT '[]'::jsonb,

  -- Raw LLM response text (retained for auditability)
  raw_response          TEXT,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 5. INDEXES — sov_evaluations ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sov_evaluations_org
  ON public.sov_evaluations(org_id);

CREATE INDEX IF NOT EXISTS idx_sov_evaluations_location
  ON public.sov_evaluations(location_id);

CREATE INDEX IF NOT EXISTS idx_sov_evaluations_query
  ON public.sov_evaluations(query_id);

-- Most queries order by created_at DESC to show the latest evaluation first
CREATE INDEX IF NOT EXISTS idx_sov_evaluations_query_created
  ON public.sov_evaluations(query_id, created_at DESC);

-- ── 6. RLS — sov_evaluations ─────────────────────────────────

ALTER TABLE public.sov_evaluations ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can only read their own evaluation rows
CREATE POLICY "org_isolation_select" ON public.sov_evaluations
  FOR SELECT
  USING (org_id = public.current_user_org_id());

-- INSERT: org members can only create evaluations for their org
-- CRITICAL: Without this policy, inserts are silently rejected (RLS Shadowban).
CREATE POLICY "org_isolation_insert" ON public.sov_evaluations
  FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

-- UPDATE: org members can only update their own evaluation rows
CREATE POLICY "org_isolation_update" ON public.sov_evaluations
  FOR UPDATE
  USING  (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

-- DELETE: org members can only delete their own evaluation rows
CREATE POLICY "org_isolation_delete" ON public.sov_evaluations
  FOR DELETE
  USING (org_id = public.current_user_org_id());
