-- ============================================================
-- MIGRATION: 20260221000001_public_menu_reads
-- Purpose:   Allow unauthenticated (anon) web crawlers to read
--            published Magic Menu data.
--
-- SECURITY MODEL:
--   • magic_menus  → SELECT allowed when is_published = TRUE
--   • locations    → SELECT allowed when ≥1 published menu
--                    references the location (EXISTS check)
--   • menu_categories → SELECT allowed when parent menu is
--                    published (EXISTS check on magic_menus)
--   • menu_items   → SELECT allowed when parent menu is
--                    published (EXISTS check on magic_menus)
--
-- The EXISTS pattern is used for all child tables so that RLS
-- never calls current_user_org_id() (which returns NULL for anon
-- and could cause confusing evaluation) and to avoid the
-- cross-table policy recursion that an IN subquery can trigger.
--
-- Applies after: 20260220000001_create_menu_categories.sql
-- ============================================================

-- ── 1. TABLE-LEVEL GRANTS ─────────────────────────────────────
-- RLS policies gate which ROWS are visible, but the anon role
-- also needs table-level SELECT permission to reach RLS at all.
-- These grants are narrow (SELECT only) and harmless because
-- RLS further restricts the rows returned.

GRANT SELECT ON public.magic_menus     TO anon;
GRANT SELECT ON public.locations       TO anon;
GRANT SELECT ON public.menu_categories TO anon;
GRANT SELECT ON public.menu_items      TO anon;

-- ── 2. magic_menus — public published-menu policy ────────────
-- The initial schema already created "public_published_menus".
-- Guard with an idempotent DO block so db reset doesn't fail if
-- the policy exists (from initial schema) or is absent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'magic_menus'
      AND policyname = 'public_published_menus'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "public_published_menus" ON public.magic_menus
        FOR SELECT
        USING (is_published = TRUE)
    $policy$;
  END IF;
END $$;

-- ── 3. locations — public policy via parent-menu EXISTS ───────
-- Allows anon SELECT on a location row only when at least one
-- published magic_menu points to that location.
-- Uses EXISTS (not IN) to avoid implicit subquery re-evaluation
-- per row and to prevent policy-recursion on magic_menus.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'locations'
      AND policyname = 'public_published_location'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "public_published_location" ON public.locations
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM   public.magic_menus mm
            WHERE  mm.location_id  = locations.id
              AND  mm.is_published = TRUE
          )
        )
    $policy$;
  END IF;
END $$;

-- ── 4. menu_categories — public policy via parent-menu EXISTS ─
-- Allows anon SELECT on a category row only when its parent
-- magic_menu is published. Direct FK: menu_categories.menu_id.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'menu_categories'
      AND policyname = 'public_published_categories'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "public_published_categories" ON public.menu_categories
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM   public.magic_menus mm
            WHERE  mm.id          = menu_categories.menu_id
              AND  mm.is_published = TRUE
          )
        )
    $policy$;
  END IF;
END $$;

-- ── 5. menu_items — replace IN-based policy with EXISTS ───────
-- The initial schema created "public_menu_items" using an IN
-- subquery: menu_id IN (SELECT id FROM magic_menus WHERE ...).
-- Replace it with the consistent EXISTS pattern.
-- This DO block drops the old policy first (if present) then
-- creates the new one, making the operation fully idempotent.

DO $$
BEGIN
  -- Drop the old IN-based policy if it still exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'menu_items'
      AND policyname = 'public_menu_items'
  ) THEN
    EXECUTE 'DROP POLICY "public_menu_items" ON public.menu_items';
  END IF;

  -- Create the EXISTS-based replacement
  EXECUTE $policy$
    CREATE POLICY "public_menu_items" ON public.menu_items
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM   public.magic_menus mm
          WHERE  mm.id          = menu_items.menu_id
            AND  mm.is_published = TRUE
        )
      )
  $policy$;
END $$;
