import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { buildTruthAuditResult, type EngineScore } from '@/lib/services/truth-audit.service';
import type { EvaluationEngine } from '@/lib/schemas/evaluations';
import EvaluationCard, { type EngineEval } from './_components/EvaluationCard';
import TruthScoreCard from './_components/TruthScoreCard';
import EngineComparisonGrid from './_components/EngineComparisonGrid';
import StatusDropdown from './_components/StatusDropdown';
import type { CorrectionStatus } from '../actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LocationRow = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
};

type EvaluationRow = {
  id: string;
  location_id: string;
  engine: string;
  accuracy_score: number | null;
  hallucinations_detected: string[];
  created_at: string;
};

type Hallucination = {
  id: string;
  claim_text: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  model_provider: string;
  correction_status: CorrectionStatus;
  expected_truth: string | null;
  detected_at: string;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPageData(): Promise<{
  locations: LocationRow[];
  evaluations: EvaluationRow[];
  hallucinations: Hallucination[];
}> {
  const supabase = await createClient();

  const [locResult, evalResult, halluResult] = await Promise.all([
    supabase
      .from('locations')
      .select('id, business_name, city, state')
      .order('created_at', { ascending: true }),

    // Ordered newest-first so the first match per (location, engine) is the latest
    supabase
      .from('ai_evaluations')
      .select('id, location_id, engine, accuracy_score, hallucinations_detected, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    supabase
      .from('ai_hallucinations')
      .select('id, claim_text, severity, model_provider, correction_status, expected_truth, detected_at')
      .order('detected_at', { ascending: false }),
  ]);

  return {
    locations: (locResult.data as LocationRow[]) ?? [],
    evaluations: (evalResult.data as EvaluationRow[]) ?? [],
    hallucinations: (halluResult.data as Hallucination[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Severity badge helpers (Phase 4 hallucinations table)
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<Hallucination['severity'], string> = {
  critical: 'bg-alert-crimson/15 text-alert-crimson ring-alert-crimson/20',
  high:     'bg-orange-500/15 text-orange-400 ring-orange-500/20',
  medium:   'bg-alert-amber/15 text-alert-amber ring-alert-amber/20',
  low:      'bg-blue-500/15 text-blue-400 ring-blue-600/20',
};

function SeverityBadge({ severity }: { severity: Hallucination['severity'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}

const MODEL_LABELS: Record<string, string> = {
  'openai-gpt4o':       'OpenAI GPT-4o',
  'perplexity-sonar':   'Perplexity Sonar',
  'google-gemini':      'Google Gemini',
  'anthropic-claude':   'Anthropic Claude',
  'microsoft-copilot':  'Microsoft Copilot',
};

function modelLabel(provider: string): string {
  return MODEL_LABELS[provider] ?? provider;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HallucinationsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const { locations, evaluations, hallucinations } = await fetchPageData();

  // ── Compute Truth Score from latest evaluations ───────────────────────
  const hasClosedHallucinations = hallucinations.some(
    (h) => h.correction_status === 'fixed',
  );

  // Collect latest score per engine across all locations
  const latestByEngine = new Map<EvaluationEngine, number>();
  for (const e of evaluations) {
    const engine = e.engine as EvaluationEngine;
    if (e.accuracy_score !== null && !latestByEngine.has(engine)) {
      latestByEngine.set(engine, e.accuracy_score);
    }
  }
  const engineScoreArray: EngineScore[] = Array.from(latestByEngine.entries()).map(
    ([engine, accuracy_score]) => ({ engine, accuracy_score }),
  );
  const truthResult = buildTruthAuditResult(engineScoreArray, hasClosedHallucinations);

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white">AI Truth Audit</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          Multi-engine truth verification — see how accurately AI engines describe your
          business across OpenAI, Perplexity, Anthropic, and Gemini.
        </p>
      </div>

      {/* ── Truth Score + Engine Comparison ───────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TruthScoreCard
          score={truthResult.engines_reporting > 0 ? truthResult.truth_score : null}
          consensus={truthResult.consensus}
          enginesReporting={truthResult.engines_reporting}
        />
        <EngineComparisonGrid engineScores={truthResult.engine_scores} />
      </div>

      {/* ── AI Evaluation Audit Cards ────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">
          Live Accuracy Audits
        </h2>

        {locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-12 text-center border border-white/5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-10 w-10 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-[#94A3B8]">No locations yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Add a location first to start running AI accuracy audits.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => {
              const locationLabel = [location.business_name, location.city, location.state]
                .filter(Boolean)
                .join(', ');

              // Find the latest evaluation per engine for this location.
              // evaluations is already ordered newest-first, so the first
              // match per engine is always the most recent run.
              const openaiEval: EngineEval =
                (evaluations.find(
                  (e) => e.location_id === location.id && e.engine === 'openai'
                ) as EngineEval) ?? null;

              const perplexityEval: EngineEval =
                (evaluations.find(
                  (e) => e.location_id === location.id && e.engine === 'perplexity'
                ) as EngineEval) ?? null;

              const anthropicEval: EngineEval =
                (evaluations.find(
                  (e) => e.location_id === location.id && e.engine === 'anthropic'
                ) as EngineEval) ?? null;

              const geminiEval: EngineEval =
                (evaluations.find(
                  (e) => e.location_id === location.id && e.engine === 'gemini'
                ) as EngineEval) ?? null;

              return (
                <EvaluationCard
                  key={location.id}
                  locationId={location.id}
                  locationLabel={locationLabel}
                  openaiEval={openaiEval}
                  perplexityEval={perplexityEval}
                  anthropicEval={anthropicEval}
                  geminiEval={geminiEval}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Historical AI Hallucinations (Phase 4) ───────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">
          Flagged Hallucinations
        </h2>

        {/* Summary badges */}
        {hallucinations.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3">
            {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
              const count = hallucinations.filter((h) => h.severity === sev).length;
              if (count === 0) return null;
              return (
                <div
                  key={sev}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${SEVERITY_STYLES[sev]}`}
                >
                  <span className="capitalize">{sev}</span>
                  <span className="font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="overflow-hidden rounded-xl bg-surface-dark border border-white/5">
          {hallucinations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mx-auto h-10 w-10 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="mt-3 text-sm font-medium text-[#94A3B8]">
                No hallucinations flagged yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Run an AI audit above to start detecting inaccuracies.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-midnight-slate">
                <tr>
                  <th className="py-3 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                    Claim
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                    Severity
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                    Model
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                    Detected
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-surface-dark">
                {hallucinations.map((h) => (
                  <tr key={h.id} className="transition hover:bg-white/5">
                    <td className="py-3.5 pl-6 pr-3 align-top">
                      <p className="max-w-sm text-sm font-medium text-white leading-snug">
                        {h.claim_text}
                      </p>
                      {h.expected_truth && (
                        <p className="mt-1 max-w-sm text-xs text-slate-400 leading-snug">
                          <span className="font-medium text-[#94A3B8]">Truth:</span>{' '}
                          {h.expected_truth}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 align-top">
                      <SeverityBadge severity={h.severity} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 align-top text-sm text-[#94A3B8]">
                      {modelLabel(h.model_provider)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 align-top text-sm text-slate-400">
                      {new Date(h.detected_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 align-top">
                      <StatusDropdown
                        hallucinationId={h.id}
                        currentStatus={h.correction_status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

    </div>
  );
}
