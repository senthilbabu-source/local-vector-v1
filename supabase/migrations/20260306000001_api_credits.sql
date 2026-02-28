-- ---------------------------------------------------------------------------
-- Sprint D (N1): API Credits — Monthly usage tracking per org
--
-- Credits gate user-initiated LLM operations (Generate Brief, Run Analysis,
-- etc). Automated cron runs do NOT consume credits.
--
-- Each org has exactly one active credits row. Credits reset monthly.
-- ---------------------------------------------------------------------------

-- ── Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_credits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan          text NOT NULL,
  credits_used  integer NOT NULL DEFAULT 0,
  credits_limit integer NOT NULL,
  reset_date    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT api_credits_credits_non_negative CHECK (credits_used >= 0),
  CONSTRAINT api_credits_limit_positive CHECK (credits_limit > 0)
);

COMMENT ON TABLE public.api_credits IS
  'Monthly API credit tracking per org. Credits gate user-initiated LLM operations. Sprint D.';
COMMENT ON COLUMN public.api_credits.reset_date IS
  'UTC midnight on the first day of the next calendar month. credits_used resets to 0 at this date.';

-- ── Indexes ───────────────────────────────────────────────────────────────

-- Each org has exactly one active credits row:
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_credits_org_id
  ON public.api_credits (org_id);

-- For admin page sorting by usage:
CREATE INDEX IF NOT EXISTS idx_api_credits_usage
  ON public.api_credits (credits_used DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.api_credits ENABLE ROW LEVEL SECURITY;

-- Users can read their own org's credits (for TopBar meter display):
CREATE POLICY "Users can read own org credits"
  ON public.api_credits FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.memberships WHERE user_id = (
      SELECT id FROM public.users WHERE auth_provider_id = auth.uid()
    )
  ));

-- No user UPDATE/INSERT/DELETE policies — credits are only modified by
-- server-side service role client (checkCredit, consumeCredit).

-- ── RPC: Atomic credit increment ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_credits_used(p_org_id uuid)
RETURNS void AS $$
  UPDATE public.api_credits
  SET credits_used = credits_used + 1,
      updated_at = now()
  WHERE org_id = p_org_id;
$$ LANGUAGE sql SECURITY DEFINER;

COMMENT ON FUNCTION public.increment_credits_used IS
  'Atomically increments credits_used by 1 for an org. SECURITY DEFINER so it bypasses RLS. Sprint D.';
