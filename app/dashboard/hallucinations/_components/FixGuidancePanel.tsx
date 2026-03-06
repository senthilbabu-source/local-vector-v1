'use client';

// ---------------------------------------------------------------------------
// FixGuidancePanel — S14 (Wave 1, AI_RULES §214)
//
// Collapsible panel showing numbered fix steps and external platform links
// for a specific hallucination category. Rendered inside AlertCard for
// open and verifying alerts.
//
// Rules:
//   - Collapsed by default ("Show fix steps" chevron toggle)
//   - Platform links open in new tab with rel="noopener noreferrer"
//   - Hidden when category has no guidance or when status is resolved
//   - data-testid="fix-guidance-panel"
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Clock } from 'lucide-react';
import { getFixGuidance } from '@/lib/hallucinations/fix-guidance';

interface FixGuidancePanelProps {
  category: string | null | undefined;
  /** When true, panel starts expanded so fix steps are visible immediately */
  defaultOpen?: boolean;
}

export default function FixGuidancePanel({ category, defaultOpen = false }: FixGuidancePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const guidance = getFixGuidance(category);

  if (!guidance) return null;

  return (
    <div
      className="mt-3 rounded-md border border-white/8 bg-white/[0.02]"
      data-testid="fix-guidance-panel"
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        aria-expanded={open}
        data-testid="fix-guidance-toggle"
      >
        <span className="font-medium">Show fix steps</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>

      {/* Expandable content */}
      {open && (
        <div className="border-t border-white/8 px-3 pb-3 pt-2 space-y-3">
          {/* Title + time estimate */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-200">{guidance.title}</p>
            <span className="flex items-center gap-1 text-[10px] text-slate-500 whitespace-nowrap">
              <Clock className="h-3 w-3" aria-hidden="true" />
              ~{guidance.estimatedDays} days
            </span>
          </div>

          {/* Urgency note */}
          {guidance.urgencyNote && (
            <p className="rounded bg-alert-amber/10 border border-alert-amber/20 px-2 py-1 text-[11px] text-alert-amber">
              {guidance.urgencyNote}
            </p>
          )}

          {/* Numbered steps */}
          <ol className="space-y-1.5" data-testid="fix-guidance-steps">
            {guidance.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-electric-indigo/20 text-[9px] font-bold text-electric-indigo">
                  {i + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>

          {/* Platform links */}
          {guidance.platforms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {guidance.platforms.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:border-white/20 hover:text-white transition-colors"
                  data-testid="fix-guidance-platform-link"
                >
                  {platform.name}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
