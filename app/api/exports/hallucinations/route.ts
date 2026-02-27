// ---------------------------------------------------------------------------
// app/api/exports/hallucinations/route.ts — CSV export route
//
// Sprint 95 — CSV Export (Gap #73).
// Runtime: nodejs (required). Auth: session-based. Plan gate: Growth+.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';

import { getAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canExportData, type PlanTier } from '@/lib/plan-enforcer';
import {
  buildHallucinationCSV,
  type HallucinationAuditRow,
} from '@/lib/exports/csv-builder';

export async function GET() {
  // ── Auth — session only, org_id derived server-side (AI_RULES §18) ──────
  let auth;
  try {
    auth = await getAuthContext();
  } catch {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Org plan gate — Growth+ required ────────────────────────────────────
  const plan = (auth.org.plan ?? 'trial') as PlanTier;
  if (!canExportData(plan)) {
    return new Response(
      JSON.stringify({ error: 'plan_required', plan: 'growth' }),
      {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // ── Query: last 90 days, limit 500, org-scoped ──────────────────────────
  const supabase = await createClient();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: rows, error } = await supabase
    .from('ai_hallucinations')
    .select('*')
    .eq('org_id', auth.orgId)
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'query_failed', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Build CSV ───────────────────────────────────────────────────────────
  const csv = buildHallucinationCSV(
    (rows ?? []) as HallucinationAuditRow[],
  );

  const date = new Date().toISOString().split('T')[0];
  const filename = `localvector-hallucinations-${date}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
