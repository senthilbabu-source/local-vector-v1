import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchEntityHealth } from '@/lib/data/entity-health';
import { FirstVisitTooltip } from '@/components/ui/FirstVisitTooltip';
import {
  type EntityHealthResult,
  type EntityStatus,
  type PlatformInfo,
} from '@/lib/services/entity-health.service';
import { Globe, ExternalLink, CheckCircle2, XCircle, AlertTriangle, CircleDashed } from 'lucide-react';
import EntityStatusDropdown from './_components/EntityStatusDropdown';
import { EntityHealthVerdictPanel } from './_components/EntityHealthVerdictPanel';
import { PLATFORM_DESCRIPTIONS, getPlatformConsequence } from '@/lib/entity-health/platform-descriptions';

// ── Status display helpers (literal Tailwind — AI_RULES §12) ────────────

function statusIcon(status: EntityStatus) {
  if (status === 'confirmed') return <CheckCircle2 className="h-5 w-5 text-green-400" />;
  if (status === 'missing') return <XCircle className="h-5 w-5 text-red-400" />;
  if (status === 'incomplete') return <AlertTriangle className="h-5 w-5 text-amber-400" />;
  return <CircleDashed className="h-5 w-5 text-slate-400" />;
}

function statusLabel(status: EntityStatus): string {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'missing') return 'Missing';
  if (status === 'incomplete') return 'Incomplete';
  return 'Not Checked';
}

// ── Page Component ──────────────────────────────────────────────────────

export default async function EntityHealthPage() {
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
          Does AI Know Your Business?
        </h1>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            No primary location found. Complete onboarding to get started.
          </p>
        </div>
      </div>
    );
  }

  const result = await fetchEntityHealth(supabase, ctx.orgId, location.id);

  // Split platforms into needs-attention vs confirmed
  const needsAttention = result.platforms.filter((p) => p.status !== 'confirmed');
  const confirmed = result.platforms.filter((p) => p.status === 'confirmed');

  return (
    <div className="space-y-5">
      {/* Sprint E: First-visit tooltip — PRESERVED */}
      <FirstVisitTooltip
        pageKey="entity-health"
        title="What is Entity Health?"
        content="This page shows whether major AI platforms — Google, ChatGPT, Siri, Copilot — have accurate, verified information about your business. The more platforms that recognize you, the more accurately AI answers customer questions."
      />

      {/* ── Header (Sprint J: jargon-free) ────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Globe className="h-5 w-5 text-signal-green" />
          Does AI Know Your Business?
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Whether major AI platforms have verified, accurate information about your business.
        </p>
      </div>

      {/* ── Verdict Panel (Sprint J) ──────────────────────────── */}
      <EntityHealthVerdictPanel result={result} />

      {/* ── Needs Attention (failing platforms first) ─────────── */}
      {needsAttention.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-400 mb-3">
            Needs Attention ({needsAttention.length})
          </h2>
          <div className="space-y-2">
            {needsAttention.map((platform) => (
              <PlatformRow
                key={platform.info.key}
                info={platform.info}
                status={platform.status}
                metadata={platform.metadata}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Confirmed Platforms ───────────────────────────────── */}
      {confirmed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-green-400 mb-3">
            Confirmed ({confirmed.length})
          </h2>
          <div className="space-y-2">
            {confirmed.map((platform) => (
              <PlatformRow
                key={platform.info.key}
                info={platform.info}
                status={platform.status}
                metadata={platform.metadata}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Platform Row (Server Component — Sprint J: customer-consequence text) ──

interface PlatformRowProps {
  info: PlatformInfo;
  status: EntityStatus;
  metadata?: Record<string, unknown>;
}

function PlatformRow({ info, status, metadata }: PlatformRowProps) {
  const isAutoDetected = info.autoDetectable && status === 'confirmed';
  const showGuide = status === 'missing' || status === 'incomplete' || status === 'unchecked';
  const desc = PLATFORM_DESCRIPTIONS[info.key];
  const consequence = getPlatformConsequence(info.key, status);

  return (
    <div
      className={`rounded-xl border bg-surface-dark px-4 py-3 ${
        status === 'confirmed'
          ? 'border-green-400/10'
          : status === 'missing'
            ? 'border-red-400/10'
            : status === 'incomplete'
              ? 'border-amber-400/10'
              : 'border-white/5'
      }`}
      data-testid={`platform-card-${info.key}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {statusIcon(status)}
          <div>
            <p className="text-sm font-semibold text-white">
              {desc?.label ?? info.label}
            </p>
            <p
              className={`text-xs ${
                status === 'confirmed'
                  ? 'text-green-400/70'
                  : status === 'missing'
                    ? 'text-red-400/70'
                    : status === 'incomplete'
                      ? 'text-amber-400/70'
                      : 'text-slate-400'
              }`}
            >
              {consequence}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAutoDetected ? (
            <span className="rounded-md bg-green-400/15 px-2 py-0.5 text-xs font-medium text-green-400">
              {statusLabel(status)}
            </span>
          ) : (
            <EntityStatusDropdown platform={info.key} currentStatus={status} />
          )}
        </div>
      </div>

      {/* Claim guide for non-confirmed platforms */}
      {showGuide && !isAutoDetected && (
        <div className="mt-3 ml-8 border-t border-white/5 pt-3">
          <p className="text-xs font-medium text-slate-400 mb-2">
            How to {status === 'incomplete' ? 'fix' : 'claim'}:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            {info.claimGuide.map((step, i) => (
              <li key={i} className="text-xs text-slate-500">{step}</li>
            ))}
          </ol>
          <a
            href={info.claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
          >
            {status === 'incomplete' ? 'Update Listing' : 'Claim Listing'}{' '}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
