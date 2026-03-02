// ---------------------------------------------------------------------------
// POST /api/onboarding/state/[step] — Mark Onboarding Step Complete (Sprint 117)
//
// Any org member can mark any step complete (steps are org-scoped).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { markStepComplete } from '@/lib/onboarding/onboarding-service';
import { ONBOARDING_STEPS } from '@/lib/onboarding/types';
import type { OnboardingStepId } from '@/lib/onboarding/types';

export const dynamic = 'force-dynamic';

const VALID_STEP_IDS = new Set<string>(ONBOARDING_STEPS.map((s) => s.id));

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ step: string }> },
) {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx?.orgId) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const { step } = await params;

    if (!VALID_STEP_IDS.has(step)) {
      return NextResponse.json({ error: 'invalid_step' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const result = await markStepComplete(
      supabase,
      ctx.orgId,
      step as OnboardingStepId,
      ctx.userId,
    );

    return NextResponse.json({ ok: true, step: result });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'onboarding-step', sprint: '117' } });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
