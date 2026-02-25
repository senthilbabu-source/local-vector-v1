-- ============================================================
-- Revenue Leak Scorecard — Feature #1
-- Adds business revenue config and leak snapshot tracking.
-- ============================================================

-- ── Revenue configuration per location ──────────────────────
-- Stores the business-specific inputs needed for revenue leak
-- calculation. Populated during onboarding or settings.
CREATE TABLE IF NOT EXISTS public.revenue_config (
    id              uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,

    -- Business revenue inputs
    business_type   varchar(50) NOT NULL DEFAULT 'restaurant',
    avg_ticket      numeric(10,2) NOT NULL DEFAULT 45.00,
    monthly_searches integer NOT NULL DEFAULT 2000,
    local_conversion_rate numeric(5,4) NOT NULL DEFAULT 0.0300,
    walk_away_rate  numeric(5,4) NOT NULL DEFAULT 0.6500,

    -- Metadata
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),

    UNIQUE(org_id, location_id)
);

ALTER TABLE public.revenue_config OWNER TO postgres;

-- RLS: org isolation
ALTER TABLE public.revenue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.revenue_config
    FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_insert" ON public.revenue_config
    FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_update" ON public.revenue_config
    FOR UPDATE USING (org_id = public.current_user_org_id());

-- ── Revenue leak snapshots ──────────────────────────────────
-- Stores calculated revenue leak per snapshot date.
-- Written by the SOV cron after each evaluation cycle.
CREATE TABLE IF NOT EXISTS public.revenue_snapshots (
    id              uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,

    -- Calculated values
    leak_low        numeric(10,2) NOT NULL DEFAULT 0,
    leak_high       numeric(10,2) NOT NULL DEFAULT 0,

    -- Breakdown components (JSONB for flexibility)
    breakdown       jsonb NOT NULL DEFAULT '{}',

    -- Inputs snapshot (frozen at calculation time)
    inputs_snapshot jsonb NOT NULL DEFAULT '{}',

    snapshot_date   date NOT NULL,
    created_at      timestamptz DEFAULT now(),

    UNIQUE(org_id, location_id, snapshot_date)
);

ALTER TABLE public.revenue_snapshots OWNER TO postgres;

-- RLS: org isolation
ALTER TABLE public.revenue_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.revenue_snapshots
    FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_insert" ON public.revenue_snapshots
    FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

-- Grants
GRANT ALL ON TABLE public.revenue_config TO anon;
GRANT ALL ON TABLE public.revenue_config TO authenticated;
GRANT ALL ON TABLE public.revenue_config TO service_role;

GRANT ALL ON TABLE public.revenue_snapshots TO anon;
GRANT ALL ON TABLE public.revenue_snapshots TO authenticated;
GRANT ALL ON TABLE public.revenue_snapshots TO service_role;

-- updated_at trigger for revenue_config
CREATE OR REPLACE TRIGGER set_updated_at_revenue_config
    BEFORE UPDATE ON public.revenue_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
