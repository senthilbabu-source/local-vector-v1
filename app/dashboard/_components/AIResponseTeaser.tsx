// ---------------------------------------------------------------------------
// AIResponseTeaser.tsx — S30 (§233)
//
// Shows a 1-line AI response snippet on the main dashboard.
// Links to /dashboard/ai-responses. Hidden when no response or sample mode.
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { Quote, AlertTriangle } from 'lucide-react';
import type { AIResponseSnippet } from '@/lib/services/ai-response-summary';
import { isResponseStale } from '@/lib/services/ai-response-summary';

interface AIResponseTeaserProps {
  response: AIResponseSnippet | null;
  sampleMode?: boolean;
}

function formatTimeAgo(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function AIResponseTeaser({ response, sampleMode }: AIResponseTeaserProps) {
  if (!response || sampleMode) return null;

  const stale = isResponseStale(response.timestamp);

  return (
    <Link
      href="/dashboard/ai-responses"
      className="group block rounded-xl border border-white/5 bg-surface-dark px-4 py-3 transition hover:border-white/10"
      data-testid="ai-response-teaser"
    >
      <div className="flex items-start gap-3">
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-electric-indigo" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-200 group-hover:text-white transition">
            {response.snippet}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium">
              {response.engine}
            </span>
            <span>{formatTimeAgo(response.timestamp)}</span>
            {stale && (
              <span className="flex items-center gap-1 text-amber-400" data-testid="stale-warning">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Stale
              </span>
            )}
            <span className="ml-auto text-electric-indigo opacity-0 group-hover:opacity-100 transition">
              See all →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
