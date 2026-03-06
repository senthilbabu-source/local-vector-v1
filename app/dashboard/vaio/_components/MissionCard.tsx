'use client';

// ---------------------------------------------------------------------------
// MissionCard — Expandable card for a single VAIO mission (Sprint 2)
//
// Two levels:
//   1. Header click → expands step list
//   2. "Show supporting data" → expands the raw detail section for this
//      mission's component (crawler audit, llms.txt, gaps, or issues)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Check,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Copy,
} from 'lucide-react';
import type { Mission } from '@/lib/vaio/types';

// ── Shared sub-types (match VAIOPageClient's API response shape) ─────────

interface CrawlerRow {
  name: string;
  user_agent: string;
  status: string;
  used_by: string;
  impact: string;
}

interface CrawlerAudit {
  overall_health: string;
  crawlers: CrawlerRow[];
  blocked_count: number;
  allowed_count: number;
  missing_count: number;
}

interface VoiceGapItem {
  category: string;
  queries: string[];
  weeks_at_zero: number;
  suggested_query_answer: string;
}

interface ContentIssue {
  type: string;
  severity: string;
  description: string;
  fix: string;
}

interface VoiceQueryRow {
  id: string;
  query_text: string;
  query_category: string;
  citation_rate: number | null;
}

export interface MissionCardProfile {
  llms_txt_standard: string | null;
  crawler_audit: CrawlerAudit | null;
  voice_gaps: VoiceGapItem[];
  top_content_issues: ContentIssue[];
}

// ── Helper: crawler status icon ──────────────────────────────────────────

function crawlerIcon(status: string) {
  switch (status) {
    case 'allowed':
      return <ShieldCheck className="h-3.5 w-3.5 text-green-400" />;
    case 'blocked':
      return <ShieldX className="h-3.5 w-3.5 text-red-400" />;
    default:
      return <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />;
  }
}

// ── Detail sections (one per component) ──────────────────────────────────

function CrawlerDetail({ crawlerAudit }: { crawlerAudit: CrawlerAudit | null }) {
  if (!crawlerAudit?.crawlers?.length) return null;
  return (
    <div className="mt-3 space-y-2" data-testid="mission-detail-crawler">
      {crawlerAudit.crawlers.map((c) => (
        <div key={c.user_agent} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {crawlerIcon(c.status)}
            <span className="text-slate-300">{c.name}</span>
            <span className="text-xs text-slate-500">({c.used_by})</span>
          </div>
          <span
            className={`text-xs ${
              c.status === 'allowed'
                ? 'text-green-400'
                : c.status === 'blocked'
                  ? 'text-red-400'
                  : 'text-slate-400'
            }`}
          >
            {c.status === 'allowed'
              ? 'Allowed'
              : c.status === 'blocked'
                ? 'Blocked'
                : 'Not specified'}
          </span>
        </div>
      ))}
    </div>
  );
}

function LlmsTxtDetail({
  llmsTxtStandard,
}: {
  llmsTxtStandard: string | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!llmsTxtStandard) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(llmsTxtStandard);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3" data-testid="mission-detail-llms-txt">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">AI Business Profile</span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-xs text-electric-indigo hover:text-electric-indigo/80"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-48 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap">
        {llmsTxtStandard}
      </pre>
    </div>
  );
}

