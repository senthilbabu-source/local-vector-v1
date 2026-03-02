'use client';

// ---------------------------------------------------------------------------
// SandboxPanel — Sprint 110: AI Answer Simulation Sandbox dashboard panel
//
// Interactive panel where users paste/select content and run simulations.
// Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { FlaskConical, Play, Loader2, ChevronRight } from 'lucide-react';
import SimulationResultsModal from './SimulationResultsModal';
import type {
  SimulationRun,
  SimulationHistoryEntry,
  SimulationMode,
  ContentSource,
  HallucinationRisk,
} from '@/lib/sandbox/types';

interface StatusResponse {
  latest_run: SimulationRun | null;
  history: SimulationHistoryEntry[];
  rate_limit: { runs_today: number; remaining: number; max: number };
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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

function riskLabel(risk: HallucinationRisk): string {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

interface SandboxPanelProps {
  isGrowthPlan: boolean;
}

export default function SandboxPanel({ isGrowthPlan }: SandboxPanelProps) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [contentText, setContentText] = useState('');
  const [contentSource, setContentSource] = useState<ContentSource>('freeform');
  const [selectedModes, setSelectedModes] = useState<SimulationMode[]>(['ingestion', 'query', 'gap_analysis']);
  const [showResults, setShowResults] = useState(false);
  const [lastRun, setLastRun] = useState<SimulationRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sandbox/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('[SandboxPanel] fetch status failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isGrowthPlan) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [isGrowthPlan, fetchStatus]);

  const handleRunSimulation = async () => {
    if (!contentText.trim()) return;
    setRunning(true);
    setError(null);

    try {
      const res = await fetch('/api/sandbox/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_text: contentText,
          content_source: contentSource,
          modes: selectedModes,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.message || json.error || 'Simulation failed');
        return;
      }

      setLastRun(json.run);
      setShowResults(true);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  const toggleMode = (mode: SimulationMode) => {
    setSelectedModes(prev =>
      prev.includes(mode)
        ? prev.filter(m => m !== mode)
        : [...prev, mode],
    );
  };

  if (!isGrowthPlan) return null;

  if (loading) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark p-5 animate-pulse"
        data-testid="sandbox-panel-skeleton"
      >
        <div className="h-5 w-48 bg-white/10 rounded mb-4" />
        <div className="h-32 bg-white/5 rounded-lg" />
      </div>
    );
  }

  const latestRun = data?.latest_run;
  const history = data?.history ?? [];
  const rateLimit = data?.rate_limit ?? { runs_today: 0, remaining: 20, max: 20 };

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark p-5" data-testid="sandbox-panel">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-electric-indigo" />
          <h2 className="text-base font-semibold text-white">AI Answer Sandbox</h2>
          {latestRun && (
            <span className="text-sm text-slate-400">
              Last run: {formatRelativeTime(latestRun.run_at)}
            </span>
          )}
        </div>
        {latestRun && (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${scoreColor(latestRun.simulation_score)}`} data-testid="sandbox-score">
              Score: {latestRun.simulation_score}/100
            </span>
            <span className={`text-xs font-bold ${scoreColor(latestRun.simulation_score)}`}>
              {letterGrade(latestRun.simulation_score)}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 mb-4">
        Test your content before publishing — see exactly how an AI would read and answer
        questions about your business. Uses Claude as the simulation engine.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: Input */}
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Test Your Content</p>

          {/* Source selector */}
          <div className="flex gap-2 mb-3">
            {(['freeform', 'draft', 'llms_txt'] as ContentSource[]).map(source => (
              <button
                key={source}
                onClick={() => setContentSource(source)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  contentSource === source
                    ? 'bg-electric-indigo/20 text-electric-indigo border border-electric-indigo/30'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                }`}
                data-testid={`sandbox-source-${source}`}
              >
                {source === 'freeform' ? 'Paste text' : source === 'draft' ? 'My latest draft' : 'My llms.txt'}
              </button>
            ))}
          </div>

          {/* Content textarea */}
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Paste your content here to test how AI would read and answer questions about your business..."
            className="w-full h-32 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-electric-indigo/50 focus:outline-none resize-none"
            data-testid="sandbox-content-input"
          />

          {/* Mode toggles */}
          <div className="flex items-center gap-3 mt-3 mb-3">
            <span className="text-xs text-slate-400">Modes:</span>
            {([
              { key: 'ingestion' as SimulationMode, label: 'Facts' },
              { key: 'query' as SimulationMode, label: 'Queries' },
              { key: 'gap_analysis' as SimulationMode, label: 'Gaps' },
            ]).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedModes.includes(key)}
                  onChange={() => toggleMode(key)}
                  className="rounded border-white/20 bg-white/5 text-electric-indigo focus:ring-electric-indigo/30"
                  data-testid={`sandbox-mode-${key}`}
                />
                <span className="text-xs text-slate-300">{label}</span>
              </label>
            ))}
          </div>

          {/* Run button */}
          <button
            onClick={handleRunSimulation}
            disabled={running || !contentText.trim() || selectedModes.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-signal-green/10 px-4 py-2 text-sm font-medium text-signal-green hover:bg-signal-green/20 transition disabled:opacity-50"
            data-testid="sandbox-run-button"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Simulating (~15 sec)...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Simulation
              </>
            )}
          </button>

          {/* Rate limit */}
          <p className="text-xs text-slate-500 mt-2">
            Runs today: {rateLimit.runs_today} / {rateLimit.max}
          </p>

          {error && (
            <p className="text-xs text-red-400 mt-2" data-testid="sandbox-error">{error}</p>
          )}
        </div>

        {/* Right: Last run results */}
        <div>
          {latestRun ? (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Last Run Results ({formatRelativeTime(latestRun.run_at)})
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                  <span className="text-sm text-slate-300">Ingestion Accuracy</span>
                  <span className={`text-sm font-semibold ${scoreColor(latestRun.ingestion_accuracy)}`}>
                    {latestRun.ingestion_accuracy}/100
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                  <span className="text-sm text-slate-300">Query Coverage</span>
                  <span className={`text-sm font-semibold ${scoreColor(Math.round(latestRun.query_coverage_rate * 100))}`}>
                    {Math.round(latestRun.query_coverage_rate * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                  <span className="text-sm text-slate-300">Hallucination Risk</span>
                  <span className={`text-sm font-semibold ${riskColor(latestRun.hallucination_risk)}`}>
                    {riskLabel(latestRun.hallucination_risk)}
                  </span>
                </div>
              </div>

              {/* Query summary */}
              {latestRun.gap_analysis && (
                <div className="mt-3 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                  <p className="text-xs text-slate-400">
                    {(latestRun.gap_analysis as { queries_with_complete_answer?: number }).queries_with_complete_answer ?? 0} of{' '}
                    {(latestRun.gap_analysis as { total_queries_tested?: number }).total_queries_tested ?? 0} queries got complete answers
                  </p>
                  {(latestRun.gap_analysis as { highest_risk_queries?: string[] }).highest_risk_queries?.[0] && (
                    <p className="text-xs text-red-400 mt-1">
                      Highest risk: &quot;{(latestRun.gap_analysis as { highest_risk_queries: string[] }).highest_risk_queries[0]}&quot;
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => { setLastRun(latestRun); setShowResults(true); }}
                className="flex items-center gap-1 mt-3 text-xs text-electric-indigo hover:text-electric-indigo/80 transition"
                data-testid="sandbox-view-results"
              >
                View Full Results <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-500">No simulation results yet. Run your first test!</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4" data-testid="sandbox-history">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Simulation History (last {history.length} runs)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left py-1 pr-4">Date</th>
                  <th className="text-left py-1 pr-4">Source</th>
                  <th className="text-left py-1 pr-4">Score</th>
                  <th className="text-left py-1 pr-4">Risk</th>
                  <th className="text-left py-1">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {history.map(entry => (
                  <tr key={entry.id} className="border-t border-white/5">
                    <td className="py-1.5 pr-4 text-slate-400">
                      {new Date(entry.run_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-300 capitalize">{entry.content_source}</td>
                    <td className={`py-1.5 pr-4 font-semibold ${scoreColor(entry.simulation_score)}`}>
                      {entry.simulation_score}/100
                    </td>
                    <td className={`py-1.5 pr-4 ${riskColor(entry.hallucination_risk)}`}>
                      {riskLabel(entry.hallucination_risk)}
                    </td>
                    <td className="py-1.5 text-slate-300">
                      {Math.round(entry.query_coverage_rate * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results modal */}
      {showResults && lastRun && (
        <SimulationResultsModal
          isOpen
          onClose={() => setShowResults(false)}
          run={lastRun}
        />
      )}
    </div>
  );
}
