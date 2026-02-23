-- ---------------------------------------------------------------------------
-- 20260224000003_listing_url_column.sql — Sprint 27A
--
-- Adds listing_url to location_integrations so users can record the
-- canonical URL for each platform listing (e.g., their Google Business
-- Profile URL). This surfaces in the Listings → Big 6 table as an editable
-- text field.
--
-- Phase 8b will populate this automatically after OAuth connection.
-- For now, users enter the URL manually (immediately actionable).
-- ---------------------------------------------------------------------------

ALTER TABLE public.location_integrations
  ADD COLUMN IF NOT EXISTS listing_url TEXT;

COMMENT ON COLUMN public.location_integrations.listing_url IS
  'Canonical URL for this platform listing (e.g. https://g.page/your-business). Set manually by the user; auto-populated by OAuth sync in Phase 8b.';