function VoiceCitationDetail({
  voiceGaps,
  queries,
}: {
  voiceGaps: VoiceGapItem[];
  queries: VoiceQueryRow[];
}) {
  return (
    <div className="mt-3 space-y-4" data-testid="mission-detail-voice-citation">
      {voiceGaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-amber-400 uppercase tracking-wide">Content Gaps</p>
          {voiceGaps.map((gap, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
            >
              <p className="text-xs font-medium text-amber-400 capitalize mb-1">
                {gap.category} — {gap.weeks_at_zero} week{gap.weeks_at_zero !== 1 ? 's' : ''} at zero citations
              </p>
              <p className="text-xs text-slate-400 mb-1.5">
                {gap.queries?.length ?? 0} queries getting zero AI mentions
              </p>
              <p className="text-xs text-slate-400 italic">
                Suggested: &ldquo;{gap.suggested_query_answer}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}

      {queries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Tracked Queries ({queries.length})
          </p>
          {queries.map((q) => (
            <div key={q.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-300 truncate max-w-xs">
                &ldquo;{q.query_text}&rdquo;
              </span>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-slate-500 capitalize">{q.query_category}</span>
                <span
                  className={`font-mono text-xs ${
                    q.citation_rate !== null && q.citation_rate > 0
                      ? 'text-green-400'
                      : 'text-slate-400'
                  }`}
                >
                  {q.citation_rate !== null ? `${Math.round(q.citation_rate * 100)}%` : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentQualityDetail({ topContentIssues }: { topContentIssues: ContentIssue[] }) {
  if (topContentIssues.length === 0) return null;
  return (
    <div className="mt-3 space-y-2" data-testid="mission-detail-content-quality">
      {topContentIssues.map((issue, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span
            className={`mt-1 inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${
              issue.severity === 'critical'
                ? 'bg-red-400'
                : issue.severity === 'warning'
                  ? 'bg-amber-400'
                  : 'bg-slate-500'
            }`}
          />
          <div>
            <p className="text-slate-300">{issue.description}</p>
            <p className="text-xs text-slate-400">{issue.fix}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MissionCard ───────────────────────────────────────────────────────────

interface MissionCardProps {
  mission: Mission;
  profile: MissionCardProfile;
  queries: VoiceQueryRow[];
  defaultOpen?: boolean;
  /** §210 — briefly pulse with a green ring when this mission just became done */
  pulseGreen?: boolean;
  'data-testid'?: string;
}

export function MissionCard({
  mission,
  profile,
  queries,
  defaultOpen = false,
  pulseGreen = false,
  'data-testid': testId,
}: MissionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showDetail, setShowDetail] = useState(false);

  const isDone = mission.status === 'done';

  // Determine if there is detail content to show for this component
  const hasDetail =
    mission.component === 'crawler_access'
      ? Boolean(profile.crawler_audit)
      : mission.component === 'llms_txt'
        ? Boolean(profile.llms_txt_standard)
        : mission.component === 'voice_citation'
          ? profile.voice_gaps.length > 0 || queries.length > 0
          : mission.component === 'content_quality'
            ? profile.top_content_issues.length > 0
            : false;

  return (
    <div
      className={`rounded-xl border bg-surface-dark transition-all ${
        pulseGreen
          ? 'border-green-400/60 ring-2 ring-green-400/20'
          : isDone
            ? 'border-green-500/20'
            : 'border-white/5 hover:border-white/10'
      }`}
      data-testid={testId ?? `mission-card-${mission.component}`}
    >
      {/* Card header — always visible */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Done checkmark / open indicator */}
          {isDone ? (
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20">
              <Check className="h-3.5 w-3.5 text-green-400" />
            </span>
          ) : (
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-electric-indigo/40 text-xs font-bold text-electric-indigo">
              +{mission.pts_gain}
            </span>
          )}
          <div className="min-w-0">
            <p
              className={`font-semibold text-sm leading-snug ${
                isDone ? 'text-slate-400' : 'text-white'
              }`}
            >
              {mission.title}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{mission.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {isDone ? (
            <span className="text-xs font-medium text-green-400">Done</span>
          ) : (
            <span className="text-xs font-medium text-electric-indigo tabular-nums">
              +{mission.pts_gain} pts
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded body — steps + optional raw detail */}
      {isOpen && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4">
          {/* Step list */}
          <ol className="space-y-3" data-testid={`mission-steps-${mission.component}`}>
            {mission.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-medium text-slate-400 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm text-slate-200 leading-snug">{step.label}</p>
                  {step.detail && (
                    <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">
                      {step.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Show supporting data toggle */}
          {hasDetail && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <button
                onClick={() => setShowDetail((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300"
                data-testid={`mission-detail-toggle-${mission.component}`}
              >
                {showDetail ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {showDetail ? 'Hide supporting data' : 'Show supporting data'}
              </button>

              {showDetail && (
                <>
                  {mission.component === 'crawler_access' && (
                    <CrawlerDetail crawlerAudit={profile.crawler_audit} />
                  )}
                  {mission.component === 'llms_txt' && (
                    <LlmsTxtDetail llmsTxtStandard={profile.llms_txt_standard} />
                  )}
                  {mission.component === 'voice_citation' && (
                    <VoiceCitationDetail voiceGaps={profile.voice_gaps} queries={queries} />
                  )}
                  {mission.component === 'content_quality' && (
                    <ContentQualityDetail topContentIssues={profile.top_content_issues} />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
