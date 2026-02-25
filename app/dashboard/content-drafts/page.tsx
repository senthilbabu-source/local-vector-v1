// ---------------------------------------------------------------------------
// /dashboard/content-drafts — Content Drafts page (Sprint 42)
//
// Displays AI-generated content drafts from the Autopilot engine (content_drafts
// table). Users can review, approve, or reject drafts. Plan-gated: only
// Growth/Agency can create manual drafts; all plans can view existing drafts.
//
// Design: Deep Night theme, consistent with rest of dashboard shell.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canRunAutopilot, type PlanTier } from '@/lib/plan-enforcer';
import ContentDraftCard, { type ContentDraftRow } from './_components/ContentDraftCard';
import DraftFilterTabs from './_components/DraftFilterTabs';

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPageData(orgId: string, statusFilter?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  let query = supabase
    .from('content_drafts')
    .select(
      'id, trigger_type, draft_title, draft_content, target_prompt, content_type, aeo_score, status, human_approved, created_at'
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[content-drafts] fetch error:', error);
  }

  return (data ?? []) as ContentDraftRow[];
}

async function fetchPlan(orgId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single();
  return data?.plan ?? 'trial';
}

// ---------------------------------------------------------------------------
// UpgradeGate — inline (single use, AI_RULES §over-engineering)
// ---------------------------------------------------------------------------

function UpgradeGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <FileText className="h-12 w-12 text-slate-600" />
      <h2 className="text-xl font-semibold text-white">AI Content Drafts</h2>
      <p className="text-slate-400 max-w-md">
        Content Drafts is available on the Growth plan. Upgrade to get AI-generated
        content from First Mover opportunities and competitor gaps.
      </p>
      <a
        href="/dashboard/billing"
        className="rounded-lg bg-signal-green px-6 py-2.5 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 transition"
      >
        Upgrade to Growth — $59/mo
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ContentDraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    redirect('/login');
  }

  const plan = await fetchPlan(ctx.orgId);

  if (!canRunAutopilot(plan as PlanTier)) {
    return <UpgradeGate />;
  }

  const resolvedParams = await searchParams;
  const statusFilter = resolvedParams.status;
  const drafts = await fetchPageData(ctx.orgId, statusFilter);

  // Summary counts (across all drafts, not just filtered)
  const allDrafts = statusFilter ? await fetchPageData(ctx.orgId) : drafts;
  const draftCount = allDrafts.filter((d) => d.status === 'draft').length;
  const approvedCount = allDrafts.filter((d) => d.status === 'approved').length;

  return (
    <div className="space-y-6">

      {/* ── Page header ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white">Content Drafts</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          AI-generated content waiting for your review. Approve drafts to publish
          them to your website or Google Business Profile.
        </p>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
          <p className="text-xs text-slate-500">Pending Review</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-400">
            {draftCount}
          </p>
        </div>
        <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
          <p className="text-xs text-slate-500">Approved</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-400">
            {approvedCount}
          </p>
        </div>
        <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
          <p className="text-xs text-slate-500">Total Drafts</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">
            {allDrafts.length}
          </p>
        </div>
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────── */}
      <DraftFilterTabs />

      {/* ── Draft cards ────────────────────────────────────────────── */}
      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center ring-1 ring-white/5">
          <FileText className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-400">
            {statusFilter ? 'No drafts match this filter' : 'No content drafts yet'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            AI-generated content from First Mover opportunities and competitor
            gaps will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <ContentDraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}
    </div>
  );
}
