'use client';

// ---------------------------------------------------------------------------
// app/dashboard/playbooks/PlaybooksPageClient.tsx — Playbook UI (Sprint 134)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import type { Playbook } from '@/lib/playbooks/playbook-types';
import { ENGINE_DISPLAY_NAMES } from '@/lib/playbooks/engine-signal-library';
import Link from 'next/link';

interface PlaybooksPageClientProps {
  playbooks: Record<string, Playbook>;
  generatedAt: string | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  present: { label: 'Done', className: 'bg-emerald-500/20 text-emerald-400' },
  partial: { label: 'Partial', className: 'bg-amber-500/20 text-amber-400' },
  missing: { label: 'Missing', className: 'bg-red-500/20 text-red-400' },
};

const IMPACT_BADGE: Record<string, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-red-500/20 text-red-400' },
  medium: { label: 'Medium', className: 'bg-amber-500/20 text-amber-400' },
  low: { label: 'Low', className: 'bg-slate-500/20 text-slate-400' },
};

export default function PlaybooksPageClient({
  playbooks,
  generatedAt,
}: PlaybooksPageClientProps) {
  const engines = Object.keys(playbooks).filter((k) => k !== 'generated_at');
  const [activeEngine, setActiveEngine] = useState(engines[0] ?? '');

  const activePlaybook = playbooks[activeEngine] ?? null;

  if (engines.length === 0) {
    return (
      <div data-testid="playbooks-page" className="max-w-3xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Your AI Engine Playbook
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            What each AI engine needs to cite your business more often.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
          <p className="text-sm text-amber-400">
            Collecting data... Playbooks will be available after sufficient SOV
            data has been gathered (typically 8 weeks).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="playbooks-page" className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Your AI Engine Playbook
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          What each AI engine needs to cite your business more often.
          {generatedAt && (
            <span className="ml-2 text-slate-500">
              Last updated: {new Date(generatedAt).toLocaleDateString()}
            </span>
          )}
        </p>
      </div>

      {/* Engine tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        {engines.map((engine) => (
          <button
            key={engine}
            type="button"
            onClick={() => setActiveEngine(engine)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              activeEngine === engine
                ? 'bg-electric-indigo text-white'
                : 'text-slate-400 hover:text-white'
            }`}
            data-testid={`engine-tab-${engine}`}
          >
            {ENGINE_DISPLAY_NAMES[engine] ?? engine}
          </button>
        ))}
      </div>

      {/* Active playbook content */}
      {activePlaybook && (
        <div className="space-y-4">
          {activePlaybook.insufficientData ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
              <p className="text-sm text-amber-400">
                Collecting data for{' '}
                {activePlaybook.engineDisplayName}... Available once 20+ queries
                have been tracked.
              </p>
            </div>
          ) : (
            <>
              {/* Citation rate gauge */}
              <div className="rounded-2xl border border-white/5 bg-surface-dark p-5">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-slate-400">You: </span>
                    <span className="font-bold text-white">
                      {Math.round(activePlaybook.clientCitationRate * 100)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Top competitor: </span>
                    <span className="font-bold text-white">
                      {Math.round(activePlaybook.topCompetitorRate * 100)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Gap: </span>
                    <span className="font-bold text-red-400">
                      {activePlaybook.gapPercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Action cards */}
              <div className="space-y-3">
                {activePlaybook.actions.map((action) => (
                  <div
                    key={action.signalId}
                    className="rounded-2xl border border-white/5 bg-surface-dark p-4 space-y-2"
                    data-testid={`action-card-${action.signalId}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${IMPACT_BADGE[action.estimatedImpact].className}`}
                      >
                        {IMPACT_BADGE[action.estimatedImpact].label}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[action.status].className}`}
                      >
                        {STATUS_BADGE[action.status].label}
                      </span>
                      <span className="text-sm font-medium text-white">
                        {action.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {action.description}
                    </p>
                    <p className="text-xs text-slate-300">{action.fixGuide}</p>
                    {action.linkedLocalVectorFeature && (
                      <Link
                        href={action.linkedLocalVectorFeature}
                        className="inline-block text-xs text-electric-indigo hover:underline"
                      >
                        Fix this &rarr;
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Disclaimer */}
          <p className="text-[11px] text-slate-500 italic">
            Recommendations are based on observed citation patterns and may not
            reflect all factors influencing AI responses.
          </p>
        </div>
      )}
    </div>
  );
}
