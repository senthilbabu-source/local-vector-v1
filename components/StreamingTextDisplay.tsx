'use client';

// ---------------------------------------------------------------------------
// components/StreamingTextDisplay.tsx — Sprint 120
//
// Animated text display for streaming AI responses.
// Shows blinking cursor during streaming, placeholder when idle.
// ---------------------------------------------------------------------------

import type { StreamingStatus } from '@/lib/streaming/types';

interface StreamingTextDisplayProps {
  text: string;
  status: StreamingStatus;
  className?: string;
  placeholder?: string;
}

export default function StreamingTextDisplay({
  text,
  status,
  className = '',
  placeholder = 'Click Generate to preview AI content...',
}: StreamingTextDisplayProps) {
  if (status === 'idle' && !text) {
    return (
      <div
        className={`text-sm text-slate-400 ${className}`}
        data-testid="streaming-text-display"
      >
        <span data-testid="streaming-placeholder">{placeholder}</span>
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div
        className={`text-sm text-slate-400 ${className}`}
        data-testid="streaming-text-display"
      >
        <span className="inline-flex items-center gap-1">
          Generating
          <span className="animate-pulse">...</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`text-sm text-slate-200 whitespace-pre-wrap font-mono ${className}`}
      data-testid="streaming-text-display"
    >
      {text}
      {status === 'streaming' && (
        <span
          data-testid="streaming-cursor"
          className="inline-block w-[2px] h-[1em] bg-electric-indigo ml-0.5 align-text-bottom"
          style={{
            animation: 'blink 0.7s step-end infinite',
          }}
        />
      )}
      {status === 'error' && text && (
        <span className="text-alert-crimson ml-1">(Error)</span>
      )}
      {status === 'cancelled' && (
        <span className="text-slate-400 ml-1">(Cancelled)</span>
      )}
    </div>
  );
}
