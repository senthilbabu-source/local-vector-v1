-- Sprint 130: Apple Business Connect sync infrastructure.

CREATE TABLE IF NOT EXISTS public.apple_bc_connections (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id       uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  apple_location_id text,
  claim_status      text NOT NULL DEFAULT 'unclaimed'
                      CHECK (claim_status IN ('unclaimed', 'pending', 'claimed', 'error')),
  last_synced_at    timestamptz,
  sync_status       text CHECK (sync_status IN ('ok', 'error', 'pending', 'no_changes')),
  sync_error        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

CREATE TABLE IF NOT EXISTS public.apple_bc_sync_log (
  id               uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id      uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  fields_updated   text[] DEFAULT '{}',
  status           text NOT NULL CHECK (status IN ('success', 'error', 'no_changes', 'skipped')),
  error_message    text,
  apple_response   jsonb
);

-- RLS: org member read, service role write
ALTER TABLE public.apple_bc_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON public.apple_bc_connections
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON public.apple_bc_connections
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.apple_bc_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON public.apple_bc_sync_log
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON public.apple_bc_sync_log
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger: update updated_at on apple_bc_connections
CREATE TRIGGER set_apple_bc_connections_updated_at
  BEFORE UPDATE ON public.apple_bc_connections
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
