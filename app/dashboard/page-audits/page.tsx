// ---------------------------------------------------------------------------
// app/dashboard/page-audits/page.tsx — Sprint 58B: Page Audit Dashboard
//
// Server component. Reads page_audits table for the tenant's org.
// Plan gate: Growth/Agency only.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PlanGate } from '@/components/plan-gate/PlanGate';
import AuditScoreOverview from './_components/AuditScoreOverview';
import PageAuditCardWrapper from './_components/PageAuditCardWrapper';
import type { PageAuditRecommendation } from '@/lib/page-audit/auditor';

// ---------------------------------------------------------------------------
// Types (mirrors page_audits table)
// ---------------------------------------------------------------------------

interface PageAuditRow {
  id: string;
  page_url: string;
  page_type: string;
  overall_score: number | null;
  answer_first_score: number | null;
  schema_completeness_score: number | null;
  faq_schema_present: boolean | null;
  faq_schema_score: number | null;
  entity_clarity_score: number | null;
  aeo_readability_score: number | null;
  recommendations: PageAuditRecommendation[] | null;
  last_audited_at: string;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPageAuditData(orgId: string) {
  const supabase = await createClient();

  const [auditResult, orgResult] = await Promise.all([
    supabase
      .from('page_audits')
      .select(
        'id, page_url, page_type, overall_score, answer_first_score, schema_completeness_score, faq_schema_present, faq_schema_score, entity_clarity_score, aeo_readability_score, recommendations, last_audited_at',
      )
      .eq('org_id', orgId)
      .order('last_audited_at', { ascending: false })
      .limit(50),

    supabase.from('organizations').select('plan').eq('id', orgId).single(),
  ]);

  return {
    audits: (auditResult.data as PageAuditRow[]) ?? [],
    plan: (orgResult.data?.plan as string) ?? 'trial',
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PageAuditsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const { audits, plan } = await fetchPageAuditData(ctx.orgId);

  // ── Empty state — no audits yet ───────────────────────────────────────────
  if (audits.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Page Audits</h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            Score your pages on 5 AEO dimensions to maximize AI visibility.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-dark border border-white/5 px-6 py-16 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-10 w-10 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-300">No page audits yet</p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Page audits run automatically as part of the weekly content audit cron. Your first results will appear after the next scan cycle.
          </p>
        </div>
      </div>
    );
  }

  // ── Compute aggregate score ───────────────────────────────────────────────
  const scores = audits
    .map((a) => a.overall_score)
    .filter((s): s is number => s !== null);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : 0;
  const latestAuditDate = audits[0]?.last_audited_at ?? null;

  return (
    <div className="space-y-8">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white">Page Audits</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          Score your pages on 5 AEO dimensions to maximize AI visibility.
        </p>
      </div>

      {/* ── Plan-gated content (blur teaser for Starter/Trial) ─────── */}
      <PlanGate requiredPlan="growth" currentPlan={plan} feature="Page Audit">
        {/* ── Score Overview ────────────────────────────────────────── */}
        <AuditScoreOverview
          overallScore={avgScore}
          totalPages={audits.length}
          lastAuditedAt={latestAuditDate}
        />

        {/* ── Page Cards ────────────────────────────────────────────── */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-white tracking-tight mb-3">
            Audited Pages
            <span className="ml-2 text-xs font-medium text-slate-500">{audits.length}</span>
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {audits.map((audit) => (
              <PageAuditCardWrapper
                key={audit.id}
                pageUrl={audit.page_url}
                pageType={audit.page_type}
                overallScore={audit.overall_score ?? 0}
                answerFirstScore={audit.answer_first_score}
                schemaCompletenessScore={audit.schema_completeness_score}
                faqSchemaPresent={audit.faq_schema_present ?? false}
                faqSchemaScore={audit.faq_schema_score}
                keywordDensityScore={audit.aeo_readability_score}
                entityClarityScore={audit.entity_clarity_score}
                recommendations={audit.recommendations ?? []}
                lastAuditedAt={audit.last_audited_at}
              />
            ))}
          </div>
        </section>
      </PlanGate>
    </div>
  );
}
