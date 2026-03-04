// ---------------------------------------------------------------------------
// app/dashboard/agent-readiness/page.tsx — Sprint J: Jargon Retirement
//
// Redesigned from technical checklist to customer-interaction scenarios.
// Answers: "Can AI take action for your customers?"
//
// AI_RULES §102: No jargon — "JSON-LD", "schema", "agentic", etc.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchAgentReadiness } from '@/lib/data/agent-readiness';
import { Bot, Zap } from 'lucide-react';
import { FirstVisitTooltip } from '@/components/ui/FirstVisitTooltip';
import { AgentReadinessVerdictPanel } from './_components/AgentReadinessVerdictPanel';
import { AgentReadinessScenarioCard } from './_components/AgentReadinessScenarioCard';
import { AgentSEOTab } from './_components/AgentSEOTab';
import { SCENARIO_DESCRIPTIONS, type CapabilityId } from '@/lib/agent-readiness/scenario-descriptions';
import type { ActionAuditResult } from '@/lib/agent-seo/agent-seo-types';

export const metadata = { title: 'AI Actions | LocalVector.ai' };

// ── Page Component ────────────────────────────────────────────────────────

export default async function AgentReadinessPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');
  if (!ctx.orgId) redirect('/login');

  const supabase = await createClient();

  // Note: agent_seo_cache and agent_seo_audited_at added in migration 20260303000004
  // Type cast needed until database.types.ts is regenerated
  const { data: location } = await supabase
    .from('locations')
    .select('id, agent_seo_cache, agent_seo_audited_at')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle() as { data: { id: string; agent_seo_cache: unknown; agent_seo_audited_at: string | null } | null };

  if (!location) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Can AI Book or Order for You?
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

  // Split capabilities into groups
  const gaps = result.capabilities.filter((c) => c.status !== 'active');
  const ready = result.capabilities.filter((c) => c.status === 'active');

  return (
    <div className="space-y-5">
      {/* Sprint E: First-visit tooltip — PRESERVED */}
      <FirstVisitTooltip
        pageKey="agent-readiness"
        title="What is Agent Readiness?"
        content="This page shows which customer interactions AI assistants can handle for your business — answering questions about hours, showing your menu, booking reservations, and placing orders. The more interactions AI can handle, the more customers you convert."
      />

      {/* ── Header (Sprint J: jargon-free) ────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Bot className="h-5 w-5 text-signal-green" />
          Can AI Book or Order for You?
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Which customer questions AI assistants can answer or actions they can take for your business.
        </p>
      </div>

      {/* ── Verdict Panel (Sprint J) ──────────────────────────── */}
      <AgentReadinessVerdictPanel result={result} />

      {/* ── Top Priority (kept from original, with scenario text) */}
      {result.topPriority && (
        <TopPriorityCard capability={result.topPriority} />
      )}

      {/* ── Gaps to Fix (failing capabilities first) ─────────── */}
      {gaps.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-400 mb-3">
            Gaps to Fix ({gaps.length})
          </h2>
          <div className="space-y-2">
            {gaps.map((cap) => (
              <AgentReadinessScenarioCard key={cap.id} capability={cap} />
            ))}
          </div>
        </div>
      )}

      {/* ── Ready (active capabilities) ──────────────────────── */}
      {ready.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-green-400 mb-3">
            Ready ({ready.length})
          </h2>
          <div className="space-y-2">
            {ready.map((cap) => (
              <AgentReadinessScenarioCard key={cap.id} capability={cap} />
            ))}
          </div>
        </div>
      )}

      {/* ── Sprint 126: Agent-SEO Action Readiness ─────────── */}
      <div className="border-t border-white/5 pt-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Can AI Take Actions on Your Website?
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Whether AI agents can book reservations, place orders, or schedule appointments through your website.
        </p>
        <AgentSEOTab
          result={location.agent_seo_cache as ActionAuditResult | null}
          auditedAt={location.agent_seo_audited_at}
        />
      </div>
    </div>
  );
}

// ── Top Priority Card (Sprint J: scenario-based) ─────────────────────────

function TopPriorityCard({ capability }: { capability: import('@/lib/services/agent-readiness.service').AgentCapability }) {
  const scenario = SCENARIO_DESCRIPTIONS[capability.id as CapabilityId];

  return (
    <div
      className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-5 py-4"
      data-testid="top-priority-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-amber-400" />
        <p className="text-sm font-semibold text-white">
          Biggest Opportunity
        </p>
        <span className="text-xs text-amber-400 font-medium">
          ({capability.maxPoints} pts)
        </span>
      </div>
      <p className="text-sm text-white font-medium">
        {scenario?.scenario ?? capability.name}
      </p>
      <p className="text-sm text-slate-400 mt-1">
        {scenario
          ? capability.status === 'partial'
            ? scenario.whenPartial
            : scenario.whenMissing
          : capability.statusDetail}
      </p>
      {capability.fixGuide && (
        <p className="text-xs text-slate-400 mt-2">{capability.fixGuide}</p>
      )}
      {capability.schemaAction && (
        <button
          className="mt-3 rounded-lg bg-electric-indigo px-4 py-2 text-xs font-semibold text-white hover:bg-electric-indigo/90 transition"
          data-testid={`generate-${capability.schemaAction}`}
        >
          Fix this &rarr;
        </button>
      )}
    </div>
  );
}
