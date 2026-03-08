'use client';

import { useState, useTransition } from 'react';
import type { MenuExtractedItem, MenuWorkspaceData } from '@/lib/types/menu';
import {
  approveAndPublish,
  enhanceMenuWithAI,
  acceptMenuEnhancements,
  dismissMenuEnhancements,
} from '../actions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReviewStateProps {
  menu: MenuWorkspaceData;
  onPublished: (publicSlug: string) => void;
}

// ---------------------------------------------------------------------------
// Confidence thresholds (Doc 06 §4)
// ---------------------------------------------------------------------------

const THRESH_AUTO   = 0.85;  // ≥ auto-approved, collapsed, emerald
const THRESH_REVIEW = 0.60;  // ≥ needs review, expanded, amber; < blocks publish

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidencePct(item: MenuExtractedItem) {
  return Math.round(item.confidence * 100);
}

type Tier = 'auto' | 'review' | 'blocked';

function getTier(item: MenuExtractedItem): Tier {
  if (item.confidence >= THRESH_AUTO)   return 'auto';
  if (item.confidence >= THRESH_REVIEW) return 'review';
  return 'blocked';
}

function hasAnySuggestion(item: MenuExtractedItem): boolean {
  return !!(item.ai_description || item.ai_name_correction);
}

// ---------------------------------------------------------------------------
// ConfidenceBadge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ item }: { item: MenuExtractedItem }) {
  const pct  = confidencePct(item);
  const tier = getTier(item);
  if (tier === 'auto') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-truth-emerald/15 px-2 py-0.5 text-xs font-semibold text-truth-emerald">
        ✓ {pct}%
      </span>
    );
  }
  if (tier === 'review') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
        ⚠ {pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-alert-crimson/15 px-2 py-0.5 text-xs font-semibold text-alert-crimson">
      ✗ {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// EnhancedBadge — shows when AI enhanced the item
// ---------------------------------------------------------------------------

function EnhancedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-electric-indigo/15 px-2 py-0.5 text-xs font-semibold text-electric-indigo">
      AI Enhanced
    </span>
  );
}

// ---------------------------------------------------------------------------
// AISuggestionCard — inline suggestion for a single item
// ---------------------------------------------------------------------------

