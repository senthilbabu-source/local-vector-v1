// ---------------------------------------------------------------------------
// GET /api/schema-expansion/status — Schema health status for dashboard
//
// Sprint 106: Returns current schema coverage data for SchemaHealthPanel.
//
// Auth: User session (getSafeAuthContext)
// Plan gate: Growth+ only
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { planSatisfies } from '@/lib/plan-enforcer';
import type { SchemaStatusResponse } from '@/lib/schema-expansion/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  // 1. Auth guard
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // 2. Plan gate
    const { data: org } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single();

    if (!org || !planSatisfies(org.plan, 'growth')) {
      return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
    }

    // 3. Resolve location
    const { data: location } = await supabase
      .from('locations')
      .select('id, schema_health_score, schema_last_run_at')
      .eq('org_id', ctx.orgId)
      .eq('is_archived', false)
      .limit(1)
      .single();

    if (!location) {
      const response: SchemaStatusResponse = {
        schema_health_score: null,
        pages: [],
        last_run_at: null,
      };
      return NextResponse.json(response);
    }

    // 4. Fetch all page_schemas for this location
    const { data: schemas } = await supabase
      .from('page_schemas')
      .select('id, page_url, page_type, schema_types, status, embed_snippet, public_url, human_approved, confidence, missing_fields, published_at, last_crawled_at')
      .eq('location_id', location.id)
      .order('page_type', { ascending: true });

    const response: SchemaStatusResponse = {
      schema_health_score: location.schema_health_score,
      pages: (schemas ?? []).map((s) => ({
        id: s.id,
        page_url: s.page_url,
        page_type: s.page_type as SchemaStatusResponse['pages'][0]['page_type'],
        schema_types: s.schema_types ?? [],
        status: s.status,
        embed_snippet: s.embed_snippet,
        public_url: s.public_url,
        human_approved: s.human_approved,
        confidence: s.confidence,
        missing_fields: s.missing_fields ?? [],
        published_at: s.published_at,
        last_crawled_at: s.last_crawled_at,
      })),
      last_run_at: location.schema_last_run_at,
    };

    return NextResponse.json(response);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'schema-expansion-status', sprint: '106' },
    });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
