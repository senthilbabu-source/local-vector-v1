-- Sprint 73: Add location_id to crawler_hits for multi-location filtering
ALTER TABLE public.crawler_hits
  ADD COLUMN IF NOT EXISTS location_id uuid
  REFERENCES public.locations(id) ON DELETE CASCADE;

-- Backfill existing rows (if any) by joining through magic_menus
UPDATE public.crawler_hits ch
SET location_id = mm.location_id
FROM public.magic_menus mm
WHERE ch.menu_id = mm.id
  AND ch.location_id IS NULL;

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_crawler_hits_org_location
  ON public.crawler_hits (org_id, location_id, crawled_at DESC);
