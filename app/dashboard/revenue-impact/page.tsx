import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchRevenueImpact } from '@/lib/data/revenue-impact';
import type { RevenueLineItem } from '@/lib/services/revenue-impact.service';
import { TrendingDown, AlertTriangle, Swords } from 'lucide-react';
import Link from 'next/link';
import RevenueConfigForm from './_components/RevenueConfigForm';
import LostSalesHero from './_components/LostSalesHero';
import { getIndustryRevenueDefaults } from '@/lib/revenue-impact/industry-revenue-defaults';
import { getIndustryConfig } from '@/lib/industries/industry-config';

export const metadata = { title: 'Lost Sales | LocalVector.ai' };

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
          What This Costs You
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
        <h1 className="text-xl font-semibold text-white tracking-tight">
          What This Costs You
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          How much revenue you might be losing because AI apps have wrong or missing information about your business.
        </p>
      </div>

      {/* ── S4: Lost Sales coaching hero ────────────────────── */}
      <LostSalesHero
        monthlyLoss={result.totalMonthlyRevenue}
        annualLoss={result.totalAnnualRevenue}
        isDefaultConfig={result.isDefaultConfig}
        industryLabel={industryLabel}
        sovGapRevenue={result.sovGapRevenue}
        hallucinationRevenue={result.hallucinationRevenue}
        competitorRevenue={result.competitorRevenue}
        avgCustomerValue={result.config.avgCustomerValue}
        monthlyCovers={result.config.monthlyCovers}
      />

      {/* ── S4: Coach playbook — numbered missions ───────────────── */}
      {result.lineItems.length > 0 && result.totalMonthlyRevenue > 0 && (
        <CoachPlaybook
          lineItems={result.lineItems}
          totalMonthlyLoss={result.totalMonthlyRevenue}
        />
      )}

      {/* ── Per-issue detail ─────────────────────────────────────── */}
      {!hasNoData && result.lineItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono mb-3">
            Detail
          </p>
          <div className="space-y-2">
            {result.lineItems.map((item) => (
              <LineItemCard key={item.category} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* ── Adjust your numbers ──────────────────────────────── */}
      <div id="adjust">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono mb-3">
          {result.isDefaultConfig ? 'Adjust your numbers for a more accurate estimate' : 'Your numbers'}
        </p>
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

// ── Plain-English label map ───────────────────────────────────────────────

const CATEGORY_PLAIN: Record<string, {
  label:   string;
  action:  string;
  timeEst: string;
  href:    string;
  hex:     string;
  ctaText: string;
}> = {
  hallucination: {
    label:   'Wrong information',
    action:  'Fix the wrong facts AI apps are spreading about your business',
    timeEst: '~2 min per fix',
    href:    '/dashboard/hallucinations',
    hex:     '#ef4444',
    ctaText: 'Fix wrong facts →',
  },
  sov_gap: {
    label:   'Not showing up in AI searches',
    action:  'Get your business found when customers ask AI for recommendations',
    timeEst: '~5 min',
    href:    '/dashboard/share-of-voice',
    hex:     '#6366f1',
    ctaText: 'See what you\'re missing →',
  },
  competitor: {
    label:   'Lost to competitors',
    action:  'See which competitors are outranking you and close the gap',
    timeEst: '~10 min',
    href:    '/dashboard/compete',
    hex:     '#FFB800',
    ctaText: 'See competitor gaps →',
  },
};

function plainLabel(category: RevenueLineItem['category']): string {
  return CATEGORY_PLAIN[category]?.label ?? category;
}

// ── Coach Playbook (Server Component) ────────────────────────────────────

function CoachPlaybook({
  lineItems,
  totalMonthlyLoss,
}: {
  lineItems: RevenueLineItem[];
  totalMonthlyLoss: number;
}) {
  // Sort highest recovery first — that's the priority order
  const sorted = [...lineItems]
    .filter(i => i.monthlyRevenue > 0)
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);

  if (sorted.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark overflow-hidden"
      data-testid="coach-playbook"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-midnight-slate px-5 py-3">
        <p
          className="text-[10px] font-bold uppercase tracking-widest text-slate-400"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
        >
          Your fix plan this week
        </p>
        <span className="text-xs text-slate-500">
          {formatCurrency(totalMonthlyLoss)}/mo recoverable
        </span>
      </div>

      {/* Mission list */}
      <div className="divide-y divide-white/5">
        {sorted.map((item, i) => {
          const cfg = CATEGORY_PLAIN[item.category] ?? {
            label: item.label, action: item.description,
            timeEst: '', href: '#', hex: '#94a3b8', ctaText: 'View →',
          };

          return (
            <div key={item.category} className="flex items-start gap-4 px-5 py-4">
              {/* Step number badge */}
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{
                  background: cfg.hex,
                  boxShadow: `0 0 10px ${cfg.hex}60`,
                }}
              >
                {i + 1}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white leading-snug">
                      {cfg.action}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className="text-sm font-bold tabular-nums font-mono"
                      style={{ color: cfg.hex }}
                    >
                      {formatCurrency(item.monthlyRevenue)}/mo
                    </p>
                    {cfg.timeEst && (
                      <p className="mt-0.5 text-[10px] text-slate-500">{cfg.timeEst}</p>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={cfg.href}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                  style={{
                    borderColor: `${cfg.hex}40`,
                    background: `${cfg.hex}10`,
                    color: cfg.hex,
                  }}
                >
                  {cfg.ctaText}
                </Link>
              </div>
            </div>
          );
        })}
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
          <span className="text-sm font-semibold text-white">{plainLabel(item.category)}</span>
        </div>
        <span className="text-sm font-bold text-white">
          {formatCurrency(item.monthlyRevenue)}/mo
        </span>
      </div>
      <p className="text-xs text-slate-400 ml-6">{item.description}</p>
      <p className="text-xs text-slate-400 ml-6 mt-1">{item.detail}</p>
    </div>
  );
}
