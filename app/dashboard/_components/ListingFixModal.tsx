'use client';

// ---------------------------------------------------------------------------
// ListingFixModal — Sprint 105: Shows guided fix instructions for platforms
// without write APIs (Yelp, Apple Maps, Bing).
// ---------------------------------------------------------------------------

import { X } from 'lucide-react';

interface ListingFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: string;
  instructions: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Business Profile',
  yelp: 'Yelp',
  apple_maps: 'Apple Maps',
  bing: 'Bing Places',
};

export default function ListingFixModal({
  isOpen,
  onClose,
  platform,
  instructions,
}: ListingFixModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      data-testid="listing-fix-modal"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-white/10 bg-surface-dark p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Fix Instructions — {PLATFORM_LABELS[platform] ?? platform}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            data-testid="listing-fix-modal-close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Instructions */}
        <div className="rounded-lg bg-midnight-slate p-4">
          <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono leading-relaxed">
            {instructions}
          </pre>
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-signal-green/15 px-4 py-2 text-sm font-medium text-signal-green hover:bg-signal-green/25 transition"
            data-testid="listing-fix-modal-done"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
