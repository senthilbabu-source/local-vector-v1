// ---------------------------------------------------------------------------
// app/dashboard/agent-readiness/page.tsx — AI Agent Readiness Score
//
// Sprint 84: Server Component. Score ring + top priority + capability
// checklist showing whether AI agents can transact with the business.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchAgentReadiness } from '@/lib/data/agent-readiness';
import type {
  AgentCapability,
  AgentReadinessResult,
  CapabilityStatus,
} from '@/lib/services/agent-readiness.service';
import { Bot, Zap, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

// ── Color helpers (literal Tailwind — AI_RULES §12) ───────────────────────

function ringStroke(score: number): string {
  if (score >= 70) return 'stroke-signal-green';
  if (score >= 40) return 'stroke-amber-400';
  return 'stroke-alert-crimson';
}

function scoreTextColor(score: number): string {
  if (score >= 70) return 'text-signal-green';
  if (score >= 40) return 'text-amber-400';
  return 'text-alert-crimson';
}

function levelBadgeClasses(score: number): string {
  if (score >= 70) return 'bg-green-400/15 text-green-400';
  if (score >= 40) return 'bg-amber-400/15 text-amber-400';
  return 'bg-red-400/15 text-red-400';
}

function statusIcon(status: CapabilityStatus) {
  if (status === 'active') return <CheckCircle2 className="h-5 w-5 text-green-400" />;
  if (status === 'partial') return <AlertTriangle className="h-5 w-5 text-amber-400" />;
  return <XCircle className="h-5 w-5 text-red-400" />;
}

function pointsColor(status: CapabilityStatus): string {
  if (status === 'active') return 'text-green-400';
  if (status === 'partial') return 'text-amber-400';
  return 'text-red-400';
}

// ── Page Component ────────────────────────────────────────────────────────

export default async function AgentReadinessPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');
  if (!ctx.orgId) redirect('/login');

  const supabase = await createClient();

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          AI Agent Readiness
        </h1>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            No primary location found. Complete onboarding to get started.
          </p>
        </div>
      </div>
    );
  }

  const result = await fetchAgentReadiness(supabase, ctx.orgId, location.id);

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Bot className="h-5 w-5 text-signal-green" />
          AI Agent Readiness
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Can AI agents transact with your business?
        </p>
      </div>

      {/* ── Score Ring ──────────────────────────────────────── */}
      <AgentScoreRing result={result} />

      {/* ── Top Priority ───────────────────────────────────── */}
      {result.topPriority && (
        <TopPriorityCard capability={result.topPriority} />
      )}

      {/* ── Capability Checklist ───────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">
          Capability Checklist
        </h2>
        <div className="space-y-2">
          {result.capabilities.map((cap) => (
            <CapabilityRow key={cap.id} capability={cap} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Score Ring ─────────────────────────────────────────────────────────────

function AgentScoreRing({ result }: { result: AgentReadinessResult }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (result.score / 100) * circ;

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-4">
      <div className="flex items-center gap-6">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="8"
              className="stroke-white/5"
            />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              className={ringStroke(result.score)}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="relative text-center">
            <span
              className={`text-3xl font-bold tabular-nums leading-none ${scoreTextColor(result.score)}`}
              data-testid="agent-readiness-score"
            >
              {result.score}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${levelBadgeClasses(result.score)}`}
              data-testid="agent-readiness-level"
            >
              {result.levelLabel}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1.5">{result.summary}</p>
        </div>
      </div>
    </div>
  );
}

// ── Top Priority Card ─────────────────────────────────────────────────────

function TopPriorityCard({ capability }: { capability: AgentCapability }) {
  return (
    <div
      className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-5 py-4"
      data-testid="top-priority-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-amber-400" />
        <p className="text-sm font-semibold text-white">
          Top Priority: {capability.name}
        </p>
        <span className="text-xs text-amber-400 font-medium">
          ({capability.maxPoints} pts)
        </span>
      </div>
      <p className="text-sm text-slate-400">{capability.statusDetail}</p>
      {capability.fixGuide && (
        <p className="text-xs text-slate-500 mt-2">{capability.fixGuide}</p>
      )}
      {capability.schemaAction && (
        <button
          className="mt-3 rounded-lg bg-electric-indigo px-4 py-2 text-xs font-semibold text-white hover:bg-electric-indigo/90 transition"
          data-testid={`generate-${capability.schemaAction}`}
        >
          Generate {capability.name} &rarr;
        </button>
      )}
    </div>
  );
}

// ── Capability Row ────────────────────────────────────────────────────────

function CapabilityRow({ capability }: { capability: AgentCapability }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {statusIcon(capability.status)}
          <div>
            <p className="text-sm font-semibold text-white">
              {capability.name}
            </p>
            <p className="text-xs text-slate-500">{capability.statusDetail}</p>
          </div>
        </div>
        <span
          className={`text-xs font-bold tabular-nums ${pointsColor(capability.status)}`}
        >
          {capability.earnedPoints}/{capability.maxPoints} pts
        </span>
      </div>

      {/* Fix guide for non-active capabilities */}
      {capability.status !== 'active' && capability.fixGuide && (
        <div className="mt-3 ml-8 border-t border-white/5 pt-3">
          <p className="text-xs text-slate-500">{capability.fixGuide}</p>
          {capability.schemaAction && (
            <button
              className="mt-2 inline-flex items-center text-xs font-semibold text-electric-indigo hover:text-electric-indigo/80 transition-colors"
              data-testid={`generate-${capability.schemaAction}`}
            >
              Generate Schema &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
