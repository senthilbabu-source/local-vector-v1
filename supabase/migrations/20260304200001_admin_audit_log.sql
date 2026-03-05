-- ---------------------------------------------------------------------------
-- Migration: admin_audit_log — Sprint §204 (Admin Write Operations)
--
-- Append-only audit trail for admin actions (plan overrides, cancellations,
-- credit grants, impersonation, forced cron runs).
--
-- Security: RLS enabled with NO policies → only service-role can read/write.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email   TEXT NOT NULL,
  action        TEXT NOT NULL,
  target_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  details       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enabled with zero policies = service-role only access
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Index for admin dashboard queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON admin_audit_log (created_at DESC);

-- Index for filtering by target org
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_org
  ON admin_audit_log (target_org_id)
  WHERE target_org_id IS NOT NULL;
