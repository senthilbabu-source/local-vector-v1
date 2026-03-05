'use client';

// ---------------------------------------------------------------------------
// CopyDraftButton — §205 Content Drafts Copy
//
// Copies the full draft content to clipboard. Available on all plans.
// Placed in the detail page header next to publish actions.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyDraftButtonProps {
  content: string;
}

export default function CopyDraftButton({ content }: CopyDraftButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-white/20 hover:text-white transition"
      data-testid="copy-draft-detail-btn"
      aria-label="Copy draft content to clipboard"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-signal-green" aria-hidden="true" />
          <span className="text-signal-green">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          Copy
        </>
      )}
    </button>
  );
}
