import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getPlanDisplayName } from '@/lib/plan-display-names';
import { formatRelativeDate } from '@/lib/admin/format-relative-date';
import AdminStatCard from '../../_components/AdminStatCard';
import PlanBadge from '../../_components/PlanBadge';
import CustomerActions from '../_components/CustomerActions';

// ---------------------------------------------------------------------------
// MRR constants (same as customers list page)
// ---------------------------------------------------------------------------

const PLAN_MRR: Record<string, number> = {
  trial: 0,
  starter: 29,
  growth: 59,
  agency: 0,
};

// ---------------------------------------------------------------------------
// Customer Detail Page — Sprint §204 (Admin Write Operations)
//
// Server Component showing comprehensive org info + admin action forms.
// Uses createServiceRoleClient() to bypass RLS.
// ---------------------------------------------------------------------------

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = createServiceRoleClient();

  // Fetch org details
  const { data: org } = await supabase
    .from('organizations')
    .select(
      `id, name, slug, plan, plan_status, stripe_customer_id, stripe_subscription_id,
       stripe_subscription_item_id, max_locations, seat_limit, seat_count,
       created_at, onboarding_completed, canceled_at, cancellation_reason,
       industry, webhook_url`,
    )
    .eq('id', orgId)
    .single();

  if (!org) notFound();

  // Parallel queries for stats
  const [membersResult, locationsResult, creditsResult, recentAuditResult] =
    await Promise.all([
      supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase
        .from('locations')
        .select('id, business_name, city, state')
        .eq('org_id', orgId),
      supabase
        .from('api_credits')
        .select('credits_used, credits_limit, reset_date')
        .eq('org_id', orgId)
        .maybeSingle(),
      // admin_audit_log not yet in generated types — cast through unknown
      (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)('admin_audit_log')
        .select('action, admin_email, details, created_at')
        .eq('target_org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(10) as unknown as Promise<{ data: Array<{ action: unknown; admin_email: unknown; details: unknown; created_at: string }> | null }>,
    ]);

  const memberCount = membersResult.count ?? 0;
  const locations = locationsResult.data ?? [];
  const credits = creditsResult.data;
  const auditLog = recentAuditResult.data ?? [];
  const mrr = PLAN_MRR[org.plan ?? 'trial'] ?? 0;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/customers"
            className="text-xs text-slate-400 hover:text-white transition"
          >
            &larr; Back to Customers
          </Link>
          <h1 className="text-xl font-semibold text-white mt-1">
            {org.name ?? 'Unnamed'}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <PlanBadge plan={org.plan} />
            <span className="text-xs text-slate-400 capitalize">
              {org.plan_status ?? 'unknown'}
            </span>
            {org.industry && (
              <span className="text-xs text-slate-500">{org.industry}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <AdminStatCard label="Plan" value={getPlanDisplayName(org.plan)} />
        <AdminStatCard label="MRR" value={`$${mrr}/mo`} />
        <AdminStatCard
          label="Credits"
          value={credits ? `${credits.credits_used}/${credits.credits_limit}` : '—'}
          highlight={
            credits && credits.credits_used >= credits.credits_limit
              ? 'danger'
              : credits && credits.credits_used >= credits.credits_limit * 0.8
                ? 'warning'
                : undefined
          }
        />
        <AdminStatCard label="Members" value={memberCount} />
        <AdminStatCard label="Locations" value={locations.length} />
        <AdminStatCard
          label="Created"
          value={formatRelativeDate(org.created_at)}
        />
      </div>

      {/* ── Stripe Info ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-white/10 bg-surface-dark p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Stripe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-400 block">Customer ID</span>
            <span className="text-slate-300 font-mono text-xs break-all">
              {org.stripe_customer_id ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Subscription ID</span>
            <span className="text-slate-300 font-mono text-xs break-all">
              {org.stripe_subscription_id ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Subscription Item</span>
            <span className="text-slate-300 font-mono text-xs break-all">
              {org.stripe_subscription_item_id ?? '—'}
            </span>
          </div>
        </div>
        {org.canceled_at && (
          <div className="mt-3 text-xs text-red-400">
            Canceled: {formatRelativeDate(org.canceled_at)}
            {org.cancellation_reason && ` — ${org.cancellation_reason}`}
          </div>
        )}
      </div>

      {/* ── Locations ──────────────────────────────────────────────── */}
      {locations.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-surface-dark p-4">
          <h2 className="text-sm font-semibold text-white mb-3">
            Locations ({locations.length})
          </h2>
          <div className="space-y-1">
            {locations.map((loc) => (
              <div key={loc.id} className="text-sm text-slate-300">
                {loc.business_name}
                {loc.city && (
                  <span className="text-slate-500 ml-2">
                    {loc.city}
                    {loc.state && `, ${loc.state}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Admin Actions ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-4">Actions</h2>
        <CustomerActions
          orgId={orgId}
          currentPlan={org.plan ?? 'trial'}
          orgName={org.name ?? 'Unnamed'}
          hasStripeSubscription={!!org.stripe_subscription_id}
        />
      </div>

      {/* ── Audit Log ──────────────────────────────────────────────── */}
      {auditLog.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-surface-dark p-4">
          <h2 className="text-sm font-semibold text-white mb-3">
            Admin Actions History
          </h2>
          <div className="space-y-2">
            {auditLog.map((entry, i) => (
              <div
                key={i}
                className="flex items-start justify-between text-xs border-b border-white/5 pb-2 last:border-0"
              >
                <div>
                  <span className="text-slate-300 font-medium capitalize">
                    {(entry.action as string).replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-500 ml-2">
                    by {entry.admin_email as string}
                  </span>
                  {(() => {
                    const d = entry.details as Record<string, unknown> | null;
                    if (d && typeof d === 'object' && d.reason) {
                      return (
                        <span className="text-slate-500 ml-1">
                          — {String(d.reason)}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <span className="text-slate-500 whitespace-nowrap ml-4">
                  {formatRelativeDate(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
