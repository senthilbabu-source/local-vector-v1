// ---------------------------------------------------------------------------
// GET /api/authority/status — Current entity authority state
//
// Sprint 108: Returns authority profile + snapshot history for dashboard panel.
// Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';
import { getAuthorityHistory } from '@/lib/authority/citation-velocity-monitor';
import type { EntityAuthorityProfile, AuthorityStatusResponse } from '@/lib/authority/types';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json(
        { error: 'plan_upgrade_required' },
        { status: 403 },
      );
    }

    // Fetch primary location
    const { data: location } = await supabase
      .from('locations')
      .select('id, authority_score, authority_last_run_at')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!location) {
      const response: AuthorityStatusResponse = {
        profile: null,
        history: [],
        last_run_at: null,
      };
      return NextResponse.json(response);
    }

    // Fetch authority profile
    const { data: profileRow } = await supabase
      .from('entity_authority_profiles')
      .select('*')
      .eq('location_id', location.id)
      .maybeSingle();

    let profile: EntityAuthorityProfile | null = null;
    if (profileRow) {
      profile = {
        location_id: profileRow.location_id,
        org_id: profileRow.org_id,
        entity_authority_score: profileRow.entity_authority_score,
        dimensions: {
          tier1_citation_score: profileRow.tier1_citation_score,
          tier2_coverage_score: profileRow.tier2_coverage_score,
          platform_breadth_score: profileRow.platform_breadth_score,
          sameas_score: profileRow.sameas_score,
          velocity_score: profileRow.velocity_score,
        },
        tier_breakdown: {
          tier1: profileRow.tier1_count,
          tier2: profileRow.tier2_count,
          tier3: profileRow.tier3_count,
          unknown: 0,
        },
        top_citations: [],
        sameas_gaps: (profileRow.sameas_gaps as unknown as EntityAuthorityProfile['sameas_gaps']) ?? [],
        citation_velocity: profileRow.citation_velocity ? Number(profileRow.citation_velocity) : null,
        velocity_label: (profileRow.velocity_label as EntityAuthorityProfile['velocity_label']) ?? 'unknown',
        recommendations: (profileRow.recommendations as unknown as EntityAuthorityProfile['recommendations']) ?? [],
        snapshot_at: profileRow.snapshot_at,
      };
    }

    // Fetch history (last 6 months)
    const history = await getAuthorityHistory(supabase, location.id, 6);

    const response: AuthorityStatusResponse = {
      profile,
      history,
      last_run_at: location.authority_last_run_at,
    };

    return NextResponse.json(response);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'authority-status', sprint: '108' } });
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500 },
    );
  }
}
