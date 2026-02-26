// ---------------------------------------------------------------------------
// /dashboard/content-drafts/[id] — Draft Detail/Review View
//
// Full detail view for a single content draft. Shows trigger context,
// editable content area, AEO score breakdown, and publish/action buttons.
//
// Spec: docs/06-FRONTEND-UX-SPEC.md §9.2, docs/19-AUTOPILOT-ENGINE.md §4
// ---------------------------------------------------------------------------

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DraftEditor from './_components/DraftEditor';
import PublishDropdown from './_components/PublishDropdown';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DraftDetail = {
  id: string;
  org_id: string;
  location_id: string | null;
  trigger_type: string;
  trigger_id: string | null;
  draft_title: string;
  draft_content: string;
  target_prompt: string | null;
  content_type: string;
  aeo_score: number | null;
  status: string;
  human_approved: boolean;
  published_url: string | null;
  published_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type LocationInfo = {
  business_name: string;
  city: string | null;
  state: string | null;
  categories: string[] | null;
};

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function triggerLabel(type: string): string {
  const labels: Record<string, string> = {
    first_mover: 'First Mover',
    competitor_gap: 'Competitor Gap',
    occasion: 'Occasion',
    prompt_missing: 'Prompt Gap',
    manual: 'Manual',
  };
  return labels[type] ?? type;
}

function triggerClasses(type: string): string {
  const map: Record<string, string> = {
    first_mover: 'bg-amber-400/10 text-amber-400 ring-amber-400/20',
    competitor_gap: 'bg-alert-crimson/10 text-alert-crimson ring-alert-crimson/20',
    occasion: 'bg-blue-400/10 text-blue-400 ring-blue-400/20',
    prompt_missing: 'bg-purple-400/10 text-purple-400 ring-purple-400/20',
    manual: 'bg-slate-400/10 text-slate-400 ring-slate-400/20',
  };
  return map[type] ?? 'bg-slate-400/10 text-slate-400 ring-slate-400/20';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    approved: 'Approved',
    published: 'Published',
    rejected: 'Rejected',
    archived: 'Archived',
  };
  return map[status] ?? status;
}

function statusClasses(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-slate-400/10 text-slate-400 ring-slate-400/20',
    approved: 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/20',
    published: 'bg-blue-400/10 text-blue-400 ring-blue-400/20',
    rejected: 'bg-alert-crimson/10 text-alert-crimson ring-alert-crimson/20',
    archived: 'bg-slate-400/10 text-slate-400 ring-slate-400/20',
  };
  return map[status] ?? 'bg-slate-400/10 text-slate-400 ring-slate-400/20';
}

function contentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    faq_page: 'FAQ Page',
    occasion_page: 'Occasion Page',
    blog_post: 'Blog Post',
    landing_page: 'Landing Page',
    gbp_post: 'GBP Post',
  };
  return labels[type] ?? type;
}

function aeoColor(score: number): string {
  if (score >= 80) return 'text-signal-green';
  if (score >= 60) return 'text-amber-400';
  return 'text-alert-crimson';
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchDraft(draftId: string, orgId: string): Promise<DraftDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('org_id', orgId)
    .single();

  if (error || !data) return null;
  return data as DraftDetail;
}

async function fetchLocation(locationId: string): Promise<LocationInfo | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('locations')
    .select('business_name, city, state, categories')
    .eq('id', locationId)
    .single();

  return data as LocationInfo | null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const { id } = await params;
  const draft = await fetchDraft(id, ctx.orgId);
  if (!draft) notFound();

  const location = draft.location_id ? await fetchLocation(draft.location_id) : null;

  const isDraft = draft.status === 'draft';
  const isApproved = draft.status === 'approved';
  const isPublished = draft.status === 'published';

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ─────────────────────────────────────────────── */}
      <Link
        href="/dashboard/content-drafts"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Content Drafts
      </Link>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/5 bg-surface-dark p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${triggerClasses(draft.trigger_type)}`}
          >
            {triggerLabel(draft.trigger_type)}
          </span>
          <span className="text-xs text-slate-600">
            {contentTypeLabel(draft.content_type)}
          </span>
          <span
            className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClasses(draft.status)}`}
          >
            {statusLabel(draft.status)}
          </span>
        </div>

        <h1 className="text-lg font-semibold text-white mb-2">
          {draft.draft_title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          {draft.aeo_score != null && (
            <span className={`font-semibold tabular-nums ${aeoColor(draft.aeo_score)}`}>
              AEO Score: {draft.aeo_score}
            </span>
          )}
          {location && (
            <span>{location.business_name} — {location.city}, {location.state}</span>
          )}
          <span>
            Created{' '}
            {new Date(draft.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          {draft.approved_at && (
            <span className="text-emerald-400">
              Approved{' '}
              {new Date(draft.approved_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
          {draft.published_at && (
            <span className="text-blue-400">
              Published{' '}
              {new Date(draft.published_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Content Editor (2/3 width) */}
        <div className="lg:col-span-2">
          <DraftEditor
            draftId={draft.id}
            draftTitle={draft.draft_title}
            draftContent={draft.draft_content}
            targetPrompt={draft.target_prompt}
            aeoScore={draft.aeo_score}
            status={draft.status}
            businessName={location?.business_name ?? 'Business'}
            city={location?.city ?? null}
            categories={location?.categories ?? null}
          />
        </div>

        {/* Right: Context Panel (1/3 width) */}
        <div className="space-y-4">
          {/* Trigger Context */}
          <div className="rounded-xl border border-white/5 bg-surface-dark p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              Trigger Context
            </h3>
            <dl className="space-y-2 text-xs">
              {draft.target_prompt && (
                <div>
                  <dt className="text-slate-500">Target Query</dt>
                  <dd className="text-white font-medium mt-0.5">
                    &ldquo;{draft.target_prompt}&rdquo;
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Trigger Type</dt>
                <dd className="text-white mt-0.5">{triggerLabel(draft.trigger_type)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Content Type</dt>
                <dd className="text-white mt-0.5">{contentTypeLabel(draft.content_type)}</dd>
              </div>
            </dl>
          </div>

          {/* Actions */}
          <div className="rounded-xl border border-white/5 bg-surface-dark p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              Actions
            </h3>
            {isApproved && <PublishDropdown draftId={draft.id} />}
            {isPublished && draft.published_url && (
              <a
                href={draft.published_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md bg-blue-400/10 px-4 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-400/20 transition text-center"
              >
                View Published Page
              </a>
            )}
            {isDraft && (
              <p className="text-xs text-slate-500">
                Approve this draft to unlock publish options.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
