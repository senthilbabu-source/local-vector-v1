// ---------------------------------------------------------------------------
// GET /api/cron/embed-backfill — Nightly embedding backfill cron (Sprint 119)
//
// Backfills rows missing embeddings across 5 tables in batches of 20.
// Protected by CRON_SECRET header (same pattern as other cron routes).
// Schedule: 0 3 * * * (3 AM UTC daily)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { backfillTable, type EmbeddableTable } from '@/lib/services/embedding-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

const TABLES: EmbeddableTable[] = [
  'menu_items',
  'ai_hallucinations',
  'target_queries',
  'content_drafts',
  'locations',
];

export async function GET(request: NextRequest) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = createServiceRoleClient();

  const results: Record<string, { processed: number; errors: number }> = {};

  for (const table of TABLES) {
    try {
      results[table] = await backfillTable(supabase, table, 20);
      console.log(
        `[embed-backfill] ${table}: ${results[table].processed} rows, ${results[table].errors} errors`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[embed-backfill] ${table} failed:`, msg);
      results[table] = { processed: 0, errors: 1 };
    }
  }

  return NextResponse.json({
    ok: true,
    results,
    duration_ms: Date.now() - startedAt,
  });
}
