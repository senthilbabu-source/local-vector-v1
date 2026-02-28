-- Sprint F: Engagement & Retention — schema additions for N3 + N4
-- N3: Correction Follow-Up tracking columns on ai_hallucinations
-- N4: Benchmarks table for city+industry comparison

-- ---------------------------------------------------------------------------
-- N3: Add follow-up tracking columns to ai_hallucinations
-- ---------------------------------------------------------------------------

ALTER TABLE public.ai_hallucinations
  ADD COLUMN IF NOT EXISTS correction_query text,
  ADD COLUMN IF NOT EXISTS verifying_since timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_result text;

COMMENT ON COLUMN public.ai_hallucinations.correction_query IS
  'Original claim text used for follow-up re-check. Set when status → verifying. Sprint F.';
COMMENT ON COLUMN public.ai_hallucinations.verifying_since IS
  'Timestamp when alert entered verifying status. Follow-up cron triggers 14 days after this. Sprint F.';
COMMENT ON COLUMN public.ai_hallucinations.follow_up_checked_at IS
  'When the follow-up cron last checked this alert. Sprint F.';
COMMENT ON COLUMN public.ai_hallucinations.follow_up_result IS
  'Result of follow-up check: fixed | recurring | null (not yet checked). Sprint F.';

-- Index for the follow-up cron query: verifying + not yet checked + old enough
CREATE INDEX IF NOT EXISTS idx_hallucinations_followup
  ON public.ai_hallucinations (correction_status, verifying_since)
  WHERE correction_status = 'verifying' AND follow_up_checked_at IS NULL;

-- ---------------------------------------------------------------------------
-- N4: Benchmarks table — pre-computed city+industry averages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.benchmarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city        text NOT NULL,
  industry    text NOT NULL DEFAULT 'restaurant',
  org_count   integer NOT NULL,
  avg_score   numeric(5,2) NOT NULL,
  min_score   numeric(5,2) NOT NULL,
  max_score   numeric(5,2) NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT benchmarks_city_industry UNIQUE (city, industry)
);

ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read benchmarks"
  ON public.benchmarks FOR SELECT
  TO authenticated
  USING (true);

-- Service role needs full access for the cron upsert
CREATE POLICY "Service role can manage benchmarks"
  ON public.benchmarks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.benchmarks IS
  'Pre-computed weekly city+industry benchmark averages. Sprint F (N4).';

-- ---------------------------------------------------------------------------
-- N4: RPC function for benchmark aggregation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_benchmarks()
RETURNS TABLE(
  city       text,
  industry   text,
  org_count  bigint,
  avg_score  numeric,
  min_score  numeric,
  max_score  numeric
) AS $$
  SELECT
    l.city,
    COALESCE(NULLIF(l.categories->>0, ''), 'Restaurant') AS industry,
    COUNT(DISTINCT o.id)::bigint                          AS org_count,
    ROUND(AVG(vs.reality_score)::numeric, 2)              AS avg_score,
    MIN(vs.reality_score)::numeric                        AS min_score,
    MAX(vs.reality_score)::numeric                        AS max_score
  FROM public.organizations o
  JOIN public.locations l    ON l.org_id = o.id AND l.is_primary = true
  JOIN public.visibility_scores vs ON vs.org_id = o.id
  WHERE vs.reality_score IS NOT NULL
    AND l.city IS NOT NULL
  GROUP BY l.city, COALESCE(NULLIF(l.categories->>0, ''), 'Restaurant')
  HAVING COUNT(DISTINCT o.id) >= 3
  ORDER BY COUNT(DISTINCT o.id) DESC;
$$ LANGUAGE sql SECURITY DEFINER;

COMMENT ON FUNCTION public.compute_benchmarks IS
  'Aggregates reality_score by city+industry for benchmark comparison. Min 3 orgs. Sprint F.';
