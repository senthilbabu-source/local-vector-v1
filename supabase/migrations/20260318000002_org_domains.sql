-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 114: White-Label Domains + Routing
-- ══════════════════════════════════════════════════════════════════════════════

-- NOTE: organizations.slug already exists (varchar(100), NOT NULL, UNIQUE).
-- No need to add it. The on_user_created trigger already generates slugs
-- from email prefix on org creation.

-- 1. org_domains table
CREATE TABLE IF NOT EXISTS public.org_domains (
  id                    uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid               NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain_type           text               NOT NULL CHECK (domain_type IN ('subdomain', 'custom')),
  domain_value          text               NOT NULL,
  verification_token    text               NOT NULL UNIQUE DEFAULT (
    'localvector-verify=' || encode(gen_random_bytes(16), 'hex')
  ),
  verification_status   text               NOT NULL DEFAULT 'unverified'
                                           CHECK (verification_status IN
                                             ('unverified', 'pending', 'verified', 'failed')),
  verified_at           timestamptz,
  last_checked_at       timestamptz,
  created_at            timestamptz        NOT NULL DEFAULT NOW(),
  updated_at            timestamptz        NOT NULL DEFAULT NOW(),
  -- One domain entry per type per org
  UNIQUE (org_id, domain_type)
);

COMMENT ON TABLE public.org_domains IS
  'Custom domain and subdomain configuration per org. Sprint 114. '
  'Each org has at most one subdomain row and one custom domain row. '
  'Verification required for custom domains before routing activates.';

-- 2. Indexes

-- Powers the hot path: every request does hostname → org lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_domains_value_verified
  ON public.org_domains (domain_value)
  WHERE verification_status = 'verified';

-- General domain_value lookup for verification checks
CREATE INDEX IF NOT EXISTS idx_org_domains_domain_value
  ON public.org_domains (domain_value);

-- Org-level lookup
CREATE INDEX IF NOT EXISTS idx_org_domains_org_id
  ON public.org_domains (org_id);

-- 3. RLS
ALTER TABLE public.org_domains ENABLE ROW LEVEL SECURITY;

-- Members can read their org's domain config
CREATE POLICY "org_domains: members can read"
  ON public.org_domains FOR SELECT
  USING (org_id = public.current_user_org_id());

-- Only owner can insert domain config
CREATE POLICY "org_domains: owner can insert"
  ON public.org_domains FOR INSERT
  WITH CHECK (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id  = public.current_user_org_id()
        AND m.user_id = (SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid())
        AND m.role    = 'owner'
    )
  );

-- Only owner can update domain config
CREATE POLICY "org_domains: owner can update"
  ON public.org_domains FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id  = public.current_user_org_id()
        AND m.user_id = (SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid())
        AND m.role    = 'owner'
    )
  );

-- Only owner can delete domain config
CREATE POLICY "org_domains: owner can delete"
  ON public.org_domains FOR DELETE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id  = public.current_user_org_id()
        AND m.user_id = (SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid())
        AND m.role    = 'owner'
    )
  );

-- Service role full access (middleware domain resolution runs as service role)
CREATE POLICY "org_domains: service role full access"
  ON public.org_domains
  USING (auth.role() = 'service_role');

-- 4. Seed subdomain rows for existing orgs
INSERT INTO public.org_domains (org_id, domain_type, domain_value, verification_status, verified_at)
SELECT
  id,
  'subdomain',
  slug || '.localvector.ai',
  'verified',
  NOW()
FROM public.organizations
WHERE slug IS NOT NULL
ON CONFLICT (org_id, domain_type) DO NOTHING;
