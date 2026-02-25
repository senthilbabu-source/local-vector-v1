-- 20260226000002_autopilot_trigger_idempotency.sql
--
-- Adds a partial unique index for (trigger_type, trigger_id) to enforce
-- idempotency at the DB level. Manual drafts (trigger_id IS NULL) are
-- excluded from the uniqueness constraint.
--
-- The existing SOV engine's upsert uses:
--   onConflict: 'trigger_type,trigger_id'
-- which needs a matching unique index/constraint.
--
-- Companion to Doc 19 §3.1 (createDraft idempotency check).

-- Drop the existing non-unique index
DROP INDEX IF EXISTS idx_content_drafts_trigger;

-- Create unique index on (trigger_type, trigger_id) WHERE trigger_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_drafts_trigger_unique
  ON public.content_drafts (trigger_type, trigger_id)
  WHERE trigger_id IS NOT NULL;
