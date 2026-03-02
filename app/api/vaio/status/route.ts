// ---------------------------------------------------------------------------
// GET /api/vaio/status — VAIO profile for the authenticated user's location
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

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
      return NextResponse.json({ profile: null, voice_queries: [], last_run_at: null });
    }

    const { data: profile } = await supabase
      .from('vaio_profiles')
      .select('*')
      .eq('location_id', location.id)
      .single();

    const { data: voiceQueries } = await supabase
      .from('target_queries')
      .select('id, query_text, query_category, citation_rate, last_run_at, is_system_seeded')
      .eq('location_id', location.id)
      .eq('query_mode', 'voice')
      .eq('is_active', true)
      .order('query_category');

    return NextResponse.json({
      profile: profile ?? null,
      voice_queries: voiceQueries ?? [],
      last_run_at: profile?.last_run_at ?? null,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'vaio-status', sprint: '109' },
    });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
