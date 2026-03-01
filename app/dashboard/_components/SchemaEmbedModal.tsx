'use client';

// ---------------------------------------------------------------------------
// SchemaEmbedModal — Sprint 106: Full-screen embed code viewer
//
// Shows the complete JSON-LD snippet with copy-to-clipboard functionality.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';

interface SchemaEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippet: string;
  pageType: string;
  publicUrl: string;
}

export default function SchemaEmbedModal({
  isOpen,
  onClose,
  snippet,
  pageType,
  publicUrl,
}: SchemaEmbedModalProps) {
  const [copied, setCopied] = useState<'snippet' | 'url' | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (text: string, type: 'snippet' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (_e) {
      // Fallback for older browsers
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="schema-embed-modal"
    >
      <div
        className="relative mx-4 max-w-2xl w-full rounded-xl bg-surface-dark border border-white/10 p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
          data-testid="schema-embed-modal-close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-1">
          Embed This Schema on Your {pageType}
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Paste this code snippet inside your page&apos;s {'<head>'} tag:
        </p>

        {/* Snippet code block */}
        <div className="relative rounded-lg bg-black/40 border border-white/5 p-4 mb-4">
          <pre
            className="text-xs leading-relaxed text-slate-300 overflow-x-auto whitespace-pre-wrap"
            data-testid="schema-embed-code"
          >
            {snippet}
          </pre>
          <button
            onClick={() => handleCopy(snippet, 'snippet')}
            className="absolute top-2 right-2 flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/20 transition"
            data-testid="schema-embed-copy"
          >
            {copied === 'snippet' ? (
              <><Check className="h-3 w-3 text-signal-green" /> Copied!</>
            ) : (
              <><Copy className="h-3 w-3" /> Copy to Clipboard</>
            )}
          </button>
        </div>

        {/* Public URL */}
        {publicUrl && (
          <div className="mb-4">
            <p className="text-sm text-slate-400 mb-2">
              Or link this file directly in your {'<head>'}:
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-black/20 border border-white/5 px-3 py-2">
              <code className="text-xs text-signal-green flex-1 break-all">
                {publicUrl}
              </code>
              <button
                onClick={() => handleCopy(publicUrl, 'url')}
                className="shrink-0 flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/20"
                data-testid="schema-embed-copy-url"
              >
                {copied === 'url' ? (
                  <><Check className="h-3 w-3 text-signal-green" /> Copied!</>
                ) : (
                  <><Copy className="h-3 w-3" /> Copy URL</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Validation links */}
        <div className="border-t border-white/5 pt-3">
          <p className="text-xs text-slate-500 mb-2">After embedding, verify at:</p>
          <div className="flex gap-3">
            <a
              href="https://search.google.com/test/rich-results"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-signal-green hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Google Rich Results Test
            </a>
            <a
              href="https://validator.schema.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-signal-green hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Schema.org Validator
            </a>
          </div>
        </div>

        {/* Done button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
            data-testid="schema-embed-modal-done"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
