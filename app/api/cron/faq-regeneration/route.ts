// ---------------------------------------------------------------------------
// app/api/cron/faq-regeneration/route.ts — Nightly FAQ Regeneration (Sprint 128)
//
// For each active location: generates FAQ pairs from ground truth,
// writes to locations.faq_cache. Pure function generator — no AI calls.
//
// Schedule: Daily at 3 AM UTC (vercel.json)
// Kill switch: STOP_FAQ_CRON=true
// AI_RULES §160
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import { generateFAQs } from '@/lib/faq/faq-generator';
import type { FAQGeneratorInput } from '@/lib/faq/faq-generator';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ── Auth guard ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ───────────────────────────────────────────────────────
  if (process.env.STOP_FAQ_CRON === 'true') {
    return NextResponse.json({ skipped: true, reason: 'Kill switch active' });
  }

  try {
    const supabase = createServiceRoleClient();

    // Fetch all active locations
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select(
        'id, business_name, city, state, phone, website_url, hours_data, amenities, categories, display_name, operational_status, accepting_new_patients, telehealth_available, insurance_types, specialty_tags',
      )
      .eq('is_archived', false);

    if (locError || !locations) {
      Sentry.captureException(
        locError ?? new Error('Failed to fetch locations'),
        { tags: { cron: 'faq-regeneration', sprint: '128' } },
      );
      return NextResponse.json(
        { error: 'Failed to fetch locations' },
        { status: 500 },
      );
    }

    let updated = 0;
    let failed = 0;

    for (const loc of locations) {
      try {
        // Fetch top 5 published menu items for this location
        const { data: menuItems } = await supabase
          .from('menu_items')
          .select(
            'name, menu_categories!inner(menu_id, magic_menus!inner(location_id, is_published))',
          )
          .eq('menu_categories.magic_menus.location_id', loc.id)
          .eq('menu_categories.magic_menus.is_published', true)
          .limit(5);

        const input: FAQGeneratorInput = {
          name: loc.business_name,
          city: loc.city ?? '',
          state: loc.state ?? '',
          phone: loc.phone,
          website_url: loc.website_url,
          hours_data: loc.hours_data as FAQGeneratorInput['hours_data'],
          amenities: loc.amenities as FAQGeneratorInput['amenities'],
          categories: loc.categories as string[] | null,
          display_name: loc.display_name,
          operational_status: loc.operational_status ?? 'OPERATIONAL',
          menuItemNames: (menuItems ?? []).map((i) => i.name),
          accepting_new_patients: loc.accepting_new_patients,
          telehealth_available: loc.telehealth_available,
          insurance_types: loc.insurance_types as string[] | null,
          specialty_tags: loc.specialty_tags,
        };

        const pairs = generateFAQs(input);

        const { error: updateError } = await supabase
          .from('locations')
          .update({
            faq_cache: pairs as unknown as Json,
            faq_updated_at: new Date().toISOString(),
          })
          .eq('id', loc.id);

        if (updateError) throw updateError;
        updated++;
      } catch (err) {
        failed++;
        Sentry.captureException(err, {
          tags: {
            cron: 'faq-regeneration',
            sprint: '128',
            locationId: loc.id,
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      updated,
      failed,
      total: locations.length,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { cron: 'faq-regeneration', sprint: '128' },
    });
    return NextResponse.json(
      { error: 'FAQ regeneration failed' },
      { status: 500 },
    );
  }
}
