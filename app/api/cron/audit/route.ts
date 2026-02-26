// ---------------------------------------------------------------------------
// GET /api/cron/audit — AI Audit Daily Cron (Inngest Dispatcher)
//
// Triggered by Vercel Cron. Dispatches to Inngest for fan-out processing.
// Falls back to inline execution if Inngest is unavailable (AI_RULES §17).
//
// Architecture:
//   • CRON_SECRET auth guard
//   • Kill switch (STOP_AUDIT_CRON)
//   • Primary: Inngest event dispatch → fan-out per org
//   • Fallback: Inline sequential loop (original architecture)
//
// Schedule: Daily, 3 AM EST (configured in vercel.json)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import {
  auditLocation,
  type DetectedHallucination,
  type LocationAuditInput,
} from '@/lib/services/ai-audit.service';
import { runInterceptForCompetitor } from '@/lib/services/competitor-intercept.service';
import { sendHallucinationAlert } from '@/lib/email';
import { snapshotRevenueLeak } from '@/lib/services/revenue-leak.service';
import { inngest } from '@/lib/inngest/client';
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

  // ── 2. Kill switch ────────────────────────────────────────────────────
  if (process.env.STOP_AUDIT_CRON === 'true') {
    console.log('[cron-audit] Audit cron halted by kill switch.');
    return NextResponse.json({ ok: true, halted: true });
  }

  // ── 3. Dispatch to Inngest (primary path) ──────────────────────────────
  try {
    await inngest.send({ name: 'cron/audit.daily', data: {} });
    console.log('[cron-audit] Dispatched to Inngest.');
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron-audit] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── 4. Inline fallback (runs when Inngest is unavailable) ──────────────
  return await runInlineAudit();
}

// ---------------------------------------------------------------------------
// Inline fallback — original sequential orchestration
// ---------------------------------------------------------------------------

async function runInlineAudit(): Promise<NextResponse> {
  const handle = await logCronStart('audit');
  try {
  return await _runInlineAuditImpl(handle);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logCronFailed(handle, msg);
    console.error('[cron-audit] Inline run failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function _runInlineAuditImpl(handle: { logId: string | null; startedAt: number }): Promise<NextResponse> {
  const supabase = createServiceRoleClient();

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
    intercepts_inserted: 0,
  };

  for (const org of orgs ?? []) {
    try {
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

      const auditInput: LocationAuditInput = {
        ...location,
        hours_data: location.hours_data as Record<string, unknown> | null,
        amenities: location.amenities as Record<string, unknown> | null,
      };
      const hallucinations: DetectedHallucination[] =
        await auditLocation(auditInput);

      if (hallucinations.length > 0) {
        const hallRows = hallucinations.map((h) => ({
          org_id: location.org_id,
          location_id: location.id,
          model_provider: h.model_provider as Database['public']['Enums']['model_provider'],
          severity: h.severity as Database['public']['Enums']['hallucination_severity'],
          category: h.category,
          claim_text: h.claim_text,
          expected_truth: h.expected_truth,
          correction_status: 'open' as Database['public']['Enums']['correction_status'],
        }));
        const { error: insertError } = await supabase
          .from('ai_hallucinations')
          .insert(hallRows);

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        summary.hallucinations_inserted += hallucinations.length;

        const { data: membershipRow } = await supabase
          .from('memberships')
          .select('users(email)')
          .eq('org_id', org.id)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle();

        const ownerEmail = (
          membershipRow?.users as { email: string } | null
        )?.email;

        if (ownerEmail) {
          await sendHallucinationAlert({
            to: ownerEmail,
            orgName: org.name,
            businessName: location.business_name,
            hallucinationCount: hallucinations.length,
            dashboardUrl: 'https://app.localvector.ai/dashboard',
          }).catch((err: unknown) =>
            console.error('[cron-audit] Email send failed:', err)
          );
        }
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

  // ── Competitor intercept loop ──────────────────────────────────────────
  for (const org of orgs ?? []) {
    try {
      const { data: location } = await supabase
        .from('locations')
        .select('id, business_name, city, state, categories')
        .eq('org_id', org.id)
        .eq('is_primary', true)
        .maybeSingle();

      if (!location) continue;

      const { data: competitors } = await supabase
        .from('competitors')
        .select('id, competitor_name')
        .eq('org_id', org.id);

      for (const competitor of competitors ?? []) {
        try {
          await runInterceptForCompetitor(
            {
              orgId:        org.id,
              locationId:   location.id,
              businessName: location.business_name,
              categories:   Array.isArray(location.categories) ? location.categories as string[] : [],
              city:         location.city,
              state:        location.state,
              competitor,
            },
            supabase,
          );
          summary.intercepts_inserted++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[cron-audit] Intercept failed for ${competitor.competitor_name} (org ${org.id}):`,
            msg,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron-audit] Competitor loop failed for org ${org.id}:`, msg);
    }
  }

  // ── Revenue leak snapshot loop ───────────────────────────────────────────
  for (const org of orgs ?? []) {
    try {
      const { data: location } = await supabase
        .from('locations')
        .select('id')
        .eq('org_id', org.id)
        .eq('is_primary', true)
        .maybeSingle();

      if (!location) continue;

      await snapshotRevenueLeak(supabase, org.id, location.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron-audit] Revenue snapshot failed for org ${org.id}:`, msg);
    }
  }

  console.log('[cron-audit] Run complete:', summary);
  await logCronComplete(handle, summary as unknown as Record<string, unknown>);
  return NextResponse.json(summary);
}
