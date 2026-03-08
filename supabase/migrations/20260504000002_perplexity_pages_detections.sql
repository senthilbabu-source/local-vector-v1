-- Sprint 6: Perplexity Pages detection
-- Records when a perplexity.ai/page/ URL appears in sov_evaluations.cited_sources.
-- Populated by a post-processing pass on existing evaluation data.

CREATE TABLE IF NOT EXISTS public.perplexity_pages_detections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  evaluation_id   uuid REFERENCES public.sov_evaluations(id) ON DELETE SET NULL,
  page_url        text NOT NULL,
  page_title      text,
  engine          text NOT NULL,           -- which SOV engine cited this page
  query_text      text,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, page_url)
);

ALTER TABLE public.perplexity_pages_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_pp_detections"
  ON public.perplexity_pages_detections FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_pp_detections_org
  ON public.perplexity_pages_detections (org_id, last_seen_at DESC);

COMMENT ON TABLE public.perplexity_pages_detections IS
  'Sprint 6: Perplexity Pages (perplexity.ai/page/*) detected in SOV cited sources. '
  'These are user-created AI content pages that may reference the business. '
  'Populated by the community-monitor cron post-processing pass.';
