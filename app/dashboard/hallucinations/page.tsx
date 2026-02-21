import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import StatusDropdown from './_components/StatusDropdown';
import type { CorrectionStatus } from '../actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

async function fetchHallucinations(): Promise<Hallucination[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from('ai_hallucinations')
    .select(
      'id, claim_text, severity, model_provider, correction_status, expected_truth, detected_at'
    )
    .order('detected_at', { ascending: false }) as {
      data: Hallucination[] | null;
      error: unknown;
    };

  if (error) {
    console.error('[hallucinations] fetch error:', error);
    return [];
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Severity badge helper
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<Hallucination['severity'], string> = {
  critical:
    'bg-red-100 text-red-700 ring-red-600/20',
  high:
    'bg-orange-100 text-orange-700 ring-orange-600/20',
  medium:
    'bg-yellow-100 text-yellow-700 ring-yellow-600/20',
  low:
    'bg-blue-100 text-blue-700 ring-blue-600/20',
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

// ---------------------------------------------------------------------------
// Model provider display name
// ---------------------------------------------------------------------------

const MODEL_LABELS: Record<string, string> = {
  'openai-gpt4o': 'OpenAI GPT-4o',
  'perplexity-sonar': 'Perplexity Sonar',
  'google-gemini': 'Google Gemini',
  'anthropic-claude': 'Anthropic Claude',
  'microsoft-copilot': 'Microsoft Copilot',
};

function modelLabel(provider: string): string {
  return MODEL_LABELS[provider] ?? provider;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HallucinationsPage() {
 const ctx = await getSafeAuthContext();
console.log("MY REAL ORG ID IS:", ctx.orgId);
  if (!ctx) {
    redirect('/login');
  }

  const hallucinations = await fetchHallucinations();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Hallucinations</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Inaccurate claims about your business detected across AI models. Update the
          status as you verify and correct each one.
        </p>
      </div>

      {/* Summary badges */}
      {hallucinations.length > 0 && (
        <div className="flex flex-wrap gap-3">
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

      {/* Table card */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5">
        {hallucinations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
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
            <p className="mt-3 text-sm font-medium text-slate-500">No hallucinations detected yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Once your first AI audit runs, detected inaccuracies will appear here.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-3 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Claim
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Severity
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Model
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Detected
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {hallucinations.map((h) => (
                <tr key={h.id} className="transition hover:bg-slate-50">
                  {/* Claim */}
                  <td className="py-3.5 pl-6 pr-3 align-top">
                    <p className="max-w-sm text-sm font-medium text-slate-900 leading-snug">
                      {h.claim_text}
                    </p>
                    {h.expected_truth && (
                      <p className="mt-1 max-w-sm text-xs text-slate-400 leading-snug">
                        <span className="font-medium text-slate-500">Truth:</span>{' '}
                        {h.expected_truth}
                      </p>
                    )}
                  </td>

                  {/* Severity */}
                  <td className="whitespace-nowrap px-3 py-3.5 align-top">
                    <SeverityBadge severity={h.severity} />
                  </td>

                  {/* Model */}
                  <td className="whitespace-nowrap px-3 py-3.5 align-top text-sm text-slate-600">
                    {modelLabel(h.model_provider)}
                  </td>

                  {/* Detected */}
                  <td className="whitespace-nowrap px-3 py-3.5 align-top text-sm text-slate-400">
                    {new Date(h.detected_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>

                  {/* Status dropdown */}
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
    </div>
  );
}
