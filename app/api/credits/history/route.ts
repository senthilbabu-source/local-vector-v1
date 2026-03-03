// ---------------------------------------------------------------------------
// app/api/credits/history/route.ts — P3-FIX-14: Credit usage history API
//
// GET /api/credits/history?limit=20
// Returns paginated credit usage history for the authenticated org.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { getCreditHistory, getCreditBalance } from '@/lib/credits/credit-service';

export async function GET(request: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Math.max(limitParam, 1), 100); // clamp 1-100

  const [history, balance] = await Promise.all([
    getCreditHistory(ctx.orgId, limit),
    getCreditBalance(ctx.orgId),
  ]);

  return NextResponse.json({
    balance,
    history,
  });
}
