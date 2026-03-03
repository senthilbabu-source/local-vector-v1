-- Sprint 126: Agent-SEO Action Readiness Audit
-- Adds cached audit result columns to locations table.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS agent_seo_cache JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS agent_seo_audited_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.locations.agent_seo_cache IS
  'Cached ActionAuditResult JSON from Agent-SEO weekly audit. Sprint 126.';

COMMENT ON COLUMN public.locations.agent_seo_audited_at IS
  'Timestamp of the last Agent-SEO audit for this location. Sprint 126.';
