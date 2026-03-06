'use client';

// ---------------------------------------------------------------------------
// PulseScoreOrb — Hero AI Health Score visualization
//
// Replaces the compact AIVisibilityPanel ring gauge with a full-bleed hero
// that communicates score at a glance through:
//
//   • Count-up animation 0 → score on mount (rAF + easeOutQuint, 1400ms)
//   • Three concentric ping rings staggered 0 / 700 / 1400ms  (lv-ping)
//   • Ambient radial glow that breathes behind the orb (lv-orb-breathe)
//   • Brief glow-flash when count-up finishes (lv-count-flash)
//   • Streak badge when score improved 2+ consecutive weeks
//   • Plain-English grade: "All Clear" / "Some Issues" / "Needs Attention"
//   • Benchmark delta vs city average (when ≥10 orgs in sample)
//
// Design system:
//   signal-green ≥80 · alert-amber 60–79 · alert-crimson <60
//   JetBrains Mono for score number  ·  Outfit for labels
//   keyframes from globals.css — none added here
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import type { BenchmarkData } from '@/lib/data/benchmarks';
import type { RealityScoreTrendPoint } from '@/lib/data/dashboard';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PulseScoreOrbProps {
  score: number | null;
  previousScore: number | null;
  /** From visibility_scores — most-recent last */
  trend: RealityScoreTrendPoint[] | null;
  orgCity: string | null;
  benchmark: BenchmarkData | null;
}

type ScoreColor = 'green' | 'amber' | 'red';

// ─── Design constants ────────────────────────────────────────────────────────

interface ColorConfig {
  ringRgba:   string;   // for border / glow rings
  glowFull:   string;   // for text-shadow (full opacity)
  textHex:    string;   // direct hex for inline style
  grade:      string;
  gradeClass: string;
}

