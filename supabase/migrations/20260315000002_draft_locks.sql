-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 116: Supabase Realtime — Draft Locks
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. draft_locks table (heartbeat-based soft locks)
CREATE TABLE IF NOT EXISTS public.draft_locks (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id     uuid         NOT NULL REFERENCES public.content_drafts(id) ON DELETE CASCADE,
  org_id       uuid         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id      uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email   text         NOT NULL,
  user_name    text,
  locked_at    timestamptz  NOT NULL DEFAULT NOW(),
  expires_at   timestamptz  NOT NULL DEFAULT (NOW() + INTERVAL '90 seconds'),
  UNIQUE (draft_id, user_id)
);

COMMENT ON TABLE public.draft_locks IS
  'Soft co-editing lock registry for content_drafts. Sprint 116. '
  'Client writes lock on draft open, refreshes heartbeat every 30s, '
  'removes on unmount. Expired locks (expires_at < NOW()) are soft-deleted '
  'by the query pattern — no cron needed. Locks are advisory only.';

CREATE INDEX IF NOT EXISTS idx_draft_locks_draft_id
  ON public.draft_locks (draft_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_draft_locks_org_id
  ON public.draft_locks (org_id);

-- 2. RLS
ALTER TABLE public.draft_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "draft_locks: org members can read"
  ON public.draft_locks FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "draft_locks: user can insert own lock"
  ON public.draft_locks FOR INSERT
  WITH CHECK (
    org_id = public.current_user_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "draft_locks: user can update own lock"
  ON public.draft_locks FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "draft_locks: user or admin can delete"
  ON public.draft_locks FOR DELETE
  USING (
    org_id = public.current_user_org_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.memberships m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.org_id  = public.current_user_org_id()
          AND u.auth_provider_id = auth.uid()
          AND m.role    IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "draft_locks: service role full access"
  ON public.draft_locks
  USING (auth.role() = 'service_role');

-- 3. Enable Realtime for draft_locks (Postgres Changes listener)
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_locks;

-- 4. Enable Realtime for content_drafts if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'content_drafts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_drafts;
  END IF;
END $$;