function AISuggestionCard({
  item,
  onAccept,
  onDismiss,
  isPending,
}: {
  item: MenuExtractedItem;
  onAccept: (itemId: string) => void;
  onDismiss: (itemId: string) => void;
  isPending: boolean;
}) {
  if (!hasAnySuggestion(item) || item.ai_enhanced) return null;

  return (
    <div className="mt-2 rounded-lg bg-electric-indigo/5 border border-electric-indigo/20 px-3 py-2.5 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-electric-indigo">
        AI Suggestion
      </p>

      {/* Name correction */}
      {item.ai_name_correction && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Typo Fix</p>
          <p className="text-xs text-slate-300">
            <span className="line-through text-slate-500">{item.name}</span>
            {' → '}
            <span className="text-white font-medium">{item.ai_name_correction}</span>
          </p>
        </div>
      )}

      {/* Description suggestion */}
      {item.ai_description && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
            {item.description ? 'Better Description' : 'Description'}
          </p>
          {item.description && (
            <p className="text-xs text-slate-500 line-through">{item.description}</p>
          )}
          <p className="text-xs text-slate-300">{item.ai_description}</p>
        </div>
      )}

      {/* Accept / Dismiss */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={() => onAccept(item.id)}
          disabled={isPending}
          className="rounded-md bg-electric-indigo px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-electric-indigo/90 transition disabled:opacity-50"
        >
          Accept
        </button>
        <button
          onClick={() => onDismiss(item.id)}
          disabled={isPending}
          className="rounded-md bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ItemRow — single menu item in the triage list
// ---------------------------------------------------------------------------

function ItemRow({
  item,
  expanded,
  onAcceptSuggestion,
  onDismissSuggestion,
  isPending,
}: {
  item: MenuExtractedItem;
  expanded: boolean;
  onAcceptSuggestion: (itemId: string) => void;
  onDismissSuggestion: (itemId: string) => void;
  isPending: boolean;
}) {
  const tier = getTier(item);
  const borderClass =
    tier === 'auto'    ? 'border-l-truth-emerald' :
    tier === 'review'  ? 'border-l-amber-400'     :
                         'border-l-alert-crimson';

  return (
    <div
      className={[
        'rounded-xl bg-surface-dark border border-white/5 border-l-4 px-4 py-3',
        borderClass,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{item.name}</span>
            {item.price && (
              <span className="text-xs text-slate-400 tabular-nums">{item.price}</span>
            )}
            <span className="text-xs text-slate-500">· {item.category}</span>
            {item.ai_enhanced && <EnhancedBadge />}
          </div>
          {expanded && item.description && (
            <p className="mt-1 text-xs text-slate-400 leading-snug">{item.description}</p>
          )}
          {expanded && tier === 'blocked' && (
            <p className="mt-1.5 text-xs text-alert-crimson font-medium">
              Low confidence — verify or edit this item before publishing.
            </p>
          )}
          {expanded && tier === 'review' && !hasAnySuggestion(item) && (
            <p className="mt-1.5 text-xs text-amber-400">
              Please verify this item is accurate.
            </p>
          )}

          {/* AI suggestion inline */}
          {expanded && (
            <AISuggestionCard
              item={item}
              onAccept={onAcceptSuggestion}
              onDismiss={onDismissSuggestion}
              isPending={isPending}
            />
          )}
        </div>
        <ConfidenceBadge item={item} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TierSection — groups items under a tier heading
// ---------------------------------------------------------------------------

function TierSection({
  title,
  count,
  colorClass,
  children,
}: {
  title: string;
  count: number;
  colorClass: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="space-y-2">
      <p className={['text-xs font-semibold uppercase tracking-wide', colorClass].join(' ')}>
        {title} &mdash; {count} {count === 1 ? 'item' : 'items'}
      </p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewState
// ---------------------------------------------------------------------------

export default function ReviewState({ menu: initialMenu, onPublished }: ReviewStateProps) {
  const [menu, setMenu] = useState(initialMenu);
  const items = menu.extracted_data?.items ?? [];
  const [certified, setCertified] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnhancing, startEnhanceTransition] = useTransition();
  const [isPendingSuggestion, startSuggestionTransition] = useTransition();

  const autoItems    = items.filter((i) => getTier(i) === 'auto');
  const reviewItems  = items.filter((i) => getTier(i) === 'review');
  const blockedItems = items.filter((i) => getTier(i) === 'blocked');

  const hasEnhancements = items.some(hasAnySuggestion);
  const pendingSuggestions = items.filter((i) => hasAnySuggestion(i) && !i.ai_enhanced);
  const enhancedCount = items.filter((i) => i.ai_enhanced).length;

  const canPublish = blockedItems.length === 0 && certified;

  async function handlePublish() {
    setError(null);
    setIsPublishing(true);
    try {
      const result = await approveAndPublish(menu.id);
      if (result.success) {
        onPublished(result.publicSlug);
      } else {
        setError(result.error);
      }
    } finally {
      setIsPublishing(false);
    }
  }

  function handleEnhance() {
    setError(null);
    startEnhanceTransition(async () => {
      const result = await enhanceMenuWithAI(menu.id);
      if (result.success) {
        setMenu(result.menu);
      } else {
        setError(result.error);
      }
    });
  }

  function handleAcceptSuggestion(itemId: string) {
    startSuggestionTransition(async () => {
      const result = await acceptMenuEnhancements(menu.id, [itemId]);
      if (result.success) setMenu(result.menu);
    });
  }

  function handleDismissSuggestion(itemId: string) {
    startSuggestionTransition(async () => {
      const result = await dismissMenuEnhancements(menu.id, [itemId]);
      if (result.success) setMenu(result.menu);
    });
  }

  function handleAcceptAll() {
    const ids = pendingSuggestions.map((i) => i.id);
    if (ids.length === 0) return;
    startSuggestionTransition(async () => {
      const result = await acceptMenuEnhancements(menu.id, ids);
      if (result.success) setMenu(result.menu);
    });
  }

  function handleDismissAll() {
    const ids = pendingSuggestions.map((i) => i.id);
    if (ids.length === 0) return;
    startSuggestionTransition(async () => {
      const result = await dismissMenuEnhancements(menu.id, ids);
      if (result.success) setMenu(result.menu);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">

      {/* ── Left pane: item triage ──────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-5">

        {/* AI extraction summary */}
        <div className="rounded-2xl bg-surface-dark border border-white/5 px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              AI Extraction Results
            </h2>
            <span className="text-xs text-slate-400 tabular-nums">
              {items.length} items · avg{' '}
              {menu.extraction_confidence !== null
                ? `${Math.round(menu.extraction_confidence * 100)}% confidence`
                : 'n/a'}
            </span>
          </div>
          {menu.extracted_data?.extracted_at && (
            <p className="mt-0.5 text-xs text-slate-500">
              Extracted{' '}
              {new Date(menu.extracted_data.extracted_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        {/* AI Enhancement banner — bulk actions when suggestions exist */}
        {pendingSuggestions.length > 0 && (
          <div className="rounded-2xl bg-electric-indigo/5 border border-electric-indigo/20 px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-electric-indigo">
                  AI Suggestions Ready
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pendingSuggestions.length} {pendingSuggestions.length === 1 ? 'item has' : 'items have'} AI-generated improvements.
                  Review each below or use bulk actions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAcceptAll}
                  disabled={isPendingSuggestion}
                  className="rounded-lg bg-electric-indigo px-3 py-1.5 text-xs font-semibold text-white hover:bg-electric-indigo/90 transition disabled:opacity-50"
                >
                  Accept All
                </button>
                <button
                  onClick={handleDismissAll}
                  disabled={isPendingSuggestion}
                  className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
                >
                  Dismiss All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Blocked tier */}
        <TierSection
          title="Must Edit"
          count={blockedItems.length}
          colorClass="text-alert-crimson"
        >
          {blockedItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              expanded
              onAcceptSuggestion={handleAcceptSuggestion}
              onDismissSuggestion={handleDismissSuggestion}
              isPending={isPendingSuggestion}
            />
          ))}
        </TierSection>

        {/* Needs-review tier */}
        <TierSection
          title="Needs Review"
          count={reviewItems.length}
          colorClass="text-amber-400"
        >
          {reviewItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              expanded
              onAcceptSuggestion={handleAcceptSuggestion}
              onDismissSuggestion={handleDismissSuggestion}
              isPending={isPendingSuggestion}
            />
          ))}
        </TierSection>

        {/* Auto-approved tier */}
        <TierSection
          title="Auto-Approved"
          count={autoItems.length}
          colorClass="text-truth-emerald"
        >
          {autoItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              expanded={false}
              onAcceptSuggestion={handleAcceptSuggestion}
              onDismissSuggestion={handleDismissSuggestion}
              isPending={isPendingSuggestion}
            />
          ))}
        </TierSection>

        {items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            No items were extracted. Try re-running the AI parse.
          </p>
        )}
      </div>

      {/* ── Right pane: enhance + publish actions ──────────────────── */}
      <div className="space-y-4">

        {/* AI Enhance card */}
        <div className="rounded-2xl bg-surface-dark border border-white/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            AI Enhancement
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            AI will generate descriptions for items missing them, fix typos in names,
            and suggest improved descriptions — all reviewable before publishing.
          </p>
          {enhancedCount > 0 && (
            <p className="text-xs text-electric-indigo">
              {enhancedCount} {enhancedCount === 1 ? 'item' : 'items'} enhanced
            </p>
          )}
          <button
            onClick={handleEnhance}
            disabled={isEnhancing || items.length === 0}
            className={[
              'w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition',
              !isEnhancing && items.length > 0
                ? 'bg-electric-indigo/10 text-electric-indigo border border-electric-indigo/20 hover:bg-electric-indigo/20'
                : 'bg-white/5 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            {isEnhancing ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon />
                Enhancing with AI&hellip;
              </span>
            ) : hasEnhancements ? (
              'Re-enhance with AI'
            ) : (
              'Enhance with AI'
            )}
          </button>
        </div>

        {/* Triage summary card */}
        <div className="rounded-2xl bg-surface-dark border border-white/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Triage Summary
          </p>
          <div className="space-y-1.5">
            <SummaryRow
              label="Auto-approved"
              count={autoItems.length}
              colorClass="text-truth-emerald"
            />
            <SummaryRow
              label="Needs review"
              count={reviewItems.length}
              colorClass="text-amber-400"
            />
            <SummaryRow
              label="Must edit"
              count={blockedItems.length}
              colorClass="text-alert-crimson"
            />
          </div>
        </div>

        {/* Certification + publish */}
        <div className="rounded-2xl bg-surface-dark border border-white/5 p-4 space-y-4">
          {/* Blocked warning */}
          {blockedItems.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-alert-crimson/10 border border-alert-crimson/20 px-3 py-2.5">
              <span className="text-alert-crimson text-xs shrink-0 mt-px">✗</span>
              <p className="text-xs text-alert-crimson">
                Fix {blockedItems.length} low-confidence{' '}
                {blockedItems.length === 1 ? 'item' : 'items'} before publishing.
              </p>
            </div>
          )}

          {/* Certification checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className={[
                  'h-4 w-4 rounded border transition',
                  certified
                    ? 'bg-electric-indigo border-electric-indigo'
                    : 'border-white/20 bg-white/5 group-hover:border-white/40',
                ].join(' ')}
              >
                {certified && (
                  <svg
                    className="absolute inset-0 h-4 w-4 text-white"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M13.5 4.5 7 11 3.5 7.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-slate-400 leading-relaxed">
              I certify this menu is accurate. AI engines will use this data to
              answer questions about my business.
            </span>
          </label>

          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={!canPublish || isPublishing}
            className={[
              'w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition',
              canPublish && !isPublishing
                ? 'bg-electric-indigo text-white hover:bg-electric-indigo/90'
                : 'bg-white/5 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            {isPublishing ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon />
                Publishing&hellip;
              </span>
            ) : (
              'Approve All & Publish to AI'
            )}
          </button>

          {error && (
            <p className="text-xs text-alert-crimson text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryRow + SpinnerIcon
// ---------------------------------------------------------------------------

function SummaryRow({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={['text-xs font-bold tabular-nums', colorClass].join(' ')}>
        {count}
      </span>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
