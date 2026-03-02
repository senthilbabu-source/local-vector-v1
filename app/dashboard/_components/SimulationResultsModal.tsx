'use client';

// ---------------------------------------------------------------------------
// SimulationResultsModal — Sprint 110: Detailed simulation results view
//
// Shows ingestion test, query results, and gap analysis for a simulation run.
// ---------------------------------------------------------------------------

import { X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type {
  SimulationRun,
  IngestionResult,
  QuerySimulationResult,
  GapAnalysisResult,
  HallucinationRisk,
  ExtractedFact,
  ContentAddition,
} from '@/lib/sandbox/types';

function scoreColor(score: number): string {
  if (score >= 80) return 'text-signal-green';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function letterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function riskColor(risk: HallucinationRisk): string {
  if (risk === 'low') return 'text-signal-green';
  if (risk === 'medium') return 'text-amber-400';
  if (risk === 'high') return 'text-red-400';
  return 'text-red-500';
}

function qualityIcon(quality: string) {
  if (quality === 'complete') return <CheckCircle className="h-4 w-4 text-signal-green shrink-0" />;
  if (quality === 'partial') return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
  if (quality === 'wrong') return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
}

function factIcon(status: string) {
  if (status === 'exact') return <CheckCircle className="h-3.5 w-3.5 text-signal-green shrink-0" />;
  if (status === 'partial') return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  if (status === 'wrong') return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
}

interface SimulationResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  run: SimulationRun;
}

export default function SimulationResultsModal({ isOpen, onClose, run }: SimulationResultsModalProps) {
  if (!isOpen) return null;

  const ingestion = run.ingestion_result as IngestionResult | null;
  const queries = (run.query_results ?? []) as QuerySimulationResult[];
  const gaps = run.gap_analysis as GapAnalysisResult | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="simulation-results-modal">
      <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-xl border border-white/10 bg-surface-dark p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Simulation Results</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tested: {run.content_source} &middot;{' '}
              {new Date(run.run_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold ${scoreColor(run.simulation_score)}`} data-testid="modal-score">
              {run.simulation_score}/100
            </span>
            <span className={`text-sm font-bold ${scoreColor(run.simulation_score)}`}>
              Grade {letterGrade(run.simulation_score)}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition" data-testid="modal-close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left: Fact Extraction Test */}
          {ingestion && (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4" data-testid="ingestion-results">
              <h3 className="text-sm font-semibold text-white mb-1">
                1. Fact Extraction Test
              </h3>
              <p className={`text-sm font-semibold ${scoreColor(ingestion.accuracy_score)} mb-3`}>
                Accuracy: {ingestion.accuracy_score}/100
              </p>
              <div className="space-y-1.5">
                {ingestion.extracted_facts.map((fact: ExtractedFact) => (
                  <div key={fact.field} className="flex items-start gap-2">
                    {factIcon(fact.match_status)}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-slate-300 capitalize">{fact.field}: </span>
                      {fact.match_status === 'exact' && (
                        <span className="text-xs text-signal-green">{fact.extracted_value || fact.ground_truth_value}</span>
                      )}
                      {fact.match_status === 'partial' && (
                        <span className="text-xs text-amber-400">{fact.extracted_value}</span>
                      )}
                      {fact.match_status === 'wrong' && (
                        <span className="text-xs">
                          <span className="text-red-400">Got: {fact.extracted_value}</span>
                          <br />
                          <span className="text-slate-500">Expected: {fact.ground_truth_value}</span>
                        </span>
                      )}
                      {fact.match_status === 'missing' && (
                        <span className="text-xs text-slate-500">Not mentioned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {ingestion.critical_errors.length > 0 && (
                <div className="mt-3 rounded bg-red-500/10 border border-red-500/20 px-3 py-2">
                  <p className="text-xs text-red-300">
                    FIX: {ingestion.critical_errors[0].message}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Right: Query Response Test */}
          {queries.length > 0 && (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4" data-testid="query-results">
              <h3 className="text-sm font-semibold text-white mb-1">
                2. Query Response Test
              </h3>
              <p className={`text-sm font-semibold ${scoreColor(Math.round(run.query_coverage_rate * 100))} mb-3`}>
                Coverage: {Math.round(run.query_coverage_rate * 100)}%
                ({queries.filter(q => q.answer_quality === 'complete' || q.answer_quality === 'partial').length} of {queries.length} answered)
              </p>
              <div className="space-y-2">
                {queries.map(q => (
                  <div key={q.query_id} className="flex items-start gap-2">
                    {qualityIcon(q.answer_quality)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">
                        &quot;{q.query_text}&quot;
                      </p>
                      {q.answer_quality === 'no_answer' && (
                        <p className="text-xs text-red-400 mt-0.5">NO BASIS — content doesn&apos;t address this</p>
                      )}
                      {q.answer_quality === 'wrong' && (
                        <p className="text-xs text-red-400 mt-0.5">
                          WRONG — {q.facts_hallucinated.length > 0 ? q.facts_hallucinated[0] : 'contains incorrect facts'}
                        </p>
                      )}
                      {(q.answer_quality === 'complete' || q.answer_quality === 'partial') && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {q.simulated_answer.slice(0, 100)}{q.simulated_answer.length > 100 ? '...' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom: Gap Analysis (full-width) */}
        {gaps && (
          <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-4" data-testid="gap-analysis-results">
            <h3 className="text-sm font-semibold text-white mb-1">
              3. Content Gaps &amp; Risk
            </h3>
            <p className={`text-sm font-semibold ${riskColor(run.hallucination_risk)} mb-3`}>
              Hallucination Risk: {run.hallucination_risk.toUpperCase()}
              {' '}({gaps.queries_with_no_answer} of {gaps.total_queries_tested} queries have no basis)
            </p>

            {/* Recommended additions */}
            {gaps.recommended_additions && (gaps.recommended_additions as ContentAddition[]).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase">Priority Additions to Close Gaps:</p>
                {(gaps.recommended_additions as ContentAddition[]).map((addition, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-xs font-bold text-electric-indigo shrink-0">{addition.priority}.</span>
                    <div>
                      <p className="text-xs text-slate-200">{addition.suggestion}</p>
                      {addition.closes_queries.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Closes {addition.closes_queries.length} quer{addition.closes_queries.length === 1 ? 'y' : 'ies'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-white/5">
          <span className="text-xs text-slate-500">
            Tokens: {run.input_tokens_used + run.output_tokens_used} | Model: {run.claude_model}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
