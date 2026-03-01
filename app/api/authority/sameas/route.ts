// ---------------------------------------------------------------------------
// GET/POST /api/authority/sameas — sameAs URL management
//
// Sprint 108: Returns current sameAs state and allows adding new sameAs URLs.
// Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';
import { fetchExistingSameAs } from '@/lib/authority/sameas-enricher';

export const dynamic = 'force-dynamic';

/**
 * GET — Returns current sameAs URLs and gaps for the location.
 */
export async function GET() {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Plan gate
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single();

    const plan = (orgRow?.plan ?? 'trial') as PlanTier;
    if (!planSatisfies(plan, 'growth')) {
      return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
    }

    // Resolve location
    const { data: location } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!location) {
      return NextResponse.json({ existing_sameas: [], gaps: [] });
    }

    const existingSameAs = await fetchExistingSameAs(supabase, location.id);

    // Fetch gaps from profile
    const { data: profile } = await supabase
      .from('entity_authority_profiles')
      .select('sameas_gaps')
      .eq('location_id', location.id)
      .maybeSingle();

    return NextResponse.json({
      existing_sameas: existingSameAs,
      gaps: profile?.sameas_gaps ?? [],
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'authority-sameas-get', sprint: '108' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

/**
 * POST — Adds a sameAs URL to the homepage schema.
 * Body: { url: string }
 */
export async function POST(request: Request) {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { url?: string };
    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'invalid_request', message: 'URL is required' },
        { status: 400 },
      );
    }

    // Validate URL format
    try {
      new URL(body.url);
    } catch (_e) {
      return NextResponse.json(
        { error: 'invalid_url', message: 'Invalid URL format' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Plan gate
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single();

    const plan = (orgRow?.plan ?? 'trial') as PlanTier;
    if (!planSatisfies(plan, 'growth')) {
      return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
    }

    // Resolve location
    const { data: location } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!location) {
      return NextResponse.json({ error: 'no_location' }, { status: 404 });
    }

    // Fetch homepage schema
    const serviceRole = createServiceRoleClient();
    const { data: schema } = await serviceRole
      .from('page_schemas')
      .select('id, json_ld')
      .eq('location_id', location.id)
      .eq('page_type', 'homepage')
      .eq('status', 'published')
      .limit(1)
      .maybeSingle();

    if (!schema) {
      return NextResponse.json(
        { error: 'no_homepage_schema', message: 'No published homepage schema found. Run Schema Expansion first.' },
        { status: 404 },
      );
    }

    // Add URL to sameAs array (deduplicated)
    const jsonLd = (schema.json_ld as unknown as Array<Record<string, unknown>>) ?? [];
    let updated = false;

    for (const schemaObj of jsonLd) {
      if (!schemaObj.sameAs) {
        schemaObj.sameAs = [body.url];
        updated = true;
      } else if (Array.isArray(schemaObj.sameAs)) {
        if (!schemaObj.sameAs.includes(body.url)) {
          schemaObj.sameAs.push(body.url);
          updated = true;
        }
      }
      break; // Only update first schema object
    }

    if (updated) {
      await serviceRole
        .from('page_schemas')
        .update({ json_ld: jsonLd as unknown as Record<string, unknown> })
        .eq('id', schema.id);
    }

    // Count current sameAs
    const sameAsCount = jsonLd.reduce((count, obj) => {
      return count + (Array.isArray(obj.sameAs) ? obj.sameAs.length : 0);
    }, 0);

    return NextResponse.json({ ok: true, sameas_count: sameAsCount });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'authority-sameas-post', sprint: '108' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
