'use client';

// ---------------------------------------------------------------------------
// ReviewResponseModal — Sprint 107: Review response approval modal
//
// Shows review text, editable draft, and approve/copy actions.
// Google: "Approve & Post to Google". Yelp: "Copy to Clipboard" + external link.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { X, Copy, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';

interface ReviewResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: {
    id: string;
    platform: string;
    reviewer_name: string;
    rating: number;
    text: string;
    response_draft: string | null;
    response_status: string;
    platform_url?: string | null;
  };
  onApprove: (reviewId: string, text: string) => Promise<void>;
  onRegenerate: (reviewId: string) => Promise<void>;
}

export default function ReviewResponseModal({
  isOpen,
  onClose,
  review,
  onApprove,
  onRegenerate,
}: ReviewResponseModalProps) {
  const [draftText, setDraftText] = useState(review.response_draft ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isNegative = review.rating <= 2;
  const isYelp = review.platform === 'yelp';
  const maxLength = isYelp ? 5000 : 4096;

  const handleApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onApprove(review.id, draftText);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      await onRegenerate(review.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_clipboardErr) {
      // Fallback — execCommand for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = draftText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stars = Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-slate-600'}>
      &#9733;
    </span>
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="review-response-modal">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-surface-dark p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white" data-testid="modal-title">
              Responding to {review.reviewer_name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm">{stars}</span>
              <span className="text-xs text-slate-400 capitalize">({review.platform})</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" data-testid="modal-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Original review */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-4 mb-4">
          <p className="text-xs text-slate-400 mb-1">Their review:</p>
          <p className="text-sm text-slate-200 italic" data-testid="modal-review-text">
            &ldquo;{review.text}&rdquo;
          </p>
        </div>

        {/* Warning for negative reviews */}
        {isNegative && (
          <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/20 px-4 py-2.5 mb-4" data-testid="negative-review-warning">
            <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
            <p className="text-xs text-orange-300">
              This is a critical review — review carefully before posting
            </p>
          </div>
        )}

        {/* Editable draft */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 mb-1 block">Your response draft:</label>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-slate-500 focus:border-signal-green/50 focus:outline-none resize-y min-h-[120px]"
            rows={5}
            data-testid="modal-draft-textarea"
          />
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
                data-testid="modal-regenerate"
              >
                <RefreshCw className={`h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Regenerating...' : 'Regenerate Draft'}
              </button>
            </div>
            <span className={`text-xs ${draftText.length > maxLength ? 'text-red-400' : 'text-slate-500'}`} data-testid="modal-char-count">
              {draftText.length} / {maxLength} chars
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 mb-3" data-testid="modal-error">{error}</div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-white hover:border-white/20 transition"
            data-testid="modal-cancel"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {isYelp ? (
              <>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg bg-signal-green/10 px-4 py-2 text-sm font-medium text-signal-green hover:bg-signal-green/20 transition"
                  data-testid="modal-copy-clipboard"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                {review.platform_url && (
                  <a
                    href={review.platform_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
                    data-testid="modal-open-yelp"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Yelp Business
                  </a>
                )}
              </>
            ) : (
              <button
                onClick={handleApprove}
                disabled={submitting || draftText.length > maxLength || draftText.length < 10}
                className="flex items-center gap-1.5 rounded-lg bg-signal-green px-4 py-2 text-sm font-semibold text-black hover:bg-signal-green/90 transition disabled:opacity-50"
                data-testid="modal-approve-post"
              >
                {submitting ? 'Posting...' : 'Approve & Post to Google'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
