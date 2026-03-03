-- Sprint 134: Per-Engine Optimization Playbooks
-- Caches generated playbooks on locations table.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS playbook_cache JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS playbook_generated_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.locations.playbook_cache IS
  'Cached per-engine Playbook objects keyed by model_provider. Sprint 134.';
COMMENT ON COLUMN public.locations.playbook_generated_at IS
  'Timestamp of last playbook generation. Sprint 134.';
