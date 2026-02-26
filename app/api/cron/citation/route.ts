// ---------------------------------------------------------------------------
// GET /api/cron/citation — Citation Intelligence Monthly Cron
//
// Runs monthly (first Sunday, 3 AM EST). Systematically samples AI answers
// for each tracked category+city combination and records which platforms
// appear in cited sources.
//
// This is aggregate market intelligence, not tenant-specific. Shared across
// all tenants in the same category+city. Cost: ~900 Perplexity queries/month
// = ~$4.50 fixed infrastructure.
//
// Architecture mirrors GET /api/cron/sov:
//   • CRON_SECRET auth guard
//   • Kill switch (STOP_CITATION_CRON)
//   • Service-role client (bypasses RLS)
//   • Per-category+metro try/catch resilience
//   • Rate-limited (500ms delay between Perplexity calls)
//
// Spec: docs/18-CITATION-INTELLIGENCE.md §2
//
// Required env vars:
//   CRON_SECRET              — shared secret validated below
//   SUPABASE_SERVICE_ROLE_KEY — used by createServiceRoleClient()
//   PERPLEXITY_API_KEY       — used by citation engine (falls back to empty results)
//
// Local dev:
//   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/citation
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  TRACKED_CATEGORIES,
  TRACKED_METROS,
  runCitationSample,
  writeCitationResults,
} from '@/lib/services/citation-engine.service';
import type { CitationCronSummary } from '@/lib/types/citations';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';

// Force dynamic so Vercel never caches this route between cron invocations.
export const dynamic = 'force-dynamic';

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

  // ── 2. Kill switch (Doc 18 §2.1) ──────────────────────────────────────
  if (process.env.STOP_CITATION_CRON === 'true') {
    console.log('[cron-citation] Citation cron halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  // ── 3. Cron run logging ────────────────────────────────────────────────
  const handle = await logCronStart('citation');

  // ── 4. Service-role client (bypasses RLS) ──────────────────────────────
  const supabase = createServiceRoleClient();

  // ── 5. Process each category+metro combination ─────────────────────────
  const summary: CitationCronSummary = {
    ok: true,
    categories_processed: 0,
    metros_processed: 0,
    platforms_found: 0,
    queries_run: 0,
    errors: 0,
  };

  const processedMetros = new Set<string>();

  for (const category of TRACKED_CATEGORIES) {
    let categoryProcessed = false;

    for (const metro of TRACKED_METROS) {
      try {
        const { platformCounts, successfulQueries, sampleQuery } =
          await runCitationSample(category, metro.city, metro.state);

        summary.queries_run += successfulQueries;

        if (successfulQueries > 0) {
          const platformsWritten = await writeCitationResults(
            category,
            metro.city,
            metro.state,
            platformCounts,
            successfulQueries,
            sampleQuery,
            supabase,
          );

          summary.platforms_found += platformsWritten;
        }

        categoryProcessed = true;
        processedMetros.add(`${metro.city} ${metro.state}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[cron-citation] Failed for ${category} in ${metro.city}, ${metro.state}:`,
          msg,
        );
        summary.errors++;
      }
    }

    if (categoryProcessed) {
      summary.categories_processed++;
    }
  }

  summary.metros_processed = processedMetros.size;

  console.log('[cron-citation] Run complete:', summary);
  await logCronComplete(handle, summary as unknown as Record<string, unknown>);
  return NextResponse.json(summary);
}
