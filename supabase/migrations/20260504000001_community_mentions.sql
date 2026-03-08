-- Sprint 6: Community platform brand mention monitoring (Nextdoor + Quora)
-- Uses Perplexity web search to detect mentions. One row per org/platform/mention.

CREATE TABLE IF NOT EXISTS public.community_mentions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  platform        text NOT NULL CHECK (platform IN ('nextdoor', 'quora')),
  mention_key     text NOT NULL,           -- hash of platform+content for dedup
  content         text NOT NULL,           -- the mention text extracted by Perplexity
  author          text,                    -- poster name if available
  url             text,                    -- direct URL if Perplexity returns one
  sentiment       text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  detected_at     timestamptz NOT NULL DEFAULT now(),
  approximate_date text,                   -- "2 weeks ago", "March 2026" etc.
  UNIQUE (org_id, mention_key)
);

ALTER TABLE public.community_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_community_mentions"
  ON public.community_mentions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_community_mentions_org_platform
  ON public.community_mentions (org_id, platform, detected_at DESC);

COMMENT ON TABLE public.community_mentions IS
  'Sprint 6: Nextdoor and Quora brand mentions detected via Perplexity search. '
  'Distinct from reddit_brand_mentions (official API) — this uses LLM web search.';
