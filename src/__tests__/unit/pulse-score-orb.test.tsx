// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/pulse-score-orb.test.tsx — Coaching Transformation
//
// Unit tests for PulseScoreOrb — the client-component AI Health Score
// visualization on the main dashboard.
//
// This component uses:
//   • requestAnimationFrame for count-up animation
//   • setTimeout for flash effect
//   • useEffect + useState for derived display state
//
// Strategy: mock rAF to resolve synchronously, advance timers as needed.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── RAF mock ─────────────────────────────────────────────────────────────────
// Use a no-op RAF that registers requests but never fires callbacks.
// The component's count-up animation (displayScore) stays at 0, but all
// tested content — grades, delta badge, streak, benchmark — derives from
// props and renders synchronously, so no animation is needed in tests.

const originalRAF = globalThis.requestAnimationFrame;
const originalCAF = globalThis.cancelAnimationFrame;

beforeEach(() => {
  let rafId = 0;
  globalThis.requestAnimationFrame = (_cb: FrameRequestCallback) => {
    return ++rafId;
  };
  globalThis.cancelAnimationFrame = vi.fn();
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;
});

// ── Component import ──────────────────────────────────────────────────────────

import PulseScoreOrb from '@/app/dashboard/_components/PulseScoreOrb';

// ── Helpers ───────────────────────────────────────────────────────────────────

const baseProps = {
  score: null,
  previousScore: null,
  trend: null,
  orgCity: null,
  benchmark: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// PulseScoreOrb
// ═══════════════════════════════════════════════════════════════════════════

describe('PulseScoreOrb', () => {
  it('renders data-testid="pulse-score-orb"', () => {
    render(<PulseScoreOrb {...baseProps} />);
    expect(screen.getByTestId('pulse-score-orb')).toBeDefined();
  });

  it('shows "—" and "Scanning…" when score is null', () => {
    render(<PulseScoreOrb {...baseProps} />);
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.getByText('Scanning…')).toBeDefined();
  });

  it('shows "All Clear" grade for score >= 80', () => {
    render(<PulseScoreOrb {...baseProps} score={85} />);
    expect(screen.getByText('All Clear')).toBeDefined();
  });

  it('shows "Some Issues" grade for score 60-79', () => {
    render(<PulseScoreOrb {...baseProps} score={70} />);
    expect(screen.getByText('Some Issues')).toBeDefined();
  });

  it('shows "Needs Attention" grade for score < 60', () => {
    render(<PulseScoreOrb {...baseProps} score={45} />);
    expect(screen.getByText('Needs Attention')).toBeDefined();
  });

  it('has correct aria-label on the orb with the score', () => {
    render(<PulseScoreOrb {...baseProps} score={82} />);
    const orb = screen.getByRole('img');
    expect(orb.getAttribute('aria-label')).toContain('82');
  });

  it('shows aria-label "not yet available" when score is null', () => {
    render(<PulseScoreOrb {...baseProps} />);
    const orb = screen.getByRole('img');
    expect(orb.getAttribute('aria-label')).toContain('not yet available');
  });

  it('shows positive delta text when score improved', () => {
    render(<PulseScoreOrb {...baseProps} score={75} previousScore={68} />);
    expect(screen.getByText(/\+7 pts this week/)).toBeDefined();
  });

  it('shows negative delta text when score dropped', () => {
    render(<PulseScoreOrb {...baseProps} score={60} previousScore={70} />);
    expect(screen.getByText(/-10 pts this week/)).toBeDefined();
  });

  it('shows streak badge for 2+ consecutive improving weeks', () => {
    const trend = [
      { score: 60, recorded_at: '2026-02-15' },
      { score: 65, recorded_at: '2026-02-22' },
      { score: 72, recorded_at: '2026-03-01' },
    ];
    render(<PulseScoreOrb {...baseProps} score={72} trend={trend as never} />);
    expect(screen.getByText(/2-wk streak/)).toBeDefined();
  });

  it('does NOT show streak badge for non-improving trend', () => {
    const trend = [
      { score: 70, recorded_at: '2026-02-22' },
      { score: 65, recorded_at: '2026-03-01' },
    ];
    render(<PulseScoreOrb {...baseProps} score={65} trend={trend as never} />);
    expect(screen.queryByText(/wk streak/)).toBeNull();
  });

  it('shows benchmark comparison when org_count >= 10', () => {
    const benchmark = { avg_score: 70, org_count: 15, city: 'Austin' };
    render(<PulseScoreOrb {...baseProps} score={80} orgCity="Austin" benchmark={benchmark as never} />);
    const benchmarkEl = screen.getByTestId('orb-benchmark');
    expect(benchmarkEl.textContent).toContain('10 pts above');
  });

  it('shows "Building city benchmark…" when org_count < 10', () => {
    const benchmark = { avg_score: 70, org_count: 5, city: 'Austin' };
    render(<PulseScoreOrb {...baseProps} score={75} orgCity="Austin" benchmark={benchmark as never} />);
    expect(screen.getByTestId('orb-benchmark').textContent).toContain('Building city benchmark');
  });
});
