'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { approveDraft, rejectDraft, archiveDraft, publishDraft } from '../actions';
import type { PublishActionResult } from '../actions';
import { DraftSourceTag } from './DraftSourceTag';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentDraftRow {
  id: string;
  trigger_type: string;
  trigger_id: string | null;
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
  /** Occasion name for occasion-triggered drafts (Sprint O L3) */
  occasionName?: string | null;
}

type PublishTarget = 'download' | 'wordpress' | 'gbp_post';

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
      return { label: 'Occasion Engine', classes: 'bg-violet-400/10 text-violet-400 ring-violet-400/20' };
    case 'prompt_missing':
      return { label: 'Prompt Gap', classes: 'bg-purple-400/10 text-purple-400 ring-purple-400/20' };
    default:
      return { label: 'Manual', classes: 'bg-slate-400/10 text-slate-400 ring-slate-400/20' };
  }
}

function statusBadge(status: string): { label: string; classes: string; testId?: string } {
  switch (status) {
    case 'approved':
      return { label: 'Approved', classes: 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/20' };
    case 'published':
      return { label: 'Published', classes: 'bg-blue-400/10 text-blue-400 ring-blue-400/20', testId: 'draft-status-published' };
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

function targetLabel(target: PublishTarget): string {
  switch (target) {
    case 'wordpress':
      return 'WordPress';
    case 'gbp_post':
      return 'Google Business Profile';
    case 'download':
      return 'Download';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContentDraftCard({ draft, occasionName }: ContentDraftCardProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<PublishTarget | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishActionResult | null>(null);

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

  function handlePublishClick(target: PublishTarget) {
    if (target === 'download') {
      handlePublishDownload();
      return;
    }
    // External publish targets require confirmation
    setConfirmTarget(target);
    setPublishResult(null);
  }

  function handleConfirmPublish() {
    if (!confirmTarget || isPublishing) return;
    setIsPublishing(true);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draft.id);
      fd.set('publish_target', confirmTarget);
      const result = await publishDraft(fd);
      setPublishResult(result);
      setIsPublishing(false);
      if (result.success) {
        setConfirmTarget(null);
      }
    });
  }

  function handleCancelPublish() {
    setConfirmTarget(null);
    setPublishResult(null);
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
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${trigger.classes}`}
          data-testid={draft.trigger_type === 'occasion' ? 'draft-origin-tag' : 'trigger-badge'}
        >
          {draft.trigger_type === 'occasion' && <CalendarDays className="h-2.5 w-2.5" aria-hidden="true" />}
          {trigger.label}
        </span>
        <span className="text-xs text-slate-600">{contentTypeLabel(draft.content_type)}</span>
        <span
          className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.classes}`}
          data-testid={status.testId ?? 'status-badge'}
        >
          {status.label}
        </span>
      </div>

      {/* ── Occasion source tag (Sprint O L3) ──────────────────── */}
      {draft.trigger_type === 'occasion' && occasionName && (
        <div className="mb-2">
          <DraftSourceTag sourceOccasion={occasionName} />
        </div>
      )}

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

      {/* ── Success banner ─────────────────────────────────────── */}
      {publishResult?.success && (
        <div
          className="mb-3 rounded-lg bg-signal-green/10 border border-signal-green/20 px-3 py-2 text-xs text-signal-green"
          data-testid="publish-success-banner"
        >
          Published successfully.
          {publishResult.publishedUrl && (
            <>
              {' '}
              <a
                href={publishResult.publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                View post
              </a>
            </>
          )}
        </div>
      )}

      {/* ── Error banner ───────────────────────────────────────── */}
      {publishResult && !publishResult.success && (
        <div
          className="mb-3 rounded-lg bg-alert-crimson/10 border border-alert-crimson/20 px-3 py-2 text-xs text-alert-crimson"
          data-testid="publish-error-banner"
        >
          {publishResult.error}
        </div>
      )}

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
            <>
              {/* WordPress publish — shown for non-GBP content types */}
              {draft.content_type !== 'gbp_post' && (
                <button
                  type="button"
                  onClick={() => handlePublishClick('wordpress')}
                  disabled={isPending}
                  className="rounded-md bg-signal-green px-3 py-1 text-xs font-semibold text-deep-navy hover:bg-signal-green/90 transition disabled:opacity-50"
                  data-testid="publish-btn-wordpress"
                >
                  {isPending ? 'Publishing...' : 'WordPress'}
                </button>
              )}
              {/* GBP Post publish — shown for gbp_post content type */}
              {draft.content_type === 'gbp_post' && (
                <button
                  type="button"
                  onClick={() => handlePublishClick('gbp_post')}
                  disabled={isPending}
                  className="rounded-md bg-signal-green px-3 py-1 text-xs font-semibold text-deep-navy hover:bg-signal-green/90 transition disabled:opacity-50"
                  data-testid="publish-btn-gbp"
                >
                  {isPending ? 'Publishing...' : 'GBP Post'}
                </button>
              )}
              {/* Download — always available */}
              <button
                type="button"
                onClick={handlePublishDownload}
                disabled={isPending}
                className="rounded-md bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
                data-testid="publish-btn"
              >
                Download
              </button>
            </>
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

      {/* ── Publish Confirmation Dialog ────────────────────────── */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          data-testid="publish-confirm-dialog"
        >
          <div className="bg-surface-dark border border-white/10 rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-2">
              Publish to {targetLabel(confirmTarget)}
            </h3>
            <p className="text-xs text-slate-400 mb-1">
              {draft.draft_title}
            </p>
            <p className="text-xs text-slate-500 mb-4">
              This will publish the draft externally. This action cannot be undone.
            </p>

            {/* Error inside dialog */}
            {publishResult && !publishResult.success && (
              <div
                className="mb-4 rounded-lg bg-alert-crimson/10 border border-alert-crimson/20 px-3 py-2 text-xs text-alert-crimson"
                data-testid="publish-error-banner"
              >
                {publishResult.error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={isPublishing}
                className="rounded-md bg-signal-green px-4 py-1.5 text-xs font-semibold text-deep-navy hover:bg-signal-green/90 transition disabled:opacity-50"
                data-testid="publish-confirm-btn"
              >
                {isPublishing ? 'Publishing...' : 'Confirm Publish'}
              </button>
              <button
                type="button"
                onClick={handleCancelPublish}
                disabled={isPublishing}
                className="rounded-md bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
                data-testid="publish-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
