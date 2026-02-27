'use server';

// ---------------------------------------------------------------------------
// Location management server actions — Sprint 100
//
// All actions derive org_id from the authenticated session (AI_RULES §18).
// Role enforcement uses roleSatisfies() with ctx.role from getSafeAuthContext().
// Plan enforcement uses planSatisfies() for Agency-tier gating.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { planSatisfies, maxLocations, type PlanTier } from '@/lib/plan-enforcer';
import { toUniqueSlug } from '@/lib/utils/slug';
import {
  AddLocationSchema,
  UpdateLocationSchema,
  type AddLocationInput,
  type UpdateLocationInput,
} from '@/lib/schemas/locations';
import { LOCATION_COOKIE } from '@/lib/location/active-location';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T = void> = T extends void
  ? { success: true } | { success: false; error: string }
  : { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// addLocation — Create a new location for the org
// ---------------------------------------------------------------------------

export async function addLocation(
  input: AddLocationInput,
): Promise<ActionResult<{ locationId: string }>> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  // Role check: admin+ required
  if (!roleSatisfies(ctx.role, 'admin')) {
    return { success: false, error: 'Admin role required to add locations' };
  }

  // Plan check: multi-location requires Agency
  const plan = (ctx.plan ?? 'trial') as PlanTier;
  const supabase = await createClient();

  // Count existing non-archived locations
  const { count } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_archived', false);

  const existingCount = count ?? 0;
  const limit = maxLocations(plan);

  // Allow first location on any plan; enforce limit for subsequent
  if (existingCount >= limit) {
    return {
      success: false,
      error: limit === 1
        ? 'Upgrade to Agency plan for multiple locations'
        : `Location limit reached (${existingCount}/${limit})`,
    };
  }

  // Validate input
  const parsed = AddLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const d = parsed.data;
  const slug = toUniqueSlug(d.business_name);

  // Auto-primary: set is_primary if this is the first (non-archived) location
  const { count: primaryCount } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .eq('is_archived', false);

  const isPrimary = (primaryCount ?? 0) === 0;

  // Determine next location_order
  const { data: maxOrderRow } = await supabase
    .from('locations')
    .select('location_order')
    .eq('org_id', ctx.orgId)
    .order('location_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxOrderRow?.location_order as number | null) ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from('locations')
    .insert({
      org_id: ctx.orgId,
      name: d.business_name,
      slug,
      business_name: d.business_name,
      display_name: d.display_name || d.business_name,
      address_line1: d.address_line1,
      city: d.city,
      state: d.state,
      zip: d.zip,
      phone: d.phone || null,
      website_url: d.website_url || null,
      timezone: d.timezone || 'America/New_York',
      is_primary: isPrimary,
      location_order: nextOrder,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? 'Failed to create location' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings/locations');
  return { success: true, data: { locationId: inserted.id } };
}

// ---------------------------------------------------------------------------
// updateLocation — Update an existing location's details
// ---------------------------------------------------------------------------

export async function updateLocation(
  locationId: string,
  input: UpdateLocationInput,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  if (!roleSatisfies(ctx.role, 'admin')) {
    return { success: false, error: 'Admin role required to edit locations' };
  }

  const parsed = UpdateLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();

  // Verify location belongs to this org (belt-and-suspenders with RLS)
  const { data: existing } = await supabase
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: 'Location not found' };
  }

  const fields = parsed.data;

  // Build update payload — only include provided fields
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (fields.business_name !== undefined) {
    updatePayload.business_name = fields.business_name;
    updatePayload.name = fields.business_name;
  }
  if (fields.display_name !== undefined) updatePayload.display_name = fields.display_name;
  if (fields.address_line1 !== undefined) updatePayload.address_line1 = fields.address_line1;
  if (fields.city !== undefined) updatePayload.city = fields.city;
  if (fields.state !== undefined) updatePayload.state = fields.state;
  if (fields.zip !== undefined) updatePayload.zip = fields.zip;
  if (fields.phone !== undefined) updatePayload.phone = fields.phone || null;
  if (fields.website_url !== undefined) updatePayload.website_url = fields.website_url || null;
  if (fields.timezone !== undefined) updatePayload.timezone = fields.timezone;

  const { error } = await supabase
    .from('locations')
    .update(updatePayload)
    .eq('id', locationId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings/locations');
  revalidatePath('/dashboard/settings/business-info');
  return { success: true };
}

// ---------------------------------------------------------------------------
// archiveLocation — Soft-delete a location
// ---------------------------------------------------------------------------

export async function archiveLocation(
  locationId: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  if (!roleSatisfies(ctx.role, 'admin')) {
    return { success: false, error: 'Admin role required to archive locations' };
  }

  const supabase = await createClient();

  // Verify location belongs to org and check constraints
  const { data: loc } = await supabase
    .from('locations')
    .select('id, is_primary, is_archived')
    .eq('id', locationId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!loc) return { success: false, error: 'Location not found' };
  if (loc.is_archived) return { success: false, error: 'Location is already archived' };
  if (loc.is_primary) {
    return { success: false, error: 'Cannot archive primary location. Set another location as primary first.' };
  }

  // Ensure this is not the only active location
  const { count } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('is_archived', false);

  if ((count ?? 0) <= 1) {
    return { success: false, error: 'Cannot archive the only active location' };
  }

  const { error } = await supabase
    .from('locations')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', locationId);

  if (error) return { success: false, error: error.message };

  // If the archived location was the active cookie, clear it so resolution
  // falls back to primary on next request
  const cookieStore = await cookies();
  const currentCookie = cookieStore.get(LOCATION_COOKIE)?.value;
  if (currentCookie === locationId) {
    cookieStore.delete(LOCATION_COOKIE);
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings/locations');
  return { success: true };
}

// ---------------------------------------------------------------------------
// setPrimaryLocation — Change which location is the org's primary
// ---------------------------------------------------------------------------

export async function setPrimaryLocation(
  locationId: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  // Owner-only: changing primary affects all users in the org
  if (!roleSatisfies(ctx.role, 'owner')) {
    return { success: false, error: 'Only the org owner can change the primary location' };
  }

  const supabase = await createClient();

  // Verify target location belongs to org and is active
  const { data: loc } = await supabase
    .from('locations')
    .select('id, is_primary, is_archived')
    .eq('id', locationId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!loc) return { success: false, error: 'Location not found' };
  if (loc.is_archived) return { success: false, error: 'Cannot set archived location as primary' };
  if (loc.is_primary) return { success: true }; // Already primary, no-op

  // Step 1: Unset current primary
  await supabase
    .from('locations')
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true);

  // Step 2: Set new primary (partial unique index enforces at-most-one)
  const { error } = await supabase
    .from('locations')
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq('id', locationId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings/locations');
  return { success: true };
}

// ---------------------------------------------------------------------------
// switchActiveLocation — Set the active location cookie (any role)
// ---------------------------------------------------------------------------

export async function switchActiveLocation(
  locationId: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // Validate locationId belongs to org and is not archived
  const { data: loc } = await supabase
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .eq('org_id', ctx.orgId)
    .eq('is_archived', false)
    .maybeSingle();

  if (!loc) return { success: false, error: 'Location not found or archived' };

  // Set HttpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set(LOCATION_COOKIE, locationId, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 1 year
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  return { success: true };
}
