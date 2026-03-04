'use client';

// ---------------------------------------------------------------------------
// ModelBreakdownPanel — "Which AI mentions you?" panel (Sprint 123)
//
// Shows per-model citation grid for a given target query.
// Collapsed by default (disclosure pattern), expands on click.
// Only renders when sov_model_results data exists for the query.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import ModelCitationBadge from './ModelCitationBadge';
import type { SOVModelId } from '@/lib/config/sov-models';

interface ModelResult {
  model_provider: SOVModelId;
  display_name: string;
  cited: boolean;
  citation_count: number;
  confidence: 'high' | 'medium' | 'low';
  ai_response_excerpt: string | null;
}

interface BreakdownResponse {
  query_id: string;
  query_text: string;
  week_of: string | null;
  models: ModelResult[];
  summary: {
    cited_by_count: number;
    total_models_run: number;
    all_models_agree: boolean;
  };
}

interface Props {
  queryId: string;
  queryText: string;
  orgName: string;
  weekOf?: string;
}

export default function ModelBreakdownPanel({ queryId, queryText, orgName, weekOf }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<BreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (weekOf) params.set('week_of', weekOf);
      const url = `/api/sov/model-breakdown/${queryId}${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      setData(json);
    } catch (_err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [queryId, weekOf]);

  // Fetch on first open
  useEffect(() => {
    if (isOpen && !data && !loading) {
      fetchData();
    }
  }, [isOpen, data, loading, fetchData]);

  // Don't render anything if collapsed and no data yet (no placeholder)
  const hasModels = data && data.models.length > 0;

  return (
    <div data-testid="model-breakdown-panel">
      {/* Disclosure toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-medium text-electric-indigo transition hover:text-electric-indigo/80"
        data-testid="model-breakdown-toggle"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        Which AI mentions you?
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="mt-2 rounded-lg border border-white/5 bg-surface-dark p-3">
          {/* Loading */}
          {loading && (
            <div className="space-y-2">
              <div className="h-8 animate-pulse rounded bg-white/5" />
              <div className="h-8 animate-pulse rounded bg-white/5" />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-[#94A3B8]">
              Unable to load model breakdown.
            </p>
          )}

          {/* No data */}
          {!loading && !error && !hasModels && (
            <p className="text-xs text-[#94A3B8]">
              Run a scan to see per-model results.
            </p>
          )}

          {/* Data */}
          {!loading && !error && hasModels && data && (
            <>
              <div className="space-y-1.5">
                {data.models.map((model) => (
                  <div key={model.model_provider}>
                    <ModelCitationBadge
                      model_provider={model.model_provider}
                      display_name={model.display_name}
                      cited={model.cited}
                      citation_count={model.citation_count}
                      confidence={model.confidence as 'high' | 'medium' | 'low'}
                    />
                    {/* View AI Response toggle */}
                    {model.ai_response_excerpt && (
                      <div className="ml-5 mt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedModel(
                              expandedModel === model.model_provider
                                ? null
                                : model.model_provider,
                            )
                          }
                          className="text-[10px] font-medium text-slate-400 hover:text-slate-400 transition"
                          data-testid={`model-response-toggle-${model.model_provider}`}
                        >
                          {expandedModel === model.model_provider
                            ? 'Hide AI Response'
                            : 'View AI Response'}
                        </button>
                        {expandedModel === model.model_provider && (
                          <p
                            className="mt-1 max-h-32 overflow-y-auto rounded bg-white/[0.02] px-2 py-1.5 text-[11px] leading-relaxed text-slate-400"
                            data-testid={`model-response-text-${model.model_provider}`}
                          >
                            {model.ai_response_excerpt}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <p
                className="mt-3 border-t border-white/5 pt-2 text-xs text-[#94A3B8]"
                data-testid="model-breakdown-summary"
              >
                {data.summary.cited_by_count} of {data.summary.total_models_run} AI
                model{data.summary.total_models_run !== 1 ? 's' : ''} mention{' '}
                <span className="font-medium text-white">{orgName}</span> for this
                query.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
