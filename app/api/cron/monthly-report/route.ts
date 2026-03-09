import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateMonthlyReport } from '@/lib/services/monthly-report.service';
import { sendMonthlyReport } from '@/lib/email';
import { canRunAIShopper } from '@/lib/plan-enforcer';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.STOP_MONTHLY_REPORT_CRON === 'true') {
    return NextResponse.json({ skipped: true, reason: 'kill_switch' });
  }

  const supabase = createServiceRoleClient();

  try {
    // Growth+ orgs only
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, plan, notify_monthly_report, last_monthly_report_sent_at' as 'id, plan')
      .in('plan', ['growth', 'agency']);

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // Filter eligible orgs upfront
    // Idempotency: skip orgs that already received this month's report
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

    const eligibleOrgs = (orgs as unknown as { id: string; plan: string; notify_monthly_report: boolean; last_monthly_report_sent_at: string | null }[])
      .filter(row => {
        if (!canRunAIShopper(row.plan as 'trial' | 'starter' | 'growth' | 'agency')) return false;
        if (row.notify_monthly_report === false) return false;
        // Idempotency: skip if already sent this month (prevents duplicate emails on retry)
        if (row.last_monthly_report_sent_at && new Date(row.last_monthly_report_sent_at) >= monthStart) return false;
        return true;
      });

    const skipped = orgs.length - eligibleOrgs.length;

    if (eligibleOrgs.length === 0) {
      return NextResponse.json({ processed: orgs.length, sent: 0, skipped });
    }

    const orgIds = eligibleOrgs.map(o => o.id);

    // ── Batch fetch all locations + memberships in 2 queries (not N+1) ──
    const [locationsResult, membershipsResult] = await Promise.all([
      supabase
        .from('locations')
        .select('id, org_id')
        .in('org_id', orgIds)
        .eq('is_primary', true),
      supabase
        .from('memberships')
        .select('org_id, user_id')
        .in('org_id', orgIds)
        .eq('role', 'owner'),
    ]);

    const locationsByOrg = new Map<string, string>();
    for (const loc of locationsResult.data ?? []) {
      locationsByOrg.set(loc.org_id, loc.id);
    }

    const ownerUserIdsByOrg = new Map<string, string>();
    for (const mem of membershipsResult.data ?? []) {
      ownerUserIdsByOrg.set(mem.org_id, mem.user_id);
    }

    // Batch fetch all owner emails in 1 query
    const ownerUserIds = [...new Set(ownerUserIdsByOrg.values())];
    const emailsByUserId = new Map<string, string>();

    if (ownerUserIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .in('id', ownerUserIds);

      for (const u of users ?? []) {
        if (u.email) emailsByUserId.set(u.id, u.email);
      }
    }

    // Previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Generate reports + send emails in parallel (batches of 10)
    let sent = 0;
    const BATCH_SIZE = 10;

    for (let i = 0; i < eligibleOrgs.length; i += BATCH_SIZE) {
      const batch = eligibleOrgs.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (org) => {
          const locId = locationsByOrg.get(org.id);
          if (!locId) return false;

          const ownerUserId = ownerUserIdsByOrg.get(org.id);
          if (!ownerUserId) return false;

          const email = emailsByUserId.get(ownerUserId);
          if (!email) return false;

          const report = await generateMonthlyReport(supabase, org.id, locId, prevMonth);

          await sendMonthlyReport(email, report);

          // Mark as sent for idempotency
          void supabase
            .from('organizations')
            .update({ last_monthly_report_sent_at: new Date().toISOString() } as Record<string, unknown>)
            .eq('id', org.id)
            .then(({ error: updateErr }) => {
              if (updateErr) Sentry.captureException(updateErr, { tags: { cron: 'monthly-report', orgId: org.id } });
            });

          return true;
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value === true) sent++;
      }
    }

    return NextResponse.json({ processed: orgs.length, sent, skipped });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'monthly-report' } });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
