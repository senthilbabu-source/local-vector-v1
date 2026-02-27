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
import { getDaysUntilPeak } from '@/lib/services/occasion-engine.service';
import type { LocalOccasionRow } from '@/lib/types/occasions';
import { PlanGate } from '@/components/plan-gate/PlanGate';
import ContentDraftCard, { type ContentDraftRow } from './_components/ContentDraftCard';
import DraftFilterTabs from './_components/DraftFilterTabs';
import OccasionTimeline, { type OccasionWithCountdown } from './_components/OccasionTimeline';

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPageData(orgId: string, statusFilter?: string) {
  const supabase = await createClient();

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

async function fetchUpcomingOccasions(): Promise<OccasionWithCountdown[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('local_occasions')
    .select('*')
    .eq('is_active', true);

  if (error || !data?.length) return [];

  const today = new Date();
  return (data as unknown as LocalOccasionRow[])
    .map((occ) => {
      const daysUntilPeak = getDaysUntilPeak(occ, today);
      return {
        id: occ.id,
        name: occ.name,
        occasion_type: occ.occasion_type,
        daysUntilPeak,
        relevant_categories: occ.relevant_categories,
      };
    })
    .filter((o) => o.daysUntilPeak >= 0 && o.daysUntilPeak <= 60)
    .sort((a, b) => a.daysUntilPeak - b.daysUntilPeak);
}

async function fetchOccasionDraftMap(orgId: string): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('content_drafts')
    .select('id, trigger_id')
    .eq('org_id', orgId)
    .eq('trigger_type', 'occasion')
    .in('status', ['draft', 'approved', 'published']);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.trigger_id) map[row.trigger_id] = row.id;
  }
  return map;
}

async function fetchPlan(orgId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single();
  return data?.plan ?? 'trial';
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

  const resolvedParams = await searchParams;
  const statusFilter = resolvedParams.status;
  const [drafts, occasions, occasionDraftMap, plan] = await Promise.all([
    fetchPageData(ctx.orgId, statusFilter),
    fetchUpcomingOccasions(),
    fetchOccasionDraftMap(ctx.orgId),
    fetchPlan(ctx.orgId),
  ]);

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

      {/* ── Plan-gated content (blur teaser for Starter/Trial) ───── */}
      <PlanGate requiredPlan="growth" currentPlan={plan} feature="Content Drafts">
        {/* ── Summary strip ────────────────────────────────────────── */}
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

        {/* ── Upcoming Occasions ────────────────────────────────────── */}
        <div className="mt-6">
          <OccasionTimeline
            occasions={occasions}
            existingDraftsByOccasionId={occasionDraftMap}
          />
        </div>

        {/* ── Filter tabs ──────────────────────────────────────────── */}
        <div className="mt-6">
          <DraftFilterTabs />
        </div>

        {/* ── Draft cards ──────────────────────────────────────────── */}
        <div className="mt-6">
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
      </PlanGate>
    </div>
  );
}
