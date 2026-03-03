-- ---------------------------------------------------------------------------
-- Sprint N: Settings expansion — scan day preference + notification toggles
-- ---------------------------------------------------------------------------

-- Scan day of week: 0=Sunday, 1=Monday, ... 6=Saturday (default Sunday)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS scan_day_of_week integer DEFAULT 0
    CHECK (scan_day_of_week BETWEEN 0 AND 6);

-- Notification: Reality Score drop alert (on by default)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS notify_score_drop_alert boolean DEFAULT true;

-- Notification: New competitor detected (off by default)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS notify_new_competitor boolean DEFAULT false;

COMMENT ON COLUMN public.organizations.scan_day_of_week IS
  'Day of week for weekly SOV scan: 0=Sunday .. 6=Saturday. Default Sunday.';
COMMENT ON COLUMN public.organizations.notify_score_drop_alert IS
  'Email alert when Reality Score drops by threshold points between scans.';
COMMENT ON COLUMN public.organizations.notify_new_competitor IS
  'Email alert when a new competitor appears in AI visibility results.';
