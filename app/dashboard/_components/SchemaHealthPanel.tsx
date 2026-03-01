'use client';

// ---------------------------------------------------------------------------
// SchemaHealthPanel — Sprint 106: Schema Coverage Dashboard Panel
//
// Displays schema health score, per-page-type status table, and action CTAs.
// Follows ListingHealthPanel pattern exactly.
// Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { Code, RefreshCw, CheckCircle, AlertCircle, Clock, XCircle, Eye, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import SchemaEmbedModal from './SchemaEmbedModal';
import type { SchemaStatusResponse, PageType } from '@/lib/schema-expansion/types';

const PAGE_TYPE_LABELS: Record<PageType, string> = {
  homepage: 'Homepage',
  about: 'About',
  faq: 'FAQ Page',
  event: 'Events',
  blog_post: 'Blog',
  service: 'Service',
  menu: 'Menu',
  other: 'Other',
};

const PAGE_TYPE_ICONS: Record<string, string> = {
  homepage: '\u{1F3E0}',
  about: '\u{2139}\u{FE0F}',
  faq: '\u{2753}',
  event: '\u{1F3AD}',
  blog_post: '\u{1F4DD}',
  service: '\u{2699}\u{FE0F}',
  other: '\u{1F4C4}',
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; label: string; color: string }> = {
  published: { icon: CheckCircle, label: 'Published', color: 'text-signal-green bg-signal-green/10 border-signal-green/20' },
  pending_review: { icon: Clock, label: 'Review Needed', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  failed: { icon: XCircle, label: 'Failed', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  draft: { icon: AlertCircle, label: 'Draft', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
  stale: { icon: AlertCircle, label: 'Stale', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

interface SchemaHealthPanelProps {
  isGrowthPlan: boolean;
}

export default function SchemaHealthPanel({ isGrowthPlan }: SchemaHealthPanelProps) {
  const [data, setData] = useState<SchemaStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [embedModal, setEmbedModal] = useState<{ snippet: string; pageType: string; url: string } | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/schema-expansion/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isGrowthPlan) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [isGrowthPlan, fetchStatus]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/schema-expansion/run', { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
      }
    } catch {
      // Handled silently
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (schemaId: string) => {
    setApproving(schemaId);
    try {
      const res = await fetch(`/api/schema-expansion/${schemaId}/approve`, { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
      }
    } catch {
      // Handled silently
    } finally {
      setApproving(null);
    }
  };

  if (!isGrowthPlan) return null;

  if (loading) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark p-5 animate-pulse"
        data-testid="schema-health-panel-skeleton"
      >
        <div className="h-5 w-48 bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-14 bg-white/5 rounded-lg" />
          <div className="h-14 bg-white/5 rounded-lg" />
          <div className="h-14 bg-white/5 rounded-lg" />
        </div>
      </div>
    );
  }

  const pages = data?.pages ?? [];
  const healthScore = data?.schema_health_score;
  const lastRunAt = data?.last_run_at;

  // Recommendations for improving score
  const recommendations = buildRecommendations(pages);

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5"
      data-testid="schema-health-panel"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-signal-green" />
          <h2 className="text-base font-semibold text-white">Schema Coverage</h2>
        </div>
        <div className="flex items-center gap-3">
          {healthScore != null && (
            <span
              className="text-sm font-semibold text-white"
              data-testid="schema-score"
            >
              Schema Score: {healthScore}/100
            </span>
          )}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 rounded-lg bg-signal-green/10 px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/20 transition disabled:opacity-50"
            data-testid="schema-scan-button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan My Website'}
          </button>
        </div>
      </div>

      {/* Last run */}
      {lastRunAt && (
        <p className="text-xs text-slate-500 mb-3" data-testid="schema-last-run">
          Last run: {formatRelativeTime(lastRunAt)}
        </p>
      )}

      {/* Empty state */}
      {pages.length === 0 && (
        <p className="text-sm text-slate-400">
          No schemas generated yet. Click &quot;Scan My Website&quot; to crawl your website and generate JSON-LD schemas.
        </p>
      )}

      {/* Page schema rows */}
      {pages.length > 0 && (
        <div className="space-y-2" data-testid="schema-page-list">
          {pages.map((page) => {
            const config = STATUS_CONFIG[page.status] ?? STATUS_CONFIG.draft;
            const Icon = config.icon;
            const isExpanded = expandedRow === page.id;
            const pageType = page.page_type as PageType;

            return (
              <div
                key={page.id}
                className={`rounded-lg border px-4 py-3 ${config.color}`}
                data-testid={`schema-row-${page.page_type}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm">
                      {PAGE_TYPE_ICONS[pageType] ?? ''}{' '}
                      <span className="font-medium">{PAGE_TYPE_LABELS[pageType] ?? page.page_type}</span>
                    </span>
                    <span className="text-xs opacity-70">
                      {page.schema_types.join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase">{config.label}</span>
                    {page.status === 'published' && page.public_url && (
                      <a
                        href={page.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs hover:underline"
                        data-testid={`schema-view-${page.page_type}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {page.status === 'pending_review' && (
                      <button
                        onClick={() => handleApprove(page.id)}
                        disabled={approving === page.id}
                        className="rounded bg-signal-green/20 px-2 py-0.5 text-xs font-medium text-signal-green hover:bg-signal-green/30 disabled:opacity-50"
                        data-testid={`schema-approve-${page.page_type}`}
                      >
                        {approving === page.id ? 'Approving...' : 'Approve'}
                      </button>
                    )}
                    {page.embed_snippet && (
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : page.id)}
                        className="text-xs hover:opacity-80"
                        data-testid={`schema-expand-${page.page_type}`}
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* AI-generated notice */}
                {page.status === 'pending_review' && page.missing_fields.includes('faqs_auto_generated') && (
                  <p className="mt-1 text-xs opacity-70">
                    AI-generated FAQs — please review before publishing
                  </p>
                )}

                {/* Expanded embed code */}
                {isExpanded && page.embed_snippet && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">Embed Code</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(page.embed_snippet!)}
                          className="flex items-center gap-1 text-xs hover:opacity-80"
                          data-testid={`schema-copy-${page.page_type}`}
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                        <button
                          onClick={() => setEmbedModal({
                            snippet: page.embed_snippet!,
                            pageType: PAGE_TYPE_LABELS[pageType] ?? page.page_type,
                            url: page.public_url ?? '',
                          })}
                          className="text-xs hover:opacity-80"
                          data-testid={`schema-modal-${page.page_type}`}
                        >
                          Full View
                        </button>
                      </div>
                    </div>
                    <pre className="rounded bg-black/30 p-2 text-[10px] leading-relaxed overflow-x-auto max-h-32 text-slate-300">
                      {page.embed_snippet}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-4 rounded-lg bg-white/3 border border-white/5 px-4 py-3" data-testid="schema-recommendations">
          <p className="text-xs font-medium text-slate-300 mb-2">
            Improve your schema score:
          </p>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-slate-400">
                → {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Embed modal */}
      {embedModal && (
        <SchemaEmbedModal
          isOpen
          onClose={() => setEmbedModal(null)}
          snippet={embedModal.snippet}
          pageType={embedModal.pageType}
          publicUrl={embedModal.url}
        />
      )}
    </div>
  );
}

function buildRecommendations(
  pages: SchemaStatusResponse['pages'],
): string[] {
  const recs: string[] = [];
  const publishedTypes = new Set(
    pages.filter((p) => p.status === 'published').map((p) => p.page_type),
  );
  const pendingTypes = pages.filter((p) => p.status === 'pending_review').map((p) => p.page_type);
  const failedTypes = pages.filter((p) => p.status === 'failed').map((p) => p.page_type);

  if (!publishedTypes.has('homepage')) {
    recs.push('Add homepage schema (biggest impact — AI citations start here)');
  }
  if (!publishedTypes.has('faq')) {
    recs.push('Create an FAQ page (top AI citation source for local businesses)');
  }
  if (!publishedTypes.has('about')) {
    recs.push('Add an About page (improves AI recognition of your brand)');
  }

  for (const pt of pendingTypes) {
    recs.push(`Approve your pending ${PAGE_TYPE_LABELS[pt as PageType] ?? pt} schema`);
  }
  for (const pt of failedTypes) {
    recs.push(`Fix your ${PAGE_TYPE_LABELS[pt as PageType] ?? pt} schema (retry generation)`);
  }

  return recs.slice(0, 3);
}
