'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink, Copy, Check } from 'lucide-react';
import { getBotInfo } from '@/lib/bot-activity/bot-knowledge';

// ---------------------------------------------------------------------------
// BotFixInstructions — Sprint I
//
// Expandable section showing how to unblock an AI crawler.
// Shows: what the bot is, why it matters, exact robots.txt edit, official docs.
// ---------------------------------------------------------------------------

interface BotFixInstructionsProps {
  botType: string;
}

export function BotFixInstructions({ botType }: BotFixInstructionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const info = getBotInfo(botType);

  if (!info) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(info!.robotsTxtAllow);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — ignore
    }
  }

  return (
    <div data-testid={`bot-fix-${botType}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-electric-indigo hover:text-electric-indigo/80 transition mt-1"
        data-testid={`bot-fix-toggle-${botType}`}
      >
        <span>How to fix</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div
          className="mt-3 rounded-lg border border-white/5 bg-midnight-slate p-4 space-y-3"
          data-testid={`bot-fix-content-${botType}`}
        >
          {/* What is this bot? */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              What is {info.displayName}?
            </p>
            <p className="text-xs text-slate-300">
              {info.displayName} is the web crawler for{' '}
              <span className="font-semibold text-white">{info.owner}</span>.{' '}
              {info.whyItMatters}
            </p>
          </div>

          {/* How to fix */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Add to your robots.txt
            </p>
            <div className="relative">
              <pre className="rounded-md bg-black/30 border border-white/5 px-3 py-2 text-xs text-signal-green font-mono overflow-x-auto">
                {info.robotsTxtAllow}
              </pre>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-1.5 right-1.5 rounded p-1 text-slate-500 hover:text-white hover:bg-white/10 transition"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-signal-green" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
              Add this to your website&apos;s{' '}
              <code className="text-slate-400">robots.txt</code> file (usually at{' '}
              <code className="text-slate-400">yoursite.com/robots.txt</code>).
              This should allow {info.displayName} to crawl your site.
            </p>
          </div>

          {/* Official docs */}
          {info.officialDocs && (
            <a
              href={info.officialDocs}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-electric-indigo hover:text-electric-indigo/80 transition"
            >
              Official documentation
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
