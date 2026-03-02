// ---------------------------------------------------------------------------
// GET /api/sandbox/draft/[draftId] — Fetch draft content for sandbox
//
// Sprint 110: Returns content_text from a content_draft for pre-loading.
// Validates that the draft belongs to the authenticated user's org.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const { draftId } = await params;

    const supabase = await createClient();
    const { data: draft, error } = await supabase
      .from('content_drafts')
      .select('id, draft_title, draft_content, status, trigger_type')
      .eq('id', draftId)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (error || !draft) {
      return NextResponse.json(
        { error: 'not_found', message: 'Draft not found or does not belong to your organization' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      draft_id: draft.id,
      title: draft.draft_title,
      content_text: draft.draft_content,
      status: draft.status,
      trigger_type: draft.trigger_type,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'sandbox-draft', sprint: '110' } });
    return NextResponse.json(
      { error: 'fetch_failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
