-- Sprint 5: Siri Readiness Score
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS siri_readiness_score integer;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS siri_readiness_last_scored_at timestamptz;

COMMENT ON COLUMN public.locations.siri_readiness_score IS
  'Sprint 5: 0-100 score measuring how complete the location data is '
  'for Apple Business Connect / Siri. Updated when ABC sync runs.';
