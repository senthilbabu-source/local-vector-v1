import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchEntityHealth } from '@/lib/data/entity-health';
import { fetchSourceIntelligence } from '@/lib/data/source-intelligence';
import { calculateCitationGapScore } from '@/lib/services/citation-engine.service';
import type { CitationSourceIntelligence, TenantListing } from '@/lib/types/citations';
import { FirstVisitTooltip } from '@/components/ui/FirstVisitTooltip';
import { PlanGate } from '@/components/plan-gate/PlanGate';
import {
  type EntityHealthResult,
  type EntityStatus,
  type PlatformInfo,
} from '@/lib/services/entity-health.service';
import { Globe, ExternalLink, CheckCircle2, XCircle, AlertTriangle, CircleDashed } from 'lucide-react';
import EntityStatusDropdown from './_components/EntityStatusDropdown';
import { EntityHealthVerdictPanel } from './_components/EntityHealthVerdictPanel';
import EntityHealthTabs from './_components/EntityHealthTabs';
import { PLATFORM_DESCRIPTIONS, getPlatformConsequence } from '@/lib/entity-health/platform-descriptions';
import { getPlatformFixLink } from '@/lib/entity-health/platform-fix-links';
import { SourceHealthSummaryPanel } from '@/app/dashboard/source-intelligence/_components/SourceHealthSummaryPanel';
import CitationGapScore from '@/app/dashboard/citations/_components/CitationGapScore';
import PlatformCitationBar from '@/app/dashboard/citations/_components/PlatformCitationBar';

export const metadata = { title: 'Where AI Knows You | LocalVector.ai' };

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

export default async function EntityHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');
  if (!ctx.orgId) redirect('/login');

  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab ?? 'platforms';

  const supabase = await createClient();

  const [locResult, orgResult] = await Promise.all([
    supabase
      .from('locations')
      .select('id, business_name, city, state, categories')
      .eq('org_id', ctx.orgId)
      .eq('is_primary', true)
      .maybeSingle(),
    supabase.from('organizations').select('plan').eq('id', ctx.orgId).single(),
  ]);

  const location = locResult.data;
  const plan = (orgResult.data?.plan as string) ?? 'trial';

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

  return (
    <div className="space-y-5">
      {/* Sprint E: First-visit tooltip — PRESERVED */}
      <FirstVisitTooltip
        pageKey="entity-health"
        title="What is Entity Health?"
        content="This page shows whether major AI platforms — Google, ChatGPT, Siri, Copilot — have accurate, verified information about your business. The more platforms that recognize you, the more accurately AI answers customer questions."
      />

      {/* ── Header (Sprint J: jargon-free) ────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Globe className="h-5 w-5 text-signal-green" />
            Does AI Know Your Business?
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Whether major AI platforms have verified, accurate information about your business.
          </p>
        </div>
        {/* S33: Tab switcher */}
        <EntityHealthTabs />
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      {activeTab === 'sources' ? (
        <SourcesTabContent orgId={ctx.orgId} locationId={location.id} plan={plan} />
      ) : activeTab === 'citations' ? (
        <CitationsTabContent orgId={ctx.orgId} locationId={location.id} plan={plan} location={location} />
      ) : (
        <PlatformsTabContent orgId={ctx.orgId} locationId={location.id} />
      )}
    </div>
  );
}

// ── Platforms Tab (default — existing content) ───────────────────────────

async function PlatformsTabContent({ orgId, locationId }: { orgId: string; locationId: string }) {
  const supabase = await createClient();
  const result = await fetchEntityHealth(supabase, orgId, locationId);

  const needsAttention = result.platforms.filter((p) => p.status !== 'confirmed');
  const confirmed = result.platforms.filter((p) => p.status === 'confirmed');

  return (
    <>
      <EntityHealthVerdictPanel result={result} />

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
    </>
  );
}

// ── Sources Tab (merged from /source-intelligence) ───────────────────────

