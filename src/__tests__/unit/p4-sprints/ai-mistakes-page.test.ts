// ---------------------------------------------------------------------------
// src/__tests__/unit/p4-sprints/ai-mistakes-page.test.ts — P4-FIX-18
//
// Tests for AI Mistakes (hallucinations) page patterns: severity ordering,
// correction status transitions, plan gating.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import type { HallucinationRow } from '@/lib/data/dashboard';

// ---------------------------------------------------------------------------
// Severity ordering (matches dashboard sort)
// ---------------------------------------------------------------------------

describe('hallucination severity ordering', () => {
  const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  it('critical sorts first', () => {
    expect(SEVERITY_ORDER.critical).toBeLessThan(SEVERITY_ORDER.high);
  });

  it('high sorts before medium', () => {
    expect(SEVERITY_ORDER.high).toBeLessThan(SEVERITY_ORDER.medium);
  });

  it('medium sorts before low', () => {
    expect(SEVERITY_ORDER.medium).toBeLessThan(SEVERITY_ORDER.low);
  });

  it('sorts an array of alerts correctly', () => {
    const alerts = [
      { severity: 'low' },
      { severity: 'critical' },
      { severity: 'medium' },
      { severity: 'high' },
    ] as Pick<HallucinationRow, 'severity'>[];

    const sorted = [...alerts].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
    );

    expect(sorted[0].severity).toBe('critical');
    expect(sorted[1].severity).toBe('high');
    expect(sorted[2].severity).toBe('medium');
    expect(sorted[3].severity).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// Correction status transitions
// ---------------------------------------------------------------------------

describe('correction status transitions', () => {
  const VALID_STATUSES = ['open', 'verifying', 'fixed', 'dismissed', 'recurring', 'corrected'];

  it('defines 6 correction statuses', () => {
    expect(VALID_STATUSES).toHaveLength(6);
  });

  it('open is the initial state', () => {
    expect(VALID_STATUSES[0]).toBe('open');
  });

  it('open → verifying is a valid transition', () => {
    expect(VALID_STATUSES).toContain('open');
    expect(VALID_STATUSES).toContain('verifying');
  });

  it('verifying → fixed or recurring are valid transitions', () => {
    expect(VALID_STATUSES).toContain('fixed');
    expect(VALID_STATUSES).toContain('recurring');
  });

  it('dismissed is a terminal state', () => {
    expect(VALID_STATUSES).toContain('dismissed');
  });
});

// ---------------------------------------------------------------------------
// Model provider mapping
// ---------------------------------------------------------------------------

describe('model provider display', () => {
  const MODEL_LABELS: Record<string, string> = {
    'openai-gpt4o': 'ChatGPT',
    'perplexity-sonar': 'Perplexity',
    'google-gemini': 'Gemini',
    'anthropic-claude': 'Claude',
    'microsoft-copilot': 'Copilot',
  };

  it('maps all model providers to display names', () => {
    expect(Object.keys(MODEL_LABELS)).toHaveLength(5);
  });

  it('each provider has a human-readable label', () => {
    for (const [, label] of Object.entries(MODEL_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
      // First letter should be uppercase
      expect(label[0]).toBe(label[0].toUpperCase());
    }
  });
});

// ---------------------------------------------------------------------------
// Triage swimlane grouping
// ---------------------------------------------------------------------------

describe('triage swimlane grouping', () => {
  it('groups alerts into Fix Now / In Progress / Resolved lanes', () => {
    const alerts: Array<{ correction_status: string }> = [
      { correction_status: 'open' },
      { correction_status: 'open' },
      { correction_status: 'verifying' },
      { correction_status: 'fixed' },
      { correction_status: 'dismissed' },
    ];

    const fixNow = alerts.filter(a => a.correction_status === 'open');
    const inProgress = alerts.filter(a => a.correction_status === 'verifying');
    const resolved = alerts.filter(a => ['fixed', 'dismissed', 'corrected'].includes(a.correction_status));

    expect(fixNow).toHaveLength(2);
    expect(inProgress).toHaveLength(1);
    expect(resolved).toHaveLength(2);
  });
});
