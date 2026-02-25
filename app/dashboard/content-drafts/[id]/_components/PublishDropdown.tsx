'use client';

import { useState, useTransition } from 'react';
import { publishDraft } from '../../actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublishDropdownProps {
  draftId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PublishDropdown({ draftId }: PublishDropdownProps) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleTargetSelect(target: string) {
    setSelectedTarget(target);
    setShowDisclaimer(true);
  }

  function handleCancel() {
    setShowDisclaimer(false);
    setSelectedTarget(null);
  }

  function handleConfirmPublish() {
    if (!selectedTarget) return;
    setMessage(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.set('draft_id', draftId);
      fd.set('publish_target', selectedTarget);
      const result = await publishDraft(fd);

      if (result.success) {
        if (result.downloadPayload) {
          // Trigger download
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
        setMessage({ type: 'success', text: 'Draft published successfully' });
      } else {
        setMessage({ type: 'error', text: result.error });
      }

      setShowDisclaimer(false);
      setSelectedTarget(null);
    });
  }

  return (
    <div className="space-y-2">
      {/* Publish target buttons */}
      <button
        type="button"
        onClick={() => handleTargetSelect('download')}
        disabled={isPending}
        className="w-full rounded-md bg-signal-green/10 px-4 py-2 text-xs font-semibold text-signal-green hover:bg-signal-green/20 transition disabled:opacity-50"
        data-testid="publish-download-btn"
      >
        Download HTML
      </button>
      <button
        type="button"
        onClick={() => handleTargetSelect('gbp_post')}
        disabled={isPending}
        className="w-full rounded-md bg-white/5 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
        data-testid="publish-gbp-btn"
      >
        Publish to GBP
      </button>
      <button
        type="button"
        onClick={() => handleTargetSelect('wordpress')}
        disabled={isPending}
        className="w-full rounded-md bg-white/5 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
        data-testid="publish-wp-btn"
      >
        Publish to WordPress
      </button>

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

      {/* Factual Disclaimer Modal */}
      {showDisclaimer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={handleCancel}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface-dark p-6 shadow-xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white mb-3">
              Publish AI-Generated Content
            </h3>
            <div className="rounded-md bg-alert-amber/10 px-3 py-2 text-xs text-alert-amber mb-4">
              You are publishing AI-generated content. Please verify all facts
              (prices, hours, amenities) before publishing.
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={isPending}
                className="rounded-md bg-signal-green px-4 py-1.5 text-xs font-semibold text-deep-navy hover:bg-signal-green/90 transition disabled:opacity-50"
                data-testid="confirm-publish-btn"
              >
                {isPending ? 'Publishing...' : 'Confirm Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
