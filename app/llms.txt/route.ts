// ---------------------------------------------------------------------------
// GET /llms.txt — Dynamic, Org-Aware AI Visibility File (Sprint 97)
//
// Two modes:
//   GET /llms.txt            -> Platform-level llms.txt (LocalVector marketing)
//   GET /llms.txt?org=[slug] -> Org-specific llms.txt (live business data)
//
// Public route — no auth required.
// Uses service-role client to load org data by slug.
// Never returns 404 — falls back to platform-level content.
//
// Cache-Control: 6-hour CDN cache, 1-hour stale. After manual regeneration
// (when llms_txt_updated_at is very recent), adds no-cache for revalidation.
//
// Sprint 97 — Gap #62 (Dynamic llms.txt 30% -> 100%)
// AI_RULES §50: generateLLMsTxt() is the ONLY place that constructs llms.txt.
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import { loadLLMsTxtData, resolveOrgIdFromSlug } from '@/lib/llms-txt/llms-txt-data-loader';
import { generateLLMsTxt } from '@/lib/llms-txt/llms-txt-generator';

// ---------------------------------------------------------------------------
// Platform-level static content (fallback)
// ---------------------------------------------------------------------------

const PLATFORM_LLMS_TXT = `# LocalVector.ai — The AI Visibility Platform for Restaurants

> LocalVector is a SaaS platform that helps local businesses detect and fix AI hallucinations (wrong answers) on ChatGPT, Perplexity, and Google Gemini.

## Core Value Proposition
- **Fear Engine:** Audits AI models to find when they say a business is "Closed" (when open) or missing amenities.
- **Magic Menu:** Converts PDF menus into Schema.org JSON-LD and markdown that AI agents can read.
- **Greed Engine:** Analyzes competitor recommendations to help businesses rank higher in AI search.

## Pricing
- **Free Tool:** Check for hallucinations (no signup required).
- **Starter ($29/mo):** Weekly audits, Magic Menu, Google Business Profile connect.
- **Growth ($59/mo):** Daily audits, competitor intercept, Share-of-Voice tracking.
- **Agency (Custom):** Up to 10 locations, white-label, full API access.

## Developer & API
- Login: https://app.localvector.ai
- Contact: hello@localvector.ai
`;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get('org');

  // If no org slug, serve platform-level llms.txt
  if (!orgSlug) {
    return new Response(PLATFORM_LLMS_TXT, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // Attempt to serve org-specific llms.txt
  try {
    const supabase = createServiceRoleClient();

    const orgId = await resolveOrgIdFromSlug(supabase, orgSlug);
    if (!orgId) {
      return new Response(PLATFORM_LLMS_TXT, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const data = await loadLLMsTxtData(supabase, orgId);
    if (!data) {
      return new Response(PLATFORM_LLMS_TXT, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const content = generateLLMsTxt(data);

    // Check if recently regenerated (< 5 min) for cache busting
    const { data: loc } = await supabase
      .from('locations')
      .select('llms_txt_updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const updatedAt = loc?.llms_txt_updated_at;
    const isRecentlyUpdated = updatedAt
      ? Date.now() - new Date(updatedAt as string).getTime() < 5 * 60 * 1000
      : false;

    const cacheControl = isRecentlyUpdated
      ? 'no-cache'
      : 'public, s-maxage=21600, stale-while-revalidate=3600';

    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': cacheControl,
      },
    });
  } catch (err) {
    console.error('[llms.txt] Error generating org llms.txt:', err);
    return new Response(PLATFORM_LLMS_TXT, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }
}
