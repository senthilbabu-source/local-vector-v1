// ---------------------------------------------------------------------------
// POST /api/hallucinations/[id]/correct — Sprint 121
// Marks a hallucination as corrected and triggers brief generation.
// Auth: owner | admin only.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { markHallucinationCorrected } from '@/lib/corrections';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'admin')) {
    return NextResponse.json({ error: 'insufficient_role' }, { status: 403 });
  }

  const { id } = await params;

  let body: { notes?: string } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — notes are optional
  }

  try {
    const supabase = await createClient();
    const result = await markHallucinationCorrected(
      supabase,
      id,
      ctx.orgId,
      body.notes,
    );

    return NextResponse.json({
      ok: true,
      follow_up_id: result.follow_up.id,
      brief_generating: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'hallucination_not_found' || msg === 'already_corrected') {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    Sentry.captureException(err, { tags: { sprint: '121', route: 'correct' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
