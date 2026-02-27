import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchEntityHealth } from '@/lib/data/entity-health';
import {
  ENTITY_PLATFORM_REGISTRY,
  type EntityHealthResult,
  type EntityStatus,
  type PlatformInfo,
} from '@/lib/services/entity-health.service';
import { Globe, ExternalLink, ChevronDown, CheckCircle2, XCircle, AlertTriangle, CircleDashed } from 'lucide-react';
import EntityStatusDropdown from './_components/EntityStatusDropdown';

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

function ratingColor(rating: EntityHealthResult['rating']): string {
  if (rating === 'strong') return 'text-green-400';
  if (rating === 'at_risk') return 'text-amber-400';
  if (rating === 'critical') return 'text-red-400';
  return 'text-slate-400';
}

function ratingBadgeClasses(rating: EntityHealthResult['rating']): string {
  if (rating === 'strong') return 'bg-green-400/15 text-green-400';
  if (rating === 'at_risk') return 'bg-amber-400/15 text-amber-400';
  if (rating === 'critical') return 'bg-red-400/15 text-red-400';
  return 'bg-slate-400/15 text-slate-400';
}

function ratingLabel(rating: EntityHealthResult['rating']): string {
  if (rating === 'strong') return 'Strong';
  if (rating === 'at_risk') return 'At Risk';
  if (rating === 'critical') return 'Critical';
  return 'Unknown';
}

function progressBarColor(rating: EntityHealthResult['rating']): string {
  if (rating === 'strong') return 'bg-green-400';
  if (rating === 'at_risk') return 'bg-amber-400';
  if (rating === 'critical') return 'bg-red-400';
  return 'bg-slate-400';
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
          Entity Knowledge Graph Health
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

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Globe className="h-5 w-5 text-signal-green" />
          Entity Knowledge Graph Health
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Track whether AI models recognize your business as a verified entity across knowledge platforms.
        </p>
      </div>

      {/* ── Score Summary ──────────────────────────────────── */}
      <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-slate-400">
              Entity Score:{' '}
              <span className={`font-bold ${ratingColor(result.rating)}`}>{result.score}%</span>
              {' · '}
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${ratingBadgeClasses(result.rating)}`}>
                {ratingLabel(result.rating)}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {result.confirmedCount} of {result.totalPlatforms} core platforms confirmed
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-white/5">
          <div
            className={`h-2 rounded-full transition-all ${progressBarColor(result.rating)}`}
            style={{ width: `${result.score}%` }}
          />
        </div>
      </div>

      {/* ── Platform Checklist ─────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Platform Checklist</h2>
        <div className="space-y-2">
          {result.platforms.map((platform) => (
            <PlatformRow
              key={platform.info.key}
              info={platform.info}
              status={platform.status}
              metadata={platform.metadata}
            />
          ))}
        </div>
      </div>

      {/* ── Top Recommendations ────────────────────────────── */}
      {result.recommendations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Top Recommendations</h2>
          <div className="space-y-2">
            {result.recommendations.slice(0, 5).map((rec, i) => (
              <div
                key={rec.platform}
                className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">{i + 1}.</span>
                  <div>
                    <p className="text-sm text-white">{rec.action}</p>
                    <p className="text-xs text-slate-500">
                      Priority: {rec.priority >= 9 ? 'HIGH' : rec.priority >= 7 ? 'MEDIUM' : 'LOW'}
                    </p>
                  </div>
                </div>
                <a
                  href={rec.claimUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
                >
                  Go <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Unknown state message ──────────────────────────── */}
      {result.rating === 'unknown' && (
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-4 text-center">
          <p className="text-sm text-slate-400">
            Complete the checklist above to assess your entity presence across AI knowledge platforms.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Platform Row (Server Component) ─────────────────────────────────────

interface PlatformRowProps {
  info: PlatformInfo;
  status: EntityStatus;
  metadata?: Record<string, unknown>;
}

function PlatformRow({ info, status, metadata }: PlatformRowProps) {
  const isAutoDetected = info.autoDetectable && status === 'confirmed';
  const showGuide = status === 'missing' || status === 'incomplete' || status === 'unchecked';

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {statusIcon(status)}
          <div>
            <p className="text-sm font-semibold text-white">{info.label}</p>
            {isAutoDetected && (
              <p className="text-xs text-slate-500">Auto-detected from your LocalVector data</p>
            )}
            {!isAutoDetected && status === 'confirmed' && (
              <p className="text-xs text-green-400/70">Claimed and verified</p>
            )}
            {status === 'missing' && (
              <p className="text-xs text-red-400/70">{info.aiImpact.split('.')[0]}</p>
            )}
            {status === 'incomplete' && (
              <p className="text-xs text-amber-400/70">Present but missing data</p>
            )}
            {status === 'unchecked' && (
              <p className="text-xs text-slate-400">{info.description}</p>
            )}
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
          <p className="text-xs font-medium text-slate-400 mb-2">How to {status === 'incomplete' ? 'fix' : 'claim'}:</p>
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
            {status === 'incomplete' ? 'Update Listing' : 'Claim Listing'} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
