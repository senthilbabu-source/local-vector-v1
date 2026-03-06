-- S27: Monthly Report + First Scan Tracking
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS notify_monthly_report boolean NOT NULL DEFAULT true;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS first_scan_completed_at timestamptz;
