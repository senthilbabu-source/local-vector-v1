// ---------------------------------------------------------------------------
// GET /api/onboarding/audit-status — Sprint 91
//
// Lightweight polling endpoint for Step 5 of the onboarding wizard.
// Returns the status of the most recent ai_audit for the authenticated
// user's org, scoped to audits created within the last 5 minutes.
//
// Response: { status: 'complete', auditId } | { status: 'running' } | { status: 'not_found' }
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // Scope to audits created within the last 5 minutes — ensures we're
  // detecting the audit triggered by onboarding, not a prior cron run.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: audit, error } = await supabase
    .from('ai_audits')
    .select('id')
    .eq('org_id', ctx.orgId)
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[audit-status] Query failed:', error.message);
    return NextResponse.json({ status: 'not_found' as const });
  }

  if (audit) {
    return NextResponse.json({ status: 'complete' as const, auditId: audit.id });
  }

  return NextResponse.json({ status: 'running' as const });
}
