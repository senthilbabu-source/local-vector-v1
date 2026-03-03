-- Sprint 135: Conversational Intent Discovery
-- Creates intent_discoveries table and extends content_drafts trigger_type.

CREATE TABLE IF NOT EXISTS public.intent_discoveries (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  prompt          text NOT NULL,
  theme           text NOT NULL CHECK (theme IN ('hours', 'events', 'offerings', 'comparison', 'occasion', 'location', 'other')),
  client_cited    boolean NOT NULL DEFAULT false,
  competitors_cited text[] NOT NULL DEFAULT '{}',
  opportunity_score integer NOT NULL DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),
  brief_created   boolean NOT NULL DEFAULT false,
  content_draft_id uuid REFERENCES public.content_drafts(id),
  discovered_at   timestamptz NOT NULL DEFAULT now(),
  run_id          uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intent_discoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.intent_discoveries
  FOR SELECT USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "service_role_all" ON public.intent_discoveries
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_intent_gaps ON public.intent_discoveries (org_id, client_cited, opportunity_score DESC)
  WHERE client_cited = false;

CREATE INDEX IF NOT EXISTS idx_intent_run ON public.intent_discoveries (org_id, run_id, discovered_at DESC);

-- Extend content_drafts trigger_type to include 'intent_gap'
ALTER TABLE public.content_drafts
  DROP CONSTRAINT IF EXISTS content_drafts_trigger_type_check;

ALTER TABLE public.content_drafts
  ADD CONSTRAINT content_drafts_trigger_type_check
  CHECK (trigger_type IN (
    'competitor_gap', 'occasion', 'prompt_missing', 'first_mover',
    'manual', 'hallucination_correction', 'review_gap', 'schema_gap',
    'intent_gap'
  ));
