// ---------------------------------------------------------------------------
// GET /api/cron/content-audit — Content Audit Monthly Cron (Inngest Dispatcher)
//
// Triggered by Vercel Cron. Dispatches to Inngest for fan-out processing.
// Falls back to inline execution if Inngest is unavailable (AI_RULES §17).
//
// Architecture:
//   • CRON_SECRET auth guard
//   • Kill switch (STOP_CONTENT_AUDIT_CRON)
//   • Primary: Inngest event dispatch → fan-out per location
//   • Fallback: Inline sequential loop (original architecture)
//
// Schedule: Monthly, 1st of month at 3 AM EST (configured in vercel.json)
// Spec: docs/17-CONTENT-GRADER.md §3
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditPage, type PageType } from '@/lib/page-audit/auditor';
import { inngest } from '@/lib/inngest/client';

// Force dynamic so Vercel never caches this route between cron invocations.
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers (used by inline fallback)
// ---------------------------------------------------------------------------

function getAuditCap(plan: string): number {
  switch (plan) {
    case 'starter': return 1;
    case 'growth':  return 10;
    case 'agency':  return 50;
    default:        return 1;
  }
}

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
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // ── 1. Auth guard ──────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Kill switch ────────────────────────────────────────────────────
  if (process.env.STOP_CONTENT_AUDIT_CRON === 'true') {
    console.log('[cron-content-audit] Content audit cron halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  // ── 3. Dispatch to Inngest (primary path) ──────────────────────────────
  try {
    await inngest.send({ name: 'cron/content-audit.monthly', data: {} });
    console.log('[cron-content-audit] Dispatched to Inngest.');
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron-content-audit] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── 4. Inline fallback (runs when Inngest is unavailable) ──────────────
  return await runInlineContentAudit();
}

// ---------------------------------------------------------------------------
// Inline fallback — original sequential orchestration
// ---------------------------------------------------------------------------

async function runInlineContentAudit(): Promise<NextResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

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

  summary.avg_score = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  console.log('[cron-content-audit] Run complete:', summary);
  return NextResponse.json(summary);
}
