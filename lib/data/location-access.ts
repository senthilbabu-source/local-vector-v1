// ---------------------------------------------------------------------------
// lib/data/location-access.ts — Location Access Filter (Sprint 99)
//
// Memoized helper that returns accessible location IDs for the current user.
// Import and use in Server Components to filter location-scoped queries.
//
// Usage in any dashboard page:
//   const locationIds = await getAccessibleLocationIds(supabase, userId, orgId);
//   const { data } = await supabase.from('table').in('location_id', locationIds);
//
// For single-location orgs (V1 majority): returns 1 entry.
// Owner always gets all org location IDs.
// ---------------------------------------------------------------------------

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getUserLocationAccess } from '@/lib/auth/location-permissions';

/**
 * Returns the list of location IDs the user can access.
 * Memoized per request via React.cache() — called once even if
 * multiple sections on a page use it.
 */
export const getAccessibleLocationIds = cache(
  async (
    supabase: SupabaseClient<Database>,
    userId: string,
    orgId: string
  ): Promise<string[]> => {
    const access = await getUserLocationAccess(supabase, userId, orgId);
    return access.map((a) => a.locationId);
  }
);

/**
 * Returns accessible locations with their effective roles.
 * Useful when the UI needs to display role badges per location.
 */
export const getAccessibleLocationsWithRoles = cache(
  async (
    supabase: SupabaseClient<Database>,
    userId: string,
    orgId: string
  ): Promise<Array<{ locationId: string; effectiveRole: string }>> => {
    return getUserLocationAccess(supabase, userId, orgId);
  }
);
