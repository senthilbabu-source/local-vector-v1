-- ---------------------------------------------------------------------------
-- Migration: Add WordPress credential columns to location_integrations
-- Sprint 61C: WordPress Credential Management
--
-- These columns are nullable and only populated for platform='wordpress' rows.
-- Credentials are stored server-side only — never exposed to the client.
-- ---------------------------------------------------------------------------

ALTER TABLE public.location_integrations
  ADD COLUMN IF NOT EXISTS wp_username TEXT,
  ADD COLUMN IF NOT EXISTS wp_app_password TEXT;

COMMENT ON COLUMN public.location_integrations.wp_username IS 'WordPress username for REST API auth — server-side only';
COMMENT ON COLUMN public.location_integrations.wp_app_password IS 'WordPress Application Password — server-side only, never exposed to client';
