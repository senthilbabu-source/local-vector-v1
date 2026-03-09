-- P0 Audit Fix: RLS policy gaps on org_themes, stripe_webhook_events, pending_gbp_imports
-- Production Audit 2026-03-08, Items #1 and #2
--
-- org_themes: has org_id, accessed via both auth + service role clients.
--   Needs standard org_isolation policies.
--
-- stripe_webhook_events: has org_id, accessed ONLY via service role client.
--   Add service-role-only INSERT + SELECT policies (defense-in-depth).
--
-- pending_gbp_imports: has org_id, accessed ONLY via service role client.
--   Add service-role-only INSERT + SELECT + DELETE policies (defense-in-depth).

-- ═══════════════════════════════════════════════════════════════════════════
-- org_themes — standard org isolation (members read, owner write)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "org_themes_org_isolation_select"
  ON public.org_themes FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "org_themes_org_isolation_insert"
  ON public.org_themes FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "org_themes_org_isolation_update"
  ON public.org_themes FOR UPDATE
  USING (org_id = public.current_user_org_id());

CREATE POLICY "org_themes_org_isolation_delete"
  ON public.org_themes FOR DELETE
  USING (org_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════════════════
-- stripe_webhook_events — service-role-only (no regular user access)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "stripe_webhook_events_service_role_select"
  ON public.stripe_webhook_events FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "stripe_webhook_events_service_role_insert"
  ON public.stripe_webhook_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- pending_gbp_imports — service-role-only (no regular user access)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "pending_gbp_imports_service_role_select"
  ON public.pending_gbp_imports FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "pending_gbp_imports_service_role_insert"
  ON public.pending_gbp_imports FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "pending_gbp_imports_service_role_delete"
  ON public.pending_gbp_imports FOR DELETE
  TO service_role
  USING (true);
