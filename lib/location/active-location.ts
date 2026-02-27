// ---------------------------------------------------------------------------
// lib/location/active-location.ts — Server-side active location resolution
//
// Single source of truth for "which location is the current user viewing."
//
// Resolution order (first match wins):
//   1. Cookie: lv_selected_location → validate against org's non-archived locations
//   2. Primary location (is_primary = true, is_archived = false)
//   3. Oldest non-archived location (created_at ASC)
//   4. null (org has no active locations)
//
// NEVER reads from URL params or query strings (AI_RULES §18).
// Cookie is HttpOnly, set server-side only via switchActiveLocation() action.
// ---------------------------------------------------------------------------

import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/** Cookie name for the active location. Shared across org contexts. */
export const LOCATION_COOKIE = 'lv_selected_location';

/** Minimal location info needed for switcher + routing. */
export interface ActiveLocationInfo {
  id: string;
  business_name: string;
  display_name: string | null;
  city: string | null;
  state: string | null;
  is_primary: boolean;
}

export interface ActiveLocationResult {
  /** The resolved active location, or null if org has no locations. */
  location: ActiveLocationInfo | null;
  /** All non-archived locations for this org (for the switcher dropdown). */
  allLocations: ActiveLocationInfo[];
}

/**
 * Resolves the active location for the given org in the current request.
 * Reads from cookie, validates, and falls back gracefully.
 */
export async function resolveActiveLocation(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<ActiveLocationResult> {
  // Fetch all non-archived locations for this org
  const { data: rawLocations } = await supabase
    .from('locations')
    .select('id, business_name, display_name, city, state, is_primary')
    .eq('org_id', orgId)
    .eq('is_archived', false)
    .order('is_primary', { ascending: false })
    .order('location_order', { ascending: true })
    .order('created_at', { ascending: true });

  const allLocations: ActiveLocationInfo[] = (rawLocations ?? []).map((l) => ({
    id: l.id,
    business_name: l.business_name,
    display_name: l.display_name,
    city: l.city,
    state: l.state,
    is_primary: l.is_primary ?? false,
  }));

  if (allLocations.length === 0) {
    return { location: null, allLocations: [] };
  }

  // 1. Read cookie
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCATION_COOKIE)?.value;

  // 2. Validate cookie value against org's non-archived locations
  if (cookieValue) {
    const fromCookie = allLocations.find((l) => l.id === cookieValue);
    if (fromCookie) {
      return { location: fromCookie, allLocations };
    }
    // Cookie value invalid (archived, deleted, different org) — fall through
  }

  // 3. Primary fallback
  const primary = allLocations.find((l) => l.is_primary);
  if (primary) {
    return { location: primary, allLocations };
  }

  // 4. Oldest fallback (first in array since sorted by created_at)
  return { location: allLocations[0], allLocations };
}

/**
 * Returns just the active location ID — convenience for data queries.
 * Returns null if org has no active locations.
 */
export async function getActiveLocationId(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<string | null> {
  const { location } = await resolveActiveLocation(supabase, orgId);
  return location?.id ?? null;
}
