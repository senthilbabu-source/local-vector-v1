-- Sprint 122: Benchmark Comparisons
-- Two tables: anonymized aggregate snapshots + per-org percentile cache.

CREATE TABLE IF NOT EXISTS public.benchmark_snapshots (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key      text         NOT NULL,
  location_key      text         NOT NULL,
  category_label    text         NOT NULL,
  location_label    text         NOT NULL,
  sample_count      int          NOT NULL,
  score_median      numeric(5,1) NOT NULL,
  score_p25         numeric(5,1) NOT NULL,
  score_p75         numeric(5,1) NOT NULL,
  score_p90         numeric(5,1) NOT NULL,
  week_of           date         NOT NULL,
  computed_at       timestamptz  NOT NULL DEFAULT NOW(),
  UNIQUE (category_key, location_key, week_of)
);

COMMENT ON TABLE public.benchmark_snapshots IS
  'Anonymized weekly SOV aggregate stats per category+location. Sprint 122. '
  'Never stores individual org scores or org_ids. '
  'Minimum sample_count=5 enforced at write time.';

CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_bucket
  ON public.benchmark_snapshots (category_key, location_key, week_of DESC);

CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_week
  ON public.benchmark_snapshots (week_of DESC);

ALTER TABLE public.benchmark_snapshots ENABLE ROW LEVEL SECURITY;

-- NOTE: The open authenticated-read policy on benchmark_snapshots is INTENTIONAL.
-- This table contains only anonymous aggregates with no org linkage.
-- Any authenticated user reading it sees only industry-level stats, never org data.
-- Do NOT add org_id filtering here.
CREATE POLICY "benchmark_snapshots: authenticated can read"
  ON public.benchmark_snapshots FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "benchmark_snapshots: service role full access"
  ON public.benchmark_snapshots FOR ALL
  USING (auth.role() = 'service_role');

-- org_benchmark_cache: pre-computed percentile rank per org per week.
CREATE TABLE IF NOT EXISTS public.org_benchmark_cache (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid         NOT NULL
                               REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_id     uuid         NOT NULL
                               REFERENCES public.benchmark_snapshots(id) ON DELETE CASCADE,
  week_of         date         NOT NULL,
  org_sov_score   numeric(5,1) NOT NULL,
  percentile_rank numeric(5,1) NOT NULL,
  category_key    text         NOT NULL,
  location_key    text         NOT NULL,
  UNIQUE (org_id, week_of)
);

COMMENT ON TABLE public.org_benchmark_cache IS
  'Cached percentile rank per org per week. Sprint 122. '
  'Computed by benchmark cron. Read-only from dashboard.';

CREATE INDEX IF NOT EXISTS idx_org_benchmark_cache_org_week
  ON public.org_benchmark_cache (org_id, week_of DESC);

ALTER TABLE public.org_benchmark_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_benchmark_cache: members can read own"
  ON public.org_benchmark_cache FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "org_benchmark_cache: service role full access"
  ON public.org_benchmark_cache FOR ALL
  USING (auth.role() = 'service_role');
