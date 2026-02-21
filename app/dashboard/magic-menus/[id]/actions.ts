'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
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
      error: parsed.error.errors[0]?.message ?? 'Invalid input',
    };
  }

  const { name, menu_id } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { error } = await supabase.from('menu_categories').insert({
    org_id: ctx.orgId, // ALWAYS server-derived — never from client
    menu_id,
    name,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Revalidate the specific editor page so the new category appears immediately
  revalidatePath(`/dashboard/magic-menus/${menu_id}`);
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
      error: parsed.error.errors[0]?.message ?? 'Invalid input',
    };
  }

  const { name, description, price, category_id, menu_id } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

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

  // Revalidate the specific editor page so the new item appears immediately
  revalidatePath(`/dashboard/magic-menus/${menu_id}`);
  return { success: true };
}
