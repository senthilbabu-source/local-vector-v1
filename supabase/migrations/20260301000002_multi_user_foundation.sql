-- ============================================================
-- Migration: 20260301000002_multi_user_foundation.sql
-- Sprint 98 — Multi-User Foundation: Invitations + Roles
--
-- EXISTING INFRASTRUCTURE (not modified):
--   - membership_role ENUM: 'owner' | 'admin' | 'member' | 'viewer'
--   - memberships table: id, user_id (→ public.users.id), org_id, role, created_at
--   - organizations.owner_user_id → public.users.id
--   - current_user_org_id() SECURITY DEFINER function (RLS core)
--   - handle_new_user() trigger: creates org + owner membership on signup
--
-- NEW:
--   1. pending_invitations table (token-based invite flow)
--   2. invited_by + joined_at columns on memberships
--   3. RLS policies on pending_invitations (org-scoped via current_user_org_id())
-- ============================================================

-- -------------------------------------------------------
-- 1. Add invited_by + joined_at to existing memberships
-- -------------------------------------------------------
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS joined_at  timestamptz NOT NULL DEFAULT now();

-- -------------------------------------------------------
-- 2. pending_invitations — token-based invitation tracking
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         public.membership_role NOT NULL DEFAULT 'viewer',
  token        text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

-- -------------------------------------------------------
-- 3. RLS on pending_invitations
-- -------------------------------------------------------
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Members can read their org's invitations
CREATE POLICY "invitations_org_isolation_select" ON public.pending_invitations
  FOR SELECT USING (org_id = public.current_user_org_id());

-- Members can insert invitations for their own org
-- (role check is enforced in the server action, not RLS — keeps RLS simple)
CREATE POLICY "invitations_org_isolation_insert" ON public.pending_invitations
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

-- Members can update invitations in their own org (for revoking)
CREATE POLICY "invitations_org_isolation_update" ON public.pending_invitations
  FOR UPDATE USING (org_id = public.current_user_org_id());

-- -------------------------------------------------------
-- 4. Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pending_invitations_token ON public.pending_invitations(token);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_org_id ON public.pending_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON public.pending_invitations(email);

-- -------------------------------------------------------
-- 5. Grants (match existing pattern for authenticated/anon/service_role)
-- -------------------------------------------------------
GRANT ALL ON TABLE public.pending_invitations TO anon;
GRANT ALL ON TABLE public.pending_invitations TO authenticated;
GRANT ALL ON TABLE public.pending_invitations TO service_role;
