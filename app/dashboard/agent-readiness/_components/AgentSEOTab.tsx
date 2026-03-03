// ---------------------------------------------------------------------------
// app/dashboard/agent-readiness/_components/AgentSEOTab.tsx
//
// Sprint 126: Agent-SEO Action Readiness tab — reads cached audit results.
// AI_RULES §165: Jargon-free. Never show "ReserveAction", "JSON-LD" in UI.
// ---------------------------------------------------------------------------

import { CheckCircle, AlertTriangle, XCircle, MinusCircle, Zap } from 'lucide-react';
import type { ActionAuditResult, ActionCapability, AuditStatus } from '@/lib/agent-seo/agent-seo-types';

// ---------------------------------------------------------------------------
// Status styles
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<AuditStatus, typeof CheckCircle> = {
  pass: CheckCircle,
  partial: AlertTriangle,
  fail: XCircle,
  skipped: MinusCircle,
};

const STATUS_COLOR: Record<AuditStatus, string> = {
  pass: 'text-truth-emerald',
  partial: 'text-alert-amber',
  fail: 'text-alert-crimson',
  skipped: 'text-slate-500',
};

const LEVEL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  agent_action_ready: { bg: 'bg-truth-emerald/10', text: 'text-truth-emerald', label: 'Action Ready' },
  partially_actionable: { bg: 'bg-alert-amber/10', text: 'text-alert-amber', label: 'Partially Actionable' },
  not_actionable: { bg: 'bg-alert-crimson/10', text: 'text-alert-crimson', label: 'Not Actionable' },
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

interface AgentSEOTabProps {
  result: ActionAuditResult | null;
  auditedAt: string | null;
}

export function AgentSEOTab({ result, auditedAt }: AgentSEOTabProps) {
  // No audit yet
  if (!result) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center"
        data-testid="agent-seo-no-audit"
      >
        <AlertTriangle className="mx-auto h-8 w-8 text-alert-amber" />
        <p className="mt-3 text-sm text-slate-400">
          Action readiness audit has not run yet. Results will appear after the next weekly scan.
        </p>
        {auditedAt === null && (
          <p className="mt-1 text-xs text-slate-500">
            Audits run every Monday at 8 AM UTC.
          </p>
        )}
      </div>
    );
  }

  const levelStyle = LEVEL_STYLES[result.level] ?? LEVEL_STYLES.not_actionable;
  const gaps = result.capabilities.filter(c => c.status !== 'pass');
  const ready = result.capabilities.filter(c => c.status === 'pass');

  return (
    <div className="space-y-5" data-testid="agent-seo-tab">
      {/* Score verdict */}
      <div className={`rounded-xl border border-white/5 ${levelStyle.bg} px-5 py-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Action Readiness Score</p>
            <p className={`text-3xl font-bold tabular-nums ${levelStyle.text}`}>
              {result.score}<span className="text-base text-slate-500">/100</span>
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${levelStyle.bg} ${levelStyle.text} ring-1 ring-inset ring-white/10`}>
            {levelStyle.label}
          </span>
        </div>
        {auditedAt && (
          <p className="mt-2 text-xs text-slate-500">
            Last audited: {new Date(auditedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Top priority */}
      {result.topPriority && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-white">Biggest Opportunity</p>
            <span className="text-xs text-amber-400 font-medium">
              ({result.topPriority.maxPoints} pts)
            </span>
          </div>
          <p className="text-sm text-white font-medium">
            {result.topPriority.description}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {result.topPriority.statusDetail}
          </p>
          {result.topPriority.fixGuide && (
            <p className="text-xs text-slate-500 mt-2">{result.topPriority.fixGuide}</p>
          )}
        </div>
      )}

      {/* Gaps to fix */}
      {gaps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-400 mb-3">
            Actions AI Cannot Take ({gaps.length})
          </h3>
          <div className="space-y-2">
            {gaps.map(cap => (
              <CapabilityCard key={cap.id} capability={cap} />
            ))}
          </div>
        </div>
      )}

      {/* Ready */}
      {ready.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-400 mb-3">
            Actions AI Can Take ({ready.length})
          </h3>
          <div className="space-y-2">
            {ready.map(cap => (
              <CapabilityCard key={cap.id} capability={cap} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CapabilityCard({ capability }: { capability: ActionCapability }) {
  const Icon = STATUS_ICON[capability.status];
  const color = STATUS_COLOR[capability.status];

  return (
    <div
      className="rounded-lg border border-white/5 bg-surface-dark px-4 py-3"
      data-testid={`agent-seo-capability-${capability.id}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">{capability.label}</p>
            <span className="text-xs text-slate-500 tabular-nums">
              {capability.earnedPoints}/{capability.maxPoints} pts
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{capability.description}</p>
          <p className="text-xs text-slate-500 mt-1">{capability.statusDetail}</p>
          {capability.fixGuide && (
            <p className="text-xs text-slate-600 mt-1 italic">{capability.fixGuide}</p>
          )}
        </div>
      </div>
    </div>
  );
}
