'use client';

// ---------------------------------------------------------------------------
// StreamingPreviewPanel.tsx — Sprint 120
//
// Inline content preview panel that streams AI-generated content.
// Placed below the target prompt in the draft editor.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useStreamingResponse } from '@/hooks/useStreamingResponse';
import StreamingTextDisplay from '@/components/StreamingTextDisplay';

interface StreamingPreviewPanelProps {
  targetPrompt: string;
  draftTitle?: string;
  contentType?: string;
  onAccept?: (content: string) => void;
}

export default function StreamingPreviewPanel({
  targetPrompt,
  draftTitle,
  contentType,
  onAccept,
}: StreamingPreviewPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { state, start, cancel, reset } = useStreamingResponse(
    '/api/content/preview-stream',
  );

  function handleGenerate() {
    setIsOpen(true);
    start({
      target_prompt: targetPrompt,
      draft_title: draftTitle,
      content_type: contentType || 'blog_post',
      max_words: 300,
    });
  }

  function handleRegenerate() {
    start({
      target_prompt: targetPrompt,
      draft_title: draftTitle,
      content_type: contentType || 'blog_post',
      max_words: 300,
    });
  }

  function handleClose() {
    reset();
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!targetPrompt}
        className="inline-flex items-center gap-1.5 rounded-md bg-electric-indigo/10 px-3 py-1.5 text-xs font-semibold text-electric-indigo hover:bg-electric-indigo/20 transition disabled:opacity-50"
        data-testid="generate-preview-btn"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
          />
        </svg>
        Preview with AI
      </button>
    );
  }

  return (
    <div
      className="rounded-lg border border-electric-indigo/20 bg-electric-indigo/5 p-4 space-y-3"
      data-testid="streaming-preview-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-electric-indigo">
          AI Content Preview
        </h3>
        <button
          type="button"
          onClick={handleClose}
          className="rounded p-0.5 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition"
          aria-label="Close preview"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Streaming content */}
      <StreamingTextDisplay
        text={state.text}
        status={state.status}
        className="min-h-[100px] max-h-[300px] overflow-y-auto rounded-md bg-white/5 p-3"
        placeholder="Click Generate to preview AI content..."
      />

      {/* Error message */}
      {state.status === 'error' && state.error && (
        <p className="text-xs text-alert-crimson">{state.error}</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {state.status === 'streaming' && (
          <button
            type="button"
            onClick={cancel}
            className="rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10 transition"
            data-testid="stop-generation-btn"
          >
            Stop Generation
          </button>
        )}
        {(state.status === 'complete' || state.status === 'cancelled') && (
          <>
            <button
              type="button"
              onClick={handleRegenerate}
              className="rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10 transition"
              data-testid="regenerate-btn"
            >
              Regenerate
            </button>
            {onAccept && state.text && (
              <button
                type="button"
                onClick={() => onAccept(state.text)}
                className="rounded-md bg-signal-green/10 px-3 py-1.5 text-xs font-semibold text-signal-green hover:bg-signal-green/20 transition"
                data-testid="use-content-btn"
              >
                Use This Content
              </button>
            )}
          </>
        )}
        {state.status === 'error' && (
          <button
            type="button"
            onClick={handleRegenerate}
            className="rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10 transition"
            data-testid="regenerate-btn"
          >
            Try Again
          </button>
        )}
      </div>

      {/* Token count */}
      {state.status === 'complete' && state.total_tokens != null && (
        <p className="text-xs text-slate-600">~{state.total_tokens} tokens</p>
      )}
    </div>
  );
}
