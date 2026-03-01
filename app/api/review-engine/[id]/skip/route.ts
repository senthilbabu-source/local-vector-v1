// ---------------------------------------------------------------------------
// POST /api/review-engine/:id/skip — Skip review response
//
// Sprint 107: Marks a review as skipped (no response needed).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reviewId } = await params;

    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: review } = await supabase
      .from('reviews')
      .select('id')
      .eq('id', reviewId)
      .maybeSingle();

    if (!review) {
      return NextResponse.json({ error: 'not_found', message: 'Review not found' }, { status: 404 });
    }

    await supabase
      .from('reviews')
      .update({ response_status: 'skipped' })
      .eq('id', reviewId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'review-skip', sprint: '107' } });
    return NextResponse.json(
      { error: 'skip_failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
