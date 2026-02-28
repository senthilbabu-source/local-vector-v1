import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchRevenueImpact } from '@/lib/data/revenue-impact';
import type { RevenueLineItem } from '@/lib/services/revenue-impact.service';
import { DollarSign, TrendingDown, AlertTriangle, Swords, ChevronDown, CheckCircle2 } from 'lucide-react';
import RevenueConfigForm from './_components/RevenueConfigForm';
import RevenueEstimatePanel from './_components/RevenueEstimatePanel';
import { getIndustryRevenueDefaults } from '@/lib/revenue-impact/industry-revenue-defaults';
import { getIndustryConfig } from '@/lib/industries/industry-config';

// ── Category display helpers (literal Tailwind — AI_RULES §12) ──────────

function categoryEmoji(category: RevenueLineItem['category']): string {
  if (category === 'sov_gap') return '\ud83d\udcc9';
  if (category === 'hallucination') return '\ud83d\udd34';
  return '\u2694\ufe0f';
}

function categoryIcon(category: RevenueLineItem['category']) {
  if (category === 'sov_gap') return <TrendingDown className="h-4 w-4 text-electric-indigo" />;
  if (category === 'hallucination') return <AlertTriangle className="h-4 w-4 text-alert-crimson" />;
  return <Swords className="h-4 w-4 text-alert-amber" />;
}

function categoryBorderColor(category: RevenueLineItem['category']): string {
  if (category === 'sov_gap') return 'border-electric-indigo/30';
  if (category === 'hallucination') return 'border-alert-crimson/30';
  return 'border-alert-amber/30';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Page Component ──────────────────────────────────────────────────────

export default async function RevenueImpactPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');
  if (!ctx.orgId) redirect('/login');

  const supabase = await createClient();

  // Fetch location + org industry in parallel
  const [locationResult, orgResult] = await Promise.all([
    supabase
      .from('locations')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('is_primary', true)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('*')
      .eq('id', ctx.orgId)
      .single(),
  ]);

  const location = locationResult.data;
  // industry column exists (Sprint E migration) but may not be in generated types
  const industryId = ((orgResult.data as Record<string, unknown>)?.industry as string) ?? null;
  const industryDefaults = getIndustryRevenueDefaults(industryId);
  const industryLabel = getIndustryConfig(industryId).label;

  if (!location) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Revenue Impact Calculator
        </h1>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            No primary location found. Complete onboarding to get started.
          </p>
        </div>
      </div>
    );
  }

  const result = await fetchRevenueImpact(supabase, ctx.orgId, location.id, industryDefaults);

  // Empty state: no data at all
  const hasNoData = result.totalMonthlyRevenue === 0 && result.lineItems.length === 0;

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-signal-green" />
          Revenue Impact Calculator
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Estimated revenue at risk from AI visibility gaps
        </p>
      </div>

      {/* ── Estimate Panel (Sprint I) ────────────────────── */}
      <RevenueEstimatePanel
        monthlyLoss={result.totalMonthlyRevenue}
        annualLoss={result.totalAnnualRevenue}
        isDefaultConfig={result.isDefaultConfig}
        industryLabel={industryLabel}
        sovGapRevenue={result.sovGapRevenue}
        hallucinationRevenue={result.hallucinationRevenue}
        competitorRevenue={result.competitorRevenue}
      />

      {/* ── Breakdown ────────────────────────────────────── */}
      {!hasNoData && result.lineItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Breakdown</h2>
          <div className="space-y-2">
            {result.lineItems.map((item) => (
              <LineItemCard key={item.category} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* ── Zero revenue positive message ──────────────────── */}
      {result.totalMonthlyRevenue === 0 && !hasNoData && (
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-white">
            Your AI visibility is strong!
          </p>
          <p className="mt-1 text-xs text-slate-400">
            No significant revenue gaps detected.
          </p>
        </div>
      )}

      {/* ── Refine Your Estimate ─────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">
          {result.isDefaultConfig ? 'Refine your estimate' : 'Revenue Settings'}
        </h2>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-4">
          <RevenueConfigForm
            locationId={location.id}
            avgCustomerValue={result.config.avgCustomerValue}
            monthlyCovers={result.config.monthlyCovers}
            isDefaultConfig={result.isDefaultConfig}
          />
        </div>
      </div>
    </div>
  );
}

// ── Line Item Card (Server Component) ────────────────────────────────────

function LineItemCard({ item }: { item: RevenueLineItem }) {
  return (
    <div
      className={`rounded-xl border bg-surface-dark px-4 py-3 ${categoryBorderColor(item.category)}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {categoryIcon(item.category)}
          <span className="text-sm font-semibold text-white">{item.label}</span>
        </div>
        <span className="text-sm font-bold text-white">
          {formatCurrency(item.monthlyRevenue)}/mo
        </span>
      </div>
      <p className="text-xs text-slate-400 ml-6">{item.description}</p>
      <p className="text-xs text-slate-500 ml-6 mt-1">{item.detail}</p>
    </div>
  );
}
