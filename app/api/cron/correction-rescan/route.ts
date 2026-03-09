// ---------------------------------------------------------------------------
// POST /api/cron/correction-rescan — Sprint 121
// Nightly cron: rescans corrections due for re-evaluation (14 days after marking).
// Schedule: 0 4 * * * (daily at 4 AM UTC)
// AI_RULES §59: Correction rescan LIMIT 20 per run.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runCorrectionRescan } from '@/lib/corrections';
import type { CorrectionFollowUp } from '@/lib/corrections/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  try {
    // Fetch pending corrections due for rescan, LIMIT 20
    const { data: pendingRows, error } = await supabase
      .from('correction_follow_ups' as never)
      .select('*')
      .eq('rescan_status' as never, 'pending' as never)
      .lte('rescan_due_at' as never, new Date().toISOString() as never)
      .limit(20);

    if (error) {
      throw new Error(`fetch_failed: ${error.message}`);
    }

    const pending = (pendingRows ?? []) as unknown as CorrectionFollowUp[];

    let rescanned = 0;
    let errors = 0;

    for (const followUp of pending) {
      try {
        await runCorrectionRescan(supabase, followUp);
        rescanned++;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { cron: 'correction-rescan', sprint: '121' },
          extra: { followUpId: followUp.id },
        });
        errors++;
      }
    }

    console.log(`[cron-correction-rescan] Rescanned ${rescanned}, errors ${errors}`);
    return NextResponse.json({ ok: true, rescanned, errors, total_pending: pending.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: 'correction-rescan', sprint: '121' } });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
