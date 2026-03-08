-- Sprint 3: GSC AI Overview tracking
-- Stores query-level AI Overview presence from Google Search Console.
-- One row per (org_id, site_url, query, date) — upsertable.

CREATE TABLE IF NOT EXISTS public.gsc_ai_overview_data (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  site_url      text NOT NULL,
  query         text NOT NULL,
  date          date NOT NULL,
  clicks        integer NOT NULL DEFAULT 0,
  impressions   integer NOT NULL DEFAULT 0,
  ctr           numeric(5,4) NOT NULL DEFAULT 0,
  position      numeric(6,2) NOT NULL DEFAULT 0,
  has_ai_overview boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, site_url, query, date)
);

-- RLS
ALTER TABLE public.gsc_ai_overview_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_gsc_ai_overviews"
  ON public.gsc_ai_overview_data FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- Index for dashboard queries
CREATE INDEX idx_gsc_ai_overviews_org_date
  ON public.gsc_ai_overview_data (org_id, date DESC);

CREATE INDEX idx_gsc_ai_overviews_query
  ON public.gsc_ai_overview_data (org_id, query);

COMMENT ON TABLE public.gsc_ai_overview_data IS
  'Sprint 3: Google Search Console AI Overview presence data per query. '
  'Populated by the ai-overviews cron. One row per org/site/query/date combo.';
