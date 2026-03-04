-- ---------------------------------------------------------------------------
-- Sprint 1: Distribution Engine — content_hash + last_distributed_at
--
-- content_hash: SHA-256 of deterministic menu content JSON.
--   Format: 'sha256-{64 hex chars}' = 71 chars max.
--   Used for change detection: skip distribution if hash unchanged.
--
-- last_distributed_at: Timestamp of the most recent successful distribution.
-- ---------------------------------------------------------------------------

ALTER TABLE public.magic_menus
  ADD COLUMN IF NOT EXISTS content_hash varchar(71),
  ADD COLUMN IF NOT EXISTS last_distributed_at timestamp with time zone;

COMMENT ON COLUMN public.magic_menus.content_hash IS
  'SHA-256 hash of menu content for change detection. Format: sha256-{hex}. Sprint 1 Distribution Engine.';
COMMENT ON COLUMN public.magic_menus.last_distributed_at IS
  'Timestamp of the most recent successful distribution to AI engines. Sprint 1 Distribution Engine.';
