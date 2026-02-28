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
import Link from 'next/link';
import { FileText, Swords } from 'lucide-react';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDaysUntilPeak } from '@/lib/services/occasion-engine.service';
import type { LocalOccasionRow } from '@/lib/types/occasions';
import { PlanGate } from '@/components/plan-gate/PlanGate';
import { markSectionSeen } from '@/lib/badges/badge-counts';
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
      'id, trigger_type, trigger_id, draft_title, draft_content, target_prompt, content_type, aeo_score, status, human_approved, created_at'
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

/**
 * Sprint O (L3): Build a map of occasion ID → occasion name for DraftSourceTag.
 */
async function fetchOccasionNames(occasionIds: string[]): Promise<Record<string, string>> {
  if (occasionIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from('local_occasions')
    .select('id, name')
    .in('id', occasionIds);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.name;
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
  searchParams: Promise<{ status?: string; from?: string; occasion?: string }>;
}) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    redirect('/login');
  }

  // Sprint 101: Mark content_drafts section as seen (resets sidebar badge)
  const badgeSupa = await createClient();
  await markSectionSeen(badgeSupa, ctx.orgId, ctx.userId, 'content_drafts');

  const resolvedParams = await searchParams;
  const statusFilter = resolvedParams.status;
  // Sprint O (L3): Breadcrumb support from content calendar
  const fromCalendar = resolvedParams.from === 'calendar';
  const breadcrumbOccasion = resolvedParams.occasion
    ? decodeURIComponent(resolvedParams.occasion).slice(0, 100)
    : null;

  const [drafts, occasions, occasionDraftMap, plan] = await Promise.all([
    fetchPageData(ctx.orgId, statusFilter),
    fetchUpcomingOccasions(),
    fetchOccasionDraftMap(ctx.orgId),
    fetchPlan(ctx.orgId),
  ]);

  // Sprint O (L3): Fetch occasion names for drafts with trigger_type='occasion'
  const occasionTriggerIds = drafts
    .filter((d) => d.trigger_type === 'occasion' && d.trigger_id)
    .map((d) => d.trigger_id!);
  const occasionNames = await fetchOccasionNames(occasionTriggerIds);

  // Summary counts (across all drafts, not just filtered)
  const allDrafts = statusFilter ? await fetchPageData(ctx.orgId) : drafts;
  const draftCount = allDrafts.filter((d) => d.status === 'draft').length;
  const approvedCount = allDrafts.filter((d) => d.status === 'approved').length;

  return (
    <div className="space-y-6">

      {/* ── Sprint O (L3): Calendar breadcrumb ────────────────────── */}
      {fromCalendar && (
        <nav
          className="flex items-center gap-2 text-sm text-slate-500"
          aria-label="Breadcrumb"
          data-testid="calendar-breadcrumb"
        >
          <Link
            href="/dashboard/content-calendar"
            className="hover:text-white transition-colors"
          >
            Content Calendar
          </Link>
          <span aria-hidden="true">&rsaquo;</span>
          <span className="text-white">
            {breadcrumbOccasion ?? 'Generated draft'}
          </span>
        </nav>
      )}

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
            <div
              data-testid="content-drafts-empty-state"
              className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-16 text-center ring-1 ring-white/5"
            >
              <FileText className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-400">
                {statusFilter ? 'No drafts match this filter' : 'No content drafts yet'}
              </p>
              {statusFilter ? (
                <p className="mt-1 text-xs text-slate-500">
                  Try removing the filter to see all drafts.
                </p>
              ) : (
                <>
                  <p className="mt-2 max-w-sm text-xs text-slate-500 leading-relaxed">
                    Content drafts are auto-generated when LocalVector detects a competitor
                    outranking you on an AI query. To generate your first draft:
                  </p>
                  <ol className="mt-2 text-left text-xs text-slate-500 space-y-0.5">
                    <li>1. Add competitors on the Compete page</li>
                    <li>2. LocalVector detects intercepts overnight</li>
                    <li>3. AI drafts appear here for your review</li>
                  </ol>
                  <Link
                    href="/dashboard/compete"
                    data-testid="content-drafts-empty-cta"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-signal-green/15 px-4 py-2 text-xs font-medium text-signal-green hover:bg-signal-green/25 transition"
                  >
                    <Swords className="h-3.5 w-3.5" />
                    Go to Compete
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft) => (
                <ContentDraftCard
                  key={draft.id}
                  draft={draft}
                  occasionName={
                    draft.trigger_type === 'occasion' && draft.trigger_id
                      ? occasionNames[draft.trigger_id] ?? null
                      : null
                  }
                />
              ))}
            </div>
          )}
        </div>
      </PlanGate>
    </div>
  );
}
