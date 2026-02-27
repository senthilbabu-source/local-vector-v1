'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { HallucinationZone } from '@/lib/services/cluster-map.service';

// ---------------------------------------------------------------------------
// Severity badge colors — literal Tailwind (AI_RULES §12)
// ---------------------------------------------------------------------------

function severityBadge(severity: HallucinationZone['severity']) {
  if (severity === 'critical')
    return 'bg-alert-crimson/15 text-alert-crimson ring-alert-crimson/30';
  if (severity === 'high')
    return 'bg-alert-crimson/10 text-alert-crimson ring-alert-crimson/20';
  if (severity === 'medium')
    return 'bg-alert-amber/10 text-alert-amber ring-alert-amber/20';
  return 'bg-slate-500/10 text-slate-400 ring-slate-500/20';
}

function engineLabel(engine: string): string {
  if (engine === 'openai') return 'ChatGPT';
  if (engine === 'perplexity') return 'Perplexity';
  if (engine === 'google') return 'Gemini';
  if (engine === 'copilot') return 'Copilot';
  return engine;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface HallucinationAlertCardProps {
  zone: HallucinationZone;
}

export default function HallucinationAlertCard({ zone }: HallucinationAlertCardProps) {
  return (
    <div className="rounded-xl border-l-4 border-alert-crimson/30 bg-surface-dark px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-alert-crimson mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${severityBadge(zone.severity)}`}
            >
              {zone.severity.charAt(0).toUpperCase() + zone.severity.slice(1)}
            </span>
            <span className="text-xs text-slate-500">{engineLabel(zone.engine)}</span>
          </div>
          <p className="mt-1 text-sm text-white truncate">&ldquo;{zone.claimText}&rdquo;</p>
          <Link
            href="/dashboard/hallucinations"
            className="mt-1 inline-block text-xs text-electric-indigo hover:text-electric-indigo/80 transition"
          >
            View in Alerts →
          </Link>
        </div>
      </div>
    </div>
  );
}
