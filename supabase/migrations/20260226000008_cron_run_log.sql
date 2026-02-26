-- ---------------------------------------------------------------------------
-- Migration: Create cron_run_log table for operational observability
-- Sprint 62A: Cron Health Logging
--
-- Service-role only writes. No user-facing dashboard needed.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cron_run_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cron_name VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  summary JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constrain status values
ALTER TABLE public.cron_run_log
  ADD CONSTRAINT chk_cron_run_log_status
  CHECK (status IN ('running', 'success', 'failed', 'timeout'));

-- Index for recent-first queries by cron name
CREATE INDEX IF NOT EXISTS idx_cron_run_log_name_started
  ON public.cron_run_log (cron_name, started_at DESC);

-- RLS enabled, no policies → service-role only
ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;
