-- ---------------------------------------------------------------------------
-- P6-FIX-25: Enable RLS on 10 tenant-scoped tables that were missing it
--
-- All tables below have an org_id column referencing organizations(id).
-- Policy pattern: org_id = public.current_user_org_id()
-- Service-role clients bypass RLS (used by crons that write to these tables).
-- ---------------------------------------------------------------------------

-- 1. entity_authority_citations
ALTER TABLE public.entity_authority_citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entity_authority_citations_select_own" ON public.entity_authority_citations
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "entity_authority_citations_insert_own" ON public.entity_authority_citations
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "entity_authority_citations_update_own" ON public.entity_authority_citations
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "entity_authority_citations_delete_own" ON public.entity_authority_citations
  FOR DELETE USING (org_id = public.current_user_org_id());

-- 2. entity_authority_profiles
ALTER TABLE public.entity_authority_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entity_authority_profiles_select_own" ON public.entity_authority_profiles
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "entity_authority_profiles_insert_own" ON public.entity_authority_profiles
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "entity_authority_profiles_update_own" ON public.entity_authority_profiles
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "entity_authority_profiles_delete_own" ON public.entity_authority_profiles
  FOR DELETE USING (org_id = public.current_user_org_id());

-- 3. entity_authority_snapshots
ALTER TABLE public.entity_authority_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entity_authority_snapshots_select_own" ON public.entity_authority_snapshots
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "entity_authority_snapshots_insert_own" ON public.entity_authority_snapshots
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "entity_authority_snapshots_update_own" ON public.entity_authority_snapshots
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "entity_authority_snapshots_delete_own" ON public.entity_authority_snapshots
  FOR DELETE USING (org_id = public.current_user_org_id());

-- 4. intent_discoveries
ALTER TABLE public.intent_discoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intent_discoveries_select_own" ON public.intent_discoveries
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "intent_discoveries_insert_own" ON public.intent_discoveries
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "intent_discoveries_update_own" ON public.intent_discoveries
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "intent_discoveries_delete_own" ON public.intent_discoveries
  FOR DELETE USING (org_id = public.current_user_org_id());

-- 5. listing_platform_ids
ALTER TABLE public.listing_platform_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listing_platform_ids_select_own" ON public.listing_platform_ids
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "listing_platform_ids_insert_own" ON public.listing_platform_ids
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "listing_platform_ids_update_own" ON public.listing_platform_ids
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "listing_platform_ids_delete_own" ON public.listing_platform_ids
  FOR DELETE USING (org_id = public.current_user_org_id());

-- 6. listing_snapshots
ALTER TABLE public.listing_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listing_snapshots_select_own" ON public.listing_snapshots
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "listing_snapshots_insert_own" ON public.listing_snapshots
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "listing_snapshots_update_own" ON public.listing_snapshots
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "listing_snapshots_delete_own" ON public.listing_snapshots
  FOR DELETE USING (org_id = public.current_user_org_id());

-- 7. nap_discrepancies
ALTER TABLE public.nap_discrepancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nap_discrepancies_select_own" ON public.nap_discrepancies
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "nap_discrepancies_insert_own" ON public.nap_discrepancies
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "nap_discrepancies_update_own" ON public.nap_discrepancies
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "nap_discrepancies_delete_own" ON public.nap_discrepancies
  FOR DELETE USING (org_id = public.current_user_org_id());

-- 8. page_schemas
ALTER TABLE public.page_schemas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page_schemas_select_own" ON public.page_schemas
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "page_schemas_insert_own" ON public.page_schemas
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "page_schemas_update_own" ON public.page_schemas
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "page_schemas_delete_own" ON public.page_schemas
  FOR DELETE USING (org_id = public.current_user_org_id());

-- 9. post_publish_audits
ALTER TABLE public.post_publish_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_publish_audits_select_own" ON public.post_publish_audits
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "post_publish_audits_insert_own" ON public.post_publish_audits
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "post_publish_audits_update_own" ON public.post_publish_audits
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "post_publish_audits_delete_own" ON public.post_publish_audits
  FOR DELETE USING (org_id = public.current_user_org_id());

-- 10. vaio_profiles
ALTER TABLE public.vaio_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vaio_profiles_select_own" ON public.vaio_profiles
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "vaio_profiles_insert_own" ON public.vaio_profiles
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "vaio_profiles_update_own" ON public.vaio_profiles
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "vaio_profiles_delete_own" ON public.vaio_profiles
  FOR DELETE USING (org_id = public.current_user_org_id());

-- Tables intentionally without RLS:
-- local_occasions — global lookup table (no org_id column)
-- directories     — global reference data (no org_id column)
