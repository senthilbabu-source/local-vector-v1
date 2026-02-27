'use server';

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchEntityHealth } from '@/lib/data/entity-health';
import { computeEntityHealth } from '@/lib/services/entity-health.service';
import type { EntityHealthResult } from '@/lib/services/entity-health.service';
import { z } from 'zod/v4';

/**
 * Server Action: Get entity health for primary location.
 * Uses getSafeAuthContext() (not getAuthContext) per AI_RULES §3.
 */
export async function getEntityHealth(): Promise<
  { success: true; data: EntityHealthResult } | { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return { success: false, error: 'No primary location' };

  const result = await fetchEntityHealth(supabase, ctx.orgId, location.id);
  return { success: true, data: result };
}

const UpdateEntitySchema = z.object({
  platform: z.enum([
    'google_knowledge_panel',
    'google_business_profile',
    'yelp',
    'tripadvisor',
    'apple_maps',
    'bing_places',
    'wikidata',
  ]),
  status: z.enum(['confirmed', 'missing', 'unchecked', 'incomplete']),
});

/**
 * Server Action: Update a single platform's entity status.
 * User-initiated via the checklist UI.
 */
export async function updateEntityStatus(
  formData: FormData,
): Promise<
  { success: true; data: EntityHealthResult } | { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const parsed = UpdateEntitySchema.safeParse({
    platform: formData.get('platform'),
    status: formData.get('status'),
  });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return { success: false, error: 'No primary location' };

  // Upsert: update the specific platform column
  const { data: existing } = await supabase
    .from('entity_checks')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('location_id', location.id)
    .maybeSingle();

  const updatePayload = {
    [parsed.data.platform]: parsed.data.status,
    last_checked_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase
      .from('entity_checks')
      .update(updatePayload)
      .eq('id', existing.id);
  } else {
    await supabase
      .from('entity_checks')
      .insert({
        org_id: ctx.orgId,
        location_id: location.id,
        ...updatePayload,
      });
  }

  // Recompute and return
  const result = await fetchEntityHealth(supabase, ctx.orgId, location.id);

  // Update entity_score
  const { data: row } = await supabase
    .from('entity_checks')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('location_id', location.id)
    .maybeSingle();

  if (row) {
    await supabase
      .from('entity_checks')
      .update({ entity_score: result.score })
      .eq('id', row.id);
  }

  return { success: true, data: result };
}
