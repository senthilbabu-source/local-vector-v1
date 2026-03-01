-- ══════════════════════════════════════════════════════════════
-- Sprint 86: Autopilot Engine — Trigger Detection + Orchestration
-- content_drafts table ALREADY EXISTS — additive changes only
-- ══════════════════════════════════════════════════════════════

-- 1. Expand trigger_type CHECK to include review_gap and schema_gap
ALTER TABLE public.content_drafts
  DROP CONSTRAINT content_drafts_trigger_type_check;

ALTER TABLE public.content_drafts
  ADD CONSTRAINT content_drafts_trigger_type_check
  CHECK (trigger_type::text = ANY (ARRAY[
    'competitor_gap', 'occasion', 'prompt_missing',
    'first_mover', 'manual', 'hallucination_correction',
    'review_gap', 'schema_gap'
  ]::text[]));

-- 2. Add new columns to content_drafts
ALTER TABLE public.content_drafts
  ADD COLUMN IF NOT EXISTS target_keywords   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rejection_reason  text,
  ADD COLUMN IF NOT EXISTS generation_notes  text;

COMMENT ON COLUMN public.content_drafts.target_keywords IS
  'Keywords woven into the draft by the generator. Sprint 86.';
COMMENT ON COLUMN public.content_drafts.rejection_reason IS
  'Optional reason when status = rejected. Sprint 86.';
COMMENT ON COLUMN public.content_drafts.generation_notes IS
  'Internal notes from the generator for debugging. Sprint 86.';

-- 3. Add autopilot tracking columns to locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS autopilot_last_run_at  timestamptz,
  ADD COLUMN IF NOT EXISTS drafts_pending_count   integer DEFAULT 0;

COMMENT ON COLUMN public.locations.autopilot_last_run_at IS
  'Last time autopilot ran for this location. Sprint 86.';
COMMENT ON COLUMN public.locations.drafts_pending_count IS
  'Count of pending (status=draft) content drafts. Sprint 86.';

-- 4. post_publish_audits — records completed citation re-checks after publish
CREATE TABLE IF NOT EXISTS public.post_publish_audits (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  draft_id           uuid        NOT NULL REFERENCES public.content_drafts(id) ON DELETE CASCADE,
  location_id        uuid        REFERENCES public.locations(id) ON DELETE SET NULL,
  target_query       text,
  baseline_score     integer,
  post_publish_score integer,
  improvement_delta  integer,
  checked_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id)
);

ALTER TABLE public.post_publish_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_publish_audits: org read own"
  ON public.post_publish_audits FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "post_publish_audits: service role full"
  ON public.post_publish_audits FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.post_publish_audits IS
  'Records citation re-check results after draft publication. Sprint 86.';

-- 5. Performance indexes for trigger detection queries
CREATE INDEX IF NOT EXISTS idx_content_drafts_autopilot
  ON public.content_drafts (org_id, trigger_type, status, created_at DESC);

GRANT ALL ON TABLE public.post_publish_audits TO anon;
GRANT ALL ON TABLE public.post_publish_audits TO authenticated;
GRANT ALL ON TABLE public.post_publish_audits TO service_role;
