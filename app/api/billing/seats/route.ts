/**
 * GET /api/billing/seats — Sprint 113
 *
 * Returns current seat state for the billing UI.
 * Auth: session required. Any org member can view.
 */

import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getSeatState } from '@/lib/billing/seat-billing-service';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const state = await getSeatState(supabase, ctx.orgId);
    return NextResponse.json(state);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'billing-seats', sprint: '113' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
