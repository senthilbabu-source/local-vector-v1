'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  CreateCategorySchema,
  CreateMenuItemSchema,
  type CreateCategoryInput,
  type CreateMenuItemInput,
} from '@/lib/schemas/menu-items';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Private helper: revalidate the public Honeypot page for this menu
// ---------------------------------------------------------------------------

/**
 * Looks up the menu's public_slug and, if the menu is currently published,
 * calls revalidatePath() for the public /m/[slug] route so that AI crawlers
 * and browsers always see the latest data without waiting for TTL expiry.
 *
 * Only triggers a revalidation when the menu is published — unpublished menus
 * have no live public page to invalidate.
 */
async function revalidatePublicPage(
  supabase: SupabaseClient<Database>,
  menuId: string
): Promise<void> {
  const { data } = (await supabase
    .from('magic_menus')
    .select('public_slug, is_published')
    .eq('id', menuId)
    .single()) as {
    data: { public_slug: string | null; is_published: boolean } | null;
    error: unknown;
  };

  if (data?.is_published && data.public_slug) {
    revalidatePath(`/m/${data.public_slug}`, 'page');
  }
}

// ---------------------------------------------------------------------------
// createMenuCategory
// ---------------------------------------------------------------------------

/**
 * Server Action: insert a new category for the given Magic Menu.
 *
 * SECURITY: `org_id` is NEVER accepted from the client. It is derived
 * exclusively from the server-side session via `getSafeAuthContext()`.
 * The `org_isolation_insert` RLS policy on `menu_categories` provides
 * a second enforcement layer.
 *
 * `menu_id` IS accepted from the client — it identifies which menu this
 * category belongs to and is not a security-sensitive field (RLS enforces
 * the org boundary; the client cannot create categories for another org's menu).
 */
export async function createMenuCategory(
  input: CreateCategoryInput
): Promise<ActionResult> {
  // Authenticate and derive org_id server-side (the RLS Rule)
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = CreateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { name, menu_id } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.from('menu_categories').insert({
    org_id: ctx.orgId, // ALWAYS server-derived — never from client
    menu_id,
    name,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Revalidate the dashboard editor page so the new category appears immediately
  revalidatePath(`/dashboard/magic-menus/${menu_id}`);
  // Revalidate the public Honeypot page so crawlers see the change right away
  await revalidatePublicPage(supabase, menu_id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// createMenuItem
// ---------------------------------------------------------------------------

/**
 * Server Action: insert a new item under the given category and menu.
 *
 * SECURITY: `org_id` is NEVER accepted from the client. Derived server-side.
 * The `org_isolation_insert` RLS policy on `menu_items` provides a second
 * enforcement layer — the client cannot insert items for another org's menu.
 */
export async function createMenuItem(
  input: CreateMenuItemInput
): Promise<ActionResult> {
  // Authenticate and derive org_id server-side (the RLS Rule)
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = CreateMenuItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { name, description, price, category_id, menu_id } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.from('menu_items').insert({
    org_id: ctx.orgId, // ALWAYS server-derived — never from client
    menu_id,
    category_id,
    name,
    description: description || null,
    price,
    currency: 'USD',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Revalidate the dashboard editor page so the new item appears immediately
  revalidatePath(`/dashboard/magic-menus/${menu_id}`);
  // Revalidate the public Honeypot page so crawlers see the change right away
  await revalidatePublicPage(supabase, menu_id);
  return { success: true };
}
