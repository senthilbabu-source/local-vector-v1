'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { toUniqueSlug } from '@/lib/utils/slug';
import {
  CreateLocationSchema,
  type CreateLocationInput,
} from '@/lib/schemas/locations';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Correction status enum (mirrors the DB correction_status ENUM)
// ---------------------------------------------------------------------------

export type CorrectionStatus =
  | 'open'
  | 'verifying'
  | 'fixed'
  | 'dismissed'
  | 'recurring';

// ---------------------------------------------------------------------------
// createLocation
// ---------------------------------------------------------------------------

/**
 * Server Action: insert a new location for the authenticated user's org.
 *
 * SECURITY: `org_id` is NEVER accepted from the client. It is derived
 * exclusively from the server-side session via `getSafeAuthContext()`.
 * The Supabase RLS `org_isolation_insert` policy on `locations` provides
 * a second layer of enforcement.
 */
export async function createLocation(
  input: CreateLocationInput
): Promise<ActionResult> {
  // Step 1 — authenticate and derive org_id server-side
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Step 2 — validate the client-supplied fields
  const parsed = CreateLocationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Invalid input',
    };
  }

  const { business_name, address_line1, city, state, zip, phone, website_url } =
    parsed.data;

  // Step 3 — generate a slug unique within the org
  const slug = toUniqueSlug(business_name);

  // Step 4 — insert (RLS will reject if org_id doesn't match the session's org)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Step 4a — determine whether this will be the primary location.
  // The first location added for an org automatically becomes primary so that
  // the OnboardingGuard and magic-menus page (both filter is_primary=true)
  // can find it. Without is_primary=true the guard never fires and magic-menus
  // always shows "No location found" for new users.
  const { count: existingPrimaryCount } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true) as { count: number | null };

  const isPrimary = (existingPrimaryCount ?? 0) === 0;

  const { error } = await supabase.from('locations').insert({
    org_id: ctx.orgId,
    name: business_name,
    slug,
    business_name,
    address_line1,
    city,
    state,
    zip,
    phone: phone || null,
    website_url: website_url || null,
    is_primary: isPrimary,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Revalidate both paths: the locations list AND the dashboard layout so the
  // OnboardingGuard re-evaluates on the user's next navigation.
  revalidatePath('/dashboard/locations');
  revalidatePath('/dashboard');
  return { success: true };
}

// ---------------------------------------------------------------------------
// updateHallucinationStatus
// ---------------------------------------------------------------------------

/**
 * Server Action: update the `correction_status` of an AI hallucination row.
 *
 * SECURITY: RLS policy `org_isolation_update` on `ai_hallucinations` ensures
 * only rows belonging to the authenticated user's org can be updated —
 * no explicit org_id filter is required here, but `getSafeAuthContext()` is
 * still called to reject unauthenticated callers before touching the DB.
 */
export async function updateHallucinationStatus(
  hallucinationId: string,
  status: CorrectionStatus
): Promise<ActionResult> {
  // Reject unauthenticated callers before any DB interaction
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const resolvedAt =
    status === 'fixed' || status === 'dismissed'
      ? new Date().toISOString()
      : null;

  const { error } = await supabase
    .from('ai_hallucinations')
    .update({
      correction_status: status,
      ...(resolvedAt ? { resolved_at: resolvedAt } : {}),
    })
    .eq('id', hallucinationId);
  // RLS `org_isolation_update` automatically rejects rows not owned by this org

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/hallucinations');
  return { success: true };
}
