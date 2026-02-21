-- ============================================================
-- MIGRATION: 20260220000001_create_menu_categories
-- Purpose:   Introduce a dedicated menu_categories table and
--            replace the flat `category VARCHAR` column on
--            menu_items with a proper category_id FK.
--            Also patches all missing RLS INSERT/UPDATE/DELETE
--            policies on menu_categories and menu_items.
-- ============================================================

-- ── 1. CREATE menu_categories TABLE ─────────────────────────

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id         UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  menu_id    UUID          NOT NULL REFERENCES public.magic_menus(id)   ON DELETE CASCADE,
  name       VARCHAR(255)  NOT NULL,
  sort_order INTEGER       NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 2. ALTER menu_items ─────────────────────────────────────
-- Drop the flat string column and replace it with a nullable FK.
-- Existing rows will have category_id = NULL (uncategorised).
-- ON DELETE SET NULL ensures deleting a category does not cascade
-- to delete its items — they simply become uncategorised.

ALTER TABLE public.menu_items
  DROP COLUMN IF EXISTS category;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS category_id UUID
    REFERENCES public.menu_categories(id) ON DELETE SET NULL;

-- ── 3. INDEXES ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_menu_categories_menu
  ON public.menu_categories(menu_id);

CREATE INDEX IF NOT EXISTS idx_menu_categories_org
  ON public.menu_categories(org_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_category
  ON public.menu_items(category_id);

-- ── 4. ENABLE RLS ON NEW TABLE ───────────────────────────────

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS POLICIES — menu_categories (all four operations) ──

-- SELECT: org members can only read their own categories
CREATE POLICY "org_isolation_select" ON public.menu_categories
  FOR SELECT
  USING (org_id = public.current_user_org_id());

-- INSERT: org members can only create categories for their org
-- CRITICAL: Without this, inserts are silently rejected (RLS Shadowban)
CREATE POLICY "org_isolation_insert" ON public.menu_categories
  FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

-- UPDATE: org members can only update their own categories
CREATE POLICY "org_isolation_update" ON public.menu_categories
  FOR UPDATE
  USING  (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

-- DELETE: org members can only delete their own categories
CREATE POLICY "org_isolation_delete" ON public.menu_categories
  FOR DELETE
  USING (org_id = public.current_user_org_id());

-- ── 6. RLS POLICIES — menu_items (INSERT + UPDATE were missing) ──
-- SELECT and DELETE policies already exist from the initial schema.
-- Adding the two missing write policies here.

-- INSERT: org members can create items for their own menus
-- CRITICAL: Without this, inserts are silently rejected (RLS Shadowban)
CREATE POLICY "org_isolation_insert" ON public.menu_items
  FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

-- UPDATE: org members can update their own items
CREATE POLICY "org_isolation_update" ON public.menu_items
  FOR UPDATE
  USING  (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

-- ── 7. ALSO PATCH: magic_menus INSERT policy ─────────────────
-- This was documented as missing in Phase 5 DEVLOG.
-- Included here so a single `db reset` resolves all known gaps.
-- Guard with DO $$ block so it's idempotent on repeated resets.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'magic_menus'
      AND policyname = 'org_isolation_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "org_isolation_insert" ON public.magic_menus
        FOR INSERT
        WITH CHECK (org_id = public.current_user_org_id())
    $policy$;
  END IF;
END $$;

-- ── 8. ALSO PATCH: ai_hallucinations INSERT policy ───────────
-- Documented as missing since Phase 0 DEVLOG.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ai_hallucinations'
      AND policyname = 'org_isolation_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "org_isolation_insert" ON public.ai_hallucinations
        FOR INSERT
        WITH CHECK (org_id = public.current_user_org_id())
    $policy$;
  END IF;
END $$;
