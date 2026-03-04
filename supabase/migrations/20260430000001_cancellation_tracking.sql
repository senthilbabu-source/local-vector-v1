-- Migration: Add cancellation tracking columns to organizations
-- Sprint: Stripe Customer Portal Self-Service (§203)
--
-- Captures when a subscription was scheduled for cancellation (cancel_at_period_end)
-- and the user's cancellation feedback reason from Stripe Portal.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

COMMENT ON COLUMN public.organizations.canceled_at IS 'When subscription was set to cancel_at_period_end';
COMMENT ON COLUMN public.organizations.cancellation_reason IS 'Stripe cancellation feedback reason';