async function SourcesTabContent({ orgId, locationId, plan }: { orgId: string; locationId: string; plan: string }) {
  const supabase = await createClient();
  const sourceResult = await fetchSourceIntelligence(supabase, orgId, locationId);

  return (
    <PlanGate requiredPlan="agency" currentPlan={plan} feature="Source Intelligence">
      <SourceHealthSummaryPanel result={sourceResult} />

      {sourceResult.sources.length === 0 && (
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            No source data available yet. Sources appear after AI mention scans detect which websites
            AI engines cite when answering questions about your business.
          </p>
        </div>
      )}

      {sourceResult.sources.length > 0 && (
        <div className="space-y-2">
          {sourceResult.sources.map((source, i) => (
            <div
              key={source.url ?? `source-${i}`}
              className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{source.name}</p>
                  {source.url && <p className="text-xs text-slate-400 truncate">{source.url}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">{source.citationCount} citation{source.citationCount === 1 ? '' : 's'}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    source.category === 'first_party' ? 'bg-signal-green/10 text-signal-green' :
                    source.category === 'competitor' ? 'bg-alert-crimson/10 text-alert-crimson' :
                    'bg-electric-indigo/10 text-electric-indigo'
                  }`}>
                    {source.category.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PlanGate>
  );
}

// ── Citations Tab (merged from /citations) ───────────────────────────────

async function CitationsTabContent({
  orgId,
  locationId,
  plan,
  location,
}: {
  orgId: string;
  locationId: string;
  plan: string;
  location: { id: string; business_name?: string | null; city?: string | null; state?: string | null; categories?: unknown };
}) {
  const supabase = await createClient();

  const categories = location.categories as string[] | null;
  const primaryCategory = categories?.[0] ?? 'restaurant';
  const city = (location.city ?? '') as string;
  const state = (location.state ?? '') as string;

  const [citationResult, listingResult] = await Promise.all([
    supabase
      .from('citation_source_intelligence')
      .select(
        'id, business_category, city, state, platform, citation_frequency, sample_query, sample_size, model_provider, measured_at',
      )
      .ilike('business_category', primaryCategory)
      .ilike('city', city)
      .ilike('state', state),

    supabase
      .from('listings')
      .select('sync_status, directories!inner(name)')
      .eq('org_id', orgId)
      .eq('location_id', locationId),
  ]);

  const platforms: CitationSourceIntelligence[] = citationResult.data ?? [];
  const listings: TenantListing[] = (listingResult.data ?? []).map((row) => ({
    directory: (row.directories as { name: string })?.name ?? '',
    sync_status: row.sync_status ?? 'not_linked',
  }));

  const gapScore = calculateCitationGapScore(platforms, listings);
  const coveredPlatforms = new Set(
    listings
      .filter((l) => l.sync_status === 'synced' || l.sync_status === 'linked')
      .map((l) => l.directory.toLowerCase()),
  );

  return (
    <PlanGate requiredPlan="growth" currentPlan={plan} feature="Citation Intelligence">
      <CitationGapScore
        gapScore={gapScore.gapScore}
        platformsCovered={gapScore.platformsCovered}
        platformsThatMatter={gapScore.platformsThatMatter}
      />

      {platforms.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            No citation data available yet. Citation intelligence appears after your market data is analyzed.
          </p>
        </div>
      ) : (
        <PlatformCitationBar platforms={platforms} coveredPlatforms={coveredPlatforms} />
      )}
    </PlanGate>
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
              <li key={i} className="text-xs text-slate-400">{step}</li>
            ))}
          </ol>
          {(() => {
            const fixLink = getPlatformFixLink(info.key);
            const href = fixLink?.url ?? info.claimUrl;
            const label = fixLink
              ? `Claim on ${fixLink.label}`
              : (status === 'incomplete' ? 'Update Listing' : 'Claim Listing');
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
                data-testid={`platform-fix-link-${info.key}`}
              >
                {label} <ExternalLink className="h-3 w-3" />
              </a>
            );
          })()}
        </div>
      )}
    </div>
  );
}
