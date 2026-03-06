// ---------------------------------------------------------------------------
// WeeklyKPIChips — 3 horizontal at-a-glance status pills
//
// Lets a restaurant owner scan their three key numbers in under 2 seconds
// without clicking into any sub-page.
//
// Chips (left → right):
//   1. AI Accuracy  — derived from open hallucination count
//   2. AI Visibility — derived from visibilityScore (SOV %)
//   3. AI Crawlers  — derived from crawler blind-spot count
//
// Each chip is a full-click Link so everything is actionable.
// Staggered slide-up entry via lv-chip-enter (globals.css).
// Pure server component — animation is applied via CSS inline style.
// ---------------------------------------------------------------------------

import Link from 'next/link';
import type { CrawlerSummary } from '@/lib/data/crawler-analytics';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WeeklyKPIChipsProps {
  openAlertCount: number;
  visibilityScore: number | null;
  crawlerSummary: CrawlerSummary | null;
}

type ChipStatus = 'good' | 'warn' | 'bad' | 'neutral';

interface Chip {
  icon:   string;
  label:  string;
  value:  string;
  hint:   string;
  status: ChipStatus;
  href:   string;
}

// ─── Style map ──────────────────────────────────────────────────────────────

const STATUS: Record<ChipStatus, { border: string; bg: string; text: string; icon: string }> = {
  good:    { border: 'border-truth-emerald/25',  bg: 'bg-truth-emerald/5',  text: 'text-truth-emerald',  icon: 'text-truth-emerald'  },
  warn:    { border: 'border-alert-amber/25',    bg: 'bg-alert-amber/5',    text: 'text-alert-amber',    icon: 'text-alert-amber'    },
  bad:     { border: 'border-alert-crimson/25',  bg: 'bg-alert-crimson/5',  text: 'text-alert-crimson',  icon: 'text-alert-crimson'  },
  neutral: { border: 'border-white/8',           bg: 'bg-white/[0.02]',     text: 'text-slate-400',      icon: 'text-slate-500'      },
};

// ─── Chip derivation ─────────────────────────────────────────────────────────

function buildChips(
  openAlertCount: number,
  visibilityScore: number | null,
  crawlerSummary: CrawlerSummary | null,
): Chip[] {
  // ── Chip 1: AI Accuracy ─────────────────────────────────────────────────
  const accuracy: Chip =
    openAlertCount === 0
      ? { icon: '✓', label: 'AI Accuracy',   value: 'All Clear',                     hint: 'No wrong facts found', status: 'good',    href: '/dashboard/hallucinations' }
      : openAlertCount <= 2
        ? { icon: '⚠', label: 'AI Accuracy', value: `${openAlertCount} issue${openAlertCount > 1 ? 's' : ''}`, hint: 'Fix soon',          status: 'warn',    href: '/dashboard/hallucinations' }
        : { icon: '!', label: 'AI Accuracy', value: `${openAlertCount} issues`,       hint: 'Needs attention',      status: 'bad',     href: '/dashboard/hallucinations' };

  // ── Chip 2: AI Visibility (SOV) ─────────────────────────────────────────
  const visibility: Chip =
    visibilityScore === null
      ? { icon: '⟳', label: 'AI Visibility', value: 'Pending',    hint: 'First scan coming', status: 'neutral', href: '/dashboard/share-of-voice' }
      : visibilityScore >= 70
        ? { icon: '↑', label: 'AI Visibility', value: `${visibilityScore}%`, hint: 'Strong presence',   status: 'good',    href: '/dashboard/share-of-voice' }
        : visibilityScore >= 40
          ? { icon: '~', label: 'AI Visibility', value: `${visibilityScore}%`, hint: 'Room to grow',      status: 'warn',    href: '/dashboard/share-of-voice' }
          : { icon: '↓', label: 'AI Visibility', value: `${visibilityScore}%`, hint: 'Low — needs work',  status: 'bad',     href: '/dashboard/share-of-voice' };

  // ── Chip 3: AI Crawlers ──────────────────────────────────────────────────
  const blindSpots   = crawlerSummary?.blindSpotCount ?? 0;
  const activeCount  = (crawlerSummary?.bots ?? []).filter((b) => b.status === 'active').length;

  const crawlers: Chip =
    crawlerSummary === null
      ? { icon: '⟳', label: 'AI Crawlers',    value: 'No data yet', hint: 'Awaiting first visit',  status: 'neutral', href: '/dashboard/crawler-analytics' }
      : blindSpots === 0
        ? { icon: '🤖', label: 'AI Crawlers',  value: `${activeCount} visiting`, hint: 'All bots have access',  status: 'good',    href: '/dashboard/crawler-analytics' }
        : { icon: '🚫', label: 'AI Crawlers',  value: `${blindSpots} blocked`,   hint: 'Fix bot access',        status: 'warn',    href: '/dashboard/crawler-analytics' };

  return [accuracy, visibility, crawlers];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function WeeklyKPIChips({
  openAlertCount,
  visibilityScore,
  crawlerSummary,
}: WeeklyKPIChipsProps) {
  const chips = buildChips(openAlertCount, visibilityScore, crawlerSummary);

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      role="list"
      aria-label="Weekly status overview"
    >
      {chips.map((chip, i) => {
        const cls = STATUS[chip.status];
        return (
          <Link
            key={chip.label}
            href={chip.href}
            role="listitem"
            className={`group flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-indigo ${cls.border} ${cls.bg}`}
            style={{
              animation: `lv-chip-enter 0.55s cubic-bezier(.16,1,.3,1) ${i * 80}ms both`,
            }}
            aria-label={`${chip.label}: ${chip.value} — ${chip.hint}`}
          >
            {/* Icon */}
            <span
              className={`shrink-0 text-xl leading-none ${cls.icon}`}
              aria-hidden="true"
            >
              {chip.icon}
            </span>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500"
                style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
              >
                {chip.label}
              </p>
              <p className={`truncate text-sm font-bold leading-tight ${cls.text}`}>
                {chip.value}
              </p>
              <p className="truncate text-[10px] text-slate-500">{chip.hint}</p>
            </div>

            {/* Hover arrow */}
            <span
              className="shrink-0 text-slate-600 transition-colors group-hover:text-slate-300"
              aria-hidden="true"
            >
              ›
            </span>
          </Link>
        );
      })}
    </div>
  );
}
