'use client';

import { useState } from 'react';
import { trackLinkInjection } from '../actions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LinkInjectionModalProps {
  menuId: string;
  publicSlug: string;
  onClose: () => void;
  /** Called after a successful link_injected event is recorded. */
  onInjected: () => void;
}

// ---------------------------------------------------------------------------
// LinkInjectionModal
// ---------------------------------------------------------------------------

export default function LinkInjectionModal({
  menuId,
  publicSlug,
  onClose,
  onInjected,
}: LinkInjectionModalProps) {
  const [copied, setCopied] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Relative path displayed; full URL used when copying (client-side only).
  const relativePath = `/m/${publicSlug}`;

  async function handleCopy() {
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${relativePath}`
        : relativePath;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select the text if clipboard API is blocked
      setCopied(false);
    }
  }

  async function handleTrack() {
    setError(null);
    setIsTracking(true);
    try {
      const result = await trackLinkInjection(menuId);
      if (result.success) {
        setTracked(true);
        onInjected();
      } else {
        setError(result.error);
      }
    } finally {
      setIsTracking(false);
    }
  }

  return (
    /* ── Backdrop ───────────────────────────────────────────────── */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* ── Modal ─────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal
        aria-label="Distribute to AI Engines"
        className="relative w-full max-w-md rounded-2xl bg-surface-dark border border-white/10 p-6 shadow-2xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Distribute to AI Engines
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Paste your menu URL everywhere AI looks — Google, Yelp, your website.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition"
          >
            ✕
          </button>
        </div>

        {/* URL row */}
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Your AI-readable menu URL</p>
          <div className="flex items-center gap-2 rounded-xl bg-midnight-slate border border-white/10 px-3 py-2">
            <span className="flex-1 text-xs font-mono text-slate-300 truncate">
              {relativePath}
            </span>
            <button
              onClick={handleCopy}
              className={[
                'shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                copied
                  ? 'bg-truth-emerald/15 text-truth-emerald'
                  : 'bg-electric-indigo/10 text-electric-indigo hover:bg-electric-indigo/20',
              ].join(' ')}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-xl bg-electric-indigo/8 border border-electric-indigo/15 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-electric-indigo">Where to paste this URL</p>
          <ul className="space-y-1 text-xs text-slate-400">
            <li className="flex items-start gap-1.5">
              <span className="text-electric-indigo shrink-0 mt-0.5">→</span>
              Google Business Profile — "Website" field
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-electric-indigo shrink-0 mt-0.5">→</span>
              Yelp business page — "Website" field
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-electric-indigo shrink-0 mt-0.5">→</span>
              Your own website footer or menu page
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          {/* Open GBP */}
          <a
            href="https://business.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
          >
            Open Google Business Profile
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                clipRule="evenodd"
              />
            </svg>
          </a>

          {/* Track injection CTA */}
          {tracked ? (
            <div className="flex items-center justify-center gap-2 w-full rounded-xl bg-truth-emerald/15 border border-truth-emerald/20 px-4 py-2.5">
              <span className="text-sm font-semibold text-truth-emerald">
                ✓ Link injection recorded
              </span>
            </div>
          ) : (
            <button
              onClick={handleTrack}
              disabled={isTracking}
              className={[
                'w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                isTracking
                  ? 'bg-electric-indigo/40 text-white/50 cursor-not-allowed'
                  : 'bg-electric-indigo text-white hover:bg-electric-indigo/90',
              ].join(' ')}
            >
              {isTracking ? 'Recording…' : 'I pasted this link into Google'}
            </button>
          )}

          {error && (
            <p className="text-xs text-alert-crimson text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
