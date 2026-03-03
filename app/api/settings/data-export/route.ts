// ---------------------------------------------------------------------------
// GET /api/settings/data-export — P6-FIX-26: GDPR Data Export
// Owner-only. Downloads all org data as a JSON file attachment.
// Rate limited: 1 export per day per org.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { ROUTE_RATE_LIMITS } from '@/lib/rate-limit/types';

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'owner_required' }, { status: 403 });
  }

  // Rate limit: 1 export per day per org
  const rl = await checkRateLimit(ROUTE_RATE_LIMITS.data_export, ctx.orgId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limited. You can export data once per day.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  try {
    const supabase = createServiceRoleClient();

    // Fetch all org-scoped data in parallel
    const [
      { data: organization },
      { data: locations },
      { data: targetQueries },
      { data: sovEvaluations },
      { data: hallucinations },
      { data: contentDrafts },
      { data: pageAudits },
      { data: competitors },
      { data: entityChecks },
    ] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', ctx.orgId).maybeSingle(),
      supabase.from('locations').select('*').eq('org_id', ctx.orgId),
      supabase.from('target_queries').select('*').eq('org_id', ctx.orgId),
      supabase.from('sov_evaluations').select('*').eq('org_id', ctx.orgId),
      supabase.from('ai_hallucinations').select('*').eq('org_id', ctx.orgId),
      supabase.from('content_drafts').select('*').eq('org_id', ctx.orgId),
      supabase.from('page_audits').select('*').eq('org_id', ctx.orgId),
      supabase.from('competitors').select('*').eq('org_id', ctx.orgId),
      supabase.from('entity_checks').select('*').eq('org_id', ctx.orgId),
    ]);

    // Redact sensitive billing fields
    const redactedOrg = organization
      ? {
          ...organization,
          stripe_customer_id: '[REDACTED]',
          stripe_subscription_id: '[REDACTED]',
        }
      : null;

    const exportData = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      organization: redactedOrg,
      locations: locations ?? [],
      targetQueries: targetQueries ?? [],
      sovEvaluations: sovEvaluations ?? [],
      hallucinations: hallucinations ?? [],
      contentDrafts: contentDrafts ?? [],
      pageAudits: pageAudits ?? [],
      competitors: competitors ?? [],
      entityChecks: entityChecks ?? [],
    };

    const slug = (organization as Record<string, unknown>)?.slug ?? 'export';
    const date = new Date().toISOString().slice(0, 10);
    const filename = `localvector-data-export-${slug}-${date}.json`;

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { sprint: 'P6-FIX-26', route: 'data-export' } });
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }
}
