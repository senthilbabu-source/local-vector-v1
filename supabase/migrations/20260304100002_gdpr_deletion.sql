-- ---------------------------------------------------------------------------
-- P6-FIX-26: GDPR deletion grace period fields on organizations
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

COMMENT ON COLUMN public.organizations.deletion_requested_at IS 'P6-FIX-26: GDPR — set when owner requests deletion. Cron hard-deletes after 7-day grace period.';
COMMENT ON COLUMN public.organizations.deletion_reason IS 'P6-FIX-26: Optional reason provided by owner during deletion request.';
