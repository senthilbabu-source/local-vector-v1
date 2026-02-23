// ---------------------------------------------------------------------------
// GET /api/cron/audit — Phase 20: Automated Web Audit Engine
//
// Triggered by Vercel Cron (or curl in local dev). Scans every paying org's
// primary location for AI hallucinations and persists findings to the
// ai_hallucinations table.
//
// Security:
//   • Requires `Authorization: Bearer <CRON_SECRET>` — rejects with 401 otherwise.
//   • Uses createServiceRoleClient() to bypass RLS. There is no user session
//     in a background job; the anon/user-scoped client would silently return
//     empty data through RLS policies.
//
// Resilience:
//   • Each org is processed inside its own try/catch. One failure increments
//     summary.failed and the loop continues — a flaky OpenAI call never aborts
//     the entire run.
//
// Plan gating:
//   • Only orgs with plan IN ('growth', 'agency') AND plan_status = 'active'
//     are processed (Pro AI Defense + Enterprise API — paying tiers).
//
// Required env vars:
//   CRON_SECRET              — shared secret validated below
//   SUPABASE_SERVICE_ROLE_KEY — already used by createServiceRoleClient()
//   OPENAI_API_KEY           — used by ai-audit.service (falls back to demo)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  auditLocation,
  type DetectedHallucination,
} from '@/lib/services/ai-audit.service';

// Force dynamic so Vercel never caches this route between cron invocations.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── 1. Auth guard ──────────────────────────────────────────────────────
  // Vercel Cron passes the secret in the Authorization header. In local dev,
  // use: curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/audit
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Service-role client (bypasses RLS — mandatory for background jobs) ─
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  // ── 3. Fetch all active paying orgs ───────────────────────────────────
  // plan_tier enum: 'trial' | 'starter' | 'growth' | 'agency'
  // UI names:  Free Scanner → trial/starter, Pro AI Defense → growth, Enterprise → agency
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name')
    .in('plan', ['growth', 'agency'])
    .eq('plan_status', 'active');

  if (orgsError) {
    console.error('[cron-audit] Failed to fetch organisations:', orgsError.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  const summary = {
    ok: true,
    orgs_found: (orgs ?? []).length,
    processed: 0,
    failed: 0,
    hallucinations_inserted: 0,
  };

  // ── 4. Process each org independently ─────────────────────────────────
  // for...of + individual try/catch: one org's failure never aborts the run.
  for (const org of orgs ?? []) {
    try {
      // Fetch this org's primary location via service role (RLS bypassed).
      // Explicit .eq('org_id', org.id) is belt-and-suspenders because the
      // public_published_location policy could otherwise leak cross-org rows
      // (same bug documented in the magic-menus page fix — DEVLOG 2026-02-22).
      const { data: location, error: locError } = await supabase
        .from('locations')
        .select(
          'id, org_id, business_name, city, state, address_line1, hours_data, amenities'
        )
        .eq('org_id', org.id)
        .eq('is_primary', true)
        .maybeSingle();

      if (locError) {
        throw new Error(`Location fetch failed: ${locError.message}`);
      }

      if (!location) {
        console.warn(
          `[cron-audit] No primary location for org ${org.id} (${org.name}) — skipping`
        );
        continue;
      }

      // ── 5. Run AI audit for this location ──────────────────────────────
      const hallucinations: DetectedHallucination[] =
        await auditLocation(location);

      // ── 6. Persist findings ────────────────────────────────────────────
      if (hallucinations.length > 0) {
        const { error: insertError } = await supabase
          .from('ai_hallucinations')
          .insert(
            hallucinations.map((h) => ({
              org_id: location.org_id,
              location_id: location.id,
              // Enum values from prod_schema.sql (all lowercase):
              model_provider: h.model_provider,
              severity: h.severity,
              category: h.category,
              claim_text: h.claim_text,
              expected_truth: h.expected_truth,
              correction_status: 'open',
            }))
          );

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        summary.hallucinations_inserted += hallucinations.length;
      }

      summary.processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron-audit] Org ${org.id} (${org.name}) failed:`,
        msg
      );
      summary.failed++;
    }
  }

  console.log('[cron-audit] Run complete:', summary);
  return NextResponse.json(summary);
}
