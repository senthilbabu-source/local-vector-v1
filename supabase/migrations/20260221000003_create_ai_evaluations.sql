-- ============================================================
-- MIGRATION: 20260221000003_create_ai_evaluations
-- Purpose:   Introduce the ai_evaluations table for storing
--            results of on-demand AI accuracy audits fired from
--            the Hallucination Monitor dashboard.
--
--            Each row represents one LLM call (OpenAI or Perplexity)
--            that evaluated how accurately an AI engine describes
--            this business. The hallucinations_detected JSONB column
--            holds an array of plain-English inaccuracy strings.
--
-- Applies after: 20260221000002_create_integrations.sql
-- ============================================================

-- ── 1. CREATE ai_evaluations TABLE ───────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_evaluations (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Tenant isolation — every row belongs to one org
  org_id                UUID          NOT NULL
                                      REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- The location that was evaluated
  -- ON DELETE CASCADE: removing a location cleans up its evaluation history
  location_id           UUID          NOT NULL
                                      REFERENCES public.locations(id) ON DELETE CASCADE,

  -- Which LLM engine ran this evaluation
  -- Allowed values: 'openai' | 'perplexity'
  engine                VARCHAR(20)   NOT NULL,

  -- The exact prompt submitted to the LLM (retained for auditability)
  prompt_used           TEXT,

  -- The raw LLM response text
  response_text         TEXT,

  -- Accuracy score 0–100 (100 = perfectly accurate, 0 = entirely wrong)
  accuracy_score        INTEGER       CHECK (accuracy_score >= 0 AND accuracy_score <= 100),

  -- Array of plain-English hallucination descriptions extracted from the response.
  -- Empty array ([]) means no hallucinations were detected.
  hallucinations_detected JSONB       NOT NULL DEFAULT '[]'::jsonb,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 2. INDEXES ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_evaluations_org
  ON public.ai_evaluations(org_id);

CREATE INDEX IF NOT EXISTS idx_ai_evaluations_location
  ON public.ai_evaluations(location_id);

-- Most queries order by created_at DESC to show the latest evaluation first
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_location_created
  ON public.ai_evaluations(location_id, created_at DESC);

-- ── 3. ENABLE RLS ─────────────────────────────────────────────

ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS POLICIES — all four operations ─────────────────────
-- Every policy gates through current_user_org_id() so tenants
-- are completely isolated. Without an INSERT policy, all server
-- action inserts would be silently rejected (RLS Shadowban).

-- SELECT: org members can only read their own evaluation rows
CREATE POLICY "org_isolation_select" ON public.ai_evaluations
  FOR SELECT
  USING (org_id = public.current_user_org_id());

-- INSERT: org members can only create evaluations for their org
-- CRITICAL: Without this policy, inserts are silently rejected.
CREATE POLICY "org_isolation_insert" ON public.ai_evaluations
  FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

-- UPDATE: org members can only update their own evaluation rows
CREATE POLICY "org_isolation_update" ON public.ai_evaluations
  FOR UPDATE
  USING  (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

-- DELETE: org members can only delete their own evaluation rows
CREATE POLICY "org_isolation_delete" ON public.ai_evaluations
  FOR DELETE
  USING (org_id = public.current_user_org_id());
