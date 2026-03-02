// ---------------------------------------------------------------------------
// GET /api/vaio/llms-txt — Returns generated llms.txt content
// POST /api/vaio/llms-txt — Regenerates llms.txt on demand
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { planSatisfies } from '@/lib/plan-enforcer';
import { generateLlmsTxt } from '@/lib/vaio/llms-txt-generator';
import type { GroundTruthForVAIO, LlmsPageUrl } from '@/lib/vaio/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    const { data: location } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('is_archived', false)
      .limit(1)
      .single();

    if (!location) {
      return NextResponse.json({ standard: null, full: null, generated_at: null });
    }

    const { data: profile } = await supabase
      .from('vaio_profiles')
      .select('llms_txt_standard, llms_txt_full, llms_txt_generated_at')
      .eq('location_id', location.id)
      .single();

    return NextResponse.json({
      standard: profile?.llms_txt_standard ?? null,
      full: profile?.llms_txt_full ?? null,
      generated_at: profile?.llms_txt_generated_at ?? null,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'vaio-llms-txt-get', sprint: '109' } });
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}

export async function POST() {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    const { data: org } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single();

    if (!org || !planSatisfies(org.plan, 'growth')) {
      return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
    }

    const { data: loc } = await supabase
      .from('locations')
      .select('id, business_name, address_line1, city, state, zip, phone, website_url, categories, amenities, hours_data')
      .eq('org_id', ctx.orgId)
      .eq('is_archived', false)
      .limit(1)
      .single();

    if (!loc) {
      return NextResponse.json({ error: 'no_location' }, { status: 422 });
    }

    const groundTruth: GroundTruthForVAIO = {
      location_id: loc.id,
      org_id: ctx.orgId,
      name: loc.business_name,
      address: loc.address_line1 ?? '',
      city: loc.city ?? '',
      state: loc.state ?? '',
      zip: loc.zip ?? '',
      phone: loc.phone,
      website: loc.website_url,
      categories: (loc.categories as string[]) ?? [],
      amenities: (loc.amenities as Record<string, boolean | undefined>) ?? {},
      hours: null,
    };

    const { data: pageSchemas } = await supabase
      .from('page_schemas')
      .select('page_type, page_url')
      .eq('location_id', loc.id)
      .eq('status', 'published');

    const pageUrls: LlmsPageUrl[] = (pageSchemas ?? []).map((ps) => ({
      page_type: ps.page_type as LlmsPageUrl['page_type'],
      url: ps.page_url,
      description: `${ps.page_type} page`,
    }));

    const result = generateLlmsTxt(groundTruth, [], pageUrls);

    const serviceRole = createServiceRoleClient();
    await serviceRole
      .from('vaio_profiles')
      .upsert({
        location_id: loc.id,
        org_id: ctx.orgId,
        llms_txt_standard: result.standard,
        llms_txt_full: result.full,
        llms_txt_generated_at: new Date().toISOString(),
        llms_txt_status: 'generated',
      }, { onConflict: 'location_id' });

    return NextResponse.json({ ok: true, standard: result.standard, full: result.full });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'vaio-llms-txt-post', sprint: '109' } });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'generation_failed', message: msg }, { status: 500 });
  }
}
