-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 115: White-Label Theming + Emails
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. org_themes table
CREATE TABLE IF NOT EXISTS public.org_themes (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid          NOT NULL UNIQUE
                                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_color         text          NOT NULL DEFAULT '#6366f1'
                                      CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color          text          NOT NULL DEFAULT '#8b5cf6'
                                      CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  text_on_primary       text          NOT NULL DEFAULT '#ffffff'
                                      CHECK (text_on_primary IN ('#ffffff', '#000000')),
  font_family           text          NOT NULL DEFAULT 'Inter',
  logo_url              text,
  logo_storage_path     text,
  show_powered_by       boolean       NOT NULL DEFAULT true,
  created_at            timestamptz   NOT NULL DEFAULT NOW(),
  updated_at            timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.org_themes IS
  'Per-org brand theme config for white-label. Sprint 115. '
  'One row per org (UNIQUE org_id). Colors validated as hex. '
  'text_on_primary is auto-computed and stored for email use. '
  'logo_url is the Supabase Storage public URL.';

-- 2. RLS
ALTER TABLE public.org_themes ENABLE ROW LEVEL SECURITY;

-- All org members can read the theme (needed for dashboard rendering)
CREATE POLICY "org_themes: members can read"
  ON public.org_themes FOR SELECT
  USING (org_id = public.current_user_org_id());

-- Owner only can insert
CREATE POLICY "org_themes: owner can insert"
  ON public.org_themes FOR INSERT
  WITH CHECK (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.memberships om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid()
        )
        AND om.role    = 'owner'
    )
  );

-- Owner only can update
CREATE POLICY "org_themes: owner can update"
  ON public.org_themes FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.memberships om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid()
        )
        AND om.role    = 'owner'
    )
  );

-- Service role full access (root layout fetches theme via service role for perf)
CREATE POLICY "org_themes: service role full access"
  ON public.org_themes
  USING (auth.role() = 'service_role');

-- 3. Supabase Storage bucket for org logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read, org owner write
CREATE POLICY "org-logos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

CREATE POLICY "org-logos: owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

CREATE POLICY "org-logos: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = public.current_user_org_id()::text
  );
