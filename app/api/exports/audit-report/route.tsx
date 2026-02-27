// ---------------------------------------------------------------------------
// app/api/exports/audit-report/route.ts — PDF audit report export route
//
// Sprint 95 — PDF Audit Report (Gap #74).
// Runtime: nodejs (required — React-PDF cannot run on Edge).
// Auth: session-based. Plan gate: Growth+.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';

import { renderToBuffer } from '@react-pdf/renderer';
import { getAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canExportData, type PlanTier } from '@/lib/plan-enforcer';
import {
  assembleAuditReportData,
  type SOVRow,
} from '@/lib/exports/pdf-assembler';
import { AuditReportPDF } from '@/lib/exports/pdf-template';
import { deriveRealityScore } from '@/app/dashboard/page';

export async function GET() {
  // ── Auth — session only ─────────────────────────────────────────────────
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

  const supabase = await createClient();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // ── Three parallel queries ──────────────────────────────────────────────
  const [hallucinationResult, sovResult, locationResult, visibilityResult] =
    await Promise.all([
      // Hallucination audits: last 90 days, limit 500
      supabase
        .from('ai_hallucinations')
        .select('*')
        .eq('org_id', auth.orgId)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(500),

      // SOV evaluations with query text: last 90 days, limit 200
      supabase
        .from('sov_evaluations')
        .select('engine, rank_position, query_id, target_queries(query_text)')
        .eq('org_id', auth.orgId)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(200),

      // Primary location (city, state)
      supabase
        .from('locations')
        .select('*')
        .eq('org_id', auth.orgId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),

      // Most recent visibility snapshot for Reality Score
      supabase
        .from('visibility_analytics')
        .select('share_of_voice')
        .eq('org_id', auth.orgId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // ── Compute Reality Score ───────────────────────────────────────────────
  const hallucinations = hallucinationResult.data ?? [];
  const openAlertCount = hallucinations.filter(
    (h) => h.correction_status === 'open',
  ).length;
  const visibilityScore =
    visibilityResult.data?.share_of_voice != null
      ? Math.round(
          (visibilityResult.data.share_of_voice as number) * 100,
        )
      : null;

  const { realityScore } = deriveRealityScore(openAlertCount, visibilityScore);
  const score = realityScore ?? 100; // no data = assumed accurate

  // ── Map SOV data ────────────────────────────────────────────────────────
  const sovData: SOVRow[] = (sovResult.data ?? []).map((row) => ({
    engine: row.engine,
    rank_position: row.rank_position,
    query_text:
      (row.target_queries as { query_text: string } | null)?.query_text ?? '',
  }));

  // ── Fetch org row ───────────────────────────────────────────────────────
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', auth.orgId)
    .single();

  if (!orgRow) {
    return new Response(JSON.stringify({ error: 'org_not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Assemble report data ────────────────────────────────────────────────
  const reportData = assembleAuditReportData(
    orgRow,
    locationResult.data,
    hallucinations,
    sovData,
    score,
  );

  // ── Render PDF ──────────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      <AuditReportPDF data={reportData} />,
    );
  } catch (err) {
    console.error('[export/audit-report] PDF render error:', err);
    return new Response(
      JSON.stringify({ error: 'pdf_render_failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Response ────────────────────────────────────────────────────────────
  const orgSlug = orgRow.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 40);
  const date = new Date().toISOString().split('T')[0];
  const filename = `ai-visibility-audit-${orgSlug}-${date}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
