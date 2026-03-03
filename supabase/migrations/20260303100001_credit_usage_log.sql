-- ---------------------------------------------------------------------------
-- P3-FIX-14: Credit usage log — immutable audit trail of credit consumption
-- ---------------------------------------------------------------------------

-- Credits usage audit log (append-only)
CREATE TABLE IF NOT EXISTS public.credit_usage_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  operation     text NOT NULL,
  credits_used  integer NOT NULL CHECK (credits_used > 0),
  credits_before integer NOT NULL,
  credits_after  integer NOT NULL,
  reference_id  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: org members read own org's log via membership check
ALTER TABLE public.credit_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_credit_log"
  ON public.credit_usage_log FOR SELECT
  USING (
    org_id IN (
      SELECT m.org_id FROM public.memberships m
      WHERE m.user_id = auth.uid()
    )
  );

-- Index for history queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_credit_log_org_created
  ON public.credit_usage_log(org_id, created_at DESC);
