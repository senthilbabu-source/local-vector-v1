// ---------------------------------------------------------------------------
// GET /api/onboarding/state — Onboarding State (Sprint 117)
//
// Returns OnboardingState for the authenticated user's org.
// Uses service role client so autoCompleteSteps() can read across tables.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getOnboardingState } from '@/lib/onboarding/onboarding-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx?.orgId) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const state = await getOnboardingState(supabase, ctx.orgId, ctx.org?.created_at ?? null);

    return NextResponse.json(state);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'onboarding-state', sprint: '117' } });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
