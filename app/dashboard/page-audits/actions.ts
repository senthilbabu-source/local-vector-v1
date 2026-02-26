// ---------------------------------------------------------------------------
// app/dashboard/page-audits/actions.ts — Sprint 58B: Page re-audit action
// ---------------------------------------------------------------------------

'use server';

import { revalidatePath } from 'next/cache';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { auditPage, type LocationContext, type PageType } from '@/lib/page-audit/auditor';
import type { Json } from '@/lib/supabase/database.types';

// Rate limit: 1 re-audit per page per 5 minutes (server-side in-memory)
const reauditTimestamps = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000;

export async function reauditPage(pageUrl: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Not authenticated' };

  // Rate limit check
  const key = `${ctx.orgId}:${pageUrl}`;
  const lastRun = reauditTimestamps.get(key) ?? 0;
  if (Date.now() - lastRun < RATE_LIMIT_MS) {
    return { success: false, error: 'Please wait 5 minutes between re-audits of the same page.' };
  }

  const supabase = await createClient();

  // Fetch the existing audit row to get page_type + location context
  const { data: existingAudit } = await supabase
    .from('page_audits')
    .select('id, page_type, location_id')
    .eq('org_id', ctx.orgId)
    .eq('page_url', pageUrl)
    .single();

  if (!existingAudit) {
    return { success: false, error: 'Audit record not found.' };
  }

  if (!existingAudit.location_id) {
    return { success: false, error: 'Audit has no associated location.' };
  }

  // Fetch location context for the auditor
  const { data: location } = await supabase
    .from('locations')
    .select('business_name, city, state, categories, amenities')
    .eq('id', existingAudit.location_id)
    .single();

  const locationCtx: LocationContext = {
    business_name: location?.business_name ?? '',
    city: location?.city ?? null,
    state: location?.state ?? null,
    categories: (location?.categories as string[] | null) ?? null,
    amenities: (location?.amenities as Record<string, boolean | undefined> | null) ?? null,
  };

  try {
    reauditTimestamps.set(key, Date.now());

    const result = await auditPage(pageUrl, existingAudit.page_type as PageType, locationCtx);

    const { error } = await supabase.from('page_audits').upsert(
      {
        org_id: ctx.orgId,
        location_id: existingAudit.location_id,
        page_url: pageUrl,
        page_type: existingAudit.page_type,
        overall_score: result.overallScore,
        answer_first_score: result.answerFirstScore,
        schema_completeness_score: result.schemaCompletenessScore,
        faq_schema_present: result.faqSchemaPresent,
        aeo_readability_score: result.keywordDensityScore,
        recommendations: result.recommendations as unknown as Json,
        last_audited_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,page_url' },
    );

    if (error) {
      return { success: false, error: 'Failed to save audit results.' };
    }

    revalidatePath('/dashboard/page-audits');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Audit failed.',
    };
  }
}
