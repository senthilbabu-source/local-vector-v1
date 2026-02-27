// ---------------------------------------------------------------------------
// GET /api/cron/citation — Citation Intelligence Cron (Tenant-Derived)
//
// Runs daily. Derives category+metro pairs from real tenant data instead of
// hardcoded arrays. For each Growth+ org with a location that has a category
// and city/state, builds citation queries, runs them against Perplexity, and
// upserts results into citation_source_intelligence.
//
// Sprint 97 — Gap #60 (Citation Intelligence Cron 40% -> 100%)
//
// Architecture:
//   - CRON_SECRET auth guard (same pattern as all other crons)
//   - Kill switch (STOP_CITATION_CRON)
//   - Service-role client (bypasses RLS for cross-org reads)
//   - Plan gate: skips orgs on starter/trial (Growth+ only)
//   - Error isolation: one org failing does not abort others
//   - Rate limiting: 500ms between Perplexity calls via runCitationSample
//   - Deduplicates category+metro pairs across orgs (shared market intelligence)
//
// Required env vars:
//   CRON_SECRET              — shared secret validated below
//   SUPABASE_SERVICE_ROLE_KEY — used by createServiceRoleClient()
//   PERPLEXITY_API_KEY       — used by citation engine
//
// Local dev:
//   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/citation
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  runCitationSample,
  writeCitationResults,
} from '@/lib/services/citation-engine.service';
import { normalizeCategoryLabel } from '@/lib/citation/citation-query-builder';
import { planSatisfies } from '@/lib/plan-enforcer';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';

// Force dynamic so Vercel never caches this route between cron invocations.
export const dynamic = 'force-dynamic';

/** Extended summary for tenant-derived cron. */
interface TenantCitationCronSummary {
  ok: boolean;
  halted?: boolean;
  orgs_processed: number;
  orgs_skipped: number;
  categories_processed: number;
  metros_processed: number;
  platforms_found: number;
  queries_run: number;
  errors: Array<{ org_id?: string; category?: string; metro?: string; reason: string }>;
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

  // ── 2. Kill switch ─────────────────────────────────────────────────────
  if (process.env.STOP_CITATION_CRON === 'true') {
    console.log('[cron-citation] Citation cron halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  // ── 3. Fail fast if Perplexity API key is missing ──────────────────────
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('[cron-citation] PERPLEXITY_API_KEY not configured');
    return NextResponse.json(
      { error: 'PERPLEXITY_API_KEY not configured' },
      { status: 500 },
    );
  }

  // ── 4. Cron run logging ────────────────────────────────────────────────
  const handle = await logCronStart('citation');

  // ── 5. Service-role client (bypasses RLS) ──────────────────────────────
  const supabase = createServiceRoleClient();

  const summary: TenantCitationCronSummary = {
    ok: true,
    orgs_processed: 0,
    orgs_skipped: 0,
    categories_processed: 0,
    metros_processed: 0,
    platforms_found: 0,
    queries_run: 0,
    errors: [],
  };

  try {
    // ── 6. Load all orgs with their primary location ───────────────────
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, plan, slug, name')
      .in('plan', ['growth', 'agency']);

    if (orgsError) {
      const msg = `Failed to load orgs: ${orgsError.message}`;
      console.error(`[cron-citation] ${msg}`);
      await logCronFailed(handle, msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    if (!orgs || orgs.length === 0) {
      console.log('[cron-citation] No eligible orgs found (Growth+).');
      await logCronComplete(handle, summary as unknown as Record<string, unknown>);
      return NextResponse.json(summary);
    }

    // ── 7. Build unique (category, city, state) tuples from org locations ─
    // Each tuple is processed once (shared market intelligence).
    const tupleMap = new Map<string, { category: string; city: string; state: string; orgIds: string[] }>();

    for (const org of orgs) {
      // Skip orgs that don't meet Growth+ threshold
      if (!planSatisfies(org.plan, 'growth')) {
        summary.orgs_skipped++;
        continue;
      }

      // Fetch primary location for this org
      const { data: location } = await supabase
        .from('locations')
        .select('categories, city, state')
        .eq('org_id', org.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!location) {
        summary.errors.push({ org_id: org.id, reason: 'no_location' });
        summary.orgs_skipped++;
        continue;
      }

      const categories = location.categories as string[] | null;
      if (!categories || categories.length === 0) {
        summary.errors.push({ org_id: org.id, reason: 'no_category' });
        summary.orgs_skipped++;
        continue;
      }

      if (!location.city) {
        summary.errors.push({ org_id: org.id, reason: 'no_city' });
        summary.orgs_skipped++;
        continue;
      }

      const city = location.city;
      const state = location.state ?? '';

      // Add each category as a separate tuple
      for (const rawCategory of categories) {
        const normalizedCategory = normalizeCategoryLabel(rawCategory);
        const tupleKey = `${normalizedCategory}|${city}|${state}`.toLowerCase();

        if (tupleMap.has(tupleKey)) {
          tupleMap.get(tupleKey)!.orgIds.push(org.id);
        } else {
          tupleMap.set(tupleKey, {
            category: normalizedCategory,
            city,
            state,
            orgIds: [org.id],
          });
        }
      }

      summary.orgs_processed++;
    }

    // ── 8. Process each unique category+metro tuple ───────────────────────
    const processedCategories = new Set<string>();
    const processedMetros = new Set<string>();

    for (const [, tuple] of tupleMap) {
      try {
        const { platformCounts, successfulQueries, sampleQuery } =
          await runCitationSample(tuple.category, tuple.city, tuple.state);

        summary.queries_run += successfulQueries;

        if (successfulQueries > 0) {
          const platformsWritten = await writeCitationResults(
            tuple.category,
            tuple.city,
            tuple.state,
            platformCounts,
            successfulQueries,
            sampleQuery,
            supabase,
          );

          summary.platforms_found += platformsWritten;
        }

        processedCategories.add(tuple.category);
        processedMetros.add(`${tuple.city} ${tuple.state}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[cron-citation] Failed for ${tuple.category} in ${tuple.city}, ${tuple.state}:`,
          msg,
        );
        summary.errors.push({
          category: tuple.category,
          metro: `${tuple.city}, ${tuple.state}`,
          reason: msg,
        });
      }
    }

    summary.categories_processed = processedCategories.size;
    summary.metros_processed = processedMetros.size;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron-citation] Unexpected error:', msg);
    await logCronFailed(handle, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  console.log('[cron-citation] Run complete:', summary);
  await logCronComplete(handle, summary as unknown as Record<string, unknown>);
  return NextResponse.json(summary);
}
