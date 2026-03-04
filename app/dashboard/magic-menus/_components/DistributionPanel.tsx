'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PropagationEvent, MenuExtractedData } from '@/lib/types/menu';
import type { BotActivity } from '@/lib/data/crawler-analytics';
import type { DistributionResult } from '@/lib/distribution';
import {
  DISTRIBUTION_ENGINES,
  getEngineLastActivity,
} from '@/lib/distribution/distribution-engines-config';
import { formatRelativeDate } from '@/lib/admin/format-relative-date';
import { distributeMenuNow, fetchDistributionStatus } from '../actions';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DistributionPanelProps {
  menuId: string;
  publicSlug: string | null;
  contentHash: string | null;
  lastDistributedAt: string | null;
  propagationEvents: PropagationEvent[];
}

// ---------------------------------------------------------------------------
// DistributionPanel
// ---------------------------------------------------------------------------

export default function DistributionPanel({
  menuId,
  publicSlug,
  contentHash: initialContentHash,
  lastDistributedAt: initialLastDistributedAt,
  propagationEvents: initialPropagationEvents,
}: DistributionPanelProps) {
  // State
  const [contentHash, setContentHash] = useState(initialContentHash);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [lastDistributedAt, setLastDistributedAt] = useState(initialLastDistributedAt);
  const [propagationEvents, setPropagationEvents] = useState(initialPropagationEvents);
  const [crawlerHits, setCrawlerHits] = useState<BotActivity[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUpToDate = computedHash !== null && contentHash === computedHash;

  // ---------------------------------------------------------------------------
  // Fetch distribution status on mount
  // ---------------------------------------------------------------------------

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const result = await fetchDistributionStatus(menuId);
      if (result.success) {
        setContentHash(result.contentHash);
        setComputedHash(result.computedHash);
        setLastDistributedAt(result.lastDistributedAt);
        setPropagationEvents(result.propagationEvents);
        setCrawlerHits(result.recentCrawlerHits);
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'DistributionPanel', sprint: 'dist-3' } });
    } finally {
      setLoadingStatus(false);
    }
  }, [menuId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleDistribute() {
    setError(null);
    setDistributing(true);
    try {
      const res = await distributeMenuNow(menuId);
      if (res.success) {
        // Optimistically update from result
        if (res.result.contentHash) setContentHash(res.result.contentHash);
        if (res.result.distributedAt) setLastDistributedAt(res.result.distributedAt);
        // Refresh to get updated propagation events + crawler hits
        await refreshStatus();
      } else {
        setError(res.error);
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'DistributionPanel', sprint: 'dist-3' } });
      setError('Distribution failed. Please try again.');
    } finally {
      setDistributing(false);
    }
  }

  async function handleCopy() {
    if (!publicSlug) return;
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/m/${publicSlug}`
        : `/m/${publicSlug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'DistributionPanel', sprint: 'dist-3' } });
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getEngineStatus(engine: (typeof DISTRIBUTION_ENGINES)[number]): {
    label: string;
    active: boolean;
  } {
    if (engine.type === 'active') {
      const lastActivity = getEngineLastActivity(engine, propagationEvents);
      return lastActivity
        ? { label: 'Pushed', active: true }
        : { label: 'Pending', active: false };
    }
    // Passive engine — check crawler hits
    const hasVisit = crawlerHits.some((h) => engine.botTypes.includes(h.botType));
    return hasVisit
      ? { label: 'Visited', active: true }
      : { label: 'Awaiting crawl', active: false };
  }

  function getEngineTimestamp(engine: (typeof DISTRIBUTION_ENGINES)[number]): string | null {
    if (engine.type === 'active') {
      return getEngineLastActivity(engine, propagationEvents);
    }
    // Passive — find latest matching crawler hit
    const matching = crawlerHits.filter((h) => engine.botTypes.includes(h.botType));
    if (matching.length === 0) return null;
    return matching.reduce((latest, h) =>
      (h.lastVisitAt ?? '') > (latest.lastVisitAt ?? '') ? h : latest,
    ).lastVisitAt;
  }

  // Recent crawler hits: top 5 with actual visits, sorted by recency
  const recentHits = crawlerHits.filter((h) => h.lastVisitAt).slice(0, 5);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section
      data-testid="distribution-panel"
      aria-label="Distribution status"
      className="mt-4 rounded-xl border border-white/5 bg-surface-dark p-5 space-y-5"
    >
      {/* ── Section A: Header + CTA ──────────────────────────────── */}
      <div
        data-testid="distribution-status-header"
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h3 className="text-sm font-semibold text-white">Distribution Status</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {lastDistributedAt
              ? `Last distributed: ${new Date(lastDistributedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date(lastDistributedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
              : 'Not yet distributed'}
          </p>
        </div>

        {isUpToDate ? (
          <span
            data-testid="up-to-date-label"
            className="inline-flex items-center gap-1.5 rounded-lg bg-truth-emerald/15 px-3 py-1.5 text-xs font-semibold text-truth-emerald"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
            Up to date
          </span>
        ) : (
          <button
            data-testid="distribute-button"
            onClick={handleDistribute}
            disabled={distributing || loadingStatus}
            className={[
              'rounded-xl px-4 py-2 text-xs font-semibold transition',
              distributing || loadingStatus
                ? 'bg-electric-indigo/40 text-white/50 cursor-not-allowed'
                : 'bg-electric-indigo text-white hover:bg-electric-indigo/90',
            ].join(' ')}
          >
            {distributing ? 'Distributing\u2026' : 'Distribute Now'}
          </button>
        )}
      </div>

      {error && (
        <p data-testid="distribution-error" className="text-xs text-alert-crimson">
          {error}
        </p>
      )}

      {/* ── Section B: Engine Status Rows ────────────────────────── */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          AI Engines
        </h4>
        <div className="divide-y divide-white/5">
          {DISTRIBUTION_ENGINES.map((engine) => {
            const status = getEngineStatus(engine);
            const timestamp = getEngineTimestamp(engine);
            return (
              <div
                key={engine.id}
                data-testid={`engine-row-${engine.id}`}
                className="flex items-center justify-between py-2.5"
              >
                <div className="flex items-center gap-3">
                  {/* Engine icon initial */}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-slate-300">
                    {engine.label.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{engine.label}</p>
                    <p className="text-[10px] text-slate-400">{engine.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {timestamp && (
                    <span
                      data-testid={`engine-timestamp-${engine.id}`}
                      className="text-[10px] font-mono text-slate-400"
                    >
                      {formatRelativeDate(timestamp)}
                    </span>
                  )}
                  <span
                    data-testid={`engine-status-${engine.id}`}
                    className={[
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      status.active
                        ? 'bg-truth-emerald/15 text-truth-emerald'
                        : 'bg-white/5 text-slate-400',
                    ].join(' ')}
                  >
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section C: Crawler Activity ──────────────────────────── */}
      <div data-testid="crawler-activity-section">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Recent AI Bot Visits
        </h4>
        {recentHits.length > 0 ? (
          <ul className="space-y-1.5">
            {recentHits.map((hit) => (
              <li
                key={hit.botType}
                data-testid={`crawler-hit-${hit.botType}`}
                className="text-xs text-slate-300"
              >
                <span className="font-medium text-white">{hit.label}</span>{' '}
                visited {formatRelativeDate(hit.lastVisitAt)}
              </li>
            ))}
          </ul>
        ) : (
          <p data-testid="no-crawler-hits" className="text-xs text-slate-400">
            No AI bot visits recorded yet.
          </p>
        )}
      </div>

      {/* ── Section D: URL Reference ─────────────────────────────── */}
      {publicSlug && (
        <div data-testid="distribution-url" className="flex items-center gap-2 rounded-lg bg-midnight-slate border border-white/10 px-3 py-2">
          <span className="flex-1 text-xs font-mono text-slate-300 truncate">
            /m/{publicSlug}
          </span>
          <button
            data-testid="copy-url-button"
            onClick={handleCopy}
            className={[
              'shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              copied
                ? 'bg-truth-emerald/15 text-truth-emerald'
                : 'bg-electric-indigo/10 text-electric-indigo hover:bg-electric-indigo/20',
            ].join(' ')}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </section>
  );
}
