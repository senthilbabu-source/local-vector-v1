-- ══════════════════════════════════════════════════════════════
-- Sprint 108: Semantic Authority Mapping — New Tables + Columns
-- ══════════════════════════════════════════════════════════════

-- 1. entity_authority_citations — per-tenant citation tracking
--    NOTE: citation_source_intelligence is AGGREGATE market data (not touched here)
--    This table is per-TENANT, per-RUN.
CREATE TABLE IF NOT EXISTS public.entity_authority_citations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id             uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url                text        NOT NULL,
  domain             text        NOT NULL,
  tier               text        NOT NULL CHECK (tier IN ('tier1','tier2','tier3','unknown')),
  source_type        text        NOT NULL,
  snippet            text,
  sentiment          text        CHECK (sentiment IN ('positive','neutral','negative','unknown'))
                                 DEFAULT 'unknown',
  is_sameas_candidate boolean    NOT NULL DEFAULT false,
  detected_at        timestamptz NOT NULL DEFAULT now(),
  run_month          text        NOT NULL,   -- YYYY-MM: which cron run produced this
  UNIQUE (location_id, url, run_month)       -- One record per URL per monthly run
);

ALTER TABLE public.entity_authority_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authority_citations: org members read own"
  ON public.entity_authority_citations FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "authority_citations: service role full access"
  ON public.entity_authority_citations FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_authority_citations_location_month
  ON public.entity_authority_citations (location_id, run_month);

CREATE INDEX IF NOT EXISTS idx_authority_citations_tier
  ON public.entity_authority_citations (location_id, tier, detected_at DESC);

COMMENT ON TABLE public.entity_authority_citations IS
  'Per-tenant citation sources detected via Perplexity Sonar. Sprint 108.
   Distinct from citation_source_intelligence (aggregate market data).';

-- ──────────────────────────────────────────────────────────────

-- 2. entity_authority_profiles — current authority state per location
CREATE TABLE IF NOT EXISTS public.entity_authority_profiles (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                   uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_authority_score   integer     NOT NULL CHECK (entity_authority_score BETWEEN 0 AND 100),

  -- Dimension scores (denormalized for fast dashboard queries)
  tier1_citation_score     integer     NOT NULL DEFAULT 0,
  tier2_coverage_score     integer     NOT NULL DEFAULT 0,
  platform_breadth_score   integer     NOT NULL DEFAULT 0,
  sameas_score             integer     NOT NULL DEFAULT 0,
  velocity_score           integer     NOT NULL DEFAULT 5,

  -- Tier counts
  tier1_count              integer     NOT NULL DEFAULT 0,
  tier2_count              integer     NOT NULL DEFAULT 0,
  tier3_count              integer     NOT NULL DEFAULT 0,

  -- sameAs state
  sameas_gaps              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  sameas_count             integer     NOT NULL DEFAULT 0,

  -- Velocity
  citation_velocity        numeric(6,2),
  velocity_label           text        CHECK (velocity_label IN ('growing','stable','declining','unknown'))
                                       DEFAULT 'unknown',

  -- Recommendations
  recommendations          jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  snapshot_at              timestamptz NOT NULL DEFAULT now(),
  last_run_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id)  -- One profile per location (upsert on update)
);

ALTER TABLE public.entity_authority_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authority_profiles: org members read own"
  ON public.entity_authority_profiles FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "authority_profiles: service role full access"
  ON public.entity_authority_profiles FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.entity_authority_profiles IS
  'Current entity authority state per location. Upserted monthly. Sprint 108.';

-- ──────────────────────────────────────────────────────────────

-- 3. entity_authority_snapshots — monthly history for velocity calculation
CREATE TABLE IF NOT EXISTS public.entity_authority_snapshots (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                 uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_authority_score integer     NOT NULL,
  tier1_count            integer     NOT NULL DEFAULT 0,
  tier2_count            integer     NOT NULL DEFAULT 0,
  tier3_count            integer     NOT NULL DEFAULT 0,
  total_citations        integer     NOT NULL DEFAULT 0,
  sameas_count           integer     NOT NULL DEFAULT 0,
  snapshot_month         text        NOT NULL,   -- YYYY-MM
  created_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id, snapshot_month)  -- One snapshot per location per month
);

ALTER TABLE public.entity_authority_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authority_snapshots: org members read own"
  ON public.entity_authority_snapshots FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "authority_snapshots: service role full access"
  ON public.entity_authority_snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_authority_snapshots_location_month
  ON public.entity_authority_snapshots (location_id, snapshot_month DESC);

COMMENT ON TABLE public.entity_authority_snapshots IS
  'Monthly authority score history for velocity trending. Sprint 108.';

-- ──────────────────────────────────────────────────────────────

-- 4. Add authority columns to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS authority_score        integer CHECK (authority_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS authority_last_run_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_locations_authority
  ON public.locations (org_id, authority_score)
  WHERE authority_score IS NOT NULL;

COMMENT ON COLUMN public.locations.authority_score IS
  'Entity authority score 0–100. NULL = never run. Sprint 108.';
COMMENT ON COLUMN public.locations.authority_last_run_at IS
  'Timestamp of last successful authority mapping run. Sprint 108.';
