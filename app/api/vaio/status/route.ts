// ---------------------------------------------------------------------------
// GET /api/vaio/status — VAIO profile for the authenticated user's location
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { computeVoiceReadinessScore } from '@/lib/vaio/vaio-service';

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

    // Compute score_breakdown on-the-fly from stored profile fields so the UI
    // always has it regardless of whether the score_breakdown column is persisted yet (§208).
    let scoreBreakdown = null;
    if (profile) {
      const crawlerHealth =
        (profile.crawler_audit as { overall_health?: string } | null)?.overall_health ?? 'unknown';
      const breakdown = computeVoiceReadinessScore(
        profile.llms_txt_status as 'generated' | 'stale' | 'not_generated',
        crawlerHealth as 'healthy' | 'partial' | 'blocked' | 'unknown',
        profile.voice_citation_rate ?? 0,
        0, // avg_content_score is not stored — content_quality derived from citation/llms/crawler fields
      );
      scoreBreakdown = {
        llms_txt: breakdown.llms_txt,
        crawler_access: breakdown.crawler_access,
        voice_citation: breakdown.voice_citation,
        content_quality: breakdown.content_quality,
      };
    }

    return NextResponse.json({
      profile: profile ? { ...profile, score_breakdown: scoreBreakdown } : null,
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
