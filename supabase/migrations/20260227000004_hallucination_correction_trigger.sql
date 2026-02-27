-- Sprint 75: Add 'hallucination_correction' to content_drafts trigger_type CHECK constraint.

-- Drop and recreate the CHECK constraint with the new value
ALTER TABLE public.content_drafts
  DROP CONSTRAINT IF EXISTS content_drafts_trigger_type_check;

ALTER TABLE public.content_drafts
  ADD CONSTRAINT content_drafts_trigger_type_check
  CHECK (trigger_type::text = ANY (ARRAY[
    'competitor_gap', 'occasion', 'prompt_missing',
    'first_mover', 'manual', 'hallucination_correction'
  ]::text[]));
