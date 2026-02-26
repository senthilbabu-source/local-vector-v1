-- ---------------------------------------------------------------------------
-- Migration: Add notification preference columns to organizations
-- Sprint 62 — Sub-task E: Settings Completeness
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS notify_hallucination_alerts BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_weekly_digest BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_sov_alerts BOOLEAN DEFAULT TRUE;
