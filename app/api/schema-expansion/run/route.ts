// ---------------------------------------------------------------------------
// POST /api/schema-expansion/run — On-demand schema expansion
//
// Sprint 106: Crawls the authenticated user's website and generates JSON-LD
// schemas for all discovered page types.
//
// Auth: User session (getSafeAuthContext)
// Plan gate: Growth+ only
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies } from '@/lib/plan-enforcer';
import { runSchemaExpansion } from '@/lib/schema-expansion/schema-expansion-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  // 1. Auth guard
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch org plan
    const supabase = await createClient();
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
      .select('id, website_url')
      .eq('org_id', ctx.orgId)
      .eq('is_archived', false)
      .limit(1)
      .single();

    if (!location) {
      return NextResponse.json({ error: 'no_location' }, { status: 422 });
    }

    if (!location.website_url) {
      return NextResponse.json({ error: 'no_website' }, { status: 422 });
    }

    // 4. Run schema expansion with service role client (cross-table writes)
    const serviceRole = createServiceRoleClient();
    const result = await runSchemaExpansion(serviceRole, location.id, ctx.orgId);

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'schema-expansion-run', sprint: '106' },
    });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'expansion_failed', message: msg }, { status: 500 });
  }
}
