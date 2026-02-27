-- Sprint 80: Entity Knowledge Graph Health Monitor
-- Tracks entity presence across AI knowledge graph platforms.

CREATE TABLE IF NOT EXISTS public.entity_checks (
  id UUID DEFAULT extensions.uuid_generate_v4() NOT NULL,
  org_id UUID NOT NULL,
  location_id UUID NOT NULL,

  -- Per-platform status
  -- 'confirmed' = user/auto-verified present
  -- 'missing' = confirmed absent
  -- 'unchecked' = not yet verified
  -- 'incomplete' = present but missing data (e.g. Bing Places without hours)
  google_knowledge_panel VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  google_business_profile VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  yelp VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  tripadvisor VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  apple_maps VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  bing_places VARCHAR(20) DEFAULT 'unchecked' NOT NULL,
  wikidata VARCHAR(20) DEFAULT 'unchecked' NOT NULL,

  -- Optional metadata per platform (URLs, external IDs, notes)
  platform_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,

  -- Aggregate score: N of 6 core platforms confirmed (0-100)
  entity_score INTEGER DEFAULT 0 NOT NULL,

  -- Timestamps
  last_checked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT entity_checks_pkey PRIMARY KEY (id),
  CONSTRAINT entity_checks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT entity_checks_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE,
  CONSTRAINT entity_checks_org_location_unique UNIQUE (org_id, location_id),

  -- Status validation
  CONSTRAINT entity_checks_gkp_status CHECK (google_knowledge_panel IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_gbp_status CHECK (google_business_profile IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_yelp_status CHECK (yelp IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_tripadvisor_status CHECK (tripadvisor IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_apple_status CHECK (apple_maps IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_bing_status CHECK (bing_places IN ('confirmed', 'missing', 'unchecked', 'incomplete')),
  CONSTRAINT entity_checks_wikidata_status CHECK (wikidata IN ('confirmed', 'missing', 'unchecked', 'incomplete'))
);

ALTER TABLE public.entity_checks OWNER TO postgres;

-- RLS policies
ALTER TABLE public.entity_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.entity_checks
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_insert" ON public.entity_checks
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_update" ON public.entity_checks
  FOR UPDATE USING (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_delete" ON public.entity_checks
  FOR DELETE USING (org_id = public.current_user_org_id());

-- Indexes
CREATE INDEX idx_entity_checks_org ON public.entity_checks USING btree (org_id);

-- Trigger
CREATE TRIGGER set_updated_at_entity_checks
  BEFORE UPDATE ON public.entity_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants
GRANT ALL ON TABLE public.entity_checks TO anon;
GRANT ALL ON TABLE public.entity_checks TO authenticated;
GRANT ALL ON TABLE public.entity_checks TO service_role;
