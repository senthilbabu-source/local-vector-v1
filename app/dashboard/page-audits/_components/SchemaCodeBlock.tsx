'use client';

// ---------------------------------------------------------------------------
// SchemaCodeBlock — Sprint 70: JSON-LD code display with copy-to-clipboard
// ---------------------------------------------------------------------------

import { useState } from 'react';

interface Props {
  code: string;
}

export default function SchemaCodeBlock({ code }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative rounded-xl border border-white/5 bg-[#0d1117] overflow-hidden">
      {/* Copy button */}
      <div className="sticky top-0 flex justify-end p-2 bg-[#0d1117]/80 backdrop-blur-sm border-b border-white/5">
        <button
          onClick={handleCopy}
          className={[
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            copied
              ? 'bg-truth-emerald/15 text-truth-emerald'
              : 'bg-electric-indigo/10 text-electric-indigo hover:bg-electric-indigo/20',
          ].join(' ')}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code block */}
      <pre className="overflow-x-auto p-4 max-h-[400px] overflow-y-auto">
        <code className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{code}</code>
      </pre>
    </div>
  );
}
