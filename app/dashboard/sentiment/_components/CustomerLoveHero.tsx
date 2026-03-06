// ---------------------------------------------------------------------------
// CustomerLoveHero — S2 Reputation hero
//
// Pure server component. No state or effects — CSS animations only.
//
// Transforms the raw sentiment score into an instantly readable "warmth meter":
//   • Full-bleed gradient bar (crimson → amber → signal-green) with a glowing
//     cursor at the exact score position — owner knows where they stand in 1s
//   • lv-ping rings + lv-heartbeat on the cursor = living, breathing score
//   • Ambient lv-orb-breathe glow in the vibe color behind the header
//   • lv-scan accent sweep on top edge (consistent with CoachBriefCard)
//   • Plain-English grade: "Loved" / "Getting There" / "Needs Care"
//   • Staggered lv-chip-enter on the top positive word tags
//   • Week-over-week plain-English delta badge ("▲ Improving this week")
//   • Compact per-engine mood row — colored dots + name, no scores shown
//   • Inline InfoTooltip — no jargon, plain owner language
//   • Coaching action CTA only appears when not "Loved"
//
// Score scale: averageScore is [-1, 1] from sentiment engine.
//   > 0.3  → Loved
//   -0.3 to 0.3 → Getting There
//   < -0.3 → Needs Care
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { SentimentSummary } from '@/lib/services/sentiment.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerLoveHeroProps {
  summary: SentimentSummary;
  trend: Array<{ weekStart: string; averageScore: number; evaluationCount: number }>;
}

type VibeKey = 'loved' | 'getting-there' | 'needs-care';

// ─── Design constants ─────────────────────────────────────────────────────────

const ENGINE_NAME: Record<string, string> = {
  perplexity: 'Perplexity',
  openai:     'ChatGPT',
  google:     'Google AI',
  copilot:    'Copilot',
};

interface VibeCfg {
  grade:      string;
  coachLine:  string;
  ringRgba:   string;
  textHex:    string;
  glowRgba:   string;
}

