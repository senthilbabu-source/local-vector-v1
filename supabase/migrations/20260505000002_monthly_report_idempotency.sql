-- P1 Audit Fix #7: Monthly report idempotency
-- Prevents duplicate emails on Inngest/cron retries by tracking last send time.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS last_monthly_report_sent_at timestamptz;

COMMENT ON COLUMN organizations.last_monthly_report_sent_at
  IS 'Timestamp of last monthly report email sent. Used for idempotency — skip if already sent this month.';
