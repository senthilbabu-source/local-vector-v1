// ---------------------------------------------------------------------------
// app/api/autopilot/status/route.ts — Autopilot Status Summary
//
// GET: Returns draft counts, monthly usage, and last run time
// for the authenticated user's org. Used by the dashboard panel.
//
// Sprint 86 — Autopilot Engine
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDraftLimit } from '@/lib/autopilot/draft-limits';
import { getActiveLocationId } from '@/lib/location/active-location';

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // Fetch org plan
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  const plan = org?.plan ?? 'trial';
  const monthlyLimit = getDraftLimit(plan);

  // Count drafts by status
  const { data: allDrafts } = await supabase
    .from('content_drafts')
    .select('id, status, aeo_score, draft_title, trigger_type, created_at')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  const drafts = allDrafts ?? [];

  const pendingCount = drafts.filter((d) => d.status === 'draft').length;
  const approvedCount = drafts.filter((d) => d.status === 'approved').length;
  const publishedCount = drafts.filter((d) => d.status === 'published').length;

  // Monthly usage (current calendar month)
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthlyUsed = drafts.filter(
    (d) => new Date(d.created_at) >= monthStart,
  ).length;

  // Last autopilot run time (from active location)
  let lastRunAt: string | null = null;
  const locationId = await getActiveLocationId(supabase, ctx.orgId);
  if (locationId) {
    const { data: loc } = await supabase
      .from('locations')
      .select('autopilot_last_run_at')
      .eq('id', locationId)
      .single();
    lastRunAt = loc?.autopilot_last_run_at ?? null;
  }

  // Top pending draft
  const topPending = drafts.find((d) => d.status === 'draft') ?? null;

  return NextResponse.json({
    drafts_pending: pendingCount,
    drafts_approved: approvedCount,
    drafts_published: publishedCount,
    monthly_used: monthlyUsed,
    monthly_limit: monthlyLimit,
    last_run_at: lastRunAt,
    top_pending_draft: topPending
      ? {
          id: topPending.id,
          title: topPending.draft_title,
          trigger_type: topPending.trigger_type,
          aeo_score: topPending.aeo_score,
          created_at: topPending.created_at,
        }
      : null,
  });
}
