-- ---------------------------------------------------------------------------
-- P8-FIX-37: Hijacking Alerts
--
-- Tracks when an AI engine confuses a business with a competitor.
-- Three hijack types: attribute_confusion, competitor_citation, address_mix.
-- Agency-only feature. Populated by weekly hijack-detection cron.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hijacking_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    location_id     UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    engine          TEXT NOT NULL,
    query_text      TEXT NOT NULL,
    hijack_type     TEXT NOT NULL,
    our_business    TEXT NOT NULL,
    competitor_name TEXT NOT NULL,
    evidence_text   TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'medium',
    status          TEXT NOT NULL DEFAULT 'new',
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    email_sent_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT hijacking_alerts_hijack_type_check CHECK (hijack_type IN ('attribute_confusion', 'competitor_citation', 'address_mix')),
    CONSTRAINT hijacking_alerts_severity_check CHECK (severity IN ('critical', 'high', 'medium')),
    CONSTRAINT hijacking_alerts_status_check CHECK (status IN ('new', 'acknowledged', 'resolved'))
);

ALTER TABLE public.hijacking_alerts OWNER TO postgres;

-- RLS: standard 4-policy org isolation
ALTER TABLE public.hijacking_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hijacking_alerts_select_own" ON public.hijacking_alerts
    FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "hijacking_alerts_insert_own" ON public.hijacking_alerts
    FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "hijacking_alerts_update_own" ON public.hijacking_alerts
    FOR UPDATE USING (org_id = public.current_user_org_id());

CREATE POLICY "hijacking_alerts_delete_own" ON public.hijacking_alerts
    FOR DELETE USING (org_id = public.current_user_org_id());

-- Indexes
CREATE INDEX idx_hijacking_alerts_active ON public.hijacking_alerts (org_id, status) WHERE status = 'new';
CREATE INDEX idx_hijacking_alerts_org ON public.hijacking_alerts (org_id);
