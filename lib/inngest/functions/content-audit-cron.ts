// ---------------------------------------------------------------------------
// lib/inngest/functions/content-audit-cron.ts — Content Audit Monthly Fan-Out
//
// Replaces the sequential for...of loop in app/api/cron/content-audit/route.ts
// with an Inngest step function that fans out per location.
//
// Event: 'cron/content-audit.monthly' (dispatched by Vercel Cron)
//
// Architecture:
//   Step 1: fetch-audit-locations          — one DB call
//   Step 2: audit-location-{locId}         — fan-out per location (parallel, max 3)
//
// Each location step audits pages sequentially (1s rate limit for polite
// crawling). auditPage() is computation-only — this step handles DB upserts.
// ---------------------------------------------------------------------------

import { inngest } from '../client';
import { withTimeout } from '../timeout';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditPage, type PageType } from '@/lib/page-audit/auditor';
import { sleep } from '@/lib/services/sov-engine.service';
import type { Json } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Plan-based page audit caps (Doc 17 §3.2)
// ---------------------------------------------------------------------------

function getAuditCap(plan: string): number {
  switch (plan) {
    case 'starter': return 1;
    case 'growth':  return 10;
    case 'agency':  return 50;
    default:        return 1;
  }
}

// ---------------------------------------------------------------------------
// Detect page type from URL path
// ---------------------------------------------------------------------------

function inferPageType(url: string): PageType {
  const lower = url.toLowerCase();
  if (lower.match(/\/menu/)) return 'menu';
  if (lower.match(/\/about/)) return 'about';
  if (lower.match(/\/faq|\/questions/)) return 'faq';
  if (lower.match(/\/event/)) return 'events';
  const path = new URL(url).pathname;
  if (path === '/' || path === '' || path === '/index.html') return 'homepage';
  return 'other';
}

// ---------------------------------------------------------------------------
// Generate page URLs to audit from a website base URL
// ---------------------------------------------------------------------------

function generateAuditUrls(websiteUrl: string, cap: number): { url: string; pageType: PageType }[] {
  let base = websiteUrl.trim();
  if (!base.startsWith('http')) base = `https://${base}`;
  base = base.replace(/\/+$/, '');

  const pages: { url: string; pageType: PageType }[] = [
    { url: base, pageType: 'homepage' },
  ];

  if (cap <= 1) return pages;

  const commonPaths = [
    '/menu', '/about', '/about-us', '/faq', '/events',
    '/contact', '/hours', '/reservations',
  ];

  for (const path of commonPaths) {
    if (pages.length >= cap) break;
    pages.push({ url: `${base}${path}`, pageType: inferPageType(`${base}${path}`) });
  }

  return pages.slice(0, cap);
}

// ---------------------------------------------------------------------------
// Per-location processor — exported for testability
// ---------------------------------------------------------------------------

export interface LocationAuditInput {
  id: string;
  org_id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  categories: string[] | null;
  amenities: Record<string, boolean | undefined> | null;
  website_url: string;
  plan: string;
}

export interface LocationAuditResult {
  pagesAudited: number;
  pagesFailed: number;
  scores: number[];
}

export async function processLocationAudit(
  loc: LocationAuditInput,
): Promise<LocationAuditResult> {
  const supabase = createServiceRoleClient();

  const cap = getAuditCap(loc.plan);
  const pages = generateAuditUrls(loc.website_url, cap);
  const scores: number[] = [];
  let pagesAudited = 0;
  let pagesFailed = 0;

  for (const page of pages) {
    try {
      const result = await auditPage(page.url, page.pageType, {
        business_name: loc.business_name,
        city: loc.city,
        state: loc.state,
        categories: loc.categories,
        amenities: loc.amenities,
      });

      await supabase.from('page_audits').upsert(
        {
          org_id: loc.org_id,
          location_id: loc.id,
          page_url: page.url,
          page_type: page.pageType,
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

      scores.push(result.overallScore);
      pagesAudited++;

      // Rate limit: 1s between page fetches
      await sleep(1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[inngest-content-audit] Page ${page.url} failed:`, msg);
      pagesFailed++;
    }
  }

  return { pagesAudited, pagesFailed, scores };
}

// ---------------------------------------------------------------------------
// Inngest function definition
// ---------------------------------------------------------------------------

export const contentAuditCronFunction = inngest.createFunction(
  {
    id: 'content-audit-monthly-cron',
    concurrency: { limit: 3 },
    retries: 2,
  },
  { event: 'cron/content-audit.monthly' },
  async ({ step }) => {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();

    // Step 1: Fetch all active locations with website_url
    const locations = await step.run('fetch-audit-locations', async () => {
      const supabase = createServiceRoleClient();

      const { data, error } = await supabase
        .from('locations')
        .select(`
          id, org_id, business_name, city, state, categories, amenities, website_url,
          organizations ( plan, plan_status )
        `)
        .not('website_url', 'is', null)
        .limit(200);

      if (error) throw new Error(`DB error: ${error.message}`);
      if (!data?.length) return [];

      // Filter to active orgs and map to typed inputs
      return data
        .filter((loc) => loc.organizations?.plan_status === 'active' && loc.website_url)
        .map((loc) => ({
          id: loc.id,
          org_id: loc.org_id,
          business_name: loc.business_name,
          city: loc.city,
          state: loc.state,
          categories: loc.categories as string[] | null,
          amenities: loc.amenities as Record<string, boolean | undefined> | null,
          website_url: loc.website_url!,
          plan: (loc.organizations?.plan ?? 'starter') as string,
        })) as LocationAuditInput[];
    });

    if (!locations.length) {
      return {
        function_id: 'content-audit-monthly-cron',
        event_name: 'cron/content-audit.monthly',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        locations_audited: 0,
        pages_audited: 0,
      };
    }

    // Step 2: Fan out — one step per location (55s timeout per step)
    const locationResults = await Promise.all(
      locations.map((loc) =>
        step.run(`audit-location-${loc.id}`, async () => {
          try {
            return await withTimeout(() => processLocationAudit(loc));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[inngest-content-audit] Location ${loc.id} failed:`, msg);
            return { pagesAudited: 0, pagesFailed: 0, scores: [] } as LocationAuditResult;
          }
        }),
      ),
    );

    const allScores = locationResults.flatMap((r) => r.scores);

    const summary = {
      function_id: 'content-audit-monthly-cron',
      event_name: 'cron/content-audit.monthly',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      locations_audited: locationResults.filter((r) => r.pagesAudited > 0).length,
      pages_audited: locationResults.reduce((sum, r) => sum + r.pagesAudited, 0),
      pages_failed: locationResults.reduce((sum, r) => sum + r.pagesFailed, 0),
      avg_score: allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0,
    };

    console.log('[inngest-content-audit] Run complete:', JSON.stringify(summary));
    return summary;
  },
);
