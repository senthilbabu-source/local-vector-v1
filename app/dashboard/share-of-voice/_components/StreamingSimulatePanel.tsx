'use client';

// ---------------------------------------------------------------------------
// StreamingSimulatePanel.tsx — Sprint 120
//
// SOV query simulation panel — shows what AI would say if asked this query.
// Collapsed by default, expands when "Simulate AI Response" is clicked.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useStreamingResponse } from '@/hooks/useStreamingResponse';
import StreamingTextDisplay from '@/components/StreamingTextDisplay';

interface StreamingSimulatePanelProps {
  queryText: string;
  locationCity?: string;
  orgName?: string;
}

export default function StreamingSimulatePanel({
  queryText,
  locationCity,
  orgName,
}: StreamingSimulatePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { state, start, cancel, reset } = useStreamingResponse(
    '/api/sov/simulate-stream',
  );

  function handleSimulate() {
    setIsOpen(true);
    start({
      query_text: queryText,
      location_city: locationCity,
      org_name: orgName,
    });
  }

  function handleClose() {
    reset();
    setIsOpen(false);
  }

  // Check if org was mentioned in the completed response
  const isMentioned =
    state.status === 'complete' &&
    orgName &&
    state.text.toLowerCase().includes(orgName.toLowerCase());
  const isNotMentioned =
    state.status === 'complete' && orgName && !isMentioned;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleSimulate}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-electric-indigo transition"
        data-testid="simulate-query-btn"
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
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
        Simulate AI Response
      </button>
    );
  }

  return (
    <div
      className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3"
      data-testid="streaming-simulate-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-400">
          AI Response Simulation
        </h4>
        <button
          type="button"
          onClick={handleClose}
          className="rounded p-0.5 text-slate-500 hover:bg-white/5 hover:text-slate-400 transition"
          aria-label="Close simulation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-xs text-slate-500">
        What would AI say if asked this query?
      </p>

      {/* Streaming content */}
      <StreamingTextDisplay
        text={state.text}
        status={state.status}
        className="min-h-[60px] max-h-[200px] overflow-y-auto rounded-md bg-white/5 p-2.5"
        placeholder="Click Simulate to see what AI would say..."
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
            className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-white/10 transition"
            data-testid="stop-simulate-btn"
          >
            Stop
          </button>
        )}
        {(state.status === 'complete' || state.status === 'cancelled' || state.status === 'error') && (
          <button
            type="button"
            onClick={handleSimulate}
            className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-white/10 transition"
            data-testid="simulate-query-btn"
          >
            Re-simulate
          </button>
        )}
      </div>

      {/* Org mention indicator */}
      {isMentioned && (
        <div
          className="flex items-center gap-1.5 rounded-md bg-signal-green/10 px-2.5 py-1.5 text-xs font-medium text-signal-green"
          data-testid="org-mentioned-indicator"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          {orgName} was mentioned
        </div>
      )}
      {isNotMentioned && (
        <div
          className="flex items-center gap-1.5 rounded-md bg-alert-crimson/10 px-2.5 py-1.5 text-xs font-medium text-alert-crimson"
          data-testid="org-not-mentioned-indicator"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          {orgName} was not mentioned
        </div>
      )}
    </div>
  );
}