const VIBE: Record<VibeKey, VibeCfg> = {
  'loved': {
    grade:     'Loved',
    coachLine: 'AI apps speak warmly about your restaurant — keep it up.',
    ringRgba:  'rgba(0,245,160,0.45)',
    textHex:   '#00F5A0',
    glowRgba:  'rgba(0,245,160,0.10)',
  },
  'getting-there': {
    grade:     'Getting There',
    coachLine: 'Most AI apps are neutral — a few updates can tip the balance.',
    ringRgba:  'rgba(255,184,0,0.45)',
    textHex:   '#FFB800',
    glowRgba:  'rgba(255,184,0,0.10)',
  },
  'needs-care': {
    grade:     'Needs Care',
    coachLine: 'AI apps describe you negatively — this shapes how customers feel before they visit.',
    ringRgba:  'rgba(239,68,68,0.45)',
    textHex:   '#ef4444',
    glowRgba:  'rgba(239,68,68,0.10)',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVibeKey(score: number): VibeKey {
  if (score > 0.3)  return 'loved';
  if (score >= -0.3) return 'getting-there';
  return 'needs-care';
}

function engineDotHex(score: number): string {
  if (score > 0.3)  return '#00F5A0';
  if (score >= -0.3) return '#FFB800';
  return '#ef4444';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerLoveHero({ summary, trend }: CustomerLoveHeroProps) {
  const avg  = summary.averageScore;
  const vibe = getVibeKey(avg);
  const cfg  = VIBE[vibe];

  // Map [-1, 1] → [6, 94] % so cursor stays visible at extremes
  const pct = Math.max(6, Math.min(94, Math.round(((avg + 1) / 2) * 100)));

  // Week-over-week delta (plain language, no raw numbers)
  const delta = trend.length >= 2
    ? trend[trend.length - 1].averageScore - trend[trend.length - 2].averageScore
    : null;

  const deltaLabel =
    delta === null      ? null
    : delta >  0.05  ? '▲ Improving this week'
    : delta < -0.05  ? '▼ Declining this week'
    : '● Stable this week';

  const deltaCls =
    delta === null      ? ''
    : delta >  0.05  ? 'bg-signal-green/10 ring-signal-green/25 text-signal-green'
    : delta < -0.05  ? 'bg-alert-crimson/10 ring-alert-crimson/25 text-alert-crimson'
    : 'bg-white/5 ring-white/10 text-slate-400';

  // Top 4 positive words for the chip cloud
  const wordChips = summary.topPositive.slice(0, 4);

  // Per-engine mood row (best → worst)
  const engines = Object.entries(summary.byEngine)
    .sort(([, a], [, b]) => b.averageScore - a.averageScore)
    .slice(0, 4);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-6"
      data-testid="customer-love-hero"
    >
      {/* ── lv-scan accent sweep on top edge ─────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-2xl"
        aria-hidden="true"
      >
        <div
          className="h-full w-1/3"
          style={{
            background: `linear-gradient(to right, transparent, ${cfg.textHex}, transparent)`,
            animation: 'lv-scan 4s linear infinite',
          }}
        />
      </div>

      {/* ── Ambient breathing glow (emotion color) ───────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 15% 55%, ${cfg.glowRgba} 0%, transparent 70%)`,
          animation: 'lv-orb-breathe 5s ease-in-out infinite',
        }}
      />

      {/* ── Header: label + grade + coach line ───────────────────────── */}
      <div className="relative flex items-start justify-between mb-7">
        <div>
          {/* Label + tooltip */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <p
              className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              Reputation Score
            </p>
            <InfoTooltip
              content={
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">What is Reputation Score?</p>
                  <p className="text-xs text-slate-300">
                    When someone asks ChatGPT or Google about restaurants near them,
                    this is how warmly AI talks about yours. Positive language builds
                    trust before a customer ever visits.
                  </p>
                  <p className="text-xs text-slate-400">
                    Fix wrong facts (hours, address, prices) to quickly improve how AI describes you.
                  </p>
                </div>
              }
            />
          </div>

          {/* Grade — big, instant read */}
          <p
            className="text-4xl font-bold leading-none tracking-tight"
            style={{ color: cfg.textHex, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            {cfg.grade}
          </p>
          <p className="mt-2 text-sm text-slate-400 max-w-xs leading-snug">
            {cfg.coachLine}
          </p>
        </div>

        {/* Delta badge — top-right, plain language */}
        {deltaLabel && (
          <span
            className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${deltaCls}`}
          >
            {deltaLabel}
          </span>
        )}
      </div>

      {/* ── Warmth bar ───────────────────────────────────────────────── */}
      <div className="relative mb-2" role="img" aria-label={`Reputation warmth: ${cfg.grade}`}>
        {/* Gradient track */}
        <div
          className="relative h-3 w-full rounded-full"
          style={{
            background: 'linear-gradient(to right, #ef4444 0%, #FFB800 48%, #00F5A0 100%)',
          }}
        >
          {/* Cursor — anchored at score position */}
          <div
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pct}%` }}
          >
            {/* Ping ring 1 */}
            <span
              className="absolute inset-0 rounded-full"
              aria-hidden="true"
              style={{
                border: `1.5px solid ${cfg.ringRgba}`,
                animation: 'lv-ping 2.4s cubic-bezier(0,0,0.2,1) 0ms infinite',
              }}
            />
            {/* Ping ring 2 — offset */}
            <span
              className="absolute inset-0 rounded-full"
              aria-hidden="true"
              style={{
                border: `1.5px solid ${cfg.ringRgba}`,
                animation: 'lv-ping 2.4s cubic-bezier(0,0,0.2,1) 900ms infinite',
              }}
            />
            {/* Cursor dot — heartbeat pulse */}
            <span
              className="absolute inset-0 rounded-full border-2 border-surface-dark"
              aria-hidden="true"
              style={{
                background:  cfg.textHex,
                boxShadow:   `0 0 12px ${cfg.ringRgba}, 0 0 28px ${cfg.glowRgba}`,
                animation:   'lv-heartbeat 2.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* Zone labels */}
        <div
          className="mt-2 flex justify-between text-[10px] select-none"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
        >
          <span className="text-alert-crimson/60">Unfavorable</span>
          <span className="text-slate-500">Neutral</span>
          <span className="text-signal-green/60">Glowing</span>
        </div>
      </div>

      {/* ── Positive word cloud ───────────────────────────────────────── */}
      {wordChips.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2" aria-label="Top positive words AI uses">
          <span
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 self-center mr-1"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            AI says:
          </span>
          {wordChips.map((word, i) => (
            <span
              key={word}
              className="inline-flex items-center rounded-full bg-signal-green/10 px-3 py-1 text-xs font-semibold text-signal-green ring-1 ring-signal-green/20"
              style={{
                animation: `lv-chip-enter 0.5s cubic-bezier(.16,1,.3,1) ${80 + i * 80}ms both`,
              }}
            >
              {word}
            </span>
          ))}
        </div>
      )}

      {/* ── Engine mood row ───────────────────────────────────────────── */}
      {engines.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            By app:
          </span>
          {engines.map(([engine, data]) => (
            <div key={engine} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: engineDotHex(data.averageScore) }}
                aria-hidden="true"
              />
              <span className="text-xs text-slate-300">
                {ENGINE_NAME[engine] ?? engine}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Coaching CTA — only for non-Loved states ──────────────────── */}
      {vibe !== 'loved' && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-white/5 bg-midnight-slate/60 px-4 py-3">
          <p className="text-xs text-slate-400 leading-snug">
            Wrong hours, prices, or facts are the fastest path to negative AI descriptions.
          </p>
          <Link
            href="/dashboard/hallucinations"
            className="ml-4 shrink-0 text-xs font-semibold text-signal-green hover:underline"
          >
            Fix now →
          </Link>
        </div>
      )}
    </div>
  );
}
