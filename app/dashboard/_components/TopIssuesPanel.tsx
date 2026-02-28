/**
 * TopIssuesPanel — Prioritized, plain-English list of the top issues
 * the customer should fix today.
 *
 * Merges hallucination alerts + technical findings, sorted by severity.
 * Each row reads like a human wrote it.
 *
 * Sprint G — Human-Readable Dashboard.
 */

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { HallucinationRow } from '@/lib/data/dashboard';
import type { CrawlerSummary } from '@/lib/data/crawler-analytics';
import {
  describeAlert,
  describeTechnicalFinding,
  type IssueDescription,
  type IssueSeverity,
  type TechnicalFindingInput,
} from '@/lib/issue-descriptions';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopIssuesPanelProps {
  alerts: HallucinationRow[];
  crawlerSummary: CrawlerSummary | null;
  sampleMode: boolean;
}

interface DisplayIssue {
  description: IssueDescription;
  affectedCount?: number;
}

// ─── Helper: derive technical findings from crawler data ────────────────

export function deriveTechnicalFindings(
  crawlerSummary: CrawlerSummary | null,
): TechnicalFindingInput[] {
  const findings: TechnicalFindingInput[] = [];

  if (!crawlerSummary) return findings;

  // Add up to 2 bot blind-spot findings
  const blindSpots = crawlerSummary.blindSpots.slice(0, 2);
  for (const bot of blindSpots) {
    findings.push({
      type: 'bot_blind_spot',
      botName: bot.label,
      affectedCount: 0,
    });
  }

  return findings;
}

// ─── Sample issues ──────────────────────────────────────────────────────

const SAMPLE_ISSUES: DisplayIssue[] = [
  {
    description: {
      headline:
        'ChatGPT says "Closes at 10pm on weekends" — the truth is "Open until 2am on weekends"',
      severity: 'critical',
      fixHref: '/dashboard/hallucinations',
      fixLabel: 'Fix with AI',
      costsCredit: true,
      category: 'AI search',
    },
  },
  {
    description: {
      headline:
        'Perplexity is showing incorrect menu or pricing information',
      severity: 'warning',
      fixHref: '/dashboard/hallucinations',
      fixLabel: 'Fix with AI',
      costsCredit: true,
      category: 'AI search',
    },
  },
  {
    description: {
      headline:
        "ClaudeBot can't reach your website — it's relying on outdated sources",
      severity: 'warning',
      fixHref: '/dashboard/crawler-analytics',
      fixLabel: 'How to fix →',
      costsCredit: false,
      category: 'Site health',
    },
  },
];

// ─── Severity sorting ───────────────────────────────────────────────────

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

// ─── Issue Row ──────────────────────────────────────────────────────────

function IssueRow({
  description,
  index,
}: {
  description: IssueDescription;
  index: number;
}) {
  const severityConfig = {
    critical: {
      dot: 'bg-alert-crimson',
      badgeClass: 'bg-red-500/10 text-red-400 ring-red-500/20',
    },
    warning: {
      dot: 'bg-alert-amber',
      badgeClass: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    },
    info: {
      dot: 'bg-electric-indigo',
      badgeClass: 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20',
    },
  };
  const { dot, badgeClass } = severityConfig[description.severity];

  return (
    <div
      className="flex items-start justify-between gap-4 border-b border-white/5 py-3 last:border-0"
      data-testid={`top-issue-row-${index}`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white leading-snug">
            {description.headline}
          </p>
          {description.subtext && (
            <p className="mt-0.5 text-xs text-slate-500">
              {description.subtext}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${badgeClass}`}
            >
              {description.category}
            </span>
            {description.costsCredit && (
              <span className="text-[10px] text-slate-600">· 1 credit</span>
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 mt-1">
        {description.fixLabel === 'Fix with AI' ? (
          <Link
            href={description.fixHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-electric-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-electric-indigo/90 transition-colors whitespace-nowrap"
            data-testid={`top-issue-fix-${index}`}
          >
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Fix with AI
          </Link>
        ) : (
          <Link
            href={description.fixHref}
            className="text-xs text-slate-400 underline hover:text-white whitespace-nowrap"
            data-testid={`top-issue-how-${index}`}
          >
            {description.fixLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────

export default function TopIssuesPanel({
  alerts,
  crawlerSummary,
  sampleMode,
}: TopIssuesPanelProps) {
  if (sampleMode) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark p-5"
        data-testid="top-issues-panel"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Top Issues</h2>
          <Link
            href="/dashboard/hallucinations"
            className="text-xs text-slate-400 hover:text-white underline"
            data-testid="top-issues-view-all"
          >
            View all →
          </Link>
        </div>
        <div>
          {SAMPLE_ISSUES.map((issue, index) => (
            <IssueRow
              key={index}
              description={issue.description}
              index={index}
            />
          ))}
        </div>
        <p className="mt-3 text-[10px] text-slate-600 text-center">
          Sample issues shown — your real issues appear after the first scan
        </p>
      </div>
    );
  }

  // 1. Convert alerts to IssueDescription
  const alertIssues: DisplayIssue[] = alerts.map((alert) => ({
    description: describeAlert(alert),
  }));

  // 2. Convert technical findings to IssueDescription
  const technicalFindings = deriveTechnicalFindings(crawlerSummary);
  const technicalIssues: DisplayIssue[] = technicalFindings.map((finding) => ({
    description: describeTechnicalFinding(finding),
    affectedCount: finding.affectedCount,
  }));

  // 3. Merge and sort: critical first, then warning, then info
  const allIssues = [...alertIssues, ...technicalIssues]
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.description.severity] -
        SEVERITY_ORDER[b.description.severity],
    )
    .slice(0, 5);

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5"
      data-testid="top-issues-panel"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Top Issues</h2>
        {allIssues.length > 0 && (
          <Link
            href="/dashboard/hallucinations"
            className="text-xs text-slate-400 hover:text-white underline"
            data-testid="top-issues-view-all"
          >
            View all →
          </Link>
        )}
      </div>

      {allIssues.length === 0 ? (
        <div className="py-6 text-center" data-testid="top-issues-empty">
          <p className="text-sm font-medium text-truth-emerald">
            No issues found
          </p>
          <p className="mt-1 text-xs text-slate-500">
            LocalVector hasn&apos;t detected any problems with how AI models
            describe your business.
          </p>
        </div>
      ) : (
        <div>
          {allIssues.map(({ description }, index) => (
            <IssueRow key={index} description={description} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
