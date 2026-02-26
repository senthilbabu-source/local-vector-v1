import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import RevenueConfigForm from './_components/RevenueConfigForm';

async function fetchRevenueConfig(orgId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('revenue_config')
    .select('avg_ticket, monthly_searches, local_conversion_rate, walk_away_rate')
    .eq('org_id', orgId)
    .limit(1)
    .maybeSingle();

  return data as {
    avg_ticket: number;
    monthly_searches: number;
    local_conversion_rate: number;
    walk_away_rate: number;
  } | null;
}

export default async function RevenueSettingsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const config = await fetchRevenueConfig(ctx.orgId ?? '');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Revenue Inputs
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Configure the values used to estimate your monthly revenue leak.
        </p>
      </div>
      <RevenueConfigForm config={config} />
    </div>
  );
}
