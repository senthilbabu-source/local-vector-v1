-- Sprint 4: Reddit brand mention monitoring
CREATE TABLE IF NOT EXISTS public.reddit_brand_mentions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  reddit_post_id  text NOT NULL,
  post_type       text NOT NULL CHECK (post_type IN ('post', 'comment')),
  subreddit       text NOT NULL,
  title           text,
  body            text NOT NULL,
  author          text NOT NULL,
  url             text NOT NULL,
  score           integer NOT NULL DEFAULT 0,
  sentiment       text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  detected_at     timestamptz NOT NULL DEFAULT now(),
  post_created_at timestamptz,
  UNIQUE (org_id, reddit_post_id)
);

ALTER TABLE public.reddit_brand_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_reddit_mentions"
  ON public.reddit_brand_mentions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_reddit_mentions_org_detected
  ON public.reddit_brand_mentions (org_id, detected_at DESC);

COMMENT ON TABLE public.reddit_brand_mentions IS
  'Sprint 4: Reddit brand mentions for proactive monitoring. '
  'Populated by the reddit-monitor cron. One row per org/post.';
