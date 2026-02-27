'use server';

// ---------------------------------------------------------------------------
// regenerateLLMsTxt — On-Demand Regeneration Server Action
//
// Called from the Settings page to force a refresh of the org's llms.txt.
// Touches the llms_txt_updated_at timestamp on the primary location to
// bust the CDN cache (route handler checks this timestamp).
//
// Auth: orgId from session only (AI_RULES §18). Never from form data.
// Plan gate: Growth+ only (AI_RULES §50).
//
// Sprint 97 — Gap #62 (Dynamic llms.txt 30% -> 100%)
// ---------------------------------------------------------------------------

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { planSatisfies } from '@/lib/plan-enforcer';

export async function regenerateLLMsTxt(): Promise<{ success: boolean; error?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    return { success: false, error: 'not_authenticated' };
  }

  const orgId = ctx.orgId;
  if (!orgId) {
    return { success: false, error: 'no_org' };
  }

  // Plan gate: Growth+ required
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single();

  if (!org || !planSatisfies(org.plan, 'growth')) {
    return { success: false, error: 'upgrade_required' };
  }

  // Touch the llms_txt_updated_at timestamp to bust CDN cache
  const { error: updateError } = await supabase
    .from('locations')
    .update({ llms_txt_updated_at: new Date().toISOString() })
    .eq('org_id', orgId);

  if (updateError) {
    console.error('[regenerate-llms-txt] Failed to update timestamp:', updateError.message);
    return { success: false, error: 'update_failed' };
  }

  return { success: true };
}
