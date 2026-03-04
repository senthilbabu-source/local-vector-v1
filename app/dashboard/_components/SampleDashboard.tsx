'use client';

// ---------------------------------------------------------------------------
// SampleDashboard.tsx — Demo state for empty orgs (Sprint 117)
//
// Renders sample SOV data, citations, missed queries, and first mover alert.
// SampleDataBanner is shown above by the parent. All data from sample-data.ts.
// ---------------------------------------------------------------------------

import {
  SAMPLE_SOV_DATA,
  SAMPLE_CITATION_EXAMPLES,
  SAMPLE_MISSING_QUERIES,
  SAMPLE_CONTENT_DRAFT,
  SAMPLE_FIRST_MOVER_ALERT,
} from '@/lib/onboarding/sample-data';

export default function SampleDashboard() {
  return (
    <div data-testid="sample-dashboard" className="space-y-4">
      {/* SOV Score */}
      <div className="rounded-lg border border-white/10 bg-[#0A1628] p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          AI Mentions
        </p>
        <p data-testid="sample-sov-score" className="mt-1 text-5xl font-bold text-slate-100">
          {SAMPLE_SOV_DATA.share_of_voice}%
        </p>
        <p className="mt-1 text-sm text-green-400">
          {'\u2191'} +{SAMPLE_SOV_DATA.delta} points this week
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Based on {SAMPLE_SOV_DATA.total_queries} AI queries tracked
        </p>
      </div>

      {/* Citations */}
      <div data-testid="sample-citation-list" className="rounded-lg border border-white/10 bg-[#0A1628] p-5">
        <h3 className="mb-3 text-sm font-semibold text-indigo-400">
          {'\u2705'} Where AI recommended you
        </h3>
        <ul className="space-y-2">
          {SAMPLE_CITATION_EXAMPLES.map((c, i) => (
            <li key={i} className="text-sm text-slate-300">
              {'\u2022'} &ldquo;{c.query_text}&rdquo; — <span className="text-green-400">{c.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Missing Queries */}
      <div className="rounded-lg border border-white/10 bg-[#0A1628] p-5">
        <h3 className="mb-3 text-sm font-semibold text-indigo-400">
          {'\uD83D\uDCCD'} Where you&apos;re not yet recommended
        </h3>
        <ul className="space-y-2">
          {SAMPLE_MISSING_QUERIES.map((q, i) => (
            <li key={i} className="text-sm text-slate-300">
              {'\u2022'} &ldquo;{q.query_text}&rdquo; — <span className="text-amber-400">{q.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Content Draft Preview */}
      <div className="rounded-lg border border-white/10 bg-[#0A1628] p-5">
        <h3 className="mb-3 text-sm font-semibold text-indigo-400">
          {'\uD83D\uDCDD'} Content Recommendation
        </h3>
        <p className="text-sm font-medium text-slate-200">{SAMPLE_CONTENT_DRAFT.title}</p>
        <p className="mt-1 text-xs text-slate-500">
          Status: {SAMPLE_CONTENT_DRAFT.status} — Trigger: SOV gap
        </p>
      </div>

      {/* First Mover Alert */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
        <h3 className="mb-2 text-sm font-semibold text-amber-300">
          {'\uD83D\uDE80'} First Mover Opportunity
        </h3>
        <p className="text-sm text-slate-300">
          &ldquo;{SAMPLE_FIRST_MOVER_ALERT.query_text}&rdquo;
        </p>
        <p className="mt-1 text-xs text-slate-400">{SAMPLE_FIRST_MOVER_ALERT.message}</p>
      </div>
    </div>
  );
}
