-- ══════════════════════════════════════════════════════════════
-- Sprint 105: NAP Sync Engine — New Tables
-- ══════════════════════════════════════════════════════════════

-- 1. listing_platform_ids — Maps a location to its IDs on each platform
CREATE TABLE IF NOT EXISTS public.listing_platform_ids (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform     text NOT NULL CHECK (platform IN ('google', 'yelp', 'apple_maps', 'bing')),
  platform_id  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, platform)
);

ALTER TABLE public.listing_platform_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_platform_ids: org members can read own"
  ON public.listing_platform_ids FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "listing_platform_ids: service role full access"
  ON public.listing_platform_ids FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_listing_platform_ids_location
  ON public.listing_platform_ids (location_id, platform);

COMMENT ON TABLE public.listing_platform_ids IS
  'Maps LocalVector locations to their platform-specific IDs (GBP location name, Yelp business ID, etc). Sprint 105.';

-- ──────────────────────────────────────────────────────────────

-- 2. listing_snapshots — Raw NAP data captured from each platform per sync run
CREATE TABLE IF NOT EXISTS public.listing_snapshots (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id             uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform                text NOT NULL CHECK (platform IN ('google', 'yelp', 'apple_maps', 'bing')),
  fetch_status            text NOT NULL CHECK (fetch_status IN ('ok', 'unconfigured', 'api_error', 'not_found')),
  raw_nap_data            jsonb,
  fetched_at              timestamptz NOT NULL DEFAULT now(),
  correction_pushed_at    timestamptz,
  correction_fields       text[]
);

ALTER TABLE public.listing_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_snapshots: org members can read own"
  ON public.listing_snapshots FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "listing_snapshots: service role full access"
  ON public.listing_snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_listing_snapshots_location_platform
  ON public.listing_snapshots (location_id, platform, fetched_at DESC);

COMMENT ON TABLE public.listing_snapshots IS
  'Raw NAP data snapshots from each platform per sync run. Enables historical diff tracking. Sprint 105.';

-- ──────────────────────────────────────────────────────────────

-- 3. nap_discrepancies — Structured discrepancy records per platform per sync
CREATE TABLE IF NOT EXISTS public.nap_discrepancies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform            text NOT NULL CHECK (platform IN ('google', 'yelp', 'apple_maps', 'bing')),
  status              text NOT NULL CHECK (status IN ('match', 'discrepancy', 'unconfigured', 'api_error', 'not_found')),
  discrepant_fields   jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity            text NOT NULL CHECK (severity IN ('none', 'low', 'medium', 'high', 'critical')) DEFAULT 'none',
  auto_correctable    boolean NOT NULL DEFAULT false,
  fix_instructions    text,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz
);

ALTER TABLE public.nap_discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nap_discrepancies: org members can read own"
  ON public.nap_discrepancies FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "nap_discrepancies: service role full access"
  ON public.nap_discrepancies FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_nap_discrepancies_location
  ON public.nap_discrepancies (location_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_nap_discrepancies_unresolved
  ON public.nap_discrepancies (location_id, platform)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE public.nap_discrepancies IS
  'Structured discrepancy records between Ground Truth and live platform data. Sprint 105.';

-- ──────────────────────────────────────────────────────────────

-- 4. Add NAP health columns to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS nap_health_score      integer CHECK (nap_health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS nap_last_checked_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_locations_nap_health
  ON public.locations (org_id, nap_health_score)
  WHERE nap_health_score IS NOT NULL;

COMMENT ON COLUMN public.locations.nap_health_score IS
  'Composite 0–100 NAP accuracy score across all platforms. NULL = never checked. Sprint 105.';
COMMENT ON COLUMN public.locations.nap_last_checked_at IS
  'Timestamp of last successful NAP sync run. Sprint 105.';
