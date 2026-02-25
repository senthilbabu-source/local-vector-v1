'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { approveDraft, rejectDraft, archiveDraft, publishDraft } from '../actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentDraftRow {
  id: string;
  trigger_type: string;
  draft_title: string;
  draft_content: string;
  target_prompt: string | null;
  content_type: string;
  aeo_score: number | null;
  status: string;
  human_approved: boolean;
  created_at: string;
}

interface ContentDraftCardProps {
  draft: ContentDraftRow;
}

// ---------------------------------------------------------------------------
// Badge helpers (literal Tailwind classes for JIT safety)
// ---------------------------------------------------------------------------

function triggerBadge(type: string): { label: string; classes: string } {
  switch (type) {
    case 'first_mover':
      return { label: 'First Mover', classes: 'bg-amber-400/10 text-amber-400 ring-amber-400/20' };
    case 'competitor_gap':
      return { label: 'Competitor Gap', classes: 'bg-alert-crimson/10 text-alert-crimson ring-alert-crimson/20' };
    case 'occasion':
      return { label: 'Occasion', classes: 'bg-blue-400/10 text-blue-400 ring-blue-400/20' };
    case 'prompt_missing':
      return { label: 'Prompt Gap', classes: 'bg-purple-400/10 text-purple-400 ring-purple-400/20' };
    default:
      return { label: 'Manual', classes: 'bg-slate-400/10 text-slate-400 ring-slate-400/20' };
  }
}

function statusBadge(status: string): { label: string; classes: string } {
  switch (status) {
    case 'approved':
      return { label: 'Approved', classes: 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/20' };
    case 'published':
      return { label: 'Published', classes: 'bg-blue-400/10 text-blue-400 ring-blue-400/20' };
    case 'rejected':
      return { label: 'Rejected', classes: 'bg-alert-crimson/10 text-alert-crimson ring-alert-crimson/20' };
    case 'archived':
      return { label: 'Archived', classes: 'bg-slate-400/10 text-slate-400 ring-slate-400/20' };
    default:
      return { label: 'Draft', classes: 'bg-slate-400/10 text-slate-400 ring-slate-400/20' };
  }
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
// Component
// ---------------------------------------------------------------------------

export default function ContentDraftCard({ draft }: ContentDraftCardProps) {
  const [isPending, startTransition] = useTransition();

  const trigger = triggerBadge(draft.trigger_type);
  const status = statusBadge(draft.status);
  const isDraft = draft.status === 'draft';
  const isApproved = draft.status === 'approved';
  const isPublished = draft.status === 'published';

  function handleApprove() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draft.id);
      await approveDraft(fd);
    });
  }

  function handleReject() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draft.id);
      await rejectDraft(fd);
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draft.id);
      await archiveDraft(fd);
    });
  }

  function handlePublishDownload() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draft.id);
      fd.set('publish_target', 'download');
      const result = await publishDraft(fd);
      if (result.success && result.downloadPayload) {
        const html = atob(result.downloadPayload);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'content-draft.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
  }

  return (
    <div
      className={[
        'rounded-xl border border-white/5 bg-surface-dark p-5 transition',
        isPending ? 'opacity-60' : '',
      ].join(' ')}
      data-testid="content-draft-card"
    >
      {/* ── Header: badges ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${trigger.classes}`}
          data-testid="trigger-badge"
        >
          {trigger.label}
        </span>
        <span className="text-xs text-slate-600">{contentTypeLabel(draft.content_type)}</span>
        <span
          className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.classes}`}
          data-testid="status-badge"
        >
          {status.label}
        </span>
      </div>

      {/* ── Title ──────────────────────────────────────────────── */}
      <h3 className="text-sm font-semibold text-white leading-snug mb-1">
        <Link
          href={`/dashboard/content-drafts/${draft.id}`}
          className="hover:text-signal-green transition"
        >
          {draft.draft_title}
        </Link>
      </h3>

      {/* ── Content preview (3 lines) ──────────────────────────── */}
      <p className="text-xs text-slate-400 line-clamp-3 mb-3">
        {draft.draft_content}
      </p>

      {/* ── Footer: AEO score + date + actions ─────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {draft.aeo_score !== null && (
            <span className={`text-xs font-semibold tabular-nums ${aeoColor(draft.aeo_score)}`}>
              AEO {draft.aeo_score}
            </span>
          )}
          <span className="text-xs text-slate-600 tabular-nums">
            {new Date(draft.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isDraft && (
            <>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isPending}
                className="rounded-md bg-signal-green/10 px-3 py-1 text-xs font-semibold text-signal-green hover:bg-signal-green/20 transition disabled:opacity-50"
                data-testid="approve-btn"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isPending}
                className="rounded-md bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
                data-testid="reject-btn"
              >
                Reject
              </button>
            </>
          )}
          {isApproved && (
            <button
              type="button"
              onClick={handlePublishDownload}
              disabled={isPending}
              className="rounded-md bg-signal-green px-3 py-1 text-xs font-semibold text-deep-navy hover:bg-signal-green/90 transition disabled:opacity-50"
              data-testid="publish-btn"
            >
              {isPending ? 'Publishing...' : 'Publish'}
            </button>
          )}
          {!isPublished && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={isPending}
              className="rounded-md bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
              data-testid="archive-btn"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
