// ---------------------------------------------------------------------------
// app/dashboard/page-audits/actions.ts — Sprint 58B + Sprint 104
//
// Sprint 58B: reauditPage() — re-audit existing pages
// Sprint 104: addPageAudit() — on-demand audit for new URLs (Doc 17 §3.2)
// ---------------------------------------------------------------------------

'use server';

import { revalidatePath } from 'next/cache';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { auditPage, type LocationContext, type PageType } from '@/lib/page-audit/auditor';
import { canRunPageAudit, type PlanTier } from '@/lib/plan-enforcer';
import * as Sentry from '@sentry/nextjs';
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
        faq_schema_score: result.faqSchemaScore,
        entity_clarity_score: result.entityClarityScore,
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

// ---------------------------------------------------------------------------
// addPageAudit — Submit a new URL for on-demand AEO audit (Sprint 104)
//
// Doc 17 §3.2: "On-demand (user clicks 'Audit')"
// Plan gate: Growth/Agency only (canRunPageAudit).
// Rate limit: 1 audit per URL per 5 minutes (same as reauditPage).
// Type inference: mirrors inferPageType() from the monthly cron.
// ---------------------------------------------------------------------------

function inferPageType(url: string): PageType {
  const lower = url.toLowerCase();
  if (lower.match(/\/menu/)) return 'menu';
  if (lower.match(/\/about/)) return 'about';
  if (lower.match(/\/faq|\/questions/)) return 'faq';
  if (lower.match(/\/event/)) return 'events';
  try {
    const path = new URL(url).pathname;
    if (path === '/' || path === '' || path === '/index.html') return 'homepage';
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'actions.ts', sprint: '104' } });
  }
  return 'other';
}

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  // Remove trailing slash for consistent rate-limit keys and DB storage
  url = url.replace(/\/+$/, '');
  return url;
}

export async function addPageAudit(
  rawUrl: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Not authenticated' };

  // Plan gate — Growth/Agency only
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const plan = (org?.plan as PlanTier) ?? 'trial';
  if (!canRunPageAudit(plan)) {
    return { success: false, error: 'Page audits require Growth or Agency plan.' };
  }

  // URL validation
  if (!rawUrl || !rawUrl.trim()) {
    return { success: false, error: 'Please enter a URL.' };
  }

  const normalizedUrl = normalizeUrl(rawUrl);

  // Basic validation — ensure it looks like a URL
  try {
    new URL(normalizedUrl);
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'actions.ts', sprint: '104' } });
    return { success: false, error: 'Please enter a valid URL.' };
  }

  // Rate limit check (shared Map with reauditPage)
  const key = `${ctx.orgId}:${normalizedUrl}`;
  const lastRun = reauditTimestamps.get(key) ?? 0;
  if (Date.now() - lastRun < RATE_LIMIT_MS) {
    return { success: false, error: 'Please wait 5 minutes between audits of the same page.' };
  }

  // Page type inference
  const pageType = inferPageType(normalizedUrl);

  // Fetch primary location for location_id
  const { data: location } = await supabase
    .from('locations')
    .select('id, business_name, city, state, categories, amenities')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) {
    return { success: false, error: 'No primary location found. Complete onboarding first.' };
  }

  const locationCtx: LocationContext = {
    business_name: location.business_name,
    city: location.city,
    state: location.state,
    categories: (location.categories as string[] | null) ?? null,
    amenities: (location.amenities as Record<string, boolean | undefined> | null) ?? null,
  };

  try {
    reauditTimestamps.set(key, Date.now());

    const result = await auditPage(normalizedUrl, pageType, locationCtx);

    const { error } = await supabase.from('page_audits').upsert(
      {
        org_id: ctx.orgId,
        location_id: location.id,
        page_url: normalizedUrl,
        page_type: pageType,
        overall_score: result.overallScore,
        answer_first_score: result.answerFirstScore,
        schema_completeness_score: result.schemaCompletenessScore,
        faq_schema_present: result.faqSchemaPresent,
        faq_schema_score: result.faqSchemaScore,
        entity_clarity_score: result.entityClarityScore,
        aeo_readability_score: result.keywordDensityScore,
        recommendations: result.recommendations as unknown as Json,
        last_audited_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,page_url' },
    );

    if (error) {
      Sentry.captureException(error, { tags: { file: 'actions.ts', sprint: '104' } });
      return { success: false, error: 'Failed to save audit results.' };
    }

    revalidatePath('/dashboard/page-audits');
    return { success: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'actions.ts', sprint: '104' } });
    return {
      success: false,
      error: 'Could not fetch that URL. Is it publicly accessible?',
    };
  }
}
