-- ---------------------------------------------------------------------------
-- PLG Mechanics — pre-launch infrastructure (AI_RULES §211)
--
-- Three tables extended:
--   scan_leads:    email sequence tracking (step + converted_at)
--   organizations: churn reason capture from Stripe webhook
--   locations:     public share token for AI Health Score sharing
-- ---------------------------------------------------------------------------

-- scan_leads: track which step of the 3-email post-scan sequence each lead is on
ALTER TABLE public.scan_leads
  ADD COLUMN email_sequence_step integer NOT NULL DEFAULT 0,
  ADD COLUMN converted_at        timestamptz;

-- organizations: capture churn reason when subscription.deleted fires
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS churn_reason text,
  ADD COLUMN IF NOT EXISTS churned_at   timestamptz;

-- locations: unique public token for shareable AI Health Score page
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS public_share_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS locations_public_share_token_idx
  ON public.locations (public_share_token);
