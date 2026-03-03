-- ---------------------------------------------------------------------------
-- P1-FIX-05: Manual scan status tracking on organizations table
--
-- Two nullable columns track the most recent manual SOV scan trigger.
-- Status lifecycle: NULL → 'pending' → 'running' → 'complete'/'failed' → NULL
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS last_manual_scan_triggered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS manual_scan_status text DEFAULT NULL
    CHECK (
      manual_scan_status IS NULL OR
      manual_scan_status IN ('pending', 'running', 'complete', 'failed')
    );

COMMENT ON COLUMN public.organizations.last_manual_scan_triggered_at IS
  'Timestamp of the most recent manual SOV scan trigger (P1-FIX-05)';
COMMENT ON COLUMN public.organizations.manual_scan_status IS
  'Status of the most recent manual SOV scan: pending|running|complete|failed|null (P1-FIX-05)';
