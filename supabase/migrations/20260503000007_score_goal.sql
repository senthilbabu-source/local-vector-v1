-- ---------------------------------------------------------------------------
-- S71: Add score_goal JSONB column to org_settings
-- Stores { targetScore: number, deadline: string } for GoalTrackerCard
-- ---------------------------------------------------------------------------

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS score_goal jsonb DEFAULT NULL;

COMMENT ON COLUMN public.org_settings.score_goal IS 'S71: Score goal — { targetScore: number, deadline: string (ISO date) }';
