'use client';

import { useState, useCallback } from 'react';
import { Share2, Copy, Check, X } from 'lucide-react';
import type { SnapshotData } from '@/lib/services/snapshot-builder';
import { buildSnapshotText, isSnapshotMeaningful } from '@/lib/services/snapshot-builder';

// ---------------------------------------------------------------------------
// S44: ShareSnapshotModal — copy-to-clipboard shareable AI summary
// ---------------------------------------------------------------------------

interface ShareSnapshotModalProps {
  snapshot: SnapshotData | null;
  sampleMode: boolean;
}

export default function ShareSnapshotModal({ snapshot, sampleMode }: ShareSnapshotModalProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!snapshot) return;
    const text = buildSnapshotText(snapshot);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = buildSnapshotText(snapshot);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [snapshot]);

  if (sampleMode || !snapshot || !isSnapshotMeaningful(snapshot)) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
        data-testid="share-report-button"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
        Share Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
          data-testid="share-snapshot-modal"
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-[#0F1629] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Share AI Report</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Snapshot card preview */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3" data-testid="snapshot-card">
              <p className="text-sm font-semibold text-white">{snapshot.businessName}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-bold text-white">
                    {snapshot.score !== null ? snapshot.score : '—'}
                  </p>
                  <p className="text-xs text-slate-400">AI Health Score</p>
                </div>
                {snapshot.sovPercent !== null && (
                  <div>
                    <p className="text-2xl font-bold text-white">{Math.round(snapshot.sovPercent)}%</p>
                    <p className="text-xs text-slate-400">AI Mentions</p>
                  </div>
                )}
                {snapshot.errorsFixed > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">{snapshot.errorsFixed}</p>
                    <p className="text-xs text-slate-400">Errors Fixed</p>
                  </div>
                )}
                {snapshot.revenueRecovered > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">
                      ${Math.round(snapshot.revenueRecovered).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">Revenue Recovered</p>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-500 pt-2 border-t border-white/5">
                Powered by LocalVector.ai
              </p>
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              data-testid="copy-snapshot-button"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy as text
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