const COLOR: Record<ScoreColor, ColorConfig> = {
  green: {
    ringRgba:   'rgba(0,245,160,0.45)',
    glowFull:   'rgba(0,245,160,1)',
    textHex:    '#00F5A0',
    grade:      'All Clear',
    gradeClass: 'text-signal-green',
  },
  amber: {
    ringRgba:   'rgba(255,184,0,0.45)',
    glowFull:   'rgba(255,184,0,1)',
    textHex:    '#FFB800',
    grade:      'Some Issues',
    gradeClass: 'text-alert-amber',
  },
  red: {
    ringRgba:   'rgba(239,68,68,0.45)',
    glowFull:   'rgba(239,68,68,1)',
    textHex:    '#ef4444',
    grade:      'Needs Attention',
    gradeClass: 'text-alert-crimson',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getScoreColor(score: number): ScoreColor {
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'red';
}

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/** Count how many consecutive weeks the score improved (most-recent streak). */
function calcStreak(trend: RealityScoreTrendPoint[] | null): number {
  if (!trend || trend.length < 2) return 0;
  let streak = 0;
  for (let i = trend.length - 1; i > 0; i--) {
    if (trend[i].score > trend[i - 1].score) streak++;
    else break;
  }
  return streak;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PulseScoreOrb({
  score,
  previousScore,
  trend,
  orgCity,
  benchmark,
}: PulseScoreOrbProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [flash, setFlash]               = useState(false);
  const rafRef   = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // Count-up animation: 0 → score over 1400 ms, then brief glow flash
  useEffect(() => {
    if (score === null) return;
    const target   = score;
    const duration = 1400;
    startRef.current = null;

    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed  = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayScore(Math.round(easeOutQuint(progress) * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setFlash(true);
        setTimeout(() => setFlash(false), 700);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [score]);

  // ── Derived values ──────────────────────────────────────────────────────
  const color  = score !== null ? getScoreColor(score) : 'amber';
  const cfg    = COLOR[color];
  const delta  = score !== null && previousScore !== null ? score - previousScore : null;
  const streak = calcStreak(trend);

  const benchmarkReady = benchmark && benchmark.org_count >= 10;
  const benchmarkDiff  =
    benchmarkReady && score !== null ? Math.round(score - benchmark.avg_score) : null;

  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-surface-dark px-6 py-10"
      data-testid="pulse-score-orb"
    >
      {/* ── Ambient breathing glow — behind everything ─────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 65% 55% at 50% 50%, ${cfg.ringRgba} 0%, transparent 70%)`,
          animation: 'lv-orb-breathe 4.5s ease-in-out infinite',
        }}
      />

      {/* ── Orb ────────────────────────────────────────────────────────── */}
      <div
        className="relative flex h-40 w-40 items-center justify-center"
        role="img"
        aria-label={`AI Health Score: ${score !== null ? score : 'not yet available'}`}
      >
        {/* Three expanding ping rings */}
        {score !== null &&
          ([0, 700, 1400] as const).map((delay) => (
            <span
              key={delay}
              className="absolute inset-0 rounded-full"
              aria-hidden="true"
              style={{
                border:    `1.5px solid ${cfg.ringRgba}`,
                animation: `lv-ping 2.6s cubic-bezier(0,0,0.2,1) ${delay}ms infinite`,
              }}
            />
          ))}

        {/* Static base ring */}
        <span
          className="absolute inset-0 rounded-full"
          aria-hidden="true"
          style={{ border: `2px solid ${cfg.ringRgba.replace('0.45)', '0.18)')}` }}
        />

        {/* Score number */}
        <span
          className="relative select-none text-6xl font-bold tabular-nums"
          aria-live="polite"
          style={{
            fontFamily:  'var(--font-jetbrains-mono, monospace)',
            color:       score !== null ? cfg.textHex : '#475569',
            textShadow:  score !== null && flash
              ? `0 0 32px ${cfg.glowFull}`
              : score !== null
                ? `0 0 20px ${cfg.ringRgba}`
                : 'none',
            transition: 'text-shadow 0.4s ease',
          }}
        >
          {score !== null ? displayScore : '—'}
        </span>
      </div>

      {/* ── Grade label ─────────────────────────────────────────────────── */}
      <p
        className={`mt-4 text-sm font-semibold tracking-wide ${cfg.gradeClass}`}
        aria-live="polite"
      >
        {score !== null ? cfg.grade : 'Scanning…'}
      </p>

      <p className="mt-0.5 text-xs uppercase tracking-widest text-slate-500"
         style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>
        AI Health Score
      </p>

      {/* ── Delta + streak row ──────────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-3">
        {delta !== null && (
          <span
            className={`text-xs font-semibold ${
              delta > 0 ? 'text-truth-emerald' : delta < 0 ? 'text-alert-crimson' : 'text-slate-400'
            }`}
            aria-label={`${delta > 0 ? 'Up' : delta < 0 ? 'Down' : 'No change'} ${Math.abs(delta)} points from last week`}
          >
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '●'} {delta > 0 ? '+' : ''}{delta} pts this week
          </span>
        )}

        {streak >= 2 && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-signal-green/10 px-2.5 py-0.5 text-[10px] font-bold text-signal-green ring-1 ring-signal-green/25"
            title={`Your score has improved for ${streak} consecutive weeks`}
          >
            🔥 {streak}-wk streak
          </span>
        )}
      </div>

      {/* ── Benchmark ───────────────────────────────────────────────────── */}
      {benchmarkReady && benchmarkDiff !== null && (
        <p
          className="mt-2 text-xs text-slate-400"
          data-testid="orb-benchmark"
        >
          {benchmarkDiff > 0
            ? `${benchmarkDiff} pts above ${orgCity ?? 'city'} avg`
            : benchmarkDiff < 0
              ? `${Math.abs(benchmarkDiff)} pts below ${orgCity ?? 'city'} avg`
              : `At ${orgCity ?? 'city'} average`}
        </p>
      )}

      {!benchmarkReady && score !== null && (
        <p className="mt-2 text-xs text-slate-500" data-testid="orb-benchmark">
          Building city benchmark…
        </p>
      )}
    </div>
  );
}
