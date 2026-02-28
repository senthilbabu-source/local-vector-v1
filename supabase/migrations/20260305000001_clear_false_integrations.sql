-- Sprint C (C2): Clear false 'connected' statuses for non-GBP platforms
--
-- The mock sync (mockSyncIntegration) wrote status='connected' with
-- last_sync_at timestamps for platforms that have no real API sync.
-- This migration resets those to 'disconnected' so the UI shows honest state.
--
-- Only google (GBP) has real OAuth — all other 'connected' rows are from the mock.

UPDATE public.location_integrations
SET status = 'disconnected', last_sync_at = NULL
WHERE platform NOT IN ('google', 'wordpress')
  AND status IN ('connected', 'syncing');
