'use client';

import { useTransition, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { generateCorrection, createCorrectionDraft } from '@/app/dashboard/actions/correction';
import type { CorrectionPackage, CorrectionAction } from '@/lib/services/correction-generator.service';

// ---------------------------------------------------------------------------
// Impact badge styles — literal Tailwind classes (AI_RULES §12)
// ---------------------------------------------------------------------------

const IMPACT_STYLES: Record<CorrectionAction['impact'], { badge: string; label: string }> = {
  high:   { badge: 'bg-signal-green/15 text-signal-green', label: 'HIGH' },
  medium: { badge: 'bg-amber-400/15 text-amber-400', label: 'MEDIUM' },
  low:    { badge: 'bg-indigo-400/15 text-indigo-400', label: 'LOW' },
};

// ---------------------------------------------------------------------------
// CorrectionPanel
// ---------------------------------------------------------------------------

interface CorrectionPanelProps {
  hallucinationId: string;
  canCreateDraft: boolean;
  onClose: () => void;
}

export default function CorrectionPanel({
  hallucinationId,
  canCreateDraft,
  onClose,
}: CorrectionPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pkg, setPkg] = useState<CorrectionPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [draftCreating, setDraftCreating] = useState(false);

  // ── Fetch correction package on mount ──────────────────────────────────────
  const loadCorrection = useCallback(() => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('hallucinationId', hallucinationId);
      const result = await generateCorrection(fd);
      if (result.success) {
        setPkg(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }, [hallucinationId]);

  // Auto-load on first render
  if (!pkg && !error && !isPending) {
    loadCorrection();
  }

  // ── Copy to clipboard ──────────────────────────────────────────────────────
  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Create draft ───────────────────────────────────────────────────────────
  const handleCreateDraft = async (contentType: string, title: string, content: string) => {
    setDraftCreating(true);
    const fd = new FormData();
    fd.set('hallucinationId', hallucinationId);
    fd.set('contentType', contentType);
    fd.set('title', title);
    fd.set('content', content);
    const result = await createCorrectionDraft(fd);
    setDraftCreating(false);
    if (result.success) {
      router.push('/dashboard/content-drafts');
    } else {
      setError(result.error);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="rounded-xl border border-white/10 bg-surface-dark p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Correction Package</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-sm">✕</button>
        </div>
        <div className="flex items-center gap-3 py-8 justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          <span className="text-sm text-slate-400">Generating correction…</span>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-alert-crimson/20 bg-surface-dark p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Correction Package</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-sm">✕</button>
        </div>
        <p className="text-sm text-alert-crimson">{error}</p>
      </div>
    );
  }

  if (!pkg) return null;

  // ── Success state ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-white/10 bg-surface-dark p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Correction Package</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-sm">✕</button>
      </div>

      {/* Diagnosis */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Diagnosis</h4>
        <p className="text-sm text-slate-300 leading-relaxed">{pkg.diagnosis}</p>
      </div>

      {/* Recommended Actions */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Recommended Actions</h4>
        <div className="space-y-2">
          {pkg.actions.map((action, i) => {
            const style = IMPACT_STYLES[action.impact];
            return (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-white/3 px-3 py-2.5">
                <span className="text-xs text-slate-600 tabular-nums mt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${style.badge}`}>
                      {style.label}
                    </span>
                    <span className="text-sm font-medium text-white">{action.title}</span>
                  </div>
                  <p className="text-xs text-slate-400">{action.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Preview */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Generated Content</h4>
        <div className="space-y-3">
          {/* GBP Post */}
          {pkg.content.gbpPost && (
            <ContentBlock
              label="GBP Post"
              content={pkg.content.gbpPost}
              copied={copied}
              onCopy={() => copyText(pkg.content.gbpPost!, 'gbp')}
              copyLabel="gbp"
              canCreateDraft={canCreateDraft}
              draftCreating={draftCreating}
              onCreateDraft={() =>
                handleCreateDraft(
                  'gbp_post',
                  `Correction: ${pkg.diagnosis.slice(0, 80)}`,
                  pkg.content.gbpPost!,
                )
              }
            />
          )}

          {/* Website Snippet */}
          {pkg.content.websiteSnippet && (
            <ContentBlock
              label="Website Snippet"
              content={pkg.content.websiteSnippet}
              copied={copied}
              onCopy={() => copyText(pkg.content.websiteSnippet!, 'website')}
              copyLabel="website"
            />
          )}

          {/* llms.txt Entry */}
          <ContentBlock
            label="llms.txt Entry"
            content={pkg.content.llmsTxtEntry}
            copied={copied}
            onCopy={() => copyText(pkg.content.llmsTxtEntry, 'llms')}
            copyLabel="llms"
          />

          {/* Social Post */}
          {pkg.content.socialPost && (
            <ContentBlock
              label="Social Post"
              content={pkg.content.socialPost}
              copied={copied}
              onCopy={() => copyText(pkg.content.socialPost!, 'social')}
              copyLabel="social"
            />
          )}
        </div>
      </div>

      {/* Copy All */}
      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <button
          onClick={() => {
            const all = [
              pkg.content.gbpPost ? `GBP Post:\n${pkg.content.gbpPost}` : '',
              pkg.content.websiteSnippet ? `Website Snippet:\n${pkg.content.websiteSnippet}` : '',
              `llms.txt Entry:\n${pkg.content.llmsTxtEntry}`,
              pkg.content.socialPost ? `Social Post:\n${pkg.content.socialPost}` : '',
            ]
              .filter(Boolean)
              .join('\n\n');
            copyText(all, 'all');
          }}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition"
        >
          {copied === 'all' ? 'Copied!' : 'Copy All to Clipboard'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentBlock — single content piece with copy + optional draft creation
// ---------------------------------------------------------------------------

function ContentBlock({
  label,
  content,
  copied,
  onCopy,
  copyLabel,
  canCreateDraft,
  draftCreating,
  onCreateDraft,
}: {
  label: string;
  content: string;
  copied: string | null;
  onCopy: () => void;
  copyLabel: string;
  canCreateDraft?: boolean;
  draftCreating?: boolean;
  onCreateDraft?: () => void;
}) {
  return (
    <div className="rounded-lg bg-white/3 px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          {onCreateDraft && (
            canCreateDraft ? (
              <button
                onClick={onCreateDraft}
                disabled={draftCreating}
                className="text-[10px] text-signal-green hover:text-signal-green/80 transition disabled:opacity-50"
              >
                {draftCreating ? 'Creating…' : 'Create Draft →'}
              </button>
            ) : (
              <span className="text-[10px] text-slate-600">Growth plan required</span>
            )
          )}
          <button onClick={onCopy} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition">
            {copied === copyLabel ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}
