// ---------------------------------------------------------------------------
// GET /api/cron/content-audit — Surgery 3: Monthly Content Audit Cron
//
// Triggered by Vercel Cron monthly. Audits each active org's website pages
// and writes scores to the page_audits table.
//
// Architecture mirrors GET /api/cron/audit and GET /api/cron/sov:
//   • CRON_SECRET auth guard
//   • Service-role client (bypasses RLS)
//   • Per-org try/catch resilience
//   • Plan-gated page caps (1/10/50 by tier)
//
// Schedule: Monthly, 1st of month at 3 AM EST (configured in vercel.json)
//
// Spec: docs/17-CONTENT-GRADER.md §3
//
// Required env vars:
//   CRON_SECRET              — shared secret
//   SUPABASE_SERVICE_ROLE_KEY — used by createServiceRoleClient()
//   OPENAI_API_KEY           — used for Answer-First scoring (falls back to heuristic)
//
// Local dev:
//   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/content-audit
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditPage, type PageType } from '@/lib/page-audit/auditor';

// Force dynamic so Vercel never caches this route between cron invocations.
export const dynamic = 'force-dynamic';

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
  // Root or index = homepage
  const path = new URL(url).pathname;
  if (path === '/' || path === '' || path === '/index.html') return 'homepage';
  return 'other';
}

// ---------------------------------------------------------------------------
// Generate page URLs to audit from a website base URL
// ---------------------------------------------------------------------------

function generateAuditUrls(websiteUrl: string, cap: number): { url: string; pageType: PageType }[] {
  // Normalize base URL
  let base = websiteUrl.trim();
  if (!base.startsWith('http')) base = `https://${base}`;
  // Remove trailing slash
  base = base.replace(/\/+$/, '');

  // Always audit homepage first
  const pages: { url: string; pageType: PageType }[] = [
    { url: base, pageType: 'homepage' },
  ];

  if (cap <= 1) return pages;

  // Common restaurant/business pages to probe
  const commonPaths = [
    '/menu',
    '/about',
    '/about-us',
    '/faq',
    '/events',
    '/contact',
    '/hours',
    '/reservations',
  ];

  for (const path of commonPaths) {
    if (pages.length >= cap) break;
    pages.push({ url: `${base}${path}`, pageType: inferPageType(`${base}${path}`) });
  }

  return pages.slice(0, cap);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // ── 1. Auth guard ──────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Service-role client ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  // ── 3. Fetch all active orgs with locations that have website_url ──────
  const { data: locations, error: locError } = await supabase
    .from('locations')
    .select(`
      id, org_id, business_name, city, state, categories, amenities, website_url,
      organizations ( plan, plan_status )
    `)
    .not('website_url', 'is', null)
    .limit(200);

  if (locError) {
    console.error('[cron-content-audit] Failed to fetch locations:', locError.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!locations?.length) {
    console.log('[cron-content-audit] No locations with website_url found.');
    return NextResponse.json({ ok: true, locations_audited: 0, pages_audited: 0 });
  }

  // ── 4. Filter to active orgs only ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeLocations = locations.filter((loc: any) =>
    loc.organizations?.plan_status === 'active' && loc.website_url,
  );

  const summary = {
    ok: true,
    locations_audited: 0,
    pages_audited: 0,
    pages_failed: 0,
    avg_score: 0,
  };

  const allScores: number[] = [];

  // ── 5. Audit each location's website ───────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const loc of activeLocations as any[]) {
    try {
      const plan = loc.organizations?.plan ?? 'starter';
      const cap = getAuditCap(plan);
      const pages = generateAuditUrls(loc.website_url, cap);

      for (const page of pages) {
        try {
          const result = await auditPage(page.url, page.pageType, {
            business_name: loc.business_name,
            city: loc.city,
            state: loc.state,
            categories: loc.categories,
            amenities: loc.amenities,
          });

          // Upsert into page_audits (unique on org_id + page_url)
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
              recommendations: result.recommendations,
              last_audited_at: new Date().toISOString(),
            },
            { onConflict: 'org_id,page_url' },
          );

          allScores.push(result.overallScore);
          summary.pages_audited++;

          // Rate limit: 1s between page fetches to be polite
          await new Promise((r) => setTimeout(r, 1000));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[cron-content-audit] Page ${page.url} failed:`, msg);
          summary.pages_failed++;
        }
      }

      summary.locations_audited++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron-content-audit] Location ${loc.id} failed:`, msg);
    }
  }

  // Calculate average score
  summary.avg_score = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  console.log('[cron-content-audit] Run complete:', summary);
  return NextResponse.json(summary);
}
