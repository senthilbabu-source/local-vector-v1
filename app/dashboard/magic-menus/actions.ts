'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { toUniqueSlug } from '@/lib/utils/slug';
import {
  CreateMagicMenuSchema,
  type CreateMagicMenuInput,
} from '@/lib/schemas/magic-menus';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// createMagicMenu
// ---------------------------------------------------------------------------

/**
 * Server Action: insert a new Magic Menu record for the authenticated user's org.
 *
 * SECURITY: `org_id` is NEVER accepted from the client. It is derived
 * exclusively from the server-side session via `getSafeAuthContext()`.
 * The Supabase RLS `org_isolation_insert` policy on `magic_menus` provides
 * a second enforcement layer.
 *
 * ⚠️  PREREQUISITE: The `magic_menus` table currently has no INSERT RLS policy
 * for authenticated users. Apply the following before testing:
 *
 *   CREATE POLICY "org_isolation_insert" ON public.magic_menus
 *     FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
 *
 * Without it, the INSERT will be silently rejected (0 rows, no error).
 *
 * NOTE: `magic_menus` has no `name` column. The user-supplied name is
 * converted to a unique slug stored in `public_slug`.
 */
export async function createMagicMenu(
  input: CreateMagicMenuInput
): Promise<ActionResult> {
  // Step 1 — authenticate and derive org_id server-side (the RLS Rule)
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Step 2 — validate client-supplied fields
  const parsed = CreateMagicMenuSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Invalid input',
    };
  }

  const { name, location_id } = parsed.data;

  // Step 3 — derive a URL-safe unique slug from the menu name
  const publicSlug = toUniqueSlug(name);

  // Step 4 — insert with org_id derived from server-side session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { error } = await supabase.from('magic_menus').insert({
    org_id: ctx.orgId,        // ALWAYS server-derived — never from client
    location_id,
    public_slug: publicSlug,
    processing_status: 'uploading',
    is_published: false,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/magic-menus');
  return { success: true };
}

// ---------------------------------------------------------------------------
// toggleMenuStatus
// ---------------------------------------------------------------------------

/**
 * Server Action: flip the `is_published` state of a Magic Menu.
 *
 * When publishing: sets `is_published = true` and `processing_status = 'published'`.
 * When unpublishing: sets `is_published = false` and `processing_status = 'review_ready'`.
 *
 * SECURITY: RLS `org_isolation_update` on `magic_menus` ensures only rows
 * belonging to the authenticated user's org can be updated. `getSafeAuthContext()`
 * rejects unauthenticated callers before any DB interaction.
 *
 * The current `is_published` state is read from the DB (not trusted from the client)
 * so the toggle is always accurate regardless of stale client state.
 */
export async function toggleMenuStatus(menuId: string): Promise<ActionResult> {
  // Reject unauthenticated callers before any DB interaction
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Read the authoritative current state from the DB
  // RLS org_isolation_select ensures we can only read our own menus
  const { data: menu, error: fetchError } = await supabase
    .from('magic_menus')
    .select('is_published')
    .eq('id', menuId)
    .single() as { data: { is_published: boolean } | null; error: unknown };

  if (fetchError || !menu) {
    return { success: false, error: 'Menu not found' };
  }

  const newIsPublished = !menu.is_published;

  const { error: updateError } = await supabase
    .from('magic_menus')
    .update({
      is_published: newIsPublished,
      // Keep processing_status in sync with the published boolean
      processing_status: newIsPublished ? 'published' : 'review_ready',
    })
    .eq('id', menuId);
  // RLS org_isolation_update ensures only the user's own menu rows are touched

  if (updateError) {
    return { success: false, error: (updateError as { message: string }).message };
  }

  revalidatePath('/dashboard/magic-menus');
  return { success: true };
}
