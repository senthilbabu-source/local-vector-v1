// ---------------------------------------------------------------------------
// GET /api/v1/sov/gaps — Prompt Intelligence Gap Report
//
// Returns the latest gap analysis for the authenticated user's org/location.
// Auth: RLS-scoped via getSafeAuthContext() (org isolation).
//
// Spec: docs/15-LOCAL-PROMPT-INTELLIGENCE.md §8.3
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { detectQueryGaps } from '@/lib/services/prompt-intelligence.service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json(
      { error: 'location_id query parameter is required' },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Verify the location belongs to this org (RLS provides secondary enforcement)
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (locError || !location) {
    return NextResponse.json(
      { error: 'Location not found or access denied' },
      { status: 404 },
    );
  }

  const gaps = await detectQueryGaps(ctx.orgId, locationId, supabase);

  return NextResponse.json({
    gaps,
    totalGaps: gaps.length,
    lastAnalyzedAt: new Date().toISOString(),
  });
}
