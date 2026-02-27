-- Migration: 20260301000001_add_llms_txt_updated_at.sql
-- Sprint 97 — Dynamic llms.txt (Gap #62)
--
-- Adds a timestamp column to locations for tracking when the llms.txt
-- content was last regenerated. Used for CDN cache busting in the
-- dynamic /llms.txt route handler.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS llms_txt_updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.locations.llms_txt_updated_at IS
  'Timestamp of last llms.txt regeneration. Used for cache busting in the dynamic llms.txt route. Sprint 97.';
