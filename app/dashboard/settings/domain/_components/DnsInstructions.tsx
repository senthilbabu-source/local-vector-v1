'use client';

/**
 * DnsInstructions — Sprint 114
 *
 * Renders CNAME + TXT record blocks with copy buttons.
 * Pure display component — no state, no API calls.
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface DnsInstructionsProps {
  cnameValue: string;
  txtValue: string;
  customDomain: string;
}

function CopyButton({ value, testId }: { value: string; testId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      // Clipboard API not available — silently ignore
    }
  }

  return (
    <button
      data-testid={testId}
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition hover:text-white"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-truth-emerald" />
          <span className="text-truth-emerald">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export default function DnsInstructions({
  cnameValue,
  txtValue,
  customDomain,
}: DnsInstructionsProps) {
  return (
    <div data-testid="dns-instructions" className="space-y-4">
      <h4 className="text-sm font-semibold text-white">DNS Setup Instructions</h4>

      <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside">
        <li>Log in to your DNS provider (e.g. Cloudflare, GoDaddy, Namecheap).</li>
        <li>Add a <strong className="text-slate-300">CNAME</strong> record (see below).</li>
        <li>Add a <strong className="text-slate-300">TXT</strong> record for verification (see below).</li>
        <li>Click &ldquo;Verify Now&rdquo; (DNS propagation may take up to 48 hours).</li>
      </ol>

      {/* CNAME record */}
      <div className="rounded-lg border border-white/5 bg-deep-navy/50 p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">CNAME Record</span>
          <CopyButton value={cnameValue} testId="copy-cname-btn" />
        </div>
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-slate-500">Name:</span>{' '}
            <span className="text-slate-300">{customDomain}</span>
          </div>
          <div>
            <span className="text-slate-500">Value:</span>{' '}
            <code data-testid="cname-record-value" className="text-electric-indigo">{cnameValue}</code>
          </div>
        </div>
      </div>

      {/* TXT record */}
      <div className="rounded-lg border border-white/5 bg-deep-navy/50 p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">TXT Record</span>
          <CopyButton value={txtValue} testId="copy-txt-btn" />
        </div>
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-slate-500">Name:</span>{' '}
            <span className="text-slate-300">{customDomain}</span>
          </div>
          <div className="break-all">
            <span className="text-slate-500">Value:</span>{' '}
            <code data-testid="txt-record-value" className="text-electric-indigo">{txtValue}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
