import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateMonthlyReport } from '@/lib/services/monthly-report.service';
import { sendMonthlyReport } from '@/lib/email';
import { canRunAIShopper } from '@/lib/plan-enforcer';

export const dynamic = 'force-dynamic';

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
    // Growth+ orgs only, opted in to monthly reports
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, plan, notify_monthly_report' as 'id, plan')
      .in('plan', ['growth', 'agency']);

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // Previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let sent = 0;
    let skipped = 0;

    for (const org of orgs) {
      const row = org as unknown as { id: string; plan: string; notify_monthly_report: boolean };

      if (!canRunAIShopper(row.plan as 'trial' | 'starter' | 'growth' | 'agency')) continue;
      if (row.notify_monthly_report === false) {
        skipped++;
        continue;
      }

      // Get primary location
      const { data: loc } = await supabase
        .from('locations')
        .select('id')
        .eq('org_id', row.id)
        .eq('is_primary', true)
        .maybeSingle();

      if (!loc) continue;

      // Get org owner email
      const { data: membership } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', row.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!membership) continue;

      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', membership.user_id)
        .single();

      if (!user?.email) continue;

      const report = await generateMonthlyReport(supabase, row.id, loc.id, prevMonth);

      void sendMonthlyReport(user.email, report).catch((err) =>
        Sentry.captureException(err, { tags: { cron: 'monthly-report', orgId: row.id } }),
      );

      sent++;
    }

    return NextResponse.json({ processed: orgs.length, sent, skipped });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'monthly-report' } });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
