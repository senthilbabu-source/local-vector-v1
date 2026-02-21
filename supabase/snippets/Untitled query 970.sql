CREATE POLICY "org_isolation_insert" ON public.magic_menus
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());