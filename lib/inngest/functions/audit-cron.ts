// ---------------------------------------------------------------------------
// lib/inngest/functions/audit-cron.ts — AI Audit Daily Fan-Out Function
//
// Replaces the sequential for...of loops in app/api/cron/audit/route.ts
// with an Inngest step function that fans out per org.
//
// Event: 'cron/audit.daily' (dispatched by Vercel Cron → Audit route)
//
// Architecture:
//   Step 1: fetch-audit-orgs       — one DB call
//   Step 2: audit-org-{orgId}      — fan-out hallucination audits (parallel, max 5)
//   Step 3: intercept-org-{orgId}  — fan-out competitor intercepts (parallel, max 5)
//
// Hallucination audits and intercepts run as separate step groups so
// intercept failures never affect hallucination counts.
// ---------------------------------------------------------------------------

import { inngest } from '../client';
import { withTimeout } from '../timeout';
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

// ---------------------------------------------------------------------------
// Per-org audit processor — exported for testability
// ---------------------------------------------------------------------------

export interface AuditOrgResult {
  success: boolean;
  hallucinationsInserted: number;
  auditId: string | null;
}

export async function processOrgAudit(org: { id: string; name: string }): Promise<AuditOrgResult> {
  const supabase = createServiceRoleClient();

  const { data: location, error: locError } = await supabase
    .from('locations')
    .select(
      'id, org_id, business_name, city, state, address_line1, hours_data, amenities',
    )
    .eq('org_id', org.id)
    .eq('is_primary', true)
    .maybeSingle();

  if (locError) throw new Error(`Location fetch failed: ${locError.message}`);
  if (!location) {
    console.warn(`[inngest-audit] No primary location for org ${org.id} (${org.name}) — skipping`);
    return { success: true, hallucinationsInserted: 0, auditId: null };
  }

  const auditInput: LocationAuditInput = {
    ...location,
    hours_data: location.hours_data as Record<string, unknown> | null,
    amenities: location.amenities as Record<string, unknown> | null,
  };
  const hallucinations: DetectedHallucination[] = await auditLocation(auditInput);

  // ── Create parent audit row (scan log) ──────────────────────────────
  let auditId: string | null = null;
  try {
    const { data: auditData, error: auditError } = await supabase
      .from('ai_audits')
      .insert({
        org_id: location.org_id,
        location_id: location.id,
        model_provider: 'openai-gpt4o' as Database['public']['Enums']['model_provider'],
        prompt_type: 'status_check' as Database['public']['Enums']['audit_prompt_type'],
        is_hallucination_detected: hallucinations.length > 0,
      })
      .select('id')
      .single();

    if (auditError) {
      console.error(`[inngest-audit] ai_audits insert failed: ${auditError.message}`);
    } else {
      auditId = auditData.id;
    }
  } catch (err) {
    console.error('[inngest-audit] ai_audits insert threw:', err);
  }

  if (hallucinations.length > 0) {
    const hallRows = hallucinations.map((h) => ({
      org_id: location.org_id,
      location_id: location.id,
      audit_id: auditId,
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

    if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

    // Send email alert (fire-and-forget)
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
        console.error('[inngest-audit] Email send failed:', err),
      );
    }
  }

  return { success: true, hallucinationsInserted: hallucinations.length, auditId };
}

// ---------------------------------------------------------------------------
// Per-org competitor intercept processor — exported for testability
// ---------------------------------------------------------------------------

export interface InterceptOrgResult {
  interceptsInserted: number;
}

export async function processOrgIntercepts(org: { id: string; name: string }): Promise<InterceptOrgResult> {
  const supabase = createServiceRoleClient();
  let interceptsInserted = 0;

  const { data: location } = await supabase
    .from('locations')
    .select('id, business_name, city, state, categories')
    .eq('org_id', org.id)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return { interceptsInserted: 0 };

  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, competitor_name')
    .eq('org_id', org.id);

  for (const competitor of competitors ?? []) {
    try {
      await runInterceptForCompetitor(
        {
          orgId: org.id,
          locationId: location.id,
          businessName: location.business_name,
          categories: Array.isArray(location.categories) ? location.categories as string[] : [],
          city: location.city,
          state: location.state,
          competitor,
        },
        supabase,
      );
      interceptsInserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[inngest-audit] Intercept failed for ${competitor.competitor_name} (org ${org.id}):`,
        msg,
      );
    }
  }

  return { interceptsInserted };
}

// ---------------------------------------------------------------------------
// Inngest function definition
// ---------------------------------------------------------------------------

export const auditCronFunction = inngest.createFunction(
  {
    id: 'audit-daily-cron',
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: 'cron/audit.daily' },
  async ({ step }) => {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();

    // Step 1: Fetch all active paying orgs
    const orgs = await step.run('fetch-audit-orgs', async () => {
      const supabase = createServiceRoleClient();

      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .in('plan', ['growth', 'agency'])
        .eq('plan_status', 'active');

      if (error) throw new Error(`DB error: ${error.message}`);
      return (data ?? []) as Array<{ id: string; name: string }>;
    });

    if (!orgs.length) {
      return {
        function_id: 'audit-daily-cron',
        event_name: 'cron/audit.daily',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        orgs_found: 0,
        processed: 0,
      };
    }

    // Step 2: Fan out hallucination audits (one step per org)
    const auditResults = await Promise.all(
      orgs.map((org) =>
        step.run(`audit-org-${org.id}`, async () => {
          try {
            return await withTimeout(() => processOrgAudit(org));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[inngest-audit] Org ${org.id} (${org.name}) failed:`, msg);
            return { success: false, hallucinationsInserted: 0, auditId: null };
          }
        }),
      ),
    );

    // Step 3: Fan out competitor intercepts (one step per org)
    const interceptResults = await Promise.all(
      orgs.map((org) =>
        step.run(`intercept-org-${org.id}`, async () => {
          try {
            return await withTimeout(() => processOrgIntercepts(org));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[inngest-audit] Competitor loop failed for org ${org.id}:`, msg);
            return { interceptsInserted: 0 };
          }
        }),
      ),
    );

    // Step 4: Fan out revenue leak snapshots (one step per org)
    await Promise.all(
      orgs.map((org) =>
        step.run(`snapshot-revenue-leak-${org.id}`, async () => {
          try {
            const supabase = createServiceRoleClient();
            const { data: location } = await supabase
              .from('locations')
              .select('id')
              .eq('org_id', org.id)
              .eq('is_primary', true)
              .maybeSingle();

            if (!location) return { snapshotted: false };

            await snapshotRevenueLeak(supabase, org.id, location.id);
            return { snapshotted: true };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[inngest-audit] Revenue snapshot failed for org ${org.id}:`, msg);
            return { snapshotted: false };
          }
        }),
      ),
    );

    const summary = {
      function_id: 'audit-daily-cron',
      event_name: 'cron/audit.daily',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      orgs_found: orgs.length,
      processed: auditResults.filter((r) => r.success).length,
      failed: auditResults.filter((r) => !r.success).length,
      hallucinations_inserted: auditResults.reduce((sum, r) => sum + r.hallucinationsInserted, 0),
      intercepts_inserted: interceptResults.reduce((sum, r) => sum + r.interceptsInserted, 0),
    };

    console.log('[inngest-audit] Run complete:', JSON.stringify(summary));
    return summary;
  },
);
