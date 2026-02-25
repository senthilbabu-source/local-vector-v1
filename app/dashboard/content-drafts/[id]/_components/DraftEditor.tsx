'use client';

import { useState, useTransition, useCallback } from 'react';
import { editDraft, approveDraft, rejectDraft, archiveDraft } from '../../actions';
import { scoreContentHeuristic } from '@/lib/autopilot/score-content';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftEditorProps {
  draftId: string;
  draftTitle: string;
  draftContent: string;
  targetPrompt: string | null;
  aeoScore: number | null;
  status: string;
  businessName: string;
  city: string | null;
  categories: string[] | null;
}

function aeoColor(score: number): string {
  if (score >= 80) return 'text-signal-green';
  if (score >= 60) return 'text-amber-400';
  return 'text-alert-crimson';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DraftEditor({
  draftId,
  draftTitle,
  draftContent,
  targetPrompt,
  aeoScore,
  status,
  businessName,
  city,
  categories,
}: DraftEditorProps) {
  const [title, setTitle] = useState(draftTitle);
  const [content, setContent] = useState(draftContent);
  const [liveAeo, setLiveAeo] = useState(aeoScore ?? 0);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isEditable = status === 'draft';

  // Debounced AEO score recalculation
  const recalcScore = useCallback(
    (newContent: string, newTitle: string) => {
      const score = scoreContentHeuristic(newContent, newTitle, {
        businessName,
        city,
        categories,
      });
      setLiveAeo(score);
    },
    [businessName, city, categories],
  );

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    recalcScore(e.target.value, title);
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    recalcScore(content, e.target.value);
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draftId);
      if (title !== draftTitle) fd.set('draft_title', title);
      if (content !== draftContent) fd.set('draft_content', content);
      const result = await editDraft(fd);
      if (result.success) {
        setMessage({ type: 'success', text: 'Draft saved' });
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    });
  }

  function handleApprove() {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draftId);
      const result = await approveDraft(fd);
      if (result.success) {
        setMessage({ type: 'success', text: 'Draft approved' });
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    });
  }

  function handleReject() {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draftId);
      const result = await rejectDraft(fd);
      if (result.success) {
        setMessage({ type: 'success', text: 'Draft returned to editable state' });
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    });
  }

  function handleArchive() {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draftId);
      const result = await archiveDraft(fd);
      if (result.success) {
        setMessage({ type: 'success', text: 'Draft archived' });
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    });
  }

  const hasChanges = title !== draftTitle || content !== draftContent;

  return (
    <div
      className={[
        'rounded-xl border border-white/5 bg-surface-dark p-5 space-y-4',
        isPending ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* AEO Score */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Live AEO Score</span>
        <span className={`text-sm font-bold tabular-nums ${aeoColor(liveAeo)}`}>
          {liveAeo}
        </span>
      </div>

      {/* Title */}
      {isEditable ? (
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-electric-indigo focus:outline-none"
          placeholder="Draft title"
          data-testid="draft-title-input"
        />
      ) : (
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      )}

      {/* Content */}
      {isEditable ? (
        <textarea
          value={content}
          onChange={handleContentChange}
          rows={16}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-electric-indigo focus:outline-none resize-y"
          placeholder="Draft content..."
          data-testid="draft-content-textarea"
        />
      ) : (
        <div className="rounded-md bg-white/5 px-3 py-3 text-sm text-slate-300 whitespace-pre-wrap">
          {content}
        </div>
      )}

      {/* Target prompt (read-only) */}
      {targetPrompt && (
        <div className="text-xs text-slate-500">
          <span className="font-medium">Target query:</span> &ldquo;{targetPrompt}&rdquo;
        </div>
      )}

      {/* Messages */}
      {message && (
        <div
          className={`rounded-md px-3 py-2 text-xs font-medium ${
            message.type === 'success'
              ? 'bg-signal-green/10 text-signal-green'
              : 'bg-alert-crimson/10 text-alert-crimson'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
        {isEditable && (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !hasChanges}
              className="rounded-md bg-electric-indigo/10 px-4 py-1.5 text-xs font-semibold text-electric-indigo hover:bg-electric-indigo/20 transition disabled:opacity-50"
              data-testid="save-btn"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="rounded-md bg-signal-green/10 px-4 py-1.5 text-xs font-semibold text-signal-green hover:bg-signal-green/20 transition disabled:opacity-50"
              data-testid="approve-btn"
            >
              Approve
            </button>
          </>
        )}
        {status === 'approved' && (
          <button
            type="button"
            onClick={handleReject}
            disabled={isPending}
            className="rounded-md bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
            data-testid="reject-btn"
          >
            Reject (Return to Draft)
          </button>
        )}
        {status !== 'published' && status !== 'archived' && (
          <button
            type="button"
            onClick={handleArchive}
            disabled={isPending}
            className="ml-auto rounded-md bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-500 hover:bg-white/10 transition disabled:opacity-50"
            data-testid="archive-btn"
          >
            Archive
          </button>
        )}
      </div>
    </div>
  );
}
